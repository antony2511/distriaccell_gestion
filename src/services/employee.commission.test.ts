import { describe, it, expect } from 'vitest';
import { calculateTieredSalesCommission, STORE_SALES_GOAL, MULTI_STORE_SALES_GOAL } from './employee.service';

describe('comisión escalonada por ventas', () => {
  it('metas por tienda y base multi-tienda', () => {
    expect(STORE_SALES_GOAL['almacen-1']).toBe(15_000_000);
    expect(STORE_SALES_GOAL['almacen-2']).toBe(33_000_000);
    expect(MULTI_STORE_SALES_GOAL).toBe(45_000_000);
  });

  it('sin superar un bloque completo todo paga a la tasa base', () => {
    const r = calculateTieredSalesCommission(36_000_000, 2, 33_000_000);
    expect(r.blocksReached).toBe(0);
    expect(r.commission).toBe(720_000);
  });

  it('cada bloque de $4M sobre la meta paga +0.1% solo sobre ese bloque', () => {
    // meta 33M, ventas 42M → 9M de exceso = 2 bloques completos + 1M de resto
    const r = calculateTieredSalesCommission(42_000_000, 2, 33_000_000);
    expect(r.blocksReached).toBe(2);
    const esperado = 33_000_000 * 0.02 + 4_000_000 * 0.021 + 4_000_000 * 0.022 + 1_000_000 * 0.022;
    expect(r.commission).toBe(Math.round(esperado));
  });

  it('con meta 0 todo es excedente', () => {
    const r = calculateTieredSalesCommission(8_000_000, 1, 0);
    expect(r.blocksReached).toBe(2);
    expect(r.commission).toBe(Math.round(4_000_000 * 0.011 + 4_000_000 * 0.012));
  });
});
