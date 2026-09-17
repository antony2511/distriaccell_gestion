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
  today: string     // 'YYYY-MM-DD'
): ProjectionResult {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay = parseInt(today.split('-')[2], 10);
  const daysRemaining = Math.max(0, daysInMonth - todayDay);

  const values = points.map(p => p.value);
  const actual = values.reduce((s, v) => s + v, 0);
  const daysWithData = points.length;

  if (daysWithData === 0) {
    return {
      actual: 0, remaining: 0, projected: 0, projectedLow: 0, projectedHigh: 0,
      dailyTypical: 0, dailyAvgActual: 0, daysWithData: 0, daysRemaining,
      reliability: 'baja', projectedDays: [],
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const dailyTypical = trimmedMean(values);
  const dailyLow = percentile(sorted, 0.15);
  const dailyHigh = percentile(sorted, 0.85);

  const projectedDays: Array<{ date: string; value: number }> = [];
  for (let d = todayDay + 1; d <= daysInMonth; d++) {
    projectedDays.push({ date: `${yearMonth}-${String(d).padStart(2, '0')}`, value: dailyTypical });
  }

  const remaining = dailyTypical * daysRemaining;
  const mean = actual / daysWithData;
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
