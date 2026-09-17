import { describe, it, expect } from 'vitest';
import { getPeriodRange, getPeriodLabel, getPrevPeriodLabel } from './periods';

const jueves = new Date(2026, 8, 17); // 17 sep 2026
const lunes = new Date(2026, 8, 14);

describe('getPeriodRange', () => {
  it('week = últimos 7 días con hoy incluido, y el anterior son los 7 previos', () => {
    const r = getPeriodRange('week', jueves);
    expect(r.startDate).toBe('2026-09-11');
    expect(r.endDate).toBe('2026-09-17');
    expect(r.prevStartDate).toBe('2026-09-04');
    expect(r.prevEndDate).toBe('2026-09-10');
  });

  it('un lunes también muestra 7 días (no la semana calendario vacía)', () => {
    const r = getPeriodRange('week', lunes);
    expect(r.startDate).toBe('2026-09-08');
    expect(r.endDate).toBe('2026-09-14');
  });

  it('week cruza de mes sin correr el día', () => {
    const r = getPeriodRange('week', new Date(2026, 9, 2)); // 2 oct
    expect(r.startDate).toBe('2026-09-26');
    expect(r.endDate).toBe('2026-10-02');
  });

  it('month = mes calendario y anterior = el mismo tramo (1 al mismo día) del mes previo', () => {
    const r = getPeriodRange('month', jueves);
    expect(r.startDate).toBe('2026-09-01');
    expect(r.endDate).toBe('2026-09-30');
    expect(r.prevStartDate).toBe('2026-08-01');
    expect(r.prevEndDate).toBe('2026-08-17');
  });

  it('month: si el mes anterior es más corto, el tramo termina en su último día', () => {
    const r = getPeriodRange('month', new Date(2026, 2, 31)); // 31 mar → feb tiene 28
    expect(r.prevStartDate).toBe('2026-02-01');
    expect(r.prevEndDate).toBe('2026-02-28');
  });

  it('year = año calendario y anterior = del 1 de enero a la misma fecha del año previo', () => {
    const r = getPeriodRange('year', jueves);
    expect(r.startDate).toBe('2026-01-01');
    expect(r.endDate).toBe('2026-12-31');
    expect(r.prevStartDate).toBe('2025-01-01');
    expect(r.prevEndDate).toBe('2025-09-17');
  });
});

describe('getPeriodLabel', () => {
  it('describe el rango real de 7 días', () => {
    expect(getPeriodLabel('week', jueves)).toBe('Últimos 7 días · 11 al 17 de septiembre');
    expect(getPeriodLabel('week', new Date(2026, 9, 2))).toBe('Últimos 7 días · 26 de septiembre al 2 de octubre');
  });

  it('mes y año', () => {
    expect(getPeriodLabel('month', jueves)).toBe('septiembre 2026');
    expect(getPeriodLabel('year', jueves)).toBe('Año 2026');
  });
});

describe('rango personalizado', () => {
  const custom = { start: '2026-08-10', end: '2026-08-20' };

  it('usa las fechas elegidas y compara con la misma cantidad de días previos', () => {
    const r = getPeriodRange('custom', jueves, custom);
    expect(r.startDate).toBe('2026-08-10');
    expect(r.endDate).toBe('2026-08-20');
    // 11 días elegidos → los 11 anteriores
    expect(r.prevStartDate).toBe('2026-07-30');
    expect(r.prevEndDate).toBe('2026-08-09');
  });

  it('sin fechas elegidas se comporta como el mes en curso', () => {
    const r = getPeriodRange('custom', jueves);
    expect(r.startDate).toBe('2026-09-01');
    expect(r.endDate).toBe('2026-09-30');
  });

  it('un solo día también funciona', () => {
    const r = getPeriodRange('custom', jueves, { start: '2026-08-10', end: '2026-08-10' });
    expect(r.startDate).toBe('2026-08-10');
    expect(r.prevStartDate).toBe('2026-08-09');
    expect(r.prevEndDate).toBe('2026-08-09');
  });

  it('describe el rango elegido', () => {
    expect(getPeriodLabel('custom', jueves, custom)).toBe('10 de agosto al 20 de agosto de 2026');
    expect(getPeriodLabel('custom', jueves, { start: '2025-12-20', end: '2026-01-05' }))
      .toBe('20 de diciembre de 2025 al 5 de enero de 2026');
  });
});

describe('getPrevPeriodLabel', () => {
  it('explica contra qué tramo se compara', () => {
    expect(getPrevPeriodLabel('week', jueves)).toBe('los 7 días anteriores (4 de septiembre al 10 de septiembre)');
    expect(getPrevPeriodLabel('month', jueves)).toBe('mismo tramo del mes anterior (1 al 17 de agosto)');
    expect(getPrevPeriodLabel('year', jueves)).toBe('mismo tramo del año anterior (1 de enero al 17 de septiembre de 2025)');
  });
});
