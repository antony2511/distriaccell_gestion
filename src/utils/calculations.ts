import { Sale, TechnicalService, QRPayment, Expense, DailyRegister } from '../types';

/**
 * Calcula el total de ventas del cuaderno
 */
export const calculateNotebookTotal = (sales: Sale[]): number => {
  return sales.reduce((acc, sale) => acc + sale.subtotal, 0);
};

/**
 * Calcula el total de servicios técnicos
 */
export const calculateServicesTotal = (services: TechnicalService[]): number => {
  return services.reduce((acc, service) => acc + service.amount, 0);
};

/**
 * Calcula el total de pagos por QR/Transferencia
 */
export const calculateQRTotal = (payments: QRPayment[] | number): number => {
  // Migración: manejar datos antiguos (número) y nuevos (array)
  if (typeof payments === 'number') {
    return 0; // Datos antiguos, retornar 0
  }
  if (!Array.isArray(payments)) {
    return 0;
  }
  return payments.reduce((acc, payment) => acc + payment.amount, 0);
};

/**
 * Desglosa los pagos por QR/Transferencia/Tarjeta agrupando por su descripción.
 * Uso puramente informativo — no afecta el balance en efectivo (ver calculateGrossIncome).
 */
export const calculateQRBreakdown = (
  payments: QRPayment[] | number
): { qr: number; transferencia: number; tarjeta: number; otros: number } => {
  const result = { qr: 0, transferencia: 0, tarjeta: 0, otros: 0 };

  if (typeof payments === 'number' || !Array.isArray(payments)) {
    return result; // Datos antiguos sin desglose
  }

  payments.forEach((payment) => {
    const key = (payment.description || '').toString().trim().toUpperCase();
    if (key === 'QR') {
      result.qr += payment.amount;
    } else if (key === 'TRANSFERENCIA') {
      result.transferencia += payment.amount;
    } else if (key === 'TARJETA') {
      result.tarjeta += payment.amount;
    } else {
      result.otros += payment.amount;
    }
  });

  return result;
};

/**
 * Calcula el total de gastos
 */
export const calculateExpensesTotal = (expenses: Expense[]): number => {
  return expenses.reduce((acc, expense) => acc + expense.amount, 0);
};

/**
 * Calcula el total de ingresos brutos
 * NOTA: Los pagos QR NO se suman aquí porque las ventas pagadas por QR ya están
 * registradas dentro de systemSales/cuaderno. qrPayments solo indica qué parte
 * de esas ventas fue al banco en vez de a caja (ver calculateExpectedCash).
 * Sumar QR encima de las ventas sería contarlas dos veces.
 */
export const calculateGrossIncome = (register: Partial<DailyRegister>): number => {
  const systemSales = register.systemSales || 0;
  const notebookSales = calculateNotebookTotal(register.notebookSales || []);
  const technicalServices = calculateServicesTotal(register.technicalServices || []);

  return systemSales + notebookSales + technicalServices;
};

/**
 * Calcula el total de efectivo recibido (sin incluir QR)
 * Los pagos QR van directo al banco, no a caja física
 */
export const calculateCashReceived = (register: Partial<DailyRegister>): number => {
  const systemSales = register.systemSales || 0;
  const notebookSales = calculateNotebookTotal(register.notebookSales || []);
  const technicalServices = calculateServicesTotal(register.technicalServices || []);

  return systemSales + notebookSales + technicalServices;
};

/**
 * Calcula el total de salidas de efectivo
 * NOTA: Los pagos QR se incluyen aquí porque aunque son ingresos,
 * ese dinero no está físicamente en caja (va directo al banco)
 */
export const calculateTotalOutflows = (register: Partial<DailyRegister>): number => {
  const expenses = calculateExpensesTotal(register.expenses || []);
  const savings = register.dailySavings || 0;
  const qrPayments = calculateQRTotal(register.qrPayments || []);

  return expenses + savings + qrPayments;
};

/**
 * Calcula el efectivo esperado en caja
 * Fórmula: Efectivo recibido - Gastos - Ahorro - Pagos QR
 * Los QR se restan porque es dinero que no llegó físicamente a caja (fue al banco)
 */
export const calculateExpectedCash = (register: Partial<DailyRegister>): number => {
  const cashReceived = calculateCashReceived(register);
  const outflows = calculateTotalOutflows(register);

  return cashReceived - outflows;
};

/**
 * Calcula la diferencia entre efectivo real y esperado
 */
export const calculateDifference = (actualCash: number, expectedCash: number): number => {
  return actualCash - expectedCash;
};

/**
 * Calcula el porcentaje de diferencia
 */
export const calculateDifferencePercentage = (difference: number, expectedCash: number): number => {
  if (expectedCash === 0) return 0;
  return Math.abs((difference / expectedCash) * 100);
};

/**
 * Calcula el balance neto del día
 */
export const calculateDailyBalance = (register: Partial<DailyRegister>): number => {
  const grossIncome = calculateGrossIncome(register);
  const totalExpenses = calculateExpensesTotal(register.expenses || []);
  const savings = register.dailySavings || 0;

  return grossIncome - totalExpenses - savings;
};

/**
 * Agrupa gastos por categoría
 */
export const groupExpensesByCategory = (expenses: Expense[]): Record<string, number> => {
  return expenses.reduce((acc, expense) => {
    const category = expense.category;
    acc[category] = (acc[category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);
};

/**
 * Agrupa servicios por técnico
 */
export const groupServicesByTechnician = (services: TechnicalService[]): Record<string, TechnicalService[]> => {
  return services.reduce((acc, service) => {
    const techName = service.technicianName;
    if (!acc[techName]) {
      acc[techName] = [];
    }
    acc[techName].push(service);
    return acc;
  }, {} as Record<string, TechnicalService[]>);
};

/**
 * Calcula comisiones de un técnico
 */
export const calculateTechnicianCommissions = (
  services: TechnicalService[],
  commissionRate: number
): number => {
  const totalAmount = calculateServicesTotal(services);
  return totalAmount * (commissionRate / 100);
};
