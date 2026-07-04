import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User, Store } from '../types';
import { getAllStores } from '../services/store.service';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  stores: Store[];
  activeStores: Store[];
  refreshStores: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  getStoreName: (storeId: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);

  const activeStores = stores.filter(s => s.status === 'activo');

  const refreshStores = async () => {
    try {
      const data = await getAllStores();
      setStores(data);
    } catch (error) {
      console.error('Error al cargar tiendas:', error);
    }
  };

  const getStoreName = (storeId: string): string => {
    if (storeId === 'todos' || storeId === 'ambos') return 'Todas las tiendas';
    const store = stores.find(s => s.id === storeId);
    return store?.name || storeId;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUser({
              ...userData,
              createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
              updatedAt: userData.updatedAt?.toDate?.() || userData.updatedAt
            } as User);
            setFirebaseUser(firebaseUser);
          }
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar tiendas cuando hay usuario autenticado
  useEffect(() => {
    if (user) {
      refreshStores();
    }
  }, [user?.id]);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setUser({
          ...userData,
          createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
          updatedAt: userData.updatedAt?.toDate?.() || userData.updatedAt
        } as User);
        setFirebaseUser(userCredential.user);
      } else {
        throw new Error('Usuario no encontrado en la base de datos');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
      setStores([]);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    const rolePermissions: Record<string, string[]> = {
      'super-admin': ['all'],
      'admin': ['read', 'write', 'daily-register', 'view-history', 'manage-suppliers'],
      'cajero': ['read', 'write', 'basic-reports', 'daily-register'],
      'tecnico': ['read-own', 'view-commissions'],
      'consulta': ['read']
    };

    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  const value = {
    user,
    firebaseUser,
    loading,
    stores,
    activeStores,
    refreshStores,
    login,
    logout,
    hasPermission,
    getStoreName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
