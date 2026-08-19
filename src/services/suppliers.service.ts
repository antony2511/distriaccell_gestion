import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Supplier, SupplierInvoice, SupplierTransaction, StoreId, PaymentMethod } from '../types';
import { saveCashWithdrawal } from './dailyRegister.service';

const SUPPLIERS_COLLECTION = 'suppliers';
const TRANSACTIONS_COLLECTION = 'supplierTransactions';
const INVOICES_COLLECTION = 'supplierInvoices';

// Función auxiliar para convertir timestamps
const toDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  return undefined;
};

/**
 * Calcula los días sin abono desde la última fecha de pago
 */
export const calculateDaysSinceLastPayment = (lastPaymentDate?: Date): number => {
  if (!lastPaymentDate) return 9999; // Si nunca ha pagado, retornar un número alto

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastPaymentDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Obtiene el color según los días sin abono
 */
export const getPaymentStatusColor = (days: number): 'green' | 'orange' | 'red' => {
  if (days <= 10) return 'green';
  if (days <= 20) return 'orange';
  return 'red';
};

/**
 * Indica si una factura está vencida (tiene fecha límite pasada y saldo pendiente)
 */
export const isInvoiceOverdue = (invoice: SupplierInvoice): boolean => {
  if (!invoice.dueDate || invoice.balance <= 0) return false;
  return invoice.dueDate.getTime() < new Date().getTime();
};

/**
 * Obtiene todos los proveedores
 */
export const getAllSuppliers = async (): Promise<Supplier[]> => {
  try {
    const q = query(
      collection(db, SUPPLIERS_COLLECTION),
      orderBy('name', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const suppliers: Supplier[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      suppliers.push({
        id: doc.id,
        ...data,
        debtStartDate: toDate(data.debtStartDate),
        lastPaymentDate: toDate(data.lastPaymentDate),
        createdAt: toDate(data.createdAt) || new Date(),
        updatedAt: toDate(data.updatedAt) || new Date(),
      } as Supplier);
    });

    return suppliers;
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    throw error;
  }
};

/**
 * Obtiene un proveedor por ID
 */
export const getSupplierById = async (id: string): Promise<Supplier | null> => {
  try {
    const docRef = doc(db, SUPPLIERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        debtStartDate: toDate(data.debtStartDate),
        lastPaymentDate: toDate(data.lastPaymentDate),
        createdAt: toDate(data.createdAt) || new Date(),
        updatedAt: toDate(data.updatedAt) || new Date(),
      } as Supplier;
    }

    return null;
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    throw error;
  }
};

/**
 * Crea un nuevo proveedor
 */
export const createSupplier = async (
  supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const docRef = doc(collection(db, SUPPLIERS_COLLECTION));

    const dataToSave = {
      ...supplierData,
      debtStartDate: supplierData.debtStartDate ? Timestamp.fromDate(supplierData.debtStartDate) : null,
      lastPaymentDate: supplierData.lastPaymentDate ? Timestamp.fromDate(supplierData.lastPaymentDate) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(docRef, dataToSave);
    return docRef.id;
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    throw error;
  }
};

/**
 * Actualiza un proveedor
 */
export const updateSupplier = async (
  id: string,
  supplierData: Partial<Supplier>
): Promise<void> => {
  try {
    const docRef = doc(db, SUPPLIERS_COLLECTION, id);

    const dataToUpdate = {
      ...supplierData,
      debtStartDate: supplierData.debtStartDate ? Timestamp.fromDate(supplierData.debtStartDate) : undefined,
      lastPaymentDate: supplierData.lastPaymentDate ? Timestamp.fromDate(supplierData.lastPaymentDate) : undefined,
      updatedAt: Timestamp.now(),
    };

    // Remover campos undefined
    Object.keys(dataToUpdate).forEach(key => {
      if (dataToUpdate[key as keyof typeof dataToUpdate] === undefined) {
        delete dataToUpdate[key as keyof typeof dataToUpdate];
      }
    });

    await updateDoc(docRef, dataToUpdate);
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    throw error;
  }
};

/**
 * Elimina un proveedor
 */
export const deleteSupplier = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, SUPPLIERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    throw error;
  }
};

