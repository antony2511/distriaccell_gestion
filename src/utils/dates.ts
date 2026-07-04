const TZ = 'America/Bogota';

/**
 * Formatea una fecha en formato legible
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: TZ
  }).format(d);
};

/**
 * Formatea una fecha en formato corto (DD/MM/YYYY)
 */
export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ
  }).format(d);
};

/**
 * Formatea una fecha para usar como ID (YYYY-MM-DD) en hora Colombia
 */
export const formatDateId = (date: Date): string => {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD según hora Colombia
 */
export const getTodayId = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
};

/**
 * Formatea una fecha construida por calendario (new Date(año, mes, día)) usando
 * sus campos locales, SIN conversión de zona horaria.
 * formatDateId es para instantes reales (new Date() / timestamps); usarlo sobre una
 * fecha de calendario corre el día cuando el navegador no está en hora Colombia.
 */
export const formatDateIdLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * "Hoy" según hora Colombia, como Date local a medianoche.
 * Base correcta para aritmética de calendario (rangos de semana/mes/año).
 */
export const getTodayBogota = (): Date => {
  const [y, m, d] = getTodayId().split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Obtiene el rango de fechas de una semana
 */
export const getWeekRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Lunes como primer día
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Obtiene el rango de fechas de un mes
 */
export const getMonthRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Obtiene el rango de fechas de un año
 */
export const getYearRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Obtiene el nombre del día de la semana
 */
export const getDayName = (date: Date): string => {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(date);
};

/**
 * Obtiene el nombre del mes
 */
export const getMonthName = (date: Date): string => {
  return new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(date);
};

/**
 * Verifica si una fecha es hoy
 */
export const isToday = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: TZ }) === new Date().toLocaleDateString('en-CA', { timeZone: TZ });
};

/**
 * Calcula días entre dos fechas
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};

/**
 * Obtiene el rango de fechas de una quincena
 * Q1: del 1 al 15 del mes
 * Q2: del 16 al último día del mes
 */
export const getQuincenaRange = (year: number, month: number, quincena: 'Q1' | 'Q2'): { start: Date; end: Date; startStr: string; endStr: string } => {
  let start: Date;
  let end: Date;
  let startDay: number;
  let endDay: number;

  if (quincena === 'Q1') {
    // Primera quincena: del 1 al 15
    startDay = 1;
    endDay = 15;
  } else {
    // Segunda quincena: del 16 al último día del mes
    startDay = 16;
    endDay = new Date(year, month, 0).getDate(); // Último día del mes
  }

  start = new Date(year, month - 1, startDay);
  end = new Date(year, month - 1, endDay);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Los strings se construyen directamente a partir de los días calendario.
  // No usar formatDateId aquí: convierte a hora Colombia una fecha creada en la
  // zona horaria local del navegador, y si esta difiere el rango se corre un día.
  const mm = String(month).padStart(2, '0');

  return {
    start,
    end,
    startStr: `${year}-${mm}-${String(startDay).padStart(2, '0')}`,
    endStr: `${year}-${mm}-${String(endDay).padStart(2, '0')}`
  };
};

/**
 * Determina la quincena actual basándose en la fecha
 */
export const getCurrentQuincena = (date: Date = new Date()): 'Q1' | 'Q2' => {
  const day = date.getDate();
  return day <= 15 ? 'Q1' : 'Q2';
};

/**
 * Obtiene el último día de un mes
 */
export const getLastDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

/**
 * Formatea el período de una quincena para mostrar
 */
export const formatQuincenaPeriod = (year: number, month: number, quincena: 'Q1' | 'Q2'): string => {
  const monthName = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(year, month - 1, 1));
  const lastDay = getLastDayOfMonth(year, month);

  if (quincena === 'Q1') {
    return `1-15 de ${monthName} ${year}`;
  } else {
    return `16-${lastDay} de ${monthName} ${year}`;
  }
};
