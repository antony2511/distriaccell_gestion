import { describe, it, expect } from 'vitest';
import { getPeriodRange, getPeriodLabel } from './periods';

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

  it('month = mes calendario completo y anterior = mes previo completo', () => {
    const r = getPeriodRange('month', jueves);
    expect(r.startDate).toBe('2026-09-01');
    expect(r.endDate).toBe('2026-09-30');
    expect(r.prevStartDate).toBe('2026-08-01');
    expect(r.prevEndDate).toBe('2026-08-31');
  });

  it('year = año calendario y anterior = año previo', () => {
    const r = getPeriodRange('year', jueves);
    expect(r.startDate).toBe('2026-01-01');
    expect(r.endDate).toBe('2026-12-31');
    expect(r.prevStartDate).toBe('2025-01-01');
    expect(r.prevEndDate).toBe('2025-12-31');
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
