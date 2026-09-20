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
import { DailyRegister, ShiftData, StoreId, SavingsWithdrawal, CashWithdrawal } from '../types';
import { formatDateId } from '../utils/dates';
import { emptyShiftData, toShiftData, mergeShiftData, isShift2Open } from '../utils/sundayShifts';

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

// Datos de un turno (domingos en accell) con sus listas ya convertidas
const convertShiftData = (data: any): ShiftData | undefined => {
  if (!data) return undefined;
  return {
    ...data,
    systemSales: data.systemSales || 0,
    dailySavings: data.dailySavings || 0,
    notebookSales: convertArrayTimestamps(data.notebookSales || []),
    technicalServices: convertArrayTimestamps(data.technicalServices || []),
    qrPayments: convertArrayTimestamps(Array.isArray(data.qrPayments) ? data.qrPayments : []),
    creditSales: convertArrayTimestamps(data.creditSales || []),
    expenses: convertArrayTimestamps(data.expenses || []),
  };
};

export const readRegisterDoc = async (
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
        shift1ClosedAt: toDate(data.shift1ClosedAt),
        reportSentAt: toDate(data.reportSentAt),
        shift1Data: convertShiftData(data.shift1Data),
        shift2Data: convertShiftData(data.shift2Data),
        notebookSales: convertArrayTimestamps(data.notebookSales || []),
        technicalServices: convertArrayTimestamps(data.technicalServices || []),
        qrPayments: convertArrayTimestamps(qrPayments),
        creditSales: convertArrayTimestamps(data.creditSales || []),
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
 * Registro con el que trabaja la pantalla. Es el mismo documento, salvo con el turno 2 abierto
 * (domingos en accell): ahí la pantalla ve SOLO la tarde, que empieza de cero, y el conteo de
 * caja también arranca en cero. Reportes y demás consumidores leen el documento tal cual, cuyos
 * totales del día ya son mañana + tarde.
 */
export const getDailyRegister = async (
  date: string,
  storeId: StoreId
): Promise<DailyRegister | null> => {
  const doc_ = await readRegisterDoc(date, storeId);
  if (!doc_ || !isShift2Open(doc_)) return doc_;
  return {
    ...doc_,
    ...toShiftData(doc_.shift2Data),
    expectedCash: 0,
    actualCash: 0,
    difference: 0,
    differenceJustification: undefined,
  };
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

    let toSave: Partial<DailyRegister> = register;
    if (isShift2Open(register)) {
      // Turno 2: `register` es la tarde. Se guarda como shift2Data y los campos del día quedan
      // como mañana + tarde. El conteo de caja del día no se toca hasta el cierre del turno 2.
      const { actualCash: _a, difference: _d, differenceJustification: _j, expectedCash: _e, ...rest } = register;
      const afternoon = toShiftData(register);
      const day = mergeShiftData(register.shift1Data!, afternoon);
      const { calculateExpectedCash } = await import('../utils/calculations');
      toSave = { ...rest, ...day, expectedCash: calculateExpectedCash(day), shift2Data: afternoon };
    }

    // Preparar datos eliminando campos undefined (Firestore no los acepta)
    const rawData = {
      ...toSave,
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
 * Envía por correo el reporte del día (a los destinatarios de Configuración → Notificaciones) y
 * marca `reportSentAt`. Devuelve true si al menos un correo salió. Nunca lanza: un fallo de
 * correo no debe romper el cierre de caja.
 *
 * Los domingos de accell hay dos cierres (mañana y tarde) pero el reporte es UNO, al terminar el
 * día, y trae el arqueo de cada turno.
 */
export const sendDayReport = async (date: string, storeId: StoreId): Promise<boolean> => {
  try {
    const register = await readRegisterDoc(date, storeId);
    if (!register) return false;

    const { sendDailyReportNotifications } = await import('./notification.service');
    const { getNotificationSettings } = await import('./settings.service');
    const { hasIndependentShift2 } = await import('../utils/sundayShifts');

    const settings = await getNotificationSettings();
    if (!settings.enabled || !settings.managerEmail) return false;

    const notificationConfig: any = {
      email: { address: settings.managerEmail, name: settings.managerName || 'Gerente' },
    };
    if (settings.secondaryEmail) {
      notificationConfig.secondaryEmail = {
        address: settings.secondaryEmail,
        name: settings.secondaryName || 'Destinatario',
      };
    }

    const shiftLabel = hasIndependentShift2(register) ? 'Domingo — turnos mañana y tarde' : undefined;
    const results = await sendDailyReportNotifications(register, notificationConfig, shiftLabel);
    console.log('✅ Reporte enviado por email:', results);

    const sent = results.emailSent || results.secondaryEmailSent;
    if (sent) {
      await updateDoc(doc(db, COLLECTION_NAME, `${date}_${storeId}`), { reportSentAt: Timestamp.now() });
    }
    return sent;
  } catch (error) {
    console.error('⚠️ Error al enviar el reporte por email (no crítico):', error);
    return false;
  }
};

/**
 * Cierra el registro del día.
 *
 * Domingos en accell (doble turno): cada cierre es independiente. El del turno 2 cuenta SOLO el
 * efectivo que entró desde el cambio de turno (esperado del día − esperado del turno 1) y
 * `actualCash` es lo contado en la tarde. Los campos del día (actualCash/expectedCash/difference)
 * guardan la suma de los dos turnos. El correo NO sale en el cierre de la mañana: sale una sola
 * vez, al cerrar el turno 2 (o con "Enviar reporte del día" si ese domingo no hay turno 2).
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

    // Documento actual (con los totales del día); la tarde de un domingo está en shift2Data
    const currentRegister = await readRegisterDoc(date, storeId);
    if (!currentRegister) {
      throw new Error('No se encontró el registro diario');
    }

    // Importar función de cálculo
    const { calculateExpectedCash, calculateDifference } = await import('../utils/calculations');
    const { combineShifts, combineJustifications, isSundayDoubleShiftDay } =
      await import('../utils/sundayShifts');

    const isSecondShift = isShift2Open(currentRegister);
    // Cierre de la mañana de un domingo de accell: el reporte espera al cierre de la tarde
    const holdReport = !isSecondShift && isSundayDoubleShiftDay(date, storeId);

    if (isSecondShift) {
      // Turno 2: arqueo independiente, solo con lo registrado en la tarde
      const shift2Expected = calculateExpectedCash(toShiftData(currentRegister.shift2Data) as Partial<DailyRegister>);
      const shift2Difference = calculateDifference(actualCash, shift2Expected);
      const day = combineShifts(
        { actual: currentRegister.shift1ActualCash ?? 0, expected: currentRegister.shift1ExpectedCash ?? 0 },
        { actual: actualCash, expected: shift2Expected }
      );

      await updateDoc(docRef, {
        storeId, // Asegurar que el storeId se guarde correctamente
        // Del día = suma de los dos turnos (lo que leen Balance General y reportes)
        actualCash: day.actualCash,
        expectedCash: day.expectedCash,
        difference: day.difference,
        differenceJustification:
          combineJustifications(currentRegister.shift1Justification, differenceJustification) ?? null,
        // Del turno 2
        shift2ActualCash: actualCash,
        shift2ExpectedCash: shift2Expected,
        shift2Difference,
        shift2Justification: differenceJustification?.trim() || null,
        isClosed: true,
        closedAt: Timestamp.now(),
        closedBy,
        updatedAt: Timestamp.now(),
      });
    } else {
      const expectedCash = calculateExpectedCash(currentRegister);
      const difference = calculateDifference(actualCash, expectedCash);

      await updateDoc(docRef, {
        storeId, // Asegurar que el storeId se guarde correctamente
        actualCash,
        expectedCash,
        difference,
        differenceJustification: differenceJustification ?? null, // Firestore rechaza undefined
        isClosed: true,
        closedAt: Timestamp.now(),
        closedBy,
        updatedAt: Timestamp.now(),
      });
    }

    // Notificación automática (asíncrona, no bloquea el cierre)
    if (!holdReport) {
      void sendDayReport(date, storeId);
    }
  } catch (error) {
    console.error('Error al cerrar registro diario:', error);
    throw error;
  }
};

/**
 * Reabre el registro de un DOMINGO en accell (almacen-2) para el segundo turno.
 * El arqueo del cierre de medio día (turno 1) se preserva en los campos shift1*; el del turno 2
 * es independiente (shift2*). Solo se permite una reapertura por día.
 */
export const reopenSundayRegister = async (
  date: string,
  storeId: StoreId,
  reopenedBy: string
): Promise<void> => {
  try {
    const isSunday = new Date(date + 'T12:00:00').getDay() === 0;
    if (!isSunday) {
      throw new Error('La reapertura por cambio de turno solo aplica los domingos');
    }
    if (storeId !== 'almacen-2') {
      throw new Error('La reapertura por cambio de turno solo aplica para accell.com');
    }

    const current = await getDailyRegister(date, storeId);
    if (!current) throw new Error('No se encontró el registro diario');
    if (!current.isClosed) throw new Error('El registro no está cerrado');
    if (current.shift1ClosedAt) throw new Error('Ya se hizo el cambio de turno de este domingo');

    const docRef = doc(db, COLLECTION_NAME, `${date}_${storeId}`);
    await updateDoc(docRef, {
      // Preservar el arqueo del turno 1
      shift1ClosedAt: current.closedAt ? Timestamp.fromDate(current.closedAt) : Timestamp.now(),
      shift1ClosedBy: current.closedBy || reopenedBy,
      shift1ActualCash: current.actualCash ?? 0,
      shift1ExpectedCash: current.expectedCash ?? 0,
      shift1Difference: current.difference ?? 0,
      shift1Justification: current.differenceJustification ?? null,
      // La mañana se congela y la tarde arranca de cero (POS, cuaderno, servicios, QR, crédito,
      // gastos y ahorro). Los campos del día siguen siendo la suma (por ahora, solo la mañana).
      shift1Data: cleanUndefined(toShiftData(current)),
      shift2Data: emptyShiftData(),
      // Reabrir para el turno 2: su arqueo es independiente (cuenta solo lo que entra desde ahora)
      isClosed: false,
      closedAt: null,
      closedBy: null,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error al reabrir registro para segundo turno:', error);
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
          shift1ClosedAt: toDate(data.shift1ClosedAt),
          reportSentAt: toDate(data.reportSentAt),
          notebookSales: convertArrayTimestamps(data.notebookSales || []),
          technicalServices: convertArrayTimestamps(data.technicalServices || []),
          qrPayments: convertArrayTimestamps(qrPayments),
          creditSales: convertArrayTimestamps(data.creditSales || []),
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
 * Registros de un rango para un conjunto de tiendas (normalmente las activas) en
 * UNA sola consulta. Reemplaza el patrón `activeStores.map(s => getDailyRegistersByRange(..., s.id))`,
 * que descargaba el rango completo una vez por tienda.
 */
export const getDailyRegistersForStores = async (
  startDate: string,
  endDate: string,
  storeIds: string[]
): Promise<DailyRegister[]> => {
  const all = await getDailyRegistersByRange(startDate, endDate);
  const ids = new Set(storeIds);
  const orphans = all.filter((r) => !ids.has(r.storeId));
  if (orphans.length > 0) {
    console.warn(
      `${orphans.length} registro(s) con tienda fuera del conjunto consultado (inactiva o mal escrita):`,
      Array.from(new Set(orphans.map((r) => r.storeId)))
    );
  }
  return all.filter((r) => ids.has(r.storeId));
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
/**
 * Retiros de ahorro de un conjunto de tiendas, en una sola lectura.
 * Los retiros viejos no tienen `storeId`: se atribuyen a almacen-1, igual que
 * en `getSavingsWithdrawals`.
 */
export const getSavingsWithdrawalsForStores = async (
  storeIds: string[]
): Promise<SavingsWithdrawal[]> => {
  const todos = await getSavingsWithdrawals();
  const ids = new Set(storeIds);
  return todos.filter((w) => ids.has(w.storeId || 'almacen-1'));
};

/**
 * Ahorro disponible (acumulado − retirado) de un conjunto de tiendas, en una
 * sola lectura de cada colección en vez de una por tienda.
 */
export const getTotalSavingsForStores = async (storeIds: string[]): Promise<number> => {
  if (storeIds.length === 0) return 0;
  const [registros, retiros] = await Promise.all([
    getDailyRegistersForStores('2020-01-01', '2099-12-31', storeIds),
    getSavingsWithdrawalsForStores(storeIds),
  ]);
  const ahorrado = registros.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  const retirado = retiros.reduce((sum, w) => sum + w.amount, 0);
  return ahorrado - retirado;
};

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
