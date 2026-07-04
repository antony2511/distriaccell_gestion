import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser as deleteAuthUser
} from 'firebase/auth';
import { db, auth } from './firebase';
import type { User, StoreId } from '../types';

export type UserRole = 'super-admin' | 'admin' | 'cajero' | 'tecnico' | 'consulta';

/**
 * Obtiene todos los usuarios del sistema
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    );

    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    throw error;
  }
}

/**
 * Obtiene un usuario por su ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return null;
    }

    return {
      ...userDoc.data(),
      id: userDoc.id,
      createdAt: userDoc.data().createdAt?.toDate(),
      updatedAt: userDoc.data().updatedAt?.toDate(),
      lastLogin: userDoc.data().lastLogin?.toDate()
    } as User;
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    throw error;
  }
}

/**
 * Obtiene usuarios por rol
 */
export async function getUsersByRole(role: UserRole): Promise<User[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', role),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error obteniendo usuarios por rol:', error);
    throw error;
  }
}

/**
 * Obtiene usuarios por tienda
 */
export async function getUsersByStore(storeId: StoreId): Promise<User[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error obteniendo usuarios por tienda:', error);
    throw error;
  }
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeId: StoreId | 'ambos';
}

/**
 * Crea un nuevo usuario en Firebase Auth y Firestore
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  try {
    // 1. Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const userId = userCredential.user.uid;

    // 2. Crear documento en Firestore
    const newUser: Omit<User, 'id'> = {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      storeId: userData.storeId,
      status: 'activo',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(doc(db, 'users', userId), {
      ...newUser,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    return {
      ...newUser,
      id: userId
    };
  } catch (error: any) {
    console.error('Error creando usuario:', error);

    // Traducir errores comunes de Firebase
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('El correo electrónico ya está en uso');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('El correo electrónico no es válido');
    }

    throw error;
  }
}

interface UpdateUserData {
  name?: string;
  role?: UserRole;
  storeId?: StoreId | 'ambos';
  status?: 'activo' | 'inactivo';
}

/**
 * Actualiza los datos de un usuario
 */
export async function updateUser(userId: string, updates: UpdateUserData): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    throw error;
  }
}

/**
 * Cambia el estado de un usuario (activo/inactivo)
 */
export async function updateUserStatus(
  userId: string,
  status: 'activo' | 'inactivo'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      status,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error actualizando estado del usuario:', error);
    throw error;
  }
}

/**
 * Elimina un usuario (solo desactiva, no elimina de Firebase Auth)
 * Para seguridad, solo desactivamos en lugar de eliminar completamente
 */
export async function deactivateUser(userId: string): Promise<void> {
  try {
    await updateUserStatus(userId, 'inactivo');
  } catch (error) {
    console.error('Error desactivando usuario:', error);
    throw error;
  }
}

/**
 * Obtiene usuarios activos
 */
export async function getActiveUsers(): Promise<User[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('status', '==', 'activo'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error obteniendo usuarios activos:', error);
    throw error;
  }
}

/**
 * Actualiza la última fecha de login del usuario
 */
export async function updateLastLogin(userId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      lastLogin: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error actualizando último login:', error);
    // No lanzar error, solo log
  }
}
