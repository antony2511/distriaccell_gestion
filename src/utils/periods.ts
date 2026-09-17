import { formatDateIdLocal, getMonthName, getMonthRange, getTodayBogota, getYearRange } from './dates';

/**
 * Períodos rápidos compartidos por Dashboard, Reportes, Balance General y Gastos.
 * Una sola definición para que "7 días" / "Mes" / "Año" signifiquen lo mismo en
 * todas las pantallas:
 *   week  = últimos 7 días (hoy incluido) — no la semana calendario, que los
 *           lunes apenas arranca y dejaba las vistas vacías
 *   month = mes calendario en curso
 *   year  = año calendario en curso
 * El período anterior es el MISMO TRAMO del período previo, para comparar
 * manzanas con manzanas a mitad de mes/año:
 *   week  → los 7 días inmediatamente anteriores
 *   month → del 1 al mismo día del mes anterior (o su último día si es más corto)
 *   year  → del 1 de enero a la misma fecha del año anterior
 * Comparar el mes en curso (a la fecha) contra el mes pasado COMPLETO hacía que
 * las ventas siempre "bajaran" y los gastos siempre "mejoraran" a principio de mes.
 */
export type PeriodType = 'week' | 'month' | 'year';

export const PERIOD_LABELS: Record<PeriodType, string> = {
  week: '7 días',
  month: 'Mes',
  year: 'Año',
};

export interface PeriodRange {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const getPeriodRange = (period: PeriodType, today: Date = getTodayBogota()): PeriodRange => {
  let start: Date;
  let end: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (period === 'week') {
    end = new Date(today);
    start = addDays(today, -6);
    prevEnd = addDays(start, -1);
    prevStart = addDays(prevEnd, -6);
  } else if (period === 'month') {
    ({ start, end } = getMonthRange(today));
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrevMonth = getMonthRange(prevMonth).end.getDate();
    prevStart = prevMonth;
    prevEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), Math.min(today.getDate(), lastDayPrevMonth));
  } else {
    ({ start, end } = getYearRange(today));
    prevStart = new Date(today.getFullYear() - 1, 0, 1);
    // 29 de febrero no existe el año anterior: Date lo corre al 1 de marzo, que es lo esperado
    prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  }

  return {
    start,
    end,
    startDate: formatDateIdLocal(start),
    endDate: formatDateIdLocal(end),
    prevStartDate: formatDateIdLocal(prevStart),
    prevEndDate: formatDateIdLocal(prevEnd),
  };
};

const dayMonth = (d: Date) => `${d.getDate()} de ${getMonthName(d)}`;

/** Describe con qué se compara: "mismo tramo del mes anterior (1 al 17 de agosto)". */
export const getPrevPeriodLabel = (period: PeriodType, today: Date = getTodayBogota()): string => {
  const { prevStartDate, prevEndDate } = getPeriodRange(period, today);
  const ps = new Date(prevStartDate + 'T12:00:00');
  const pe = new Date(prevEndDate + 'T12:00:00');
  if (period === 'week') return `los 7 días anteriores (${dayMonth(ps)} al ${dayMonth(pe)})`;
  if (period === 'month') return `mismo tramo del mes anterior (1 al ${dayMonth(pe)})`;
  return `mismo tramo del año anterior (1 de enero al ${dayMonth(pe)} de ${pe.getFullYear()})`;
};

export const getPeriodLabel = (period: PeriodType, today: Date = getTodayBogota()): string => {
  if (period === 'week') {
    const { start } = getPeriodRange('week', today);
    const sameMonth = start.getMonth() === today.getMonth();
    return sameMonth
      ? `Últimos 7 días · ${start.getDate()} al ${today.getDate()} de ${getMonthName(today)}`
      : `Últimos 7 días · ${start.getDate()} de ${getMonthName(start)} al ${today.getDate()} de ${getMonthName(today)}`;
  }
  if (period === 'month') return `${getMonthName(today)} ${today.getFullYear()}`;
  return `Año ${today.getFullYear()}`;
};
