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
import { Employee, EmployeePayment, PaymentMethod, StoreId } from '../types';
import { saveCashWithdrawal } from './dailyRegister.service';

const EMPLOYEES_COLLECTION = 'employees';
const PAYMENTS_COLLECTION = 'employeePayments';

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
 * Obtiene todos los empleados
 */
export const getAllEmployees = async (): Promise<Employee[]> => {
  try {
    const q = query(
      collection(db, EMPLOYEES_COLLECTION),
      orderBy('name', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const employees: Employee[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      employees.push({
        id: doc.id,
        ...data,
        hireDate: toDate(data.hireDate),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as Employee);
    });

    return employees;
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    throw error;
  }
};

/**
 * Obtiene empleados por almacén
 */
export const getEmployeesByStore = async (storeId: StoreId): Promise<Employee[]> => {
  try {
    // Consulta simple sin orderBy para evitar requerir índice compuesto
    const q = query(
      collection(db, EMPLOYEES_COLLECTION),
      where('storeId', '==', storeId)
    );
    const querySnapshot = await getDocs(q);
    const employees: Employee[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      employees.push({
        id: doc.id,
        ...data,
        hireDate: toDate(data.hireDate),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as Employee);
    });

    // Ordenar en memoria por nombre
    employees.sort((a, b) => a.name.localeCompare(b.name));

    return employees;
  } catch (error) {
    console.error('Error al obtener empleados por almacén:', error);
    throw error;
  }
};

/**
 * Obtiene un empleado por ID
 */
export const getEmployee = async (id: string): Promise<Employee | null> => {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        hireDate: toDate(data.hireDate),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as Employee;
    }

    return null;
  } catch (error) {
    console.error('Error al obtener empleado:', error);
    throw error;
  }
};

/**
 * Crea o actualiza un empleado
 */
export const saveEmployee = async (employee: Partial<Employee>): Promise<string> => {
  try {
    const docRef = employee.id
      ? doc(db, EMPLOYEES_COLLECTION, employee.id)
      : doc(collection(db, EMPLOYEES_COLLECTION));

    // Eliminar el campo id antes de guardar (ya está en la referencia del documento)
    const { id, ...employeeData } = employee;

    const dataToSave = {
      ...employeeData,
      hireDate: employee.hireDate ? Timestamp.fromDate(employee.hireDate) : Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdAt: employee.createdAt ? Timestamp.fromDate(employee.createdAt) : Timestamp.now(),
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar empleado:', error);
    throw error;
  }
};

/**
 * Elimina un empleado
 */
export const deleteEmployee = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    throw error;
  }
};

/**
 * Actualiza el estado de un empleado
 */
export const updateEmployeeStatus = async (
  id: string,
  status: 'activo' | 'inactivo' | 'vacaciones'
): Promise<void> => {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error al actualizar estado del empleado:', error);
    throw error;
  }
};

// ========== PAGOS DE EMPLEADOS ==========

/**
 * Obtiene todos los pagos de un empleado
 */
export const getEmployeePayments = async (employeeId: string): Promise<EmployeePayment[]> => {
  try {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('employeeId', '==', employeeId),
      orderBy('period', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const payments: EmployeePayment[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        ...data,
        paymentDate: toDate(data.paymentDate),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as EmployeePayment);
    });

    return payments;
  } catch (error) {
    console.error('Error al obtener pagos del empleado:', error);
    throw error;
  }
};

/**
 * Obtiene pagos por período
 */
export const getPaymentsByPeriod = async (period: string): Promise<EmployeePayment[]> => {
  try {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('period', '==', period),
      orderBy('employeeName', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const payments: EmployeePayment[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        ...data,
        paymentDate: toDate(data.paymentDate),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as EmployeePayment);
    });

    return payments;
  } catch (error) {
    console.error('Error al obtener pagos por período:', error);
    throw error;
  }
};

/**
 * Crea o actualiza un pago de empleado
 */
