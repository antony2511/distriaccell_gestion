import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Limpia todas las colecciones de la base de datos
 * ADVERTENCIA: Esta operación es irreversible
 */
export async function clearDatabase() {
  const collections = [
    'users',
    'employees',
    'employeePayments',
    'dailyRegisters',
    'suppliers',
    'supplierTransactions',
    'savingsWithdrawals',
    'settings'
  ];

  console.log('🗑️  Iniciando limpieza de base de datos...');

  for (const collectionName of collections) {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      console.log(`📂 Limpiando colección: ${collectionName} (${querySnapshot.size} documentos)`);

      const deletePromises = querySnapshot.docs.map(document =>
        deleteDoc(doc(db, collectionName, document.id))
      );

      await Promise.all(deletePromises);
      console.log(`✅ Colección ${collectionName} limpiada`);
    } catch (error) {
      console.error(`❌ Error limpiando ${collectionName}:`, error);
    }
  }

  console.log('✨ Base de datos limpiada completamente');
}

/**
 * Limpia solo una colección específica
 */
export async function clearCollection(collectionName: string) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    console.log(`📂 Limpiando colección: ${collectionName} (${querySnapshot.size} documentos)`);

    const deletePromises = querySnapshot.docs.map(document =>
      deleteDoc(doc(db, collectionName, document.id))
    );

    await Promise.all(deletePromises);
    console.log(`✅ Colección ${collectionName} limpiada`);
  } catch (error) {
    console.error(`❌ Error limpiando ${collectionName}:`, error);
    throw error;
  }
}
