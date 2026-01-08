import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';

// Datos del administrador
const ADMIN_DATA = {
  email: 'admin@distriaccell.com',
  password: 'Admin123456!',
  name: 'Administrador General',
  role: 'admin' as const,
  storeId: 'almacen-1' as const,
  status: 'activo' as const
};

export const createAdminUser = async () => {
  try {
    console.log('🔄 Creando usuario administrador...');

    // 1. Crear usuario en Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      ADMIN_DATA.email,
      ADMIN_DATA.password
    );

    const userId = userCredential.user.uid;
    console.log('✅ Usuario creado en Authentication:', userId);

    // 2. Crear documento de usuario en Firestore
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      name: ADMIN_DATA.name,
      email: ADMIN_DATA.email,
      role: ADMIN_DATA.role,
      storeId: ADMIN_DATA.storeId,
      status: ADMIN_DATA.status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Usuario guardado en Firestore');
    console.log('✨ ¡Usuario administrador creado exitosamente!');

    return userId;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️  El usuario ya existe.');
      throw new Error('El usuario ya existe. Puedes iniciar sesión directamente.');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
};
