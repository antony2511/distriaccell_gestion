/**
 * Días de la semana en que cada tienda NO abre (0 = domingo … 6 = sábado). Sirve para que los
 * promedios diarios y la proyección del mes no cuenten días en que la tienda no trabaja.
 * Si una tienda no aparece aquí, abre todos los días.
 */
const CLOSED_WEEKDAYS: Record<string, number[]> = {
  // Colmoviles no trabaja los domingos
  L6UWRlktKPsgDVYPCxh2: [0],
};

export const getClosedWeekdays = (storeId: string): number[] => CLOSED_WEEKDAYS[storeId] ?? [];

/** ¿La tienda abre ese día (YYYY-MM-DD)? */
export const storeOpensOn = (storeId: string, date: string): boolean => {
  const closed = CLOSED_WEEKDAYS[storeId];
  if (!closed) return true;
  const [y, m, d] = date.split('-').map(Number);
  return !closed.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
};