export const saveEmployeePayment = async (payment: Partial<EmployeePayment>): Promise<string> => {
  try {
    const docRef = payment.id
      ? doc(db, PAYMENTS_COLLECTION, payment.id)
      : doc(collection(db, PAYMENTS_COLLECTION));

    const dataToSave = {
      ...payment,
      paymentDate: payment.paymentDate ? Timestamp.fromDate(payment.paymentDate) : null,
      updatedAt: Timestamp.now(),
      createdAt: payment.createdAt ? Timestamp.fromDate(payment.createdAt) : Timestamp.now(),
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar pago:', error);
    throw error;
  }
};

/**
 * Elimina un pago de empleado. Solo se permite si el pago sigue pendiente
 * (nunca uno ya marcado como pagado / parcial, para no perder el rastro de
 * dinero que ya salió de caja).
 */
export const deleteEmployeePayment = async (paymentId: string): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const status = snap.data().status;
    if (status !== 'pendiente') {
      throw new Error('Solo se pueden eliminar pagos pendientes (no marcados como pagados).');
    }
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error al eliminar pago:', error);
    throw error;
  }
};

/**
 * Marca un pago como pagado y descuenta el monto de la tienda de origen elegida,
 * registrando un retiro de caja tipo 'nomina' para que el Balance General lo refleje.
 */
export const markPaymentAsPaid = async (
  paymentId: string,
  amount: number,
  paymentMethod: PaymentMethod,
  paymentDate: Date,
  storeId: StoreId,
  employeeName: string,
  period: string,
  authorizedBy: string,
  authorizedByName: string
): Promise<void> => {
  try {
    const docRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    await updateDoc(docRef, {
      status: 'pagado',
      amountPaid: amount,
      paymentMethod,
      paymentDate: Timestamp.fromDate(paymentDate),
      updatedAt: Timestamp.now(),
    });

    await saveCashWithdrawal({
      date: paymentDate,
      type: 'nomina',
      amount,
      concept: `Nómina — ${employeeName} (${period})`,
      beneficiary: employeeName,
      authorizedBy,
      authorizedByName,
      storeId,
    });
  } catch (error) {
    console.error('Error al marcar pago como pagado:', error);
    throw error;
  }
};

/**
 * Desde este período (inclusive) los servicios técnicos dejan de comisionar
 * para vendedores. Administradores no cambian.
 */
const VENDEDOR_SIN_SERVICIOS_DESDE = '2026-07-01';

/**
 * Meta de ventas del período por almacén (base desde la que arranca la escala
 * escalonada cuando el empleado comisiona sobre UNA sola tienda).
 */
export const STORE_SALES_GOAL: Record<string, number> = {
  'almacen-1': 15_000_000, // Distriaccell
  'almacen-2': 33_000_000, // accell.com
};

/**
 * Base fija de la escala para empleados que comisionan sobre MÁS DE UNA tienda
 * (p. ej. un administrador con varias tiendas asignadas). No se suman las metas
 * individuales: la escala arranca en este mínimo.
 */
export const MULTI_STORE_SALES_GOAL = 45_000_000;

const COMMISSION_BLOCK_SIZE = 4_000_000;
const COMMISSION_BLOCK_INCREMENT = 0.001; // +0.1% por cada bloque completo, igual para todos

export interface TieredCommissionResult {
  goalBase: number;
  excess: number;
  blocksReached: number;
  baseRate: number;
  effectiveRate: number;
  commission: number;
}

/**
 * Comisión escalonada por ventas. La tasa base (baseRatePercent) es manual
 * por empleado (employee.commissionRate) — no se fija por rol, para poder
 * pagar distinto a cada vendedor/administrador. Por cada bloque completo de
 * COMMISSION_BLOCK_SIZE por encima de la meta, ESE bloque paga con la tasa
 * incrementada (cálculo por tramos, como una tabla progresiva): las ventas
 * que ya pagaron a una tasa anterior nunca se recalculan a la tasa nueva.
 */
