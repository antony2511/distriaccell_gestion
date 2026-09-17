// Tipos base
export type View = 'dashboard' | 'income' | 'expenses' | 'employees' | 'reports' | 'daily-closings' | 'executive-report' | 'credit-report' | 'suppliers' | 'users' | 'config' | 'general-balance' | 'stores' | 'migrate-records';

export type StoreId = string;

export type PaymentMethod = 'efectivo' | 'nequi' | 'daviplata' | 'transferencia' | 'banco' | 'qr' | 'otro';

// Valores literales que ya escribe QRPaymentsInput.tsx en QRPayment.description
export type QRPaymentDescription = 'QR' | 'TRANSFERENCIA' | 'TARJETA';

export type SaleCategory = 'accesorios' | 'servicios' | 'repuestos' | 'otros';

export type ExpenseCategory =
  | 'insumos'
  | 'servicios-tecnicos'
  | 'inventario'
  | 'administrativos'
  | 'servicios-publicos'
  | 'transporte'
  | 'comidas'
  | 'mantenimiento'
  | 'otros';

export type ServiceType =
  | 'pantalla'
  | 'bateria'
  | 'pin'
  | 'software'
  | 'puerto'
  | 'limpieza'
  | 'desbloqueo'
  | 'otro';

// Interfaz de tienda
export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  color?: string;
  status: 'activo' | 'inactivo';
  createdAt: Date;
  updatedAt: Date;
}

// Interfaces de datos

export interface Sale {
  id: string;
  description: string;
  category: SaleCategory;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  timestamp: Date;
}

export interface TechnicalService {
  id: string;
  serviceType: ServiceType;
  deviceModel: string;
  technicianName: string;
  amount: number;
  customerName?: string;
  timestamp: Date;
}

export interface QRPayment {
  id: string;
  description: QRPaymentDescription | string; // string por compatibilidad con datos legacy
  amount: number;
  customerName?: string;
  timestamp: Date;
}

export type CreditDownPaymentMethod = 'efectivo' | 'transferencia';

/**
 * Venta a crédito de celulares/tablet. El cajero registra el precio de venta
 * COMPLETO en systemSales ese día. La parte que NO llegó al cajón se descuenta
 * del efectivo esperado (en un bucket aparte de qrPayments):
 *   - abono en efectivo  -> se descuenta solo lo financiado (precio venta − abono)
 *   - abono transferencia -> se descuenta el precio de venta completo (nada llegó a caja)
 * Con `downPayment` = 0 la venta es 100% financiada. El abono NO se registra
 * además en el bloque QR: este apartado lo maneja según `downPaymentMethod`.
 * Valor vendido (producto + 10%), monto financiado, reparto 8% tienda / 2%
 * financiera, margen y ganancia se derivan en utils/calculations.ts.
 */
export interface CreditSale {
  id: string;
  purchasePrice: number;                     // Precio de compra del equipo (costo)
  productValue: number;                      // Precio de venta del producto (sin recargo) — va completo en systemSales
  downPayment: number;                       // Abono del cliente (0 si es 100% financiado)
  downPaymentMethod: CreditDownPaymentMethod; // Cómo pagó el abono: efectivo (queda en caja) o transferencia/QR (fue a banco)
  deviceModel?: string;
  timestamp: Date;                           // Fecha/hora del registro (día del registro diario)
}

export interface Expense {
  id: string;
  concept: string;
  category: ExpenseCategory;
  subcategory?: string;
  amount: number;
  responsiblePerson?: string;
  timestamp: Date;
}

export interface DailyRegister {
  id: string;
  date: string; // YYYY-MM-DD
  storeId: StoreId;
  registeredBy: string;
  registeredByName: string;

  // Ingresos
  systemSales: number; // Ventas del sistema POS
  notebookSales: Sale[]; // Ventas del cuaderno
  technicalServices: TechnicalService[]; // Servicios técnicos
  qrPayments: QRPayment[]; // Pagos por QR/Transferencia (tratamiento especial)
  creditSales?: CreditSale[]; // Ventas a crédito celulares/tablet (a financiera, no a caja)

  // Gastos
  expenses: Expense[]; // Gastos operativos
  dailySavings: number; // Ahorro del día

  // Balance
  expectedCash: number; // Calculado automáticamente
  actualCash: number; // Contado físicamente
  difference: number; // actualCash - expectedCash
  differenceJustification?: string;

  // Estado
  isClosed: boolean;
  closedAt?: Date;
  closedBy?: string;

  // Cierre de medio día (domingos en accell — cambio de turno).
  // Al reabrir para el turno 2, el arqueo del turno 1 se preserva aquí.
  shift1ClosedAt?: Date;
  shift1ClosedBy?: string;
  shift1ActualCash?: number;
  shift1ExpectedCash?: number;
  shift1Difference?: number;
  shift1Justification?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'vendedor' | 'tecnico' | 'cajero' | 'administrador';
  storeId: StoreId;
  status: 'activo' | 'inactivo' | 'vacaciones';
  avatar?: string;

