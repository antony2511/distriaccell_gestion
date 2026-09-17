import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
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

/**
 * Firestore por defecto habla con Google usando WebChannel sobre QUIC (HTTP/3,
 * UDP). En redes que filtran o degradan UDP —como la de algunos locales— la
 * conexión no falla: se queda reintentando (`ERR_QUIC_PROTOCOL_ERROR /
 * QUIC_TOO_MANY_RTOS` en la consola) y las consultas nunca responden, así que
 * la pantalla queda cargando para siempre.
 *
 * `experimentalForceLongPolling` obliga al SDK a usar peticiones HTTPS
 * normales, que atraviesan esas redes sin problema. La app no usa `onSnapshot`
 * (solo lecturas puntuales), así que no se pierde nada: el costo es un poco más
 * de latencia en escenarios de tiempo real que aquí no existen.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
