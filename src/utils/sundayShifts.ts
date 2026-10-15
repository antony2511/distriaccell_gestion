import { DailyRegister, ShiftData } from '../types';
import { isColombianHoliday } from './holidays';

/**
 * Domingos y festivos en accell (almacen-2): la caja se cierra dos veces, mañana y tarde, y cada cierre
 * (arqueo) es independiente y CADA TURNO EMPIEZA DE CERO (POS, cuaderno, servicios, QR, crédito, gastos
 * y ahorro). El día sigue siendo UN solo documento, cuyos totales son la suma de los dos turnos.
 */

const emptyShift = (): ShiftData => ({
  systemSales: 0,
  notebookSales: [],
  technicalServices: [],
  qrPayments: [],
  creditSales: [],
  expenses: [],
  dailySavings: 0,
});

/** Turno vacío: así arranca la tarde. */
export const emptyShiftData = emptyShift;

/** Toma de un registro solo los campos de ingresos/gastos de un turno. */
export const toShiftData = (source: Partial<ShiftData> | Partial<DailyRegister> | undefined | null): ShiftData => ({
  systemSales: source?.systemSales ?? 0,
  notebookSales: source?.notebookSales ?? [],
  technicalServices: source?.technicalServices ?? [],
  qrPayments: source?.qrPayments ?? [],
  creditSales: source?.creditSales ?? [],
  expenses: source?.expenses ?? [],
  dailySavings: source?.dailySavings ?? 0,
});

/** Suma de dos turnos: importes sumados y listas juntas (mañana primero). Son los totales del día. */
export const mergeShiftData = (morning: Partial<ShiftData>, afternoon: Partial<ShiftData>): ShiftData => {
  const m = toShiftData(morning);
  const a = toShiftData(afternoon);
  return {
    systemSales: m.systemSales + a.systemSales,
    notebookSales: [...m.notebookSales, ...a.notebookSales],
    technicalServices: [...m.technicalServices, ...a.technicalServices],
    qrPayments: [...m.qrPayments, ...a.qrPayments],
    creditSales: [...m.creditSales, ...a.creditSales],
    expenses: [...m.expenses, ...a.expenses],
    dailySavings: m.dailySavings + a.dailySavings,
  };
};

/** Turno 2 en curso: mañana congelada y tarde abierta. La pantalla trabaja solo con la tarde. */
export const isShift2Open = (register: Partial<DailyRegister>): boolean =>
  !!register.shift1Data && !!register.shift2Data && !register.isClosed;


export interface CierreTurno {
  actual: number;
  expected: number;
}

/**
 * Totales del día a partir de los dos arqueos independientes. Son los valores que van en
 * actualCash / expectedCash / difference del día, que consumen Balance General y reportes:
 * el efectivo recogido del domingo es lo contado en la mañana MÁS lo contado en la tarde.
 */
export const combineShifts = (shift1: CierreTurno, shift2: CierreTurno) => ({
  actualCash: shift1.actual + shift2.actual,
  expectedCash: shift1.expected + shift2.expected,
  difference: shift1.actual - shift1.expected + (shift2.actual - shift2.expected),
});

/** Justificación del día: la de cada turno, rotulada, si hubo alguna. */
export const combineJustifications = (
  shift1?: string | null,
  shift2?: string | null
): string | undefined => {
  const j1 = shift1?.trim();
  const j2 = shift2?.trim();
  if (j1 && j2) return `Turno 1: ${j1} · Turno 2: ${j2}`;
  if (j1) return `Turno 1: ${j1}`;
  if (j2) return `Turno 2: ${j2}`;
  return undefined;
};

/** ¿El día tiene el cierre de la tarde independiente (no el modelo anterior de arqueo acumulado)? */
export const hasIndependentShift2 = (register: Partial<DailyRegister>): boolean =>
  !!register.shift1ClosedAt && register.shift2ExpectedCash !== undefined && register.shift2ExpectedCash !== null;

const isSunday = (date: string): boolean => new Date(date + 'T12:00:00').getDay() === 0;

/** Domingo o festivo de accell: los únicos días/tienda con doble turno. */
export const isDoubleShiftDay = (date: string, storeId: string): boolean =>
  storeId === 'almacen-2' && (isSunday(date) || isColombianHoliday(date));

/** Cómo se nombra el día de doble turno en pantalla y en el correo. */
export const doubleShiftDayLabel = (date: string): string => (isSunday(date) ? 'Domingo' : 'Festivo');

/**
 * Desde esta fecha el reporte de los días de doble turno de accell se envía UNA sola vez al terminar el día.
 * Antes se enviaba uno por cada cierre, así que esos días no ofrecen el botón "enviar reporte".
 */
export const SUNDAY_SINGLE_REPORT_FROM = '2026-09-20';