  // Nómina
  baseSalary: number;
  commissionType?: 'service' | 'sales' | 'none';
  commissionRate?: number; // Porcentaje (0-100) para comisión por servicios
  // Tiendas cuyas ventas cuentan para la comisión por ventas (admin multi-tienda).
  // Si está vacío/ausente se usa la tienda asignada (storeId).
  commissionStoreIds?: StoreId[];

  // Información de contacto
  phone?: string;
  address?: string;

  // Fechas
  hireDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  currentBalance: number; // Saldo actual de la deuda — suma de los saldos de sus facturas pendientes
  debtStartDate?: Date; // Fecha de la factura más antigua (se fija automáticamente al crear facturas)
  lastPaymentDate?: Date; // Fecha del último pago realizado
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  invoiceNumber?: string; // Número/consecutivo de la factura, opcional
  concept: string;
  amount: number; // Monto original de la factura
  balance: number; // Saldo pendiente de esta factura (se reduce con los pagos FIFO)
  status: 'pending' | 'partial' | 'paid';
  issueDate: Date; // Fecha de inicio de la factura
  dueDate?: Date; // Fecha de vencimiento, opcional
  storeId: StoreId;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'purchase' | 'payment';
  date: Date;
  concept: string;
  amount: number;
  dueDate?: Date; // Solo para compras a crédito
  storeId: StoreId;
  paymentMethod?: PaymentMethod; // Solo para pagos
  reference?: string;
  observations?: string;
  invoiceId?: string | null; // Factura a la que pertenece esta compra/abono (null = abono sin factura asociada)
  invoiceNumber?: string | null; // Copia denormalizada del número de factura, para mostrar sin lookup extra
  createdBy: string;
  createdAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super-admin' | 'admin' | 'cajero' | 'tecnico' | 'consulta';
  storeId: string;
  status: 'activo' | 'inactivo';
  /**
   * Da acceso al Balance General (caja general en efectivo): ver el saldo de
   * todas las tiendas, registrar retiros y hacer el cierre mensual. Se concede
   * por usuario, no por rol: hay varios `admin` de tienda y solo quien maneja
   * la caja general debe tenerlo. El super-admin lo tiene siempre.
   */
  canManageGeneralCash?: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsWithdrawal {
  id: string;
  date: Date;
  amount: number;
  justification: string;
  authorizedBy: string;
  authorizedByName: string;
  storeId?: string;
  createdAt: Date;
}

export type CashWithdrawalType = 'propietario' | 'proveedor' | 'prestamo' | 'nomina' | 'otro';

export interface CashWithdrawal {
  id: string;
  date: Date;
  type: CashWithdrawalType;
  amount: number;
  concept: string;
  beneficiary?: string; // Nombre del beneficiario (proveedor, persona del préstamo, etc.)
  reference?: string; // Referencia o número de documento
  authorizedBy: string;
  authorizedByName: string;
  storeId: StoreId | 'ambos';
  createdAt: Date;
}

export interface MonthlyClosing {
  id: string;
  storeId: StoreId;
  period: string; // 'YYYY-MM' — el mes que se cierra
  date: Date; // fecha del cierre (normalmente el último día del mes)
  balanceBeforeClosing: number; // saldo calculado en el momento del cierre (auditoría)
  amountWithdrawn: number; // cuánto sale de la caja
  amountRemaining: number; // cuánto queda — pasa como base al período siguiente
  difference: number; // balanceBeforeClosing - (amountWithdrawn + amountRemaining)
  justification?: string;
  authorizedBy: string;
  authorizedByName: string;
  createdAt: Date;
}

// Tipos para reportes

export interface DailyReport {
  date: string;
  storeId: StoreId;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    dailySavings: number;
    balance: number;
  };
  income: {
    systemSales: number;
    notebookSales: number;
    technicalServices: number;
    qrPayments: number; // Este es el total calculado
  };
  expensesByCategory: Record<ExpenseCategory, number>;
  difference: number;
  alerts: string[];
}

export interface EmployeePayment {
  id: string;
  employeeId: string;
  employeeName: string;
  storeId: StoreId;
  period: string; // YYYY-MM para mensual, YYYY-MM-Q1/Q2 para quincenal
  periodType: 'quincenal' | 'mensual';

  // Detalles del pago
  baseSalary: number;
  commissions: number;
  bonuses: number;
  deductions: number;
  totalAmount: number;

  // Comisiones desglosadas
  commissionsDetail?: {
    salesCommission: number;
    servicesCommission: number;
    totalSales: number;
    totalServices: number;
  };

  // Estado
  status: 'pendiente' | 'pagado' | 'parcial';
  amountPaid: number;
  paymentDate?: Date;
  paymentMethod?: PaymentMethod;

  // Metadatos
  observations?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos para configuración

export interface AppSettings {
  companyName: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
  businessHours: {
    openTime: string;
    closeTime: string;
    workingDays: number[]; // 0-6 (Domingo-Sábado)
  };
  alerts: {
    lowCashThreshold?: number;
    maxDifferencePercentage: number;
    requireJustificationPercentage: number;
    supplierDueDateWarningDays: number;
    dailyReportEmail?: string;
    dailyReportTime?: string;
  };
  reports: {
    autoSendDaily: boolean;
    recipientEmail?: string;
    ccEmails?: string[];
  };
}
