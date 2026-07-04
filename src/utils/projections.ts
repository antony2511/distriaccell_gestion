export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface ProjectionResult {
  actual: number;
  remaining: number;
  projected: number;
  dailyAvgActual: number;
  projectedDays: Array<{ date: string; value: number }>;
}

export function computeProjection(
  points: DailyPoint[],
  yearMonth: string, // 'YYYY-MM'
  today: string     // 'YYYY-MM-DD'
): ProjectionResult {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay = parseInt(today.split('-')[2], 10);

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const actual = sorted.reduce((s, p) => s + p.value, 0);
  const n = sorted.length;

  if (n === 0) {
    return { actual: 0, remaining: 0, projected: 0, dailyAvgActual: 0, projectedDays: [] };
  }

  const dailyAvgActual = actual / n;

  // Use day-of-month as x for regression
  const xs = sorted.map(p => parseInt(p.date.split('-')[2], 10));
  const ys = sorted.map(p => p.value);

  let slope = 0;
  let intercept = dailyAvgActual;

  if (n >= 2) {
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom !== 0) {
      slope = (n * sumXY - sumX * sumY) / denom;
      intercept = (sumY - slope * sumX) / n;
    }
  }

  const projectedDays: Array<{ date: string; value: number }> = [];
  let remaining = 0;

  for (let d = todayDay + 1; d <= daysInMonth; d++) {
    const value = Math.max(0, slope * d + intercept);
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    projectedDays.push({ date: dateStr, value });
    remaining += value;
  }

  return { actual, remaining, projected: actual + remaining, dailyAvgActual, projectedDays };
}
