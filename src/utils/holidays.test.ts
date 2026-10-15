import { describe, it, expect } from 'vitest';
import { getColombianHolidays, isColombianHoliday } from './holidays';

describe('festivos de Colombia', () => {
  it('2026: los 18 festivos del calendario oficial', () => {
    expect([...getColombianHolidays(2026)].sort()).toEqual([
      '2026-01-01', // Año Nuevo
      '2026-01-12', // Reyes Magos (6 ene → lunes)
      '2026-03-23', // San José (19 mar → lunes)
      '2026-04-02', // Jueves Santo
      '2026-04-03', // Viernes Santo
      '2026-05-01', // Día del Trabajo
      '2026-05-18', // Ascensión
      '2026-06-08', // Corpus Christi
      '2026-06-15', // Sagrado Corazón
      '2026-06-29', // San Pedro y San Pablo (ya cae lunes)
      '2026-07-20', // Independencia
      '2026-08-07', // Batalla de Boyacá
      '2026-08-17', // Asunción (15 ago → lunes)
      '2026-10-12', // Día de la Raza (ya cae lunes)
      '2026-11-02', // Todos los Santos (1 nov → lunes)
      '2026-11-16', // Independencia de Cartagena (11 nov → lunes)
      '2026-12-08', // Inmaculada Concepción
      '2026-12-25', // Navidad
    ]);
  });

  it('2027: los 18 festivos del calendario oficial', () => {
    expect([...getColombianHolidays(2027)].sort()).toEqual([
      '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26', '2027-05-01',
      '2027-05-10', '2027-05-31', '2027-06-07', '2027-07-05', '2027-07-20', '2027-08-07',
      '2027-08-16', '2027-10-18', '2027-11-01', '2027-11-15', '2027-12-08', '2027-12-25',
    ]);
  });

  it('un festivo trasladado NO lo es en su fecha original', () => {
    expect(isColombianHoliday('2026-01-06')).toBe(false); // Reyes pasó al lunes 12
    expect(isColombianHoliday('2026-01-12')).toBe(true);
    expect(isColombianHoliday('2027-10-12')).toBe(false); // martes → lunes 18
    expect(isColombianHoliday('2027-10-18')).toBe(true);
  });

  it('un día corriente no es festivo', () => {
    expect(isColombianHoliday('2026-10-13')).toBe(false);
    expect(isColombianHoliday('2026-09-21')).toBe(false);
  });
});
