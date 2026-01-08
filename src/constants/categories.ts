// Categorías de gastos
export const EXPENSE_CATEGORIES = [
  { id: 'insumos', label: 'Insumos y materiales', icon: '📦' },
  { id: 'servicios-tecnicos', label: 'Servicios técnicos contratados', icon: '🔧' },
  { id: 'inventario', label: 'Compras de inventario', icon: '📱' },
  { id: 'administrativos', label: 'Gastos administrativos', icon: '📋' },
  { id: 'servicios-publicos', label: 'Servicios públicos (luz, agua, internet)', icon: '💡' },
  { id: 'transporte', label: 'Transporte', icon: '🚗' },
  { id: 'comidas', label: 'Comidas del personal', icon: '🍽️', subcategories: [
    'Desayuno',
    'Almuerzo',
    'Cena',
    'Refrigerio'
  ]},
  { id: 'mantenimiento', label: 'Mantenimiento', icon: '🔨' },
  { id: 'otros', label: 'Otros gastos', icon: '📝' }
] as const;

// Categorías de ventas
export const SALE_CATEGORIES = [
  { id: 'accesorios', label: 'Accesorios', icon: '🎧' },
  { id: 'servicios', label: 'Servicios', icon: '🔧' },
  { id: 'repuestos', label: 'Repuestos', icon: '🔩' },
  { id: 'otros', label: 'Otros', icon: '📦' }
] as const;

// Métodos de pago
export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'nequi', label: 'Nequi', icon: '📱' },
  { id: 'banco', label: 'Banco', icon: '🏦' },
  { id: 'qr', label: 'QR', icon: '📲', isDigital: true }
] as const;

// Tipos de servicios técnicos
export const SERVICE_TYPES = [
  { id: 'pantalla', label: 'Cambio de pantalla', icon: '📱' },
  { id: 'bateria', label: 'Cambio de batería', icon: '🔋' },
  { id: 'pin', label: 'Instalación de pin', icon: '📌' },
  { id: 'software', label: 'Reparación software', icon: '💻' },
  { id: 'puerto', label: 'Reparación puerto carga', icon: '🔌' },
  { id: 'limpieza', label: 'Limpieza interna', icon: '🧹' },
  { id: 'desbloqueo', label: 'Desbloqueo', icon: '🔓' },
  { id: 'otro', label: 'Otro', icon: '🔧' }
] as const;

// Almacenes
export const STORES = [
  { id: 'almacen-1', label: 'Distriaccell' },
  { id: 'almacen-2', label: 'accell.com' }
] as const;

// Roles de usuario
export const USER_ROLES = [
  { id: 'super-admin', label: 'Super Administrador', permissions: ['all'] },
  { id: 'admin', label: 'Administrador', permissions: ['read', 'write', 'close-day', 'reports', 'manage-payroll', 'manage-suppliers'] },
  { id: 'cajero', label: 'Cajero', permissions: ['read', 'write', 'basic-reports'] },
  { id: 'tecnico', label: 'Técnico', permissions: ['read-own', 'view-commissions'] },
  { id: 'consulta', label: 'Consulta', permissions: ['read'] }
] as const;

// Estados de empleado
export const EMPLOYEE_STATUS = [
  { id: 'activo', label: 'Activo', color: 'green' },
  { id: 'inactivo', label: 'Inactivo', color: 'gray' },
  { id: 'vacaciones', label: 'Vacaciones', color: 'blue' }
] as const;
