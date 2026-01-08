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
import { Employee, EmployeePayment, StoreId } from '../types';

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
    const q = query(
      collection(db, EMPLOYEES_COLLECTION),
      where('storeId', '==', storeId),
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
 * Marca un pago como pagado
 */
export const markPaymentAsPaid = async (
  paymentId: string,
  amount: number,
  paymentMethod: string,
  paymentDate: Date
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
  } catch (error) {
    console.error('Error al marcar pago como pagado:', error);
    throw error;
  }
};

/**
 * Calcula las comisiones de un empleado para un período
 */
export const calculateCommissions = async (
  employeeId: string,
  storeId: StoreId,
  startDate: string,
  endDate: string
): Promise<{ salesCommission: number; servicesCommission: number; totalSales: number; totalServices: number; servicesCount: number }> => {
  try {
    const employee = await getEmployee(employeeId);
    if (!employee || !employee.commissionType || employee.commissionType === 'none') {
      return { salesCommission: 0, servicesCommission: 0, totalSales: 0, totalServices: 0, servicesCount: 0 };
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

      // Sumar TODAS las ventas del almacén en el período (globales)
      registers.forEach(register => {
        // Ventas del sistema POS
        totalSales += register.systemSales || 0;

        // Ventas del cuaderno
        if (register.notebookSales && register.notebookSales.length > 0) {
          const notebookTotal = register.notebookSales.reduce((sum, sale) => sum + sale.subtotal, 0);
          totalSales += notebookTotal;
        }

        // NO incluir servicios técnicos en ventas
        // NO incluir pagos QR en ventas
      });

      // Calcular comisión basada en el porcentaje configurado
      if (employee.commissionRate && employee.commissionRate > 0) {
        salesCommission = (totalSales * employee.commissionRate) / 100;
      }
    }

    return {
      salesCommission,
      servicesCommission,
      totalSales,
      totalServices,
      servicesCount
    };
  } catch (error) {
    console.error('Error al calcular comisiones:', error);
    throw error;
  }
};
