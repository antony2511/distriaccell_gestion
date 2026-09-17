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
  /** false mientras se cargan las tiendas; distingue "todavía no llegaron" de "no hay ninguna". */
  storesLoaded: boolean;
  /** Mensaje si la carga de tiendas falló (p. ej. permisos de Firestore). */
  storesError: string | null;
  refreshStores: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  getStoreName: (storeId: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Si el navegador no alcanza a Firestore, el SDK reintenta indefinidamente: la
 * promesa no se resuelve ni se rechaza y la pantalla queda cargando para
 * siempre. Este límite la convierte en un error visible.
 */
export const conLimiteDeTiempo = <T,>(promesa: Promise<T>, ms: number, que: string): Promise<T> =>
  Promise.race([
    promesa,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`No hubo respuesta al cargar ${que}. Revisá la conexión a internet e intentá de nuevo.`)),
        ms
      )
    ),
  ]);

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
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);

  const activeStores = stores.filter(s => s.status === 'activo');

  const refreshStores = async () => {
    try {
      setStoresError(null);
      // 8 s es holgado: medido contra la base real, esta consulta tarda ~0,3 s
      const data = await conLimiteDeTiempo(getAllStores(), 8000, 'las tiendas');
      setStores(data);
    } catch (error: any) {
      // Si esto falla, las vistas que dependen de las tiendas se quedaban en
      // blanco sin explicación: el mensaje se propaga para poder mostrarlo.
      console.error('Error al cargar tiendas:', error);
      setStoresError(
        error?.code === 'permission-denied'
          ? 'Tu usuario no tiene permiso para leer las tiendas (reglas de Firestore).'
          : error?.message || 'No se pudieron cargar las tiendas.'
      );
    } finally {
      setStoresLoaded(true);
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
          // Con límite: si esta lectura se cuelga, la app entera se quedaba en
          // "Cargando..." porque setLoading(false) está después del await.
          const userDoc = await conLimiteDeTiempo(
            getDoc(doc(db, 'users', firebaseUser.uid)),
            8000,
            'tu perfil de usuario'
          );
          if (userDoc.exists()) {
            const userData = userDoc.data() as Record<string, any>;
            setUser({
              ...userData,
              // El id viene de la sesión, no del documento: la mayoría de los
              // documentos de usuario no guardan el campo `id` (solo los creados
              // por el setup original). Sin esto, `user.id` quedaba undefined y
              // el efecto que carga las tiendas —que depende de user?.id— nunca
              // se disparaba: la lista quedaba vacía y las pantallas que la usan
              // se quedaban cargando para siempre.
              id: firebaseUser.uid,
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
        const userData = userDoc.data() as Record<string, any>;
        setUser({
          ...userData,
          id: userCredential.user.uid, // ver comentario en onAuthStateChanged
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
    if (userPermissions.includes('all')) return true;

    // Permiso concedido por usuario, no por rol (ver User.canManageGeneralCash)
    if (permission === 'general-cash') return user.canManageGeneralCash === true;

    return userPermissions.includes(permission);
  };

  const value = {
    user,
    firebaseUser,
    loading,
    stores,
    activeStores,
    storesLoaded,
    storesError,
    refreshStores,
    login,
    logout,
    hasPermission,
    getStoreName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
