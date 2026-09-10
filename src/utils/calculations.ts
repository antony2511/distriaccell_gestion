import { Sale, TechnicalService, QRPayment, Expense, DailyRegister, CreditSale } from '../types';

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

// ========== VENTAS A CRÉDITO (celulares/tablet) ==========
// El cajero registra el precio de venta COMPLETO en systemSales ese día.
// El cliente puede abonar parte en efectivo (downPayment) y financiar el resto
// con una financiera. Al precio de venta se le suma un recargo del 10%; de ese
// 10% la tienda se queda con 4 puntos y la financiera con 6. La ganancia de la
// tienda es el margen del producto más esos 4 puntos (no depende del abono).
// La parte que NO entró como efectivo (precio de venta − abono) se descuenta
// del efectivo esperado, igual que una transferencia. Tasas fijas.

export const CREDIT_SURCHARGE_RATE = 0.10;       // recargo total sobre el precio de venta
export const CREDIT_STORE_SHARE_RATE = 0.04;     // puntos del recargo que gana la tienda
export const CREDIT_FINANCIER_SHARE_RATE = 0.06; // puntos del recargo que retiene la financiera

export interface CreditSaleBreakdown {
  purchasePrice: number;
  productValue: number;
  downPayment: number;        // abono en efectivo del cliente
  surcharge: number;          // productValue * 10%
  storeShare: number;         // productValue * 4%
  financierShare: number;     // productValue * 6%
  soldValue: number;          // productValue + 10%
  financedValue: number;      // soldValue - downPayment  (lo que el cliente le debe a la financiera)
  notInCash: number;          // productValue - downPayment  (parte del systemSales que NO entró a caja)
  margin: number;             // productValue - purchasePrice
  profit: number;             // margin + storeShare
}

/**
 * Desglosa una venta a crédito a partir de los valores que digita el cajero.
 */
export const calcCreditSale = (
  sale: { purchasePrice?: number; productValue?: number; downPayment?: number }
): CreditSaleBreakdown => {
  const purchasePrice = sale.purchasePrice || 0;
  const productValue = sale.productValue || 0;
  // El abono nunca puede superar el precio de venta.
  const downPayment = Math.min(Math.max(sale.downPayment || 0, 0), productValue);
  const surcharge = productValue * CREDIT_SURCHARGE_RATE;
  const storeShare = productValue * CREDIT_STORE_SHARE_RATE;
  const financierShare = productValue * CREDIT_FINANCIER_SHARE_RATE;
  const margin = productValue - purchasePrice;
  const soldValue = productValue + surcharge;
  return {
    purchasePrice,
    productValue,
    downPayment,
    surcharge,
    storeShare,
    financierShare,
    soldValue,
    financedValue: soldValue - downPayment,
    notInCash: productValue - downPayment,
    margin,
    profit: margin + storeShare,
  };
};

/** Σ valor vendido (producto + 10%). */
export const calculateCreditSoldTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).soldValue, 0);

/** Σ precio de venta (sin recargo). */
export const calculateCreditProductTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + (s.productValue || 0), 0);

/** Σ abono en efectivo del cliente. */
export const calculateCreditDownPaymentTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).downPayment, 0);

/** Σ monto financiado (valor vendido − abono) — lo que el cliente debe a la financiera. */
export const calculateCreditFinancedTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).financedValue, 0);

/**
 * Σ parte del systemSales que NO entró como efectivo (precio de venta − abono).
 * Es lo que hay que descontar del efectivo esperado por las ventas a crédito,
 * igual que se descuentan los QR.
 */
export const calculateCreditNotInCashTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).notInCash, 0);

/** Σ ganancia de la tienda (margen + 4%). */
export const calculateCreditProfitTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).profit, 0);

/** Σ margen del producto (precio venta − precio compra). */
export const calculateCreditMarginTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).margin, 0);

/** Σ 4 puntos del recargo que gana la tienda. */
export const calculateCreditStoreShareTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).storeShare, 0);

/** Σ 6 puntos del recargo que retiene la financiera. */
export const calculateCreditFinancierShareTotal = (creditSales: CreditSale[] = []): number =>
  creditSales.reduce((acc, s) => acc + calcCreditSale(s).financierShare, 0);

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
 * NOTA: Los pagos QR y la parte financiada de las ventas a crédito se incluyen
 * aquí porque, aunque son ingresos registrados en systemSales, ese dinero no
 * está físicamente en caja (QR va al banco; el crédito lo paga la financiera).
 */
export const calculateTotalOutflows = (register: Partial<DailyRegister>): number => {
  const expenses = calculateExpensesTotal(register.expenses || []);
  const savings = register.dailySavings || 0;
  const qrPayments = calculateQRTotal(register.qrPayments || []);
  const creditNotInCash = calculateCreditNotInCashTotal(register.creditSales || []);

  return expenses + savings + qrPayments + creditNotInCash;
};

/**
 * Calcula el efectivo esperado en caja
 * Fórmula: Efectivo recibido - Gastos - Ahorro - Pagos QR - Crédito financiado
 * QR y crédito se restan porque es dinero que no llegó físicamente a caja
 * (QR fue al banco; en el crédito solo el abono en efectivo entra a caja)
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
