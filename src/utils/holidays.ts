/**
 * Festivos de Colombia, calculados por año (no hay lista que mantener):
 *  - fijos: 1 ene, 1 may, 20 jul, 7 ago, 8 dic, 25 dic;
 *  - ley Emiliani (pasan al lunes siguiente si no caen en lunes): 6 ene, 19 mar, 29 jun, 15 ago,
 *    12 oct, 1 nov, 11 nov;
 *  - según la Pascua: Jueves y Viernes Santo, y los lunes de Ascensión, Corpus Christi y Sagrado
 *    Corazón.
 *
 * Todo se hace con fechas calendario en UTC y cadenas YYYY-MM-DD: nunca depende de la zona
 * horaria del navegador.
 */

const FIXED: Array<[number, number]> = [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]];
const EMILIANI: Array<[number, number]> = [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]];
// Días desde el domingo de Pascua (los tres últimos ya son el lunes al que se trasladan)
const EASTER_OFFSETS = [-3, -2, 43, 64, 71];

const DAY_MS = 86_400_000;
const toId = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * DAY_MS);

/** Domingo de Pascua (calendario gregoriano, algoritmo de Butcher). */
const easterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

const holidaysByYear = new Map<number, Set<string>>();

/** Festivos de un año, como YYYY-MM-DD. */
export const getColombianHolidays = (year: number): Set<string> => {
  const cached = holidaysByYear.get(year);
  if (cached) return cached;

  const holidays = new Set<string>();
  for (const [month, day] of FIXED) {
    holidays.add(toId(new Date(Date.UTC(year, month - 1, day))));
  }
  for (const [month, day] of EMILIANI) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const untilMonday = (8 - date.getUTCDay()) % 7; // 0 si ya es lunes
    holidays.add(toId(addDays(date, untilMonday)));
  }
  const easter = easterSunday(year);
  for (const offset of EASTER_OFFSETS) {
    holidays.add(toId(addDays(easter, offset)));
  }

  holidaysByYear.set(year, holidays);
  return holidays;
};

/** ¿La fecha (YYYY-MM-DD) es festivo en Colombia? */
export const isColombianHoliday = (date: string): boolean =>
  getColombianHolidays(Number(date.slice(0, 4))).has(date);
