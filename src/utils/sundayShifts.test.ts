import { describe, it, expect } from 'vitest';
import {
  combineShifts,
  combineJustifications,
  hasIndependentShift2,
  isDoubleShiftDay,
  doubleShiftDayLabel,
  emptyShiftData,
  toShiftData,
  mergeShiftData,
  isShift2Open,
} from './sundayShifts';
import { calculateExpectedCash, calculateGrossIncome } from './calculations';

// Registro mínimo: solo ventas del POS, sin gastos/QR/crédito/ahorro → esperado = systemSales
const registro = (systemSales: number, extra: Record<string, unknown> = {}) =>
  ({ systemSales, notebookSales: [], technicalServices: [], qrPayments: [], creditSales: [], expenses: [], dailySavings: 0, ...extra }) as any;

describe('cierre independiente de turnos (domingos accell)', () => {
  it('combina los dos arqueos: contado, esperado y diferencia del día son la suma de los turnos', () => {
    const dia = combineShifts({ actual: 495_000, expected: 500_000 }, { actual: 810_000, expected: 800_000 });
    expect(dia.actualCash).toBe(1_305_000);
    expect(dia.expectedCash).toBe(1_300_000);
    expect(dia.difference).toBe(5_000); // -5.000 de la mañana + 10.000 de la tarde
    // coherente con actual − expected del día
    expect(dia.difference).toBe(dia.actualCash - dia.expectedCash);
  });

  it('el efectivo del día que ve el Balance es lo contado en la mañana MÁS lo contado en la tarde', () => {
    // antes la tarde contaba el día completo (1.300.000) y el turno 1 no sumaba; ahora cada uno cuenta lo suyo
    const dia = combineShifts({ actual: 500_000, expected: 500_000 }, { actual: 800_000, expected: 800_000 });
    expect(dia.actualCash).toBe(1_300_000);
  });

  it('justificaciones rotuladas por turno', () => {
    expect(combineJustifications('faltó cambio', 'sobró propina')).toBe('Turno 1: faltó cambio · Turno 2: sobró propina');
    expect(combineJustifications(undefined, 'sobró propina')).toBe('Turno 2: sobró propina');
    expect(combineJustifications('faltó cambio', '')).toBe('Turno 1: faltó cambio');
    expect(combineJustifications('', null)).toBeUndefined();
  });

  it('distingue el cierre independiente del modelo anterior (arqueo acumulado)', () => {
    const viejo = { shift1ClosedAt: new Date(), shift1ActualCash: 1 } as any;
    const nuevo = { shift1ClosedAt: new Date(), shift2ExpectedCash: 800_000 } as any;
    expect(hasIndependentShift2(viejo)).toBe(false);
    expect(hasIndependentShift2(nuevo)).toBe(true);
    expect(hasIndependentShift2({ shift2ExpectedCash: 0, shift1ClosedAt: new Date() } as any)).toBe(true);
  });

  it('solo los domingos y festivos de accell tienen doble turno', () => {
    expect(isDoubleShiftDay('2026-09-20', 'almacen-2')).toBe(true); // domingo
    expect(isDoubleShiftDay('2026-09-19', 'almacen-2')).toBe(false); // sábado
    expect(isDoubleShiftDay('2026-09-20', 'almacen-1')).toBe(false); // otra tienda
    // festivos: también doble turno, solo en accell
    expect(isDoubleShiftDay('2026-10-12', 'almacen-2')).toBe(true); // lunes festivo
    expect(isDoubleShiftDay('2026-10-12', 'almacen-1')).toBe(false);
    expect(isDoubleShiftDay('2026-10-13', 'almacen-2')).toBe(false); // martes corriente
    expect(doubleShiftDayLabel('2026-09-20')).toBe('Domingo');
    expect(doubleShiftDayLabel('2026-10-12')).toBe('Festivo');
  });
});

describe('cada turno empieza de cero y el día es la suma', () => {
  const sale = (subtotal: number) => ({ id: 's' + subtotal, description: 'x', category: 'accesorios', quantity: 1, unitPrice: subtotal, subtotal, timestamp: new Date() });
  const gasto = (amount: number) => ({ id: 'g' + amount, concept: 'x', category: 'otros', amount, timestamp: new Date() });
  const manana = { ...emptyShiftData(), systemSales: 600_000, notebookSales: [sale(50_000)], expenses: [gasto(20_000)], dailySavings: 30_000 } as any;
  const tarde = { ...emptyShiftData(), systemSales: 900_000, notebookSales: [sale(70_000), sale(10_000)], expenses: [gasto(5_000)], dailySavings: 0 } as any;

  it('la tarde arranca vacía: POS, cuaderno, servicios, QR, crédito, gastos y ahorro en cero', () => {
    const t = emptyShiftData();
    expect(t.systemSales).toBe(0);
    expect(t.dailySavings).toBe(0);
    for (const lista of [t.notebookSales, t.technicalServices, t.qrPayments, t.creditSales, t.expenses]) expect(lista).toEqual([]);
  });

  it('el esperado de la tarde sale SOLO de lo registrado en la tarde', () => {
    expect(calculateExpectedCash(tarde)).toBe(900_000 + 80_000 - 5_000);
    expect(calculateExpectedCash(manana)).toBe(600_000 + 50_000 - 20_000 - 30_000);
  });

  it('los totales del día son mañana + tarde: importes sumados y listas juntas', () => {
    const dia = mergeShiftData(manana, tarde);
    expect(dia.systemSales).toBe(1_500_000);
    expect(dia.dailySavings).toBe(30_000);
    expect(dia.notebookSales.map((v) => v.subtotal)).toEqual([50_000, 70_000, 10_000]);
    expect(dia.expenses).toHaveLength(2);
  });

  it('el esperado del día es la suma de los esperados de cada turno (nada se pierde ni se duplica)', () => {
    const dia = mergeShiftData(manana, tarde);
    expect(calculateExpectedCash(dia)).toBe(calculateExpectedCash(manana) + calculateExpectedCash(tarde));
    expect(calculateGrossIncome(dia)).toBe(calculateGrossIncome(manana) + calculateGrossIncome(tarde));
  });

  it('toShiftData toma solo los campos del turno y completa los que falten', () => {
    const t = toShiftData({ systemSales: 5, isClosed: true, storeId: 'almacen-2' } as any);
    expect(t).toEqual({ ...emptyShiftData(), systemSales: 5 });
    expect(toShiftData(undefined)).toEqual(emptyShiftData());
  });

  it('turno 2 abierto = mañana congelada + tarde en curso + día sin cerrar', () => {
    expect(isShift2Open({ shift1Data: manana, shift2Data: tarde, isClosed: false } as any)).toBe(true);
    expect(isShift2Open({ shift1Data: manana, shift2Data: tarde, isClosed: true } as any)).toBe(false);
    expect(isShift2Open({ isClosed: false } as any)).toBe(false); // día normal
    expect(isShift2Open({ shift1ClosedAt: new Date(), isClosed: false } as any)).toBe(false); // modelo anterior
  });
});
