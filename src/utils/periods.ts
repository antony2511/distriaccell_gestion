import { formatDateIdLocal, getMonthName, getMonthRange, getTodayBogota, getYearRange } from './dates';

/**
 * Períodos rápidos compartidos por Dashboard, Reportes, Balance General y Gastos.
 * Una sola definición para que "7 días" / "Mes" / "Año" signifiquen lo mismo en
 * todas las pantallas:
 *   week  = últimos 7 días (hoy incluido) — no la semana calendario, que los
 *           lunes apenas arranca y dejaba las vistas vacías
 *   month = mes calendario en curso
 *   year  = año calendario en curso
 * El período anterior tiene la misma duración e inmediatamente precede al actual.
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
    ({ start: prevStart, end: prevEnd } = getMonthRange(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
  } else {
    ({ start, end } = getYearRange(today));
    ({ start: prevStart, end: prevEnd } = getYearRange(new Date(today.getFullYear() - 1, 0, 1)));
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
