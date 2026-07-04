import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Store } from '../types';

const COLLECTION = 'stores';

const INITIAL_STORES = [
  { id: 'almacen-1', name: 'Distriaccell', color: 'orange' },
  { id: 'almacen-2', name: 'accell.com', color: 'blue' },
];

const toDate = (ts: any): Date => {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  return new Date();
};

export async function getAllStores(): Promise<Store[]> {
  const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'asc')));

  if (snapshot.empty) {
    const now = Timestamp.now();
    await Promise.all(
      INITIAL_STORES.map(s =>
        setDoc(doc(db, COLLECTION, s.id), {
          name: s.name,
          color: s.color,
          status: 'activo',
          createdAt: now,
          updatedAt: now,
        })
      )
    );
    return INITIAL_STORES.map(s => ({
      ...s,
      status: 'activo' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  return snapshot.docs.map(d => ({
    ...(d.data() as Omit<Store, 'id' | 'createdAt' | 'updatedAt'>),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  }));
}

export async function createStore(
  data: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Store> {
  const docRef = doc(collection(db, COLLECTION));
  const now = Timestamp.now();
  await setDoc(docRef, { ...data, createdAt: now, updatedAt: now });
  return { ...data, id: docRef.id, createdAt: new Date(), updatedAt: new Date() };
}

export async function updateStore(
  id: string,
  data: Partial<Omit<Store, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: Timestamp.now() });
}

export async function toggleStoreStatus(
  id: string,
  status: 'activo' | 'inactivo'
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { status, updatedAt: Timestamp.now() });
}