/**
 * Registra un pago a un proveedor. El monto se aplica automáticamente (FIFO) a las
 * facturas pendientes del proveedor, empezando por la de fecha de inicio más antigua.
 * Si el proveedor no tiene facturas registradas (dato legado) o el pago excede el total
 * de facturas pendientes, el sobrante queda como un abono general sin factura asociada.
 */
export const registerPayment = async (
  supplierId: string,
  amount: number,
  concept: string,
  storeId: StoreId,
  paymentMethod: PaymentMethod,
  createdBy: string,
  authorizedByName: string,
  reference?: string,
  observations?: string
): Promise<void> => {
  try {
    const pendingInvoices = (await getSupplierInvoices(supplierId))
      .filter((invoice) => invoice.balance > 0)
      .sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());

    // Repartir el pago entre las facturas pendientes, de la más antigua a la más nueva
    let remaining = amount;
    const allocations: { invoiceId: string | null; invoiceNumber: string | null; applied: number }[] = [];

    for (const invoice of pendingInvoices) {
      if (remaining <= 0) break;
      const applied = Math.min(invoice.balance, remaining);
      allocations.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber ?? null, applied });
      remaining -= applied;

      const newInvoiceBalance = invoice.balance - applied;
      await updateDoc(doc(db, INVOICES_COLLECTION, invoice.id), {
        balance: newInvoiceBalance,
        status: newInvoiceBalance <= 0 ? 'paid' : 'partial',
        updatedAt: Timestamp.now(),
      });
    }

    // Sin facturas pendientes que cubran el monto (proveedor sin facturas, o pago mayor a la deuda)
    if (remaining > 0) {
      allocations.push({ invoiceId: null, invoiceNumber: null, applied: remaining });
    }

    // Una transacción de pago por cada factura afectada, para trazabilidad clara en el historial
    for (const allocation of allocations) {
      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      await setDoc(transactionRef, {
        supplierId,
        type: 'payment',
        concept: allocation.invoiceNumber
          ? `${concept} — Factura ${allocation.invoiceNumber}`
          : concept,
        amount: allocation.applied,
        storeId,
        paymentMethod,
        reference: reference ?? null,
        observations: observations ?? null,
        invoiceId: allocation.invoiceId,
        invoiceNumber: allocation.invoiceNumber,
        createdBy,
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
    }

    // Actualizar el saldo del proveedor y la fecha del último pago
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    const supplierSnap = await getDoc(supplierRef);
    let supplierName = 'Proveedor';

    if (supplierSnap.exists()) {
      const supplierData = supplierSnap.data();
      supplierName = supplierData.name || supplierName;
      const currentBalance = supplierData.currentBalance || 0;
      const newBalance = Math.max(0, currentBalance - amount); // No permitir balance negativo

      await updateDoc(supplierRef, {
        currentBalance: newBalance,
        lastPaymentDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    // Descontar de la tienda de origen elegida — refleja el pago en el Balance General.
    // Solo aplica a pagos en efectivo: los pagos por banco/nequi/transferencia salen de la
    // cuenta bancaria, no de la caja, y no deben restar del balance en efectivo.
    if (paymentMethod === 'efectivo') {
      await saveCashWithdrawal({
        date: new Date(),
        type: 'proveedor',
        amount,
        concept: concept || `Pago a proveedor — ${supplierName}`,
        beneficiary: supplierName,
        reference,
        authorizedBy: createdBy,
        authorizedByName,
        storeId,
      });
    }
  } catch (error) {
    console.error('Error al registrar pago:', error);
    throw error;
  }
};

/**
 * Obtiene todas las facturas de un proveedor, ordenadas por fecha de inicio (más antigua primero)
 */
export const getSupplierInvoices = async (supplierId: string): Promise<SupplierInvoice[]> => {
  try {
    // Consulta sin orderBy para evitar necesidad de índice compuesto
    const q = query(
      collection(db, INVOICES_COLLECTION),
      where('supplierId', '==', supplierId)
    );
    const querySnapshot = await getDocs(q);
    const invoices: SupplierInvoice[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      invoices.push({
        id: doc.id,
        ...data,
        issueDate: toDate(data.issueDate) || new Date(),
        dueDate: toDate(data.dueDate),
        createdAt: toDate(data.createdAt) || new Date(),
        updatedAt: toDate(data.updatedAt) || new Date(),
      } as SupplierInvoice);
    });

    return invoices.sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());
  } catch (error) {
    console.error('Error al obtener facturas del proveedor:', error);
    throw error;
  }
};

/**
 * Registra una nueva factura (compra a crédito) de un proveedor. El monto queda como
 * saldo pendiente de esa factura y se suma al saldo total del proveedor.
 */
export const createSupplierInvoice = async (
  supplierId: string,
  invoiceData: {
    invoiceNumber?: string;
    concept: string;
    amount: number;
    issueDate: Date;
    dueDate?: Date;
    storeId: StoreId;
  },
  createdBy: string
): Promise<string> => {
  try {
    const invoiceRef = doc(collection(db, INVOICES_COLLECTION));
    await setDoc(invoiceRef, {
      supplierId,
      invoiceNumber: invoiceData.invoiceNumber ?? null,
      concept: invoiceData.concept,
      amount: invoiceData.amount,
      balance: invoiceData.amount,
      status: 'pending',
      issueDate: Timestamp.fromDate(invoiceData.issueDate),
      dueDate: invoiceData.dueDate ? Timestamp.fromDate(invoiceData.dueDate) : null,
      storeId: invoiceData.storeId,
      createdBy,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Transacción de compra asociada, para que aparezca en el historial de movimientos
    const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    await setDoc(transactionRef, {
      supplierId,
      type: 'purchase',
      concept: invoiceData.invoiceNumber
        ? `${invoiceData.concept} — Factura ${invoiceData.invoiceNumber}`
        : invoiceData.concept,
      amount: invoiceData.amount,
      dueDate: invoiceData.dueDate ? Timestamp.fromDate(invoiceData.dueDate) : null,
      storeId: invoiceData.storeId,
      invoiceId: invoiceRef.id,
      invoiceNumber: invoiceData.invoiceNumber ?? null,
      createdBy,
      date: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    // Actualizar el saldo del proveedor y, si es la factura más antigua, su fecha de inicio
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    const supplierSnap = await getDoc(supplierRef);

    if (supplierSnap.exists()) {
      const supplierData = supplierSnap.data();
      const currentBalance = supplierData.currentBalance || 0;
      const existingStart = toDate(supplierData.debtStartDate);
      const newStart = !existingStart || invoiceData.issueDate < existingStart
        ? invoiceData.issueDate
        : existingStart;

      await updateDoc(supplierRef, {
        currentBalance: currentBalance + invoiceData.amount,
        debtStartDate: Timestamp.fromDate(newStart),
        updatedAt: Timestamp.now(),
      });
    }

    return invoiceRef.id;
  } catch (error) {
    console.error('Error al registrar factura:', error);
    throw error;
  }
};

/**
 * Elimina una factura que todavía no ha recibido ningún pago (balance === amount).
 * Facturas con abonos parciales o pagadas no se pueden eliminar, para no perder trazabilidad.
 */
export const deleteSupplierInvoice = async (invoice: SupplierInvoice): Promise<void> => {
  try {
    if (invoice.balance !== invoice.amount) {
      throw new Error('No se puede eliminar una factura que ya tiene abonos registrados');
    }

    await deleteDoc(doc(db, INVOICES_COLLECTION, invoice.id));

    const supplierRef = doc(db, SUPPLIERS_COLLECTION, invoice.supplierId);
    const supplierSnap = await getDoc(supplierRef);

    if (supplierSnap.exists()) {
      const currentBalance = supplierSnap.data().currentBalance || 0;
      await updateDoc(supplierRef, {
        currentBalance: Math.max(0, currentBalance - invoice.amount),
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error('Error al eliminar factura:', error);
    throw error;
  }
};

/**
 * Obtiene todas las transacciones de un proveedor
 */
export const getSupplierTransactions = async (
  supplierId: string
): Promise<SupplierTransaction[]> => {
  try {
    // Consulta sin orderBy para evitar necesidad de índice compuesto
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('supplierId', '==', supplierId)
    );
    const querySnapshot = await getDocs(q);
    const transactions: SupplierTransaction[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        ...data,
        date: toDate(data.date) || new Date(),
        dueDate: toDate(data.dueDate),
        createdAt: toDate(data.createdAt) || new Date(),
      } as SupplierTransaction);
    });

    // Ordenar por fecha en el cliente (más reciente primero)
    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    throw error;
  }
};
