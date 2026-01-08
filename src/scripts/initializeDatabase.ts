/**
 * Script para inicializar las colecciones de Firestore
 * Ejecutar solo UNA VEZ para configurar la estructura inicial
 */

import { doc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export const initializeDatabase = async () => {
  try {
    console.log('🔄 Inicializando base de datos...\n');

    // 1. COLECCIÓN: stores (Tiendas/Almacenes)
    console.log('📦 Creando tiendas...');
    await setDoc(doc(db, 'stores', 'almacen-1'), {
      id: 'almacen-1',
      name: 'Distriaccell',
      address: 'Calle Principal #123',
      phone: '3001234567',
      status: 'activo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    await setDoc(doc(db, 'stores', 'almacen-2'), {
      id: 'almacen-2',
      name: 'accell.com',
      address: 'Avenida Norte #456',
      phone: '3009876543',
      status: 'activo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log('✅ Tiendas creadas\n');

    // 2. COLECCIÓN: employees (Empleados y Técnicos)
    console.log('👥 Creando empleados de ejemplo...');

    // Técnico para Distriaccell
    await setDoc(doc(db, 'employees', 'tech-001'), {
      id: 'tech-001',
      name: 'Jaime Rodríguez',
      email: 'jaime@distriaccell.com',
      role: 'tecnico',
      storeId: 'almacen-1',
      phone: '3001111111',
      salary: 1500000,
      commissionRate: 0.20, // 20% de comisión
      status: 'activo',
      hireDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Técnico para accell.com
    await setDoc(doc(db, 'employees', 'tech-002'), {
      id: 'tech-002',
      name: 'Carlos Pérez',
      email: 'carlos@distriaccell.com',
      role: 'tecnico',
      storeId: 'almacen-2',
      phone: '3002222222',
      salary: 1500000,
      commissionRate: 0.20,
      status: 'activo',
      hireDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Cajero para Distriaccell
    await setDoc(doc(db, 'employees', 'cashier-001'), {
      id: 'cashier-001',
      name: 'María González',
      email: 'maria@distriaccell.com',
      role: 'cajero',
      storeId: 'almacen-1',
      phone: '3003333333',
      salary: 1300000,
      commissionRate: 0,
      status: 'activo',
      hireDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Empleados creados\n');

    // 2B. COLECCIÓN: users (Usuarios del sistema con acceso)
    console.log('👤 Creando usuarios del sistema...');
    console.log('⚠️  NOTA: Estos usuarios necesitarán cuentas de autenticación en Firebase Auth');
    console.log('   Puedes crearlas manualmente en la consola de Firebase o con la página de Setup\n');

    // Administrador de Distriaccell
    await setDoc(doc(db, 'users', 'user-admin-1'), {
      id: 'user-admin-1',
      name: 'Administrador Distriaccell',
      email: 'admin.distriaccell@distriaccell.com',
      role: 'admin',
      storeId: 'almacen-1',
      status: 'activo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Administrador de accell.com
    await setDoc(doc(db, 'users', 'user-admin-2'), {
      id: 'user-admin-2',
      name: 'Administrador Accell.com',
      email: 'admin.accell@distriaccell.com',
      role: 'admin',
      storeId: 'almacen-2',
      status: 'activo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Jefe/Gerente General (acceso a ambas tiendas)
    await setDoc(doc(db, 'users', 'user-boss'), {
      id: 'user-boss',
      name: 'Gerente General',
      email: 'gerente@distriaccell.com',
      role: 'super-admin',
      storeId: 'almacen-1', // Default store, pero tendrá acceso a ambas
      status: 'activo',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Usuarios del sistema creados\n');

    // 3. COLECCIÓN: suppliers (Proveedores) - Estructura simplificada
    console.log('🏢 Creando proveedores de ejemplo...');

    await setDoc(doc(db, 'suppliers', 'supp-001'), {
      name: 'Distribuidora Tech S.A.S',
      currentBalance: 2500000,
      debtStartDate: Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Hace 30 días
      lastPaymentDate: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)), // Hace 5 días
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    await setDoc(doc(db, 'suppliers', 'supp-002'), {
      name: 'Accesorios Móviles LTDA',
      currentBalance: 800000,
      debtStartDate: Timestamp.fromDate(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)), // Hace 45 días
      lastPaymentDate: Timestamp.fromDate(new Date(Date.now() - 18 * 24 * 60 * 60 * 1000)), // Hace 18 días
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Proveedores creados\n');

    // 4. COLECCIÓN: categories (Categorías para gastos y productos)
    console.log('🏷️  Creando categorías...');

    const expenseCategories = [
      { id: 'rent', name: 'Arriendo', type: 'expense', icon: 'home' },
      { id: 'utilities', name: 'Servicios Públicos', type: 'expense', icon: 'bolt' },
      { id: 'salaries', name: 'Salarios', type: 'expense', icon: 'payments' },
      { id: 'transport', name: 'Transporte', type: 'expense', icon: 'local_shipping' },
      { id: 'supplies', name: 'Insumos', type: 'expense', icon: 'inventory' },
      { id: 'maintenance', name: 'Mantenimiento', type: 'expense', icon: 'build' },
      { id: 'marketing', name: 'Publicidad', type: 'expense', icon: 'campaign' },
      { id: 'other', name: 'Otros', type: 'expense', icon: 'more_horiz' }
    ];

    for (const category of expenseCategories) {
      await setDoc(doc(db, 'categories', category.id), {
        ...category,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }

    console.log('✅ Categorías creadas\n');

    // 5. COLECCIÓN: settings (Configuraciones del sistema)
    console.log('⚙️  Creando configuraciones...');

    await setDoc(doc(db, 'settings', 'general'), {
      companyName: 'DistriAccell',
      currency: 'COP',
      timezone: 'America/Bogota',
      dateFormat: 'DD/MM/YYYY',
      fiscalYearStart: '01/01',
      autoSaveInterval: 30, // segundos
      maxDifferencePercentage: 5, // %
      requireJustificationAbove: 5, // %
      requireConfirmationAbove: 10, // %
      updatedAt: Timestamp.now()
    });

    console.log('✅ Configuraciones creadas\n');

    // 6. COLECCIÓN: paymentMethods (Métodos de pago)
    console.log('💳 Creando métodos de pago...');

    const paymentMethods = [
      { id: 'efectivo', name: 'Efectivo', isDigital: false },
      { id: 'qr', name: 'QR/Transferencia', isDigital: true },
      { id: 'tarjeta', name: 'Tarjeta', isDigital: true }
    ];

    for (const method of paymentMethods) {
      await setDoc(doc(db, 'paymentMethods', method.id), {
        ...method,
        createdAt: Timestamp.now()
      });
    }

    console.log('✅ Métodos de pago creados\n');

    // 7. COLECCIÓN: serviceTypes (Tipos de servicio técnico)
    console.log('🔧 Creando tipos de servicio...');

    const serviceTypes = [
      { id: 'screen', name: 'Cambio de Pantalla', avgPrice: 150000 },
      { id: 'battery', name: 'Cambio de Batería', avgPrice: 80000 },
      { id: 'charging', name: 'Pin de Carga', avgPrice: 50000 },
      { id: 'software', name: 'Formateo/Software', avgPrice: 40000 },
      { id: 'unlock', name: 'Liberación', avgPrice: 60000 },
      { id: 'water', name: 'Daño por Agua', avgPrice: 120000 },
      { id: 'other', name: 'Otro', avgPrice: 0 }
    ];

    for (const service of serviceTypes) {
      await setDoc(doc(db, 'serviceTypes', service.id), {
        ...service,
        createdAt: Timestamp.now()
      });
    }

    console.log('✅ Tipos de servicio creados\n');

    console.log('✨ ¡Base de datos inicializada correctamente!\n');
    console.log('📋 Colecciones creadas:');
    console.log('   • stores (2 tiendas: Distriaccell y accell.com)');
    console.log('   • employees (3 empleados de ejemplo)');
    console.log('   • users (3 usuarios: 2 admins + 1 gerente)');
    console.log('   • suppliers (2 proveedores)');
    console.log('   • categories (8 categorías)');
    console.log('   • settings (configuraciones)');
    console.log('   • paymentMethods (3 métodos)');
    console.log('   • serviceTypes (7 tipos)');
    console.log('\n⚠️  IMPORTANTE: Los usuarios creados necesitan cuentas en Firebase Auth');
    console.log('   Usa la página /?setup para crear sus cuentas de autenticación\n');
    console.log('🎉 Ya puedes usar el sistema completo!\n');

    return true;
  } catch (error: any) {
    console.error('❌ Error al inicializar base de datos:', error);
    throw error;
  }
};
