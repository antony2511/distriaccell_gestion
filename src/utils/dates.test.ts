import { describe, it, expect } from 'vitest';
import { formatDateIdLocal, getQuincenaRange, getWeekRange, getMonthRange } from './dates';

describe('rangos de calendario (sin conversión de zona horaria)', () => {
  it('getQuincenaRange construye los strings desde los días calendario', () => {
    const q1 = getQuincenaRange(2026, 6, 'Q1');
    const q2 = getQuincenaRange(2026, 6, 'Q2');
    expect(q1.startStr).toBe('2026-06-01');
    expect(q1.endStr).toBe('2026-06-15');
    expect(q2.startStr).toBe('2026-06-16');
    expect(q2.endStr).toBe('2026-06-30');
  });

  it('Q2 de febrero termina el 28 (o 29 en bisiesto)', () => {
    expect(getQuincenaRange(2026, 2, 'Q2').endStr).toBe('2026-02-28');
    expect(getQuincenaRange(2028, 2, 'Q2').endStr).toBe('2028-02-29');
  });

  it('formatDateIdLocal usa los campos locales de la fecha', () => {
    expect(formatDateIdLocal(new Date(2026, 8, 17))).toBe('2026-09-17');
    expect(formatDateIdLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('getWeekRange va de lunes a domingo', () => {
    const { start, end } = getWeekRange(new Date(2026, 8, 17)); // jueves 17 sep 2026
    expect(formatDateIdLocal(start)).toBe('2026-09-14');
    expect(formatDateIdLocal(end)).toBe('2026-09-20');
    const sunday = getWeekRange(new Date(2026, 8, 20)); // domingo pertenece a la semana que empezó el lunes 14
    expect(formatDateIdLocal(sunday.start)).toBe('2026-09-14');
  });

  it('getMonthRange cubre del 1 al último día', () => {
    const { start, end } = getMonthRange(new Date(2026, 8, 17));
    expect(formatDateIdLocal(start)).toBe('2026-09-01');
    expect(formatDateIdLocal(end)).toBe('2026-09-30');
  });
});
