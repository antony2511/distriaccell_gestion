import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase - DistriAccell Gestión
const firebaseConfig = {
  apiKey: "AIzaSyBWSIEEhYrN0jz_R7jW4SNW_udF-ROH7RQ",
  authDomain: "distriaccell-gestion.firebaseapp.com",
  projectId: "distriaccell-gestion",
  storageBucket: "distriaccell-gestion.firebasestorage.app",
  messagingSenderId: "236631919888",
  appId: "1:236631919888:web:1e70d19a3583f5ba2ba995"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
