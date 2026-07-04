import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { DailyRegister, StoreId, SavingsWithdrawal, CashWithdrawal } from '../types';
import { formatDateId } from '../utils/dates';

const COLLECTION_NAME = 'dailyRegisters';

/**
 * Obtiene el registro del día para un almacén específico
 */
// Función auxiliar para convertir timestamps a Date
const toDate = (timestamp: any): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  return undefined;
};

// Función auxiliar para convertir timestamps en arrays
const convertArrayTimestamps = (arr: any[]): any[] => {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map(item => ({
    ...item,
    timestamp: toDate(item.timestamp)
  }));
};

export const getDailyRegister = async (
  date: string,
  storeId: StoreId
): Promise<DailyRegister | null> => {
  try {
    const docId = `${date}_${storeId}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Migración: convertir qrPayments de número a array si es necesario
      let qrPayments = data.qrPayments || [];
      if (typeof qrPayments === 'number') {
        // Datos antiguos: convertir número a array vacío
        qrPayments = [];
      }

      return {
        ...data,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        closedAt: toDate(data.closedAt),
        notebookSales: convertArrayTimestamps(data.notebookSales || []),
        technicalServices: convertArrayTimestamps(data.technicalServices || []),
        qrPayments: convertArrayTimestamps(qrPayments),
        expenses: convertArrayTimestamps(data.expenses || []),
      } as DailyRegister;
    }

    return null;
  } catch (error) {
    console.error('Error al obtener registro diario:', error);
    throw error;
  }
};

/**
 * Crea o actualiza el registro del día
 */
// Función auxiliar para limpiar valores undefined recursivamente
const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }

  // Preservar Timestamps de Firestore y objetos Date
  if (obj instanceof Date) {
    return Timestamp.fromDate(obj);
  }

  if (obj.constructor?.name === 'Timestamp' || obj.seconds !== undefined) {
    return obj;
  }

  if (typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanUndefined(value);
      }
      return acc;
    }, {} as any);
  }

  return obj;
};

export const saveDailyRegister = async (
  register: Partial<DailyRegister>
): Promise<void> => {
  try {
    const docId = `${register.date}_${register.storeId}`;
    const docRef = doc(db, COLLECTION_NAME, docId);

    // Preparar datos eliminando campos undefined (Firestore no los acepta)
    const rawData = {
      ...register,
      updatedAt: Timestamp.now(),
      createdAt: register.createdAt || Timestamp.now(),
    };

    // Limpiar valores undefined recursivamente
    const dataToSave = cleanUndefined(rawData);

    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    console.error('Error al guardar registro diario:', error);
    throw error;
  }
};

/**
 * Cierra el registro del día
 */
export const closeDailyRegister = async (
  date: string,
  storeId: StoreId,
  actualCash: number,
  differenceJustification: string | undefined,
  closedBy: string
): Promise<void> => {
  try {
    const docId = `${date}_${storeId}`;
    const docRef = doc(db, COLLECTION_NAME, docId);

    // Obtener el registro actual para calcular expectedCash y difference
    const currentRegister = await getDailyRegister(date, storeId);
    if (!currentRegister) {
      throw new Error('No se encontró el registro diario');
    }

    // Importar función de cálculo
    const { calculateExpectedCash, calculateDifference } = await import('../utils/calculations');

    // Calcular valores
    const expectedCash = calculateExpectedCash(currentRegister);
    const difference = calculateDifference(actualCash, expectedCash);

    await updateDoc(docRef, {
      storeId, // Asegurar que el storeId se guarde correctamente
      actualCash,
      expectedCash,
      difference,
      differenceJustification,
      isClosed: true,
      closedAt: Timestamp.now(),
      closedBy,
      updatedAt: Timestamp.now(),
    });

    // Enviar notificaciones automáticas después de cerrar
    try {
      // Obtener el registro completo para enviar
      const register = await getDailyRegister(date, storeId);
      if (register) {
        // Importar dinámicamente para evitar dependencias circulares
        const { sendDailyReportNotifications } = await import('./notification.service');
        const { getNotificationSettings } = await import('./settings.service');

        // Obtener configuración de notificaciones
        const settings = await getNotificationSettings();

        if (settings.enabled && settings.managerEmail) {
          const notificationConfig: any = {
            email: {
              address: settings.managerEmail,
              name: settings.managerName || 'Gerente'
            }
          };

          // Agregar correo secundario si está configurado
          if (settings.secondaryEmail) {
            notificationConfig.secondaryEmail = {
              address: settings.secondaryEmail,
              name: settings.secondaryName || 'Destinatario'
            };
          }

          // Enviar notificación por email de forma asíncrona (no bloquear el cierre)
          sendDailyReportNotifications(register, notificationConfig)
            .then((results) => {
              console.log('✅ Reporte enviado por email:', results);
            })
            .catch((error) => {
              console.error('⚠️ Error al enviar email (no crítico):', error);
            });
        }
      }
    } catch (notificationError) {
      // No fallar el cierre si las notificaciones fallan
      console.error('⚠️ Error al enviar notificaciones (no crítico):', notificationError);
    }
  } catch (error) {
    console.error('Error al cerrar registro diario:', error);
    throw error;
  }
};

/**
 * Obtiene registros de un rango de fechas
 */
export const getDailyRegistersByRange = async (
  startDate: string,
  endDate: string,
  storeId?: StoreId
): Promise<DailyRegister[]> => {
  try {
    // Consulta simple sin índice compuesto
    const q = query(
      collection(db, COLLECTION_NAME),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    const querySnapshot = await getDocs(q);
    const registers: DailyRegister[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Filtrar por storeId en memoria si se proporciona
      if (!storeId || data.storeId === storeId) {
        // Migración: convertir qrPayments de número a array si es necesario
        let qrPayments = data.qrPayments || [];
        if (typeof qrPayments === 'number') {
          qrPayments = [];
        }

        registers.push({
          ...data,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          closedAt: toDate(data.closedAt),
          notebookSales: convertArrayTimestamps(data.notebookSales || []),
          technicalServices: convertArrayTimestamps(data.technicalServices || []),
          qrPayments: convertArrayTimestamps(qrPayments),
          expenses: convertArrayTimestamps(data.expenses || []),
        } as DailyRegister);
      }
    });

    // Ordenar por fecha descendente en memoria
    registers.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return registers;
  } catch (error) {
    console.error('Error al obtener registros por rango:', error);
    throw error;
  }
};

/**
 * Verifica si un día ya está cerrado
 */
export const isDayClosed = async (
  date: string,
  storeId: StoreId
): Promise<boolean> => {
  try {
    const register = await getDailyRegister(date, storeId);
    return register?.isClosed || false;
  } catch (error) {
    console.error('Error al verificar si el día está cerrado:', error);
    return false;
  }
};

// ========== MIGRACIÓN DE REGISTROS ==========

export const deleteDailyRegister = async (date: string, storeId: StoreId): Promise<void> => {
  const docId = `${date}_${storeId}`;
  await deleteDoc(doc(db, COLLECTION_NAME, docId));
};

export const migrateDailyRegisters = async (
  startDate: string,
  endDate: string,
  fromStoreId: StoreId,
  toStoreId: StoreId,
  migratedBy: string
): Promise<{ migrated: number; errors: string[] }> => {
  const registers = await getDailyRegistersByRange(startDate, endDate, fromStoreId);
  let migrated = 0;
  const errors: string[] = [];

  for (const register of registers) {
    try {
      const newRegister = { ...register, storeId: toStoreId };
      await saveDailyRegister(newRegister);
      await deleteDailyRegister(register.date, fromStoreId);
      migrated++;
    } catch (error) {
      errors.push(`${register.date}: ${error}`);
    }
  }

  return { migrated, errors };
};

// ========== GESTIÓN DE RETIROS DE AHORRO ==========

const SAVINGS_WITHDRAWALS_COLLECTION = 'savingsWithdrawals';

/**
 * Registra un retiro de ahorro
 */
export const saveSavingsWithdrawal = async (
  withdrawal: Omit<SavingsWithdrawal, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const docRef = doc(collection(db, SAVINGS_WITHDRAWALS_COLLECTION));

    const dataToSave = {
      ...withdrawal,
      date: Timestamp.fromDate(withdrawal.date),
      createdAt: Timestamp.now(),
    };

    await setDoc(docRef, dataToSave);
    return docRef.id;
  } catch (error) {
    console.error('Error al registrar retiro de ahorro:', error);
    throw error;
  }
};

/**
 * Obtiene retiros de ahorro, opcionalmente filtrados por tienda.
 * Registros legacy (sin storeId) se tratan como pertenecientes a 'almacen-1'.
 */
export const getSavingsWithdrawals = async (storeId?: string): Promise<SavingsWithdrawal[]> => {
  try {
    const q = query(
      collection(db, SAVINGS_WITHDRAWALS_COLLECTION),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const withdrawals: SavingsWithdrawal[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docStoreId: string | undefined = data.storeId;

      // Si hay filtro de tienda: incluir si coincide, o si es legacy (sin storeId) y filtramos almacen-1
      if (storeId) {
        const isMatch = docStoreId === storeId;
        const isLegacyForPrimary = !docStoreId && storeId === 'almacen-1';
        if (!isMatch && !isLegacyForPrimary) return;
      }

      withdrawals.push({
        id: docSnap.id,
        ...data,
        date: toDate(data.date) || new Date(),
        createdAt: toDate(data.createdAt) || new Date(),
      } as SavingsWithdrawal);
    });

    return withdrawals;
  } catch (error) {
    console.error('Error al obtener retiros de ahorro:', error);
    throw error;
  }
};

/**
 * Calcula el total acumulado de ahorro, filtrado por tienda si se especifica.
 */
export const getTotalSavings = async (storeId?: StoreId): Promise<number> => {
  try {
    const allRegisters = await getDailyRegistersByRange('2020-01-01', '2099-12-31', storeId);
    const totalSaved = allRegisters.reduce((sum, register) => sum + (register.dailySavings || 0), 0);

    const withdrawals = await getSavingsWithdrawals(storeId);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    return totalSaved - totalWithdrawn;
  } catch (error) {
    console.error('Error al calcular total de ahorro:', error);
    throw error;
  }
};

// ========== GESTIÓN DE RETIROS DE CAJA (BALANCE) ==========

const CASH_WITHDRAWALS_COLLECTION = 'cashWithdrawals';

/**
 * Registra un retiro de caja (del balance neto)
 */
export const saveCashWithdrawal = async (
  withdrawal: Omit<CashWithdrawal, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const docRef = doc(collection(db, CASH_WITHDRAWALS_COLLECTION));

    const dataToSave = {
      ...withdrawal,
      // Firestore rechaza campos con valor undefined explícito (p.ej. beneficiary/reference vacíos)
      beneficiary: withdrawal.beneficiary ?? null,
      reference: withdrawal.reference ?? null,
      date: Timestamp.fromDate(withdrawal.date),
      createdAt: Timestamp.now(),
    };

    await setDoc(docRef, dataToSave);
    return docRef.id;
  } catch (error) {
    console.error('Error al registrar retiro de caja:', error);
    throw error;
  }
};

/**
 * Obtiene todos los retiros de caja
 */
export const getCashWithdrawals = async (storeId?: StoreId | 'ambos'): Promise<CashWithdrawal[]> => {
  try {
    const q = query(
      collection(db, CASH_WITHDRAWALS_COLLECTION),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const withdrawals: CashWithdrawal[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Filtrar por storeId si se proporciona
      if (!storeId || storeId === 'ambos' || data.storeId === storeId || data.storeId === 'ambos') {
        withdrawals.push({
          id: docSnap.id,
          ...data,
          date: toDate(data.date) || new Date(),
          createdAt: toDate(data.createdAt) || new Date(),
        } as CashWithdrawal);
      }
    });

    return withdrawals;
  } catch (error) {
    console.error('Error al obtener retiros de caja:', error);
    throw error;
  }
};

/**
 * Obtiene retiros de caja por rango de fechas
 */
export const getCashWithdrawalsByRange = async (
  startDate: string,
  endDate: string,
  storeId?: StoreId | 'ambos'
): Promise<CashWithdrawal[]> => {
  try {
    const allWithdrawals = await getCashWithdrawals(storeId);

    // Filtrar por rango de fechas (el día se determina en hora Colombia,
    // no en UTC — toISOString correría al día siguiente los retiros de la noche)
    return allWithdrawals.filter(w => {
      const dateStr = formatDateId(w.date);
      return dateStr >= startDate && dateStr <= endDate;
    });
  } catch (error) {
    console.error('Error al obtener retiros de caja por rango:', error);
    throw error;
  }
};

/**
 * Calcula el total de retiros de caja
 */
export const getTotalCashWithdrawals = async (storeId?: StoreId | 'ambos'): Promise<number> => {
  try {
    const withdrawals = await getCashWithdrawals(storeId);
    return withdrawals.reduce((sum, w) => sum + w.amount, 0);
  } catch (error) {
    console.error('Error al calcular total de retiros de caja:', error);
    throw error;
  }
};

/**
 * Calcula el total de retiros de caja por tipo
 */
export const getCashWithdrawalsByType = async (storeId?: StoreId | 'ambos'): Promise<Record<string, number>> => {
  try {
    const withdrawals = await getCashWithdrawals(storeId);

    return withdrawals.reduce((acc, w) => {
      acc[w.type] = (acc[w.type] || 0) + w.amount;
      return acc;
    }, {} as Record<string, number>);
  } catch (error) {
    console.error('Error al obtener retiros por tipo:', error);
    throw error;
  }
};
