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
import { Supplier, SupplierTransaction, StoreId, PaymentMethod } from '../types';
import { saveCashWithdrawal } from './dailyRegister.service';

const SUPPLIERS_COLLECTION = 'suppliers';
const TRANSACTIONS_COLLECTION = 'supplierTransactions';

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
        debtStartDate: toDate(data.debtStartDate) || new Date(),
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
        debtStartDate: toDate(data.debtStartDate) || new Date(),
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
      debtStartDate: Timestamp.fromDate(supplierData.debtStartDate),
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
 * Registra un pago a un proveedor
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
    // Crear la transacción de pago
    const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    const transactionData: Omit<SupplierTransaction, 'id'> = {
      supplierId,
      type: 'payment',
      date: new Date(),
      concept,
      amount,
      storeId,
      paymentMethod,
      reference,
      observations,
      createdBy,
      createdAt: new Date(),
    };

    await setDoc(transactionRef, {
      ...transactionData,
      // Firestore rechaza campos con valor undefined explícito
      reference: reference ?? null,
      observations: observations ?? null,
      date: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

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

    // Descontar de la tienda de origen elegida — refleja el pago en el Balance General
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
  } catch (error) {
    console.error('Error al registrar pago:', error);
    throw error;
  }
};

/**
 * Registra una compra a crédito a un proveedor
 */
export const registerPurchase = async (
  supplierId: string,
  amount: number,
  concept: string,
  storeId: StoreId,
  createdBy: string,
  dueDate?: Date,
  observations?: string
): Promise<void> => {
  try {
    // Crear la transacción de compra
    const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    const transactionData: Omit<SupplierTransaction, 'id'> = {
      supplierId,
      type: 'purchase',
      date: new Date(),
      concept,
      amount,
      dueDate,
      storeId,
      observations,
      createdBy,
      createdAt: new Date(),
    };

    await setDoc(transactionRef, {
      ...transactionData,
      date: Timestamp.now(),
      dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
      createdAt: Timestamp.now(),
    });

    // Actualizar el saldo del proveedor
    const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    const supplierSnap = await getDoc(supplierRef);

    if (supplierSnap.exists()) {
      const currentBalance = supplierSnap.data().currentBalance || 0;
      const newBalance = currentBalance + amount;

      await updateDoc(supplierRef, {
        currentBalance: newBalance,
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error('Error al registrar compra:', error);
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
