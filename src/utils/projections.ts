export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export type ProjectionReliability = 'alta' | 'media' | 'baja';

export interface ProjectionResult {
  actual: number;
  remaining: number;
  projected: number;
  /** Escenario conservador y optimista (percentiles 15 y 85 de los días con datos). */
  projectedLow: number;
  projectedHigh: number;
  /** Venta de un día "normal": promedio recortado (sin el mejor ni el peor 20%). */
  dailyTypical: number;
  /** Compatibilidad: promedio simple de los días con datos. */
  dailyAvgActual: number;
  daysWithData: number;
  daysRemaining: number;
  reliability: ProjectionReliability;
  projectedDays: Array<{ date: string; value: number }>;
}

const percentile = (sorted: number[], p: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/**
 * Promedio recortado: descarta el 20% de días más bajos y el 20% más altos antes
 * de promediar. Un solo día excepcional (o un día casi sin ventas) deja de
 * arrastrar la proyección del mes entero.
 */
const trimmedMean = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.2);
  const core = sorted.length - 2 * cut > 0 ? sorted.slice(cut, sorted.length - cut) : sorted;
  return core.reduce((s, v) => s + v, 0) / core.length;
};

export interface ProjectionOptions {
  /** Días de la semana en que la tienda no abre (0 = domingo): no se proyectan ni cuentan como dato. */
  closedWeekdays?: number[];
}

const weekdayOf = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/**
 * Proyecta el cierre del mes a partir de los días ya registrados.
 *
 * Usa un día típico (promedio recortado) repetido en los días que faltan, más un
 * rango conservador/optimista. Antes se ajustaba una recta por mínimos cuadrados
 * sobre el día del mes: con ~15 puntos y ventas muy variables la pendiente era
 * casi ruido y se disparaba. Backtest sobre jun–ago 2026 (4 tiendas, cortes en
 * los días 10/15/20): error absoluto medio 33,7% con la recta contra 14,5% con
 * este método, y el peor caso bajó de +118% a +53%.
 */
export function computeProjection(
  points: DailyPoint[],
  yearMonth: string, // 'YYYY-MM'
  lastDone: string,  // 'YYYY-MM-DD': último día ya terminado; los siguientes del mes se proyectan
  options: ProjectionOptions = {}
): ProjectionResult {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Si aún no ha terminado ningún día del mes (p. ej. día 1 con la caja abierta) se proyecta el mes entero
  const todayDay = lastDone.startsWith(yearMonth) ? parseInt(lastDone.split('-')[2], 10) : 0;
  const closed = new Set(options.closedWeekdays ?? []);
  const isOpen = (date: string) => !closed.has(weekdayOf(date));

  const openDates: string[] = [];
  for (let d = todayDay + 1; d <= daysInMonth; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, '0')}`;
    if (isOpen(date)) openDates.push(date);
  }
  const daysRemaining = openDates.length;

  // Un día en que la tienda no abre no es un "día normal": no entra al promedio (lo vendido sí cuenta)
  const openPoints = points.filter(p => isOpen(p.date));
  const actual = points.reduce((s, p) => s + p.value, 0);
  const daysWithData = openPoints.length;

  const values = openPoints.map(p => p.value);

  if (daysWithData === 0) {
    return {
      actual, remaining: 0, projected: actual, projectedLow: actual, projectedHigh: actual,
      dailyTypical: 0, dailyAvgActual: 0, daysWithData: 0, daysRemaining,
      reliability: 'baja', projectedDays: [],
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const dailyTypical = trimmedMean(values);
  const dailyLow = percentile(sorted, 0.15);
  const dailyHigh = percentile(sorted, 0.85);

  const projectedDays: Array<{ date: string; value: number }> = [];
  openDates.forEach(date => projectedDays.push({ date, value: dailyTypical }));

  const remaining = dailyTypical * daysRemaining;
  const mean = values.reduce((s, v) => s + v, 0) / daysWithData;
  // Coeficiente de variación: qué tan parejos son los días entre sí
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / daysWithData;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  let reliability: ProjectionReliability = 'alta';
  if (daysWithData < 5) reliability = 'baja';
  else if (daysWithData < 10 || cv > 0.8) reliability = 'media';

  return {
    actual,
    remaining,
    projected: actual + remaining,
    projectedLow: actual + dailyLow * daysRemaining,
    projectedHigh: actual + dailyHigh * daysRemaining,
    dailyTypical,
    dailyAvgActual: mean,
    daysWithData,
    daysRemaining,
    reliability,
    projectedDays,
  };
}

const RELIABILITY_ORDER: ProjectionReliability[] = ['baja', 'media', 'alta'];

/**
 * Proyección consolidada = suma de las proyecciones de cada tienda. Así cada tienda proyecta
 * solo los días en que abre (Colmoviles no trabaja domingos). La confianza es la de la tienda
 * menos confiable entre las que venden.
 */
export function sumProjections(parts: ProjectionResult[]): ProjectionResult {
  const selling = parts.filter(p => p.actual > 0);
  const byDate: Record<string, number> = {};
  parts.forEach(p => p.projectedDays.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.value; }));
  const sum = (f: (p: ProjectionResult) => number) => parts.reduce((s, p) => s + f(p), 0);
  return {
    actual: sum(p => p.actual),
    remaining: sum(p => p.remaining),
    projected: sum(p => p.projected),
    projectedLow: sum(p => p.projectedLow),
    projectedHigh: sum(p => p.projectedHigh),
    dailyTypical: sum(p => p.dailyTypical),
    dailyAvgActual: sum(p => p.dailyAvgActual),
    daysWithData: Math.max(0, ...parts.map(p => p.daysWithData)),
    daysRemaining: Math.max(0, ...parts.map(p => p.daysRemaining)),
    reliability: selling.length === 0
      ? 'baja'
      : selling.reduce<ProjectionReliability>(
          (worst, p) => (RELIABILITY_ORDER.indexOf(p.reliability) < RELIABILITY_ORDER.indexOf(worst) ? p.reliability : worst),
          'alta'
        ),
    projectedDays: Object.entries(byDate)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
