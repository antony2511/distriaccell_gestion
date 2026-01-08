import { Sale, TechnicalService, Expense, DailyRegister } from '../types';

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
 * Calcula el total de gastos
 */
export const calculateExpensesTotal = (expenses: Expense[]): number => {
  return expenses.reduce((acc, expense) => acc + expense.amount, 0);
};

/**
 * Calcula el total de ingresos brutos
 * NOTA: Los pagos QR NO se incluyen en ingresos brutos.
 * Son un ingreso aparte que va directo al banco.
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
  const qrPayments = register.qrPayments || 0;

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
