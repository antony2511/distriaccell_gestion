import { describe, it, expect } from 'vitest';
import { resumirRegistros, resumirRegistro } from './periodSummary';
import { calculateExpectedCash, calculateGrossIncome } from './calculations';
import type { DailyRegister } from '../types';

const ts = new Date('2026-09-09T12:00:00Z');

const dia1: Partial<DailyRegister> = {
  systemSales: 2_000_000,
  notebookSales: [{ id: 's1', description: 'Forro', category: 'accesorios', quantity: 1, unitPrice: 30_000, subtotal: 30_000, timestamp: ts }],
  technicalServices: [{ id: 't1', serviceType: 'pantalla', deviceModel: 'A54', technicianName: 'Jose', amount: 120_000, timestamp: ts }],
  qrPayments: [
    { id: 'q1', description: 'QR', amount: 400_000, timestamp: ts },
    { id: 'q2', description: 'TARJETA', amount: 100_000, timestamp: ts },
  ],
  creditSales: [{ id: 'c1', purchasePrice: 600_000, productValue: 795_000, downPayment: 0, downPaymentMethod: 'efectivo', timestamp: ts }],
  expenses: [{ id: 'e1', concept: 'Almuerzo', category: 'comidas', amount: 25_000, timestamp: ts }],
  dailySavings: 50_000,
};

const dia2: Partial<DailyRegister> = {
  systemSales: 500_000,
  qrPayments: [{ id: 'q3', description: 'TRANSFERENCIA', amount: 200_000, timestamp: ts }],
  expenses: [{ id: 'e2', concept: 'Taxi', category: 'transporte', amount: 10_000, timestamp: ts }],
  dailySavings: 0,
};

describe('resumirRegistros', () => {
  it('ventas = sistema + cuaderno + servicios; banco y crédito NO se suman encima', () => {
    const r = resumirRegistros([dia1, dia2]);
    expect(r.dias).toBe(2);
    expect(r.ventas).toBe(2_150_000 + 500_000);
    expect(r.ventas).toBe(calculateGrossIncome(dia1) + calculateGrossIncome(dia2));
    expect(r.banco).toBe(700_000);
    expect(r.bancoDesglose).toEqual({ qr: 400_000, transferencia: 200_000, tarjeta: 100_000, otros: 0 });
    expect(r.creditoNoCaja).toBe(795_000);
  });

  it('utilidad = ventas − gastos, el ahorro NO resta', () => {
    const r = resumirRegistros([dia1, dia2]);
    expect(r.gastos).toBe(35_000);
    expect(r.ahorro).toBe(50_000);
    expect(r.utilidad).toBe(2_650_000 - 35_000);
  });

  it('efectivo y caja esperada descuentan banco y crédito', () => {
    const r = resumirRegistros([dia1, dia2]);
    expect(r.efectivo).toBe(2_650_000 - 700_000 - 795_000);
    expect(r.cajaEsperada).toBe(r.efectivo - 35_000 - 50_000);
    expect(r.cajaEsperada).toBe(calculateExpectedCash(dia1) + calculateExpectedCash(dia2));
  });

  it('resumirRegistro de un día coincide con el cierre diario', () => {
    expect(resumirRegistro(dia1).cajaEsperada).toBe(calculateExpectedCash(dia1));
  });

  it('sin registros todo es 0', () => {
    const r = resumirRegistros([]);
    expect(r.dias).toBe(0);
    expect(r.ventas).toBe(0);
    expect(r.utilidad).toBe(0);
    expect(r.cajaEsperada).toBe(0);
  });
});
