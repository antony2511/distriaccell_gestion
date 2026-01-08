/**
 * Formatea una fecha en formato legible
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
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
    year: 'numeric'
  }).format(d);
};

/**
 * Formatea una fecha para usar como ID (YYYY-MM-DD)
 */
export const formatDateId = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD
 */
export const getTodayId = (): string => {
  return formatDateId(new Date());
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
  const today = new Date();
  return formatDateId(d) === formatDateId(today);
};

/**
 * Calcula días entre dos fechas
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};
