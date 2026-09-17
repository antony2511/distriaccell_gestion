import { describe, it, expect } from 'vitest';
import {
  calcCreditSale,
  calculateCreditNotInCashTotal,
  calculateCreditProfitTotal,
  calculateExpectedCash,
  calculateGrossIncome,
  calculateQRBreakdown,
  calculateQRTotal,
  calculateTotalOutflows,
  CREDIT_FINANCIER_SHARE_RATE,
  CREDIT_STORE_SHARE_RATE,
  CREDIT_SURCHARGE_RATE,
} from './calculations';
import type { CreditSale, DailyRegister, QRPayment } from '../types';

const ts = new Date('2026-09-09T12:00:00Z');

const credit = (partial: Partial<CreditSale>): CreditSale => ({
  id: 'c1',
  purchasePrice: 0,
  productValue: 0,
  downPayment: 0,
  downPaymentMethod: 'efectivo',
  timestamp: ts,
  ...partial,
});

const qr = (description: string, amount: number): QRPayment => ({
  id: `q-${description}-${amount}`,
  description,
  amount,
  timestamp: ts,
});

describe('tasas del crédito', () => {
  it('el recargo se reparte 8% tienda / 2% financiera y suma 10%', () => {
    expect(CREDIT_SURCHARGE_RATE).toBe(0.1);
    expect(CREDIT_STORE_SHARE_RATE).toBe(0.08);
    expect(CREDIT_FINANCIER_SHARE_RATE).toBe(0.02);
    expect(CREDIT_STORE_SHARE_RATE + CREDIT_FINANCIER_SHARE_RATE).toBeCloseTo(CREDIT_SURCHARGE_RATE);
  });
});

describe('calcCreditSale', () => {
  it('Redmi 15 accell 2026-09-09: 100% financiado descuenta el precio completo', () => {
    const b = calcCreditSale(credit({ purchasePrice: 600_000, productValue: 795_000, downPayment: 0 }));
    expect(b.soldValue).toBeCloseTo(874_500);
    expect(b.financedValue).toBeCloseTo(874_500);
    expect(b.notInCash).toBe(795_000);
    expect(b.margin).toBe(195_000);
    expect(b.storeShare).toBeCloseTo(63_600);
    expect(b.profit).toBeCloseTo(258_600);
  });

  it('Samsung A57 accell 2026-09-09: abono por transferencia descuenta el precio completo', () => {
    const b = calcCreditSale(
      credit({ purchasePrice: 1_100_000, productValue: 1_480_000, downPayment: 878_000, downPaymentMethod: 'transferencia' })
    );
    expect(b.downPaymentInCash).toBe(false);
    expect(b.notInCash).toBe(1_480_000);
    expect(b.financedValue).toBeCloseTo(1_480_000 * 1.1 - 878_000);
  });

  it('abono en efectivo: solo se descuenta lo financiado (el abono quedó en caja)', () => {
    const b = calcCreditSale(credit({ productValue: 1_000_000, downPayment: 300_000, downPaymentMethod: 'efectivo' }));
    expect(b.downPaymentInCash).toBe(true);
    expect(b.notInCash).toBe(700_000);
  });

  it('la ganancia no depende del abono ni del método', () => {
    const base = { purchasePrice: 800_000, productValue: 1_000_000 };
    const sinAbono = calcCreditSale(credit({ ...base, downPayment: 0 }));
    const conAbonoEfectivo = calcCreditSale(credit({ ...base, downPayment: 400_000, downPaymentMethod: 'efectivo' }));
    const conAbonoBanco = calcCreditSale(credit({ ...base, downPayment: 400_000, downPaymentMethod: 'transferencia' }));
    expect(sinAbono.profit).toBe(conAbonoEfectivo.profit);
    expect(sinAbono.profit).toBe(conAbonoBanco.profit);
    expect(sinAbono.profit).toBeCloseTo(200_000 + 80_000);
  });

  it('registros viejos sin downPaymentMethod se tratan como efectivo', () => {
    const b = calcCreditSale({ productValue: 500_000, downPayment: 100_000 });
    expect(b.downPaymentInCash).toBe(true);
    expect(b.notInCash).toBe(400_000);
  });

  it('el abono se acota entre 0 y el precio de venta', () => {
    expect(calcCreditSale({ productValue: 500_000, downPayment: 900_000 }).downPayment).toBe(500_000);
    expect(calcCreditSale({ productValue: 500_000, downPayment: -50 }).downPayment).toBe(0);
    expect(calcCreditSale({}).notInCash).toBe(0);
  });
});

