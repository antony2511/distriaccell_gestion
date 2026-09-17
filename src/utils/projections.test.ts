import { describe, it, expect } from 'vitest';
import { computeProjection, DailyPoint } from './projections';

const dias = (valores: number[], ym = '2026-09'): DailyPoint[] =>
  valores.map((value, i) => ({ date: `${ym}-${String(i + 1).padStart(2, '0')}`, value }));

describe('computeProjection', () => {
  it('proyecta el día típico sobre los días que faltan', () => {
    // 10 días de $1.000.000 → faltan 20 días de septiembre
    const r = computeProjection(dias(Array(10).fill(1_000_000)), '2026-09', '2026-09-10');
    expect(r.actual).toBe(10_000_000);
    expect(r.daysRemaining).toBe(20);
    expect(r.dailyTypical).toBe(1_000_000);
    expect(r.projected).toBe(30_000_000);
  });

  it('un día excepcional no dispara la proyección (promedio recortado)', () => {
    const normales = Array(9).fill(1_000_000);
    const conPico = [...normales, 20_000_000];
    const sinPico = computeProjection(dias(normales), '2026-09', '2026-09-09');
    const conPicoProy = computeProjection(dias(conPico), '2026-09', '2026-09-10');
    // El día típico apenas se mueve pese a un día 20 veces mayor
    expect(conPicoProy.dailyTypical).toBe(1_000_000);
    expect(sinPico.dailyTypical).toBe(1_000_000);
    // El pico sí cuenta en lo ya vendido, no en lo que falta
    expect(conPicoProy.actual).toBe(29_000_000);
  });

  it('un día casi sin ventas tampoco hunde la proyección', () => {
    const r = computeProjection(dias([0, 1_000_000, 1_000_000, 1_000_000, 1_000_000]), '2026-09', '2026-09-05');
    expect(r.dailyTypical).toBe(1_000_000);
  });

  it('el rango conservador/optimista encierra la proyección', () => {
    const r = computeProjection(dias([500_000, 800_000, 1_000_000, 1_200_000, 2_000_000]), '2026-09', '2026-09-05');
    expect(r.projectedLow).toBeLessThanOrEqual(r.projected);
    expect(r.projectedHigh).toBeGreaterThanOrEqual(r.projected);
    expect(r.projectedLow).toBeGreaterThanOrEqual(r.actual);
  });

  it('marca la confianza según cuántos días hay y qué tan parejos son', () => {
    expect(computeProjection(dias([1_000_000, 900_000, 1_100_000]), '2026-09', '2026-09-03').reliability).toBe('baja');
    expect(computeProjection(dias(Array(7).fill(1_000_000)), '2026-09', '2026-09-07').reliability).toBe('media');
    expect(computeProjection(dias(Array(15).fill(1_000_000)), '2026-09', '2026-09-15').reliability).toBe('alta');
    // Muchos días pero disparejos → media
    const disparejos = [100_000, 5_000_000, 200_000, 4_000_000, 150_000, 6_000_000, 300_000, 3_000_000, 120_000, 5_500_000, 80_000, 4_800_000];
    expect(computeProjection(dias(disparejos), '2026-09', '2026-09-12').reliability).toBe('media');
  });

  it('el último día del mes no proyecta nada más', () => {
    const r = computeProjection(dias(Array(30).fill(1_000_000)), '2026-09', '2026-09-30');
    expect(r.daysRemaining).toBe(0);
    expect(r.remaining).toBe(0);
    expect(r.projected).toBe(r.actual);
    expect(r.projectedDays).toHaveLength(0);
  });

  it('sin datos devuelve todo en cero', () => {
    const r = computeProjection([], '2026-09', '2026-09-15');
    expect(r.projected).toBe(0);
    expect(r.reliability).toBe('baja');
    expect(r.projectedDays).toEqual([]);
  });

  it('febrero se proyecta sobre 28 días', () => {
    const r = computeProjection(dias(Array(10).fill(1_000_000), '2026-02'), '2026-02', '2026-02-10');
    expect(r.daysRemaining).toBe(18);
    expect(r.projected).toBe(28_000_000);
  });
});
