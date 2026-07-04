// Tipos base
export type View = 'login' | 'dashboard' | 'income' | 'expenses' | 'employees' | 'reports' | 'executive-report' | 'savings' | 'payroll' | 'suppliers' | 'users' | 'settings' | 'config' | 'general-balance' | 'stores' | 'migrate-records';

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
  currentBalance: number; // Saldo actual de la deuda
  debtStartDate: Date; // Fecha de inicio del saldo
  lastPaymentDate?: Date; // Fecha del último pago realizado
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
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsRecord {
  id: string;
  date: string; // YYYY-MM-DD
  storeId: StoreId;
  amount: number;
  accumulatedTotal: number;
  source: 'daily-register'; // Siempre viene del registro diario
  dailyRegisterId: string;
  createdAt: Date;
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

export interface PayrollRecord {
  id: string;
  month: string; // YYYY-MM
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  commissions: number;
  totalAmount: number;
  status: 'pending' | 'paid';
  paymentDate?: Date;
  paymentMethod?: PaymentMethod;
  observations?: string;
  servicesCount?: number; // Para técnicos
  createdAt: Date;
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