describe('pagos QR', () => {
  it('datos legacy (número) cuentan como 0', () => {
    expect(calculateQRTotal(150_000 as unknown as QRPayment[])).toBe(0);
    expect(calculateQRBreakdown(150_000 as unknown as QRPayment[])).toEqual({ qr: 0, transferencia: 0, tarjeta: 0, otros: 0 });
  });

  it('desglosa por descripción sin importar mayúsculas y agrupa lo demás en otros', () => {
    const b = calculateQRBreakdown([qr('QR', 100), qr('qr ', 50), qr('Transferencia', 200), qr('TARJETA', 30), qr('Sistecredito', 7)]);
    expect(b).toEqual({ qr: 150, transferencia: 200, tarjeta: 30, otros: 7 });
    expect(calculateQRTotal([qr('QR', 100), qr('TRANSFERENCIA', 200)])).toBe(300);
  });
});

describe('efectivo esperado del cierre diario', () => {
  const register: Partial<DailyRegister> = {
    systemSales: 2_000_000,
    notebookSales: [
      { id: 's1', description: 'Forro', category: 'accesorios', quantity: 2, unitPrice: 15_000, subtotal: 30_000, timestamp: ts },
    ],
    technicalServices: [
      { id: 't1', serviceType: 'pantalla', deviceModel: 'A54', technicianName: 'Jose', amount: 120_000, timestamp: ts },
    ],
    qrPayments: [qr('QR', 400_000), qr('TRANSFERENCIA', 100_000)],
    creditSales: [credit({ purchasePrice: 600_000, productValue: 795_000, downPayment: 0 })],
    expenses: [{ id: 'e1', concept: 'Almuerzo', category: 'comidas', amount: 25_000, timestamp: ts }],
    dailySavings: 50_000,
  };

  it('las ventas brutas NO suman el QR ni el crédito (ya están en systemSales)', () => {
    expect(calculateGrossIncome(register)).toBe(2_150_000);
  });

  it('las salidas incluyen gastos + ahorro + QR + crédito no en caja', () => {
    expect(calculateTotalOutflows(register)).toBe(25_000 + 50_000 + 500_000 + 795_000);
  });

  it('efectivo esperado = ventas − gastos − ahorro − QR − crédito no en caja', () => {
    expect(calculateExpectedCash(register)).toBe(2_150_000 - 1_370_000);
  });

  it('migrar un QR proxy al bloque de crédito no cambia el efectivo esperado', () => {
    // Colmoviles 2026-09-08: tablet 100% financiada de 1.250.000 registrada antes como QR
    const antes: Partial<DailyRegister> = { systemSales: 1_250_000, qrPayments: [qr('QR', 1_250_000)] };
    const despues: Partial<DailyRegister> = {
      systemSales: 1_250_000,
      qrPayments: [],
      creditSales: [credit({ purchasePrice: 900_000, productValue: 1_250_000, downPayment: 0 })],
    };
    expect(calculateExpectedCash(antes)).toBe(0);
    expect(calculateExpectedCash(despues)).toBe(calculateExpectedCash(antes));
  });

  it('un registro vacío da 0 en todo', () => {
    expect(calculateGrossIncome({})).toBe(0);
    expect(calculateExpectedCash({})).toBe(0);
    expect(calculateCreditNotInCashTotal()).toBe(0);
    expect(calculateCreditProfitTotal()).toBe(0);
  });
});
