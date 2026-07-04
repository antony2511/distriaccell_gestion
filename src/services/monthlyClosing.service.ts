import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { MonthlyClosing, StoreId } from '../types';

const COLLECTION_NAME = 'monthlyClosings';

const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
  return new Date();
};

const mapDoc = (docSnap: any): MonthlyClosing => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    date: toDate(data.date),
    createdAt: toDate(data.createdAt),
  } as MonthlyClosing;
};

/**
 * Cierre mensual más reciente de una tienda (la base para calcular el balance
 * acumulado hacia adelante). null si la tienda nunca ha tenido un cierre.
 */
export const getLatestClosing = async (storeId: StoreId): Promise<MonthlyClosing | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('storeId', '==', storeId),
      orderBy('date', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return mapDoc(snap.docs[0]);
  } catch (error) {
    console.error('Error al obtener el último cierre mensual:', error);
    throw error;
  }
};

/**
 * Verifica si ya existe un cierre para esa tienda y ese período ('YYYY-MM'),
 * para bloquear un doble cierre del mismo mes.
 */
export const getClosingForPeriod = async (storeId: StoreId, period: string): Promise<MonthlyClosing | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('storeId', '==', storeId),
      where('period', '==', period)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return mapDoc(snap.docs[0]);
  } catch (error) {
    console.error('Error al verificar cierre del período:', error);
    throw error;
  }
};

/**
 * Historial completo de cierres de una tienda, más reciente primero.
 */
export const getClosingsByStore = async (storeId: StoreId): Promise<MonthlyClosing[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('storeId', '==', storeId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc);
  } catch (error) {
    console.error('Error al obtener historial de cierres:', error);
    throw error;
  }
};

/**
 * Registra un cierre mensual de caja para una tienda. `amountRemaining` pasa
 * a ser la base sobre la que se calcula el balance del siguiente período.
 */
export const saveMonthlyClosing = async (
  data: Omit<MonthlyClosing, 'id' | 'createdAt' | 'difference'>
): Promise<string> => {
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const difference = data.balanceBeforeClosing - (data.amountWithdrawn + data.amountRemaining);

    await setDoc(docRef, {
      ...data,
      difference,
      justification: data.justification ?? null,
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error al registrar el cierre mensual:', error);
    throw error;
  }
};