export const calculateTieredSalesCommission = (
  totalSales: number,
  baseRatePercent: number,
  goalBase: number
): TieredCommissionResult => {
  const baseRate = baseRatePercent / 100;
  const excess = Math.max(0, totalSales - goalBase);
  const blocksReached = Math.floor(excess / COMMISSION_BLOCK_SIZE);

  if (blocksReached === 0) {
    const commission = Math.round(totalSales * baseRate);
    return { goalBase, excess, blocksReached, baseRate, effectiveRate: baseRate, commission };
  }

  let commission = goalBase * baseRate;
  for (let i = 1; i <= blocksReached; i++) {
    commission += COMMISSION_BLOCK_SIZE * (baseRate + i * COMMISSION_BLOCK_INCREMENT);
  }
  const remainder = excess - blocksReached * COMMISSION_BLOCK_SIZE;
  if (remainder > 0) {
    commission += remainder * (baseRate + blocksReached * COMMISSION_BLOCK_INCREMENT);
  }
  commission = Math.round(commission);

  return {
    goalBase,
    excess,
    blocksReached,
    baseRate,
    effectiveRate: totalSales > 0 ? commission / totalSales : baseRate,
    commission,
  };
};

/**
 * Calcula las comisiones de un empleado para un período
 */
export const calculateCommissions = async (
  employeeId: string,
  storeId: StoreId,
  startDate: string,
  endDate: string
): Promise<{ salesCommission: number; servicesCommission: number; totalSales: number; totalServices: number; servicesCount: number; servicesIncludedInSales: boolean; tieredCommission: TieredCommissionResult | null; commissionStoreIds: StoreId[] }> => {
  try {
    const employee = await getEmployee(employeeId);
    if (!employee || !employee.commissionType || employee.commissionType === 'none') {
      return { salesCommission: 0, servicesCommission: 0, totalSales: 0, totalServices: 0, servicesCount: 0, servicesIncludedInSales: false, tieredCommission: null, commissionStoreIds: [] };
    }

    // Importar getDailyRegistersByRange dinámicamente para evitar dependencias circulares
    const { getDailyRegistersByRange } = await import('./dailyRegister.service');

    // Obtener todos los registros del período para el almacén
    const registers = await getDailyRegistersByRange(startDate, endDate, storeId);

    let totalServices = 0;
    let servicesCount = 0;
    let servicesCommission = 0;
    let totalSales = 0;
    let salesCommission = 0;
    let servicesIncludedInSales = false;
    let tieredCommission: TieredCommissionResult | null = null;
    let commissionStoreIds: StoreId[] = [storeId];

    // COMISIÓN POR SERVICIOS - Solo para técnicos
    if (employee.commissionType === 'service' && employee.role === 'tecnico') {
      // Recorrer todos los registros y buscar servicios del técnico
      registers.forEach(register => {
        if (register.technicalServices && register.technicalServices.length > 0) {
          // Filtrar servicios por el nombre del técnico
          const technicianServices = register.technicalServices.filter(
            service => service.technicianName.toLowerCase().includes(employee.name.toLowerCase()) ||
                      employee.name.toLowerCase().includes(service.technicianName.toLowerCase())
          );

          // Sumar el total de servicios del técnico
          technicianServices.forEach(service => {
            totalServices += service.amount;
            servicesCount++;
          });
        }
      });

      // Calcular comisión basada en el porcentaje configurado
      if (employee.commissionRate && employee.commissionRate > 0) {
        servicesCommission = (totalServices * employee.commissionRate) / 100;
      }
    }

    // COMISIÓN POR VENTAS - Solo para vendedores y administradores
    if (employee.commissionType === 'sales' &&
        (employee.role === 'vendedor' || employee.role === 'administrador')) {

      console.log(`=== CÁLCULO DE COMISIONES PARA ${employee.name} ===`);
      console.log(`Período: ${startDate} a ${endDate}`);
      console.log(`Almacén: ${storeId}`);
      console.log(`Rol: ${employee.role}`);

      // Tiendas cuyas ventas comisionan para este empleado:
      //  1. Si tiene commissionStoreIds configuradas explícitamente, se usan esas.
      //  2. Caso legado: admin de accell.com (almacen-2) comisiona sobre AMBOS almacenes.
      //  3. Por defecto: solo su tienda asignada.
      if (employee.commissionStoreIds && employee.commissionStoreIds.length > 0) {
        commissionStoreIds = [...employee.commissionStoreIds];
      } else if (employee.role === 'administrador' && employee.storeId === 'almacen-2') {
        commissionStoreIds = ['almacen-2', 'almacen-1'];
      } else {
        commissionStoreIds = [storeId];
      }
      const isMultiStore = commissionStoreIds.length > 1;
      if (isMultiStore) {
        console.log(`🔥 Comisión multi-tienda: ${commissionStoreIds.join(', ')}`);
      }

      // Registros de todas las tiendas que comisionan (reusa la consulta ya hecha
      // para storeId; las demás se consultan aparte).
      let registersToProcess: typeof registers = [];
      for (const sId of commissionStoreIds) {
        const storeRegisters = sId === storeId
          ? registers
          : await getDailyRegistersByRange(startDate, endDate, sId);
        registersToProcess = registersToProcess.concat(storeRegisters);
      }

      console.log(`Total de registros a procesar: ${registersToProcess.length}`);

      // Desde julio 2026 los servicios técnicos NO comisionan para vendedores.
      // Períodos anteriores conservan la regla vieja para que un recálculo
      // de una quincena ya pagada no cambie el valor.
      servicesIncludedInSales = !(employee.role === 'vendedor' && startDate >= VENDEDOR_SIN_SERVICIOS_DESDE);
      if (!servicesIncludedInSales) {
        console.log('Regla desde 2026-07: servicios técnicos excluidos de la comisión del vendedor');
      }

      // Sumar TODAS las ventas del período (globales o de ambos almacenes si aplica)
      registersToProcess.forEach(register => {
        const systemSales = register.systemSales || 0;
        const notebookTotal = register.notebookSales?.reduce((sum, sale) => sum + sale.subtotal, 0) || 0;
        const servicesTotal = register.technicalServices?.reduce((sum, s) => sum + s.amount, 0) || 0;
        const qrTotal = register.qrPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

        console.log(`[${register.date}] Sistema: ${systemSales}, Cuaderno: ${notebookTotal}, Servicios: ${servicesTotal}, QR: ${qrTotal}`);

        // Ventas del sistema POS
        totalSales += systemSales;

        // Ventas del cuaderno
        totalSales += notebookTotal;

        // Las ventas a crédito (celulares/tablet) NO se suman aquí: el equipo ya
        // queda registrado en la venta del sistema (systemSales) ese día, así que
        // ya comisiona por esa vía. Sumarlo desde creditSales lo contaría doble.

        // Servicios técnicos: comisionan para administradores; para vendedores
        // solo en períodos anteriores a julio 2026
        if (servicesIncludedInSales) {
          totalSales += servicesTotal;
        }
        totalServices += servicesTotal;
        servicesCount += register.technicalServices?.length || 0;

        // NO incluir pagos QR en ventas (son pagos, no ventas)
      });

      console.log(`Total ventas + servicios calculados: ${totalSales}`);

      // Comisión escalonada: la tasa base es employee.commissionRate (manual
      // por empleado); por cada bloque completo de ventas sobre la meta se suma
      // 0.1% SOLO a ese bloque.
      if (employee.commissionRate && employee.commissionRate > 0) {
        // Meta base de la escala:
        //  - multi-tienda → base fija MULTI_STORE_SALES_GOAL ($45M), no la suma
        //    de las metas individuales.
        //  - una sola tienda → la meta de esa tienda.
        const goalBase = isMultiStore
          ? MULTI_STORE_SALES_GOAL
          : (STORE_SALES_GOAL[commissionStoreIds[0]] ?? 0);
        tieredCommission = calculateTieredSalesCommission(totalSales, employee.commissionRate, goalBase);
        salesCommission = tieredCommission.commission;
        console.log(
          `Meta: ${goalBase}, Excedente: ${tieredCommission.excess}, Bloques: ${tieredCommission.blocksReached}, ` +
          `Tasa base: ${employee.commissionRate}%, Tasa efectiva: ${(tieredCommission.effectiveRate * 100).toFixed(3)}%, ` +
          `Comisión: ${salesCommission}`
        );
      }
    }

    return {
      salesCommission,
      servicesCommission,
      totalSales,
      totalServices,
      servicesCount,
      servicesIncludedInSales,
      tieredCommission,
      commissionStoreIds
    };
  } catch (error) {
    console.error('Error al calcular comisiones:', error);
    throw error;
  }
};
