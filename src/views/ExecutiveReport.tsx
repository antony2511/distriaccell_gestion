import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { DailyRegister, StoreId, CashWithdrawal, CashWithdrawalType } from '../types';
import { getDailyRegistersByRange, getCashWithdrawalsByRange } from '../services/dailyRegister.service';
import { formatDateId, formatDateIdLocal, getTodayId, getTodayBogota, getMonthRange } from '../utils/dates';
import { calculateGrossIncome, calculateExpensesTotal, calculateQRBreakdown } from '../utils/calculations';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { formatCurrency } from '../utils/currency';
import { computeProjection } from '../utils/projections';

interface ExecutiveInsights {
  resumenGeneral: string;
  analisisTendencias: string;
  proyecciones: string;
  diasDestacados: string;
  recomendaciones: string;
}

type Preset = '7days' | 'month' | 'custom';

const WITHDRAWAL_TYPE_LABELS: Record<CashWithdrawalType, { label: string; icon: string }> = {
  propietario: { label: 'Retiros del Propietario', icon: 'person' },
  proveedor: { label: 'Pagos a Proveedores', icon: 'local_shipping' },
  prestamo: { label: 'Préstamos', icon: 'handshake' },
  nomina: { label: 'Nómina', icon: 'payments' },
  otro: { label: 'Otros Retiros', icon: 'more_horiz' },
};

const STORE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f97316'];

// ─────────────────────────────────────────────────────────────────────────────
// PDF pagination helper: busca puntos de corte "seguros" (huecos entre
// tarjetas, filas de tabla, etc.) en vez de cortar el canvas a ciegas cada
// X píxeles — así una página no parte una imagen o un párrafo por la mitad.
// ─────────────────────────────────────────────────────────────────────────────
const computeSafeBreakPoints = (root: HTMLElement, canvasHeight: number): number[] => {
  const rootRect = root.getBoundingClientRect();
  const scaleRatio = canvasHeight / rootRect.height;
  const candidates = new Set<number>([0, canvasHeight]);
  const MAX_DEPTH = 6;

  const walk = (container: Element, depth: number) => {
    const kids = Array.from(container.children) as HTMLElement[];
    for (let i = 0; i < kids.length; i++) {
      const kid = kids[i];
      if (i < kids.length - 1) {
        const kidRect = kid.getBoundingClientRect();
        const nextRect = kids[i + 1].getBoundingClientRect();
        if (nextRect.top >= kidRect.bottom) {
          const midY = (kidRect.bottom + nextRect.top) / 2 - rootRect.top;
          if (midY > 0 && midY < rootRect.height) {
            candidates.add(midY * scaleRatio);
          }
        }
      }
      if (depth < MAX_DEPTH) walk(kid, depth + 1);
    }
  };
  walk(root, 0);

  return Array.from(candidates).sort((a, b) => a - b);
};

// ─────────────────────────────────────────────────────────────────────────────
// Access guard wrapper
// ─────────────────────────────────────────────────────────────────────────────
const ExecutiveReport: React.FC = () => {
  const { hasPermission } = useAuth();

  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Solo el gerente puede acceder al reporte ejecutivo.
          </p>
        </div>
      </div>
    );
  }

  return <ExecutiveReportContent />;
};

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────
const ExecutiveReportContent: React.FC = () => {
  const { activeStores, getStoreName } = useAuth();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [preset, setPreset] = useState<Preset>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreId | 'todas'>('todas');

  // ── Data state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── PDF ref ───────────────────────────────────────────────────────────────
  const reportRef = useRef<HTMLDivElement>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [filterRegs, setFilterRegs] = useState<DailyRegister[]>([]);
  const [monthRegs, setMonthRegs] = useState<DailyRegister[]>([]);
  const [prevPeriodRegs, setPrevPeriodRegs] = useState<DailyRegister[]>([]);
  const [periodWithdrawals, setPeriodWithdrawals] = useState<CashWithdrawal[]>([]);

  // ── IA (GPT) — análisis ejecutivo ─────────────────────────────────────────
  const [insights, setInsights] = useState<ExecutiveInsights | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // ── Auto-fill dates on preset change ─────────────────────────────────────
  useEffect(() => {
    const today = getTodayId();
    if (preset === '7days') {
      const start = getTodayBogota();
      start.setDate(start.getDate() - 6);
      setStartDate(formatDateIdLocal(start));
      setEndDate(today);
    } else if (preset === 'month') {
      const { start } = getMonthRange(getTodayBogota());
      setStartDate(formatDateIdLocal(start));
      setEndDate(today);
    }
  }, [preset]);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setHasQueried(true);
    setInsights(null);
    setInsightsError(null);
    try {
      const { start: mStart } = getMonthRange(getTodayBogota());
      const monthStart = formatDateIdLocal(mStart);
      const monthEnd = getTodayId();

      const storeArg = selectedStore === 'todas' ? undefined : selectedStore;
      const fetchAll = selectedStore === 'todas';

      const fetchRange = async (from: string, to: string): Promise<DailyRegister[]> => {
        if (fetchAll) {
          const results = await Promise.all(
            activeStores.map(s => getDailyRegistersByRange(from, to, s.id))
          );
          return results.flat();
        }
        return getDailyRegistersByRange(from, to, storeArg);
      };

      // Reuse filter data if it already covers the current month
      const filterCoversMonth = startDate <= monthStart && endDate >= monthEnd;

      // Rango anterior de la misma duración, inmediatamente antes de startDate,
      // para poder comparar y hablar de tendencias
      const periodMs = new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime();
      const prevEnd = new Date(new Date(startDate + 'T00:00:00').getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - periodMs);

      const [fr, mr, pr, wd] = await Promise.all([
        fetchRange(startDate, endDate),
        filterCoversMonth ? Promise.resolve(null) : fetchRange(monthStart, monthEnd),
        fetchRange(formatDateIdLocal(prevStart), formatDateIdLocal(prevEnd)),
        getCashWithdrawalsByRange(startDate, endDate, storeArg),
      ]);

      setFilterRegs(fr);
      setMonthRegs(mr ?? fr);
      setPrevPeriodRegs(pr);
      setPeriodWithdrawals(wd);
    } catch (err) {
      console.error('Error cargando reporte ejecutivo:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    if (!reportRef.current || !hasQueried) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const element = reportRef.current;

      // Ocultar las secciones marcadas como solo-app (p. ej. Recomendaciones IA)
      // durante la captura; se restauran al final aunque la exportación falle.
      // Debe seguir oculto también cuando computeSafeBreakPoints mide el layout,
      // para que los cortes de página coincidan con el canvas capturado.
      const excludedFromPdf = Array.from(element.querySelectorAll('[data-pdf-exclude]')) as HTMLElement[];
      const previousDisplays = excludedFromPdf.map(el => el.style.display);
      excludedFromPdf.forEach(el => { el.style.display = 'none'; });
      try {

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - margin * 2;
      const pxPerMM = canvas.width / contentW;
      const maxSliceHeightPx = (pageH - margin * 2) * pxPerMM;

      const breakPoints = computeSafeBreakPoints(element, canvas.height);

      let posY = margin;
      let srcY = 0;

      while (srcY < canvas.height) {
        const desiredEnd = Math.min(canvas.height, srcY + maxSliceHeightPx);

        // Busca el punto de corte seguro más cercano por debajo del límite
        // de la página (cae en un hueco entre secciones/tarjetas/filas).
        let cut = desiredEnd;
        for (const bp of breakPoints) {
          if (bp > srcY && bp <= desiredEnd) cut = bp;
        }

        const srcH = cut - srcY;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        const sliceHmm = srcH / pxPerMM;
        pdf.addImage(sliceData, 'JPEG', margin, posY, contentW, sliceHmm);

        srcY = cut;
        if (srcY < canvas.height) {
          pdf.addPage();
          posY = margin;
        }
      }

      const fileName = `reporte-ejecutivo-${startDate || 'distriaccell'}.pdf`;
      pdf.save(fileName);

      } finally {
        excludedFromPdf.forEach((el, i) => { el.style.display = previousDisplays[i]; });
      }
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  }, [hasQueried, startDate]);

  // ── Derived: stores present in filter data ────────────────────────────────
  const storesInData = useMemo(() => {
    if (selectedStore !== 'todas') {
      return activeStores.filter(s => s.id === selectedStore);
    }
    const ids = new Set(filterRegs.map(r => r.storeId));
    return activeStores.filter(s => ids.has(s.id));
  }, [filterRegs, selectedStore, activeStores]);

  // ── Derived: sorted date list in filter range ─────────────────────────────
  const dateList = useMemo(() => {
    const dates = new Set(filterRegs.map(r => r.date));
    return Array.from(dates).sort();
  }, [filterRegs]);

  // ── Derived: income[date][storeId] ───────────────────────────────────────
  const incomeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    filterRegs.forEach(r => {
      if (!matrix[r.date]) matrix[r.date] = {};
      matrix[r.date][r.storeId] = calculateGrossIncome(r);
    });
    return matrix;
  }, [filterRegs]);

  // ── Period totals ──────────────────────────────────────────────────────────
  const periodTotalsByStore = useMemo(() => {
    const totals: Record<string, number> = {};
    filterRegs.forEach(r => {
      totals[r.storeId] = (totals[r.storeId] || 0) + calculateGrossIncome(r);
    });
    return totals;
  }, [filterRegs]);

  const periodGrandTotal = useMemo(
    () => Object.values(periodTotalsByStore).reduce((s: number, v: number) => s + v, 0),
    [periodTotalsByStore]
  );

  const periodDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [startDate, endDate]);

  const periodAvg = useMemo(
    () => periodGrandTotal / periodDays,
    [periodGrandTotal, periodDays]
  );

  // ── Gastos del período (total y por tienda) + resultado neto ────────────
  const expensesByStore = useMemo(() => {
    const totals: Record<string, number> = {};
    filterRegs.forEach(r => {
      totals[r.storeId] = (totals[r.storeId] || 0) + calculateExpensesTotal(r.expenses || []);
    });
    return totals;
  }, [filterRegs]);

  const periodExpenseTotal = useMemo(
    () => Object.values(expensesByStore).reduce((s: number, v: number) => s + v, 0),
    [expensesByStore]
  );

  const periodNetResult = useMemo(
    () => periodGrandTotal - periodExpenseTotal,
    [periodGrandTotal, periodExpenseTotal]
  );

  // ── Desglose QR / Transferencia / Tarjeta del período ────────────────────
  const qrBreakdown = useMemo(() => {
    const allQR = filterRegs.flatMap(r => r.qrPayments || []);
    return calculateQRBreakdown(allQR);
  }, [filterRegs]);

  // ── Gastos del período por categoría ─────────────────────────────────────
  const expensesByCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    filterRegs.forEach(r => {
      (r.expenses || []).forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
      });
    });
    return Object.entries(totals)
      .map(([id, total]) => {
        const cat = EXPENSE_CATEGORIES.find(c => c.id === id);
        return { id, label: cat?.label || id, icon: cat?.icon || '📝', total };
      })
      .sort((a, b) => b.total - a.total);
  }, [filterRegs]);

  // ── Ahorros del período (total y por tienda) ─────────────────────────────
  const savingsByStore = useMemo(() => {
    const totals: Record<string, number> = {};
    filterRegs.forEach(r => {
      totals[r.storeId] = (totals[r.storeId] || 0) + (r.dailySavings || 0);
    });
    return totals;
  }, [filterRegs]);

  const periodSavingsTotal = useMemo(
    () => Object.values(savingsByStore).reduce((s: number, v: number) => s + v, 0),
    [savingsByStore]
  );

  // ── Retiros de caja del período (por tipo y por tienda) ──────────────────
  const withdrawalsByType = useMemo(() => {
    const totals: Partial<Record<CashWithdrawalType, number>> = {};
    periodWithdrawals.forEach(w => {
      totals[w.type] = (totals[w.type] || 0) + w.amount;
    });
    return (Object.keys(WITHDRAWAL_TYPE_LABELS) as CashWithdrawalType[])
      .filter(t => (totals[t] || 0) > 0)
      .map(t => ({ type: t, ...WITHDRAWAL_TYPE_LABELS[t], total: totals[t] || 0 }));
  }, [periodWithdrawals]);

  const periodWithdrawalTotal = useMemo(
    () => periodWithdrawals.reduce((s, w) => s + w.amount, 0),
    [periodWithdrawals]
  );

  const withdrawalsByStore = useMemo(() => {
    const totals: Record<string, number> = {};
    periodWithdrawals.forEach(w => {
      totals[w.storeId] = (totals[w.storeId] || 0) + w.amount;
    });
    return totals;
  }, [periodWithdrawals]);

  // ── Mejores / peores días de venta del período (consolidado todas las tiendas) ──
  const { bestDays, worstDays } = useMemo(() => {
    const byDate: Record<string, number> = {};
    filterRegs.forEach(r => {
      byDate[r.date] = (byDate[r.date] || 0) + calculateGrossIncome(r);
    });
    const sorted = Object.entries(byDate)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => b.total - a.total);
    return {
      bestDays: sorted.slice(0, 3),
      worstDays: sorted.slice(-3).reverse(),
    };
  }, [filterRegs]);

  // ── Comparación con el período inmediatamente anterior (misma duración) ──
  const previousPeriodComparison = useMemo(() => {
    const prevTotal = prevPeriodRegs.reduce((s, r) => s + calculateGrossIncome(r), 0);
    const changePct = prevTotal > 0 ? ((periodGrandTotal - prevTotal) / prevTotal) * 100 : null;
    return { prevTotal, changePct };
  }, [prevPeriodRegs, periodGrandTotal]);

  // ── Weekly avg: rolling last 7 days (from monthRegs) ─────────────────────
  const weeklyAvg = useMemo(() => {
    const now = new Date();
    const cutoff = formatDateId(new Date(now.getTime() - 6 * 86400000));
    const today = formatDateId(now);
    const last7 = monthRegs.filter(r => r.date >= cutoff && r.date <= today);
    return last7.reduce((s, r) => s + calculateGrossIncome(r), 0) / 7;
  }, [monthRegs]);

  // ── Monthly avg: month total / calendar days elapsed ─────────────────────
  const { monthlyAvg, daysElapsed } = useMemo(() => {
    const daysElapsed = getTodayBogota().getDate();
    const total = monthRegs.reduce((s, r) => s + calculateGrossIncome(r), 0);
    return { monthlyAvg: total / daysElapsed, daysElapsed };
  }, [monthRegs]);

  // ── Projection: current month, all stores consolidated ────────────────────
  const projection = useMemo(() => {
    const now = new Date();
    const today = formatDateId(now);
    const yearMonth = today.substring(0, 7);
    const byDate: Record<string, number> = {};
    monthRegs.forEach(r => {
      byDate[r.date] = (byDate[r.date] || 0) + calculateGrossIncome(r);
    });
    const points = Object.entries(byDate).map(([date, value]) => ({ date, value }));
    return computeProjection(points, yearMonth, today);
  }, [monthRegs]);

  // ── Chart data: full current month ───────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date();
    const today = formatDateId(now);
    const yearMonth = today.substring(0, 7);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Consolidated actual per day
    const actualByDate: Record<string, number> = {};
    monthRegs.forEach(r => {
      actualByDate[r.date] = (actualByDate[r.date] || 0) + calculateGrossIncome(r);
    });

    // Per-store actual per day
    const storeByDate: Record<string, Record<string, number>> = {};
    monthRegs.forEach(r => {
      if (!storeByDate[r.storeId]) storeByDate[r.storeId] = {};
      storeByDate[r.storeId][r.date] = calculateGrossIncome(r);
    });

    const projMap = Object.fromEntries(projection.projectedDays.map(p => [p.date, p.value]));

    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const isPast = dateStr <= today;

      const point: Record<string, any> = {
        day: d,
        label: String(d),
        date: dateStr,
        actual: isPast ? (actualByDate[dateStr] ?? 0) : null,
        projected: !isPast ? (projMap[dateStr] ?? null) : null,
      };

      storesInData.forEach(store => {
        point[`s_${store.id}`] = isPast ? (storeByDate[store.id]?.[dateStr] ?? 0) : null;
      });

      return point;
    });
  }, [monthRegs, projection, storesInData]);

  // ── Per-store projections ─────────────────────────────────────────────────
  const storeProjections = useMemo(() => {
    const now = new Date();
    const today = formatDateId(now);
    const yearMonth = today.substring(0, 7);

    return storesInData.map(store => {
      const storeMonthRegs = monthRegs.filter(r => r.storeId === store.id);
      const byDate: Record<string, number> = {};
      storeMonthRegs.forEach(r => { byDate[r.date] = calculateGrossIncome(r); });
      const points = Object.entries(byDate).map(([date, value]) => ({ date, value }));
      const proj = computeProjection(points, yearMonth, today);
      return { store, proj };
    });
  }, [storesInData, monthRegs]);

  // ── Generar análisis ejecutivo con IA ─────────────────────────────────────
  // Solo enviamos números ya calculados por nosotros — GPT únicamente los
  // explica/interpreta en texto, nunca calcula ni inventa cifras.
  const generateInsights = useCallback(async () => {
    setGeneratingInsights(true);
    setInsightsError(null);
    try {
      const payload = {
        periodo: { desde: startDate, hasta: endDate, dias: periodDays },
        tienda: selectedStore === 'todas' ? 'Todas las tiendas' : getStoreName(selectedStore),
        ingresos: {
          totalPeriodo: periodGrandTotal,
          porTienda: Object.fromEntries(
            Object.entries(periodTotalsByStore).map(([id, v]) => [getStoreName(id), v])
          ),
          promedioDiarioPeriodo: periodAvg,
          promedioUltimos7Dias: weeklyAvg,
          promedioMensual: monthlyAvg,
        },
        gastos: {
          totalPeriodo: periodExpenseTotal,
          porTienda: Object.fromEntries(
            Object.entries(expensesByStore).map(([id, v]) => [getStoreName(id), v])
          ),
          porCategoria: Object.fromEntries(
            expensesByCategory.map(c => [c.label, c.total])
          ),
        },
        otrasSalidas: {
          ahorrosPeriodo: periodSavingsTotal,
          retirosCajaTotal: periodWithdrawalTotal,
          retirosPorTipo: Object.fromEntries(
            withdrawalsByType.map(w => [w.label, w.total])
          ),
        },
        resultadoNetoPeriodo: periodNetResult,
        ingresosBancarios: qrBreakdown,
        comparacionPeriodoAnterior: {
          totalPeriodoAnterior: previousPeriodComparison.prevTotal,
          variacionPorcentual: previousPeriodComparison.changePct,
        },
        mejoresDias: bestDays,
        peoresDias: worstDays,
        proyeccionCierreMes: projection,
        proyeccionPorTienda: storeProjections.map(({ store, proj }) => ({
          tienda: store.name,
          proyeccion: proj,
        })),
      };

      const res = await fetch('/api/generate-executive-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || 'Error al generar el análisis');
      }

      const data: ExecutiveInsights = await res.json();
      setInsights(data);
    } catch (err: any) {
      console.error('Error al generar análisis con IA:', err);
      setInsightsError(err.message || 'Error al generar el análisis con IA');
    } finally {
      setGeneratingInsights(false);
    }
  }, [
    startDate, endDate, periodDays, selectedStore, getStoreName,
    periodGrandTotal, periodTotalsByStore, periodAvg, weeklyAvg, monthlyAvg,
    periodExpenseTotal, expensesByStore, expensesByCategory, periodSavingsTotal,
    periodWithdrawalTotal, withdrawalsByType, periodNetResult, qrBreakdown,
    previousPeriodComparison, bestDays, worstDays, projection, storeProjections,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Header + Filters ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-black mb-1">📈 Reporte Ejecutivo</h2>
            <p className="text-emerald-100 text-sm">
              Promedios, tendencias y proyección de cierre del mes
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['7days', 'month', 'custom'] as Preset[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  preset === p ? 'bg-white text-emerald-600' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {p === '7days' ? '7 días' : p === 'month' ? 'Mes actual' : 'Personalizado'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end border-t border-white/20 pt-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-bold text-emerald-100 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setPreset('custom'); setStartDate(e.target.value); }}
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white focus:outline-none focus:bg-white/30"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-bold text-emerald-100 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setPreset('custom'); setEndDate(e.target.value); }}
              className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white focus:outline-none focus:bg-white/30"
            />
          </div>
          {activeStores.length > 1 && (
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-emerald-100 mb-1">Tienda</label>
              <select
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white focus:outline-none focus:bg-white/30 [&>option]:text-slate-900"
              >
                <option value="todas">Todas las tiendas</option>
                {activeStores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={loadData}
              disabled={loading || !startDate || !endDate}
              className="px-6 py-2 bg-white text-emerald-700 rounded-lg font-black text-sm hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? 'Cargando...' : 'Consultar'}
            </button>
            {hasQueried && !loading && (
              <button
                onClick={generateInsights}
                disabled={generatingInsights}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined !text-[18px]">auto_awesome</span>
                {generatingInsights ? 'Analizando...' : insights ? 'Regenerar Análisis IA' : 'Generar Análisis con IA'}
              </button>
            )}
            {hasQueried && !loading && (
              <button
                onClick={exportPDF}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined !text-[18px]">picture_as_pdf</span>
                {exporting ? 'Generando...' : 'PDF'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Calculando análisis ejecutivo...</p>
          </div>
        </div>
      )}

      {/* ── Empty / initial state ────────────────────────────────────────── */}
      {!loading && !hasQueried && (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-8xl block mb-4">
            trending_up
          </span>
          <p className="text-slate-500 font-medium text-lg">
            Selecciona un período y presiona Consultar
          </p>
          <p className="text-slate-400 text-sm mt-1">
            El reporte incluye promedios, desglose diario por tienda y proyección del cierre del mes
          </p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {!loading && hasQueried && (
        <div ref={reportRef} className="space-y-8">
          {/* ── Resumen Ejecutivo (IA) ── */}
          {insightsError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-400">
              {insightsError}
            </div>
          )}
          {insights && (
            <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">auto_awesome</span>
                Resumen Ejecutivo
              </h3>
              <div className="space-y-4">
                <InsightSection title="Resumen General" text={insights.resumenGeneral} />
                <InsightSection title="Análisis de Tendencias" text={insights.analisisTendencias} />
                <InsightSection title="Proyecciones" text={insights.proyecciones} />
                <InsightSection title="Días Destacados" text={insights.diasDestacados} />
                {/* Solo visible en la app: se excluye del PDF exportado */}
                <div data-pdf-exclude>
                  <InsightSection title="Recomendaciones" text={insights.recomendaciones} />
                  <p className="text-[11px] italic text-slate-400 mt-1">
                    Las recomendaciones son de uso interno — no se incluyen en el PDF exportado
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Ingresos, Gastos y Resultado Neto ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label="Ingresos del período"
              value={formatCurrency(periodGrandTotal)}
              sub={
                previousPeriodComparison.changePct !== null
                  ? `${previousPeriodComparison.changePct >= 0 ? '▲' : '▼'} ${Math.abs(previousPeriodComparison.changePct).toFixed(1)}% vs período anterior`
                  : 'Sin período anterior para comparar'
              }
              icon="payments"
              iconColor="text-emerald-500"
              valueColor="text-emerald-600"
            />
            <KpiCard
              label="Gastos del período"
              value={formatCurrency(periodExpenseTotal)}
              sub={`${periodGrandTotal > 0 ? ((periodExpenseTotal / periodGrandTotal) * 100).toFixed(1) : '0'}% de los ingresos`}
              icon="shopping_cart"
              iconColor="text-red-500"
              valueColor="text-red-600"
            />
            <KpiCard
              label="Resultado neto"
              value={formatCurrency(periodNetResult)}
              sub="Ingresos - Gastos del período"
              icon="account_balance"
              iconColor={periodNetResult >= 0 ? 'text-blue-500' : 'text-red-500'}
              valueColor={periodNetResult >= 0 ? 'text-blue-600' : 'text-red-600'}
            />
          </div>

          {/* ── Ingresos Bancarios (QR/Transferencia) ── */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">qr_code_2</span>
              Ingresos Bancarios (QR / Transferencia)
            </h3>
            <p className="text-sm text-slate-500 mb-4">Dinero que fue directo a la cuenta bancaria, no a caja física</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">QR</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(qrBreakdown.qr)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Transferencia</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(qrBreakdown.transferencia)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Tarjeta</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(qrBreakdown.tarjeta)}</p>
              </div>
            </div>
          </div>

          {/* ── Gastos por Categoría ── */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">receipt_long</span>
              Gastos del Período por Categoría
            </h3>
            <p className="text-sm text-slate-500 mb-4">Gastos operativos registrados en los cierres diarios</p>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-slate-400">Sin gastos registrados en el período</p>
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map(cat => {
                  const pct = periodExpenseTotal > 0 ? (cat.total / periodExpenseTotal) * 100 : 0;
                  return (
                    <div key={cat.id}>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-700 dark:text-slate-300">{cat.icon} {cat.label}</span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {formatCurrency(cat.total)}
                          <span className="ml-2 text-xs font-bold text-slate-400">{pct.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
                  <span className="font-bold text-slate-500">Total gastos</span>
                  <span className="font-black text-red-600">{formatCurrency(periodExpenseTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Otras Salidas de Dinero: Ahorros y Retiros de Caja ── */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">move_up</span>
              Otras Salidas de Dinero del Período
            </h3>
            <p className="text-sm text-slate-500 mb-4">Ahorros apartados y retiros de caja (nómina, proveedores, propietario)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
                <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase mb-1">Ahorros del período</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(periodSavingsTotal)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Total retiros de caja</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(periodWithdrawalTotal)}</p>
              </div>
            </div>
            {withdrawalsByType.length === 0 ? (
              <p className="text-sm text-slate-400">Sin retiros de caja registrados en el período</p>
            ) : (
              <div className="space-y-2">
                {withdrawalsByType.map(w => (
                  <div key={w.type} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="material-symbols-outlined text-base text-amber-500">{w.icon}</span>
                      {w.label}
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">{formatCurrency(w.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Resumen Financiero por Tienda ── */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">storefront</span>
              Ingresos y Egresos por Tienda
            </h3>
            <p className="text-sm text-slate-500 mb-4">Resumen financiero del período seleccionado</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-2 pr-2">Tienda</th>
                    <th className="text-right py-2 px-2">Ingresos</th>
                    <th className="text-right py-2 px-2">Gastos</th>
                    <th className="text-right py-2 px-2">Ahorros</th>
                    <th className="text-right py-2 px-2">Retiros</th>
                    <th className="text-right py-2 pl-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {storesInData.map(store => {
                    const income = periodTotalsByStore[store.id] || 0;
                    const expenses = expensesByStore[store.id] || 0;
                    const savings = savingsByStore[store.id] || 0;
                    const withdrawals = withdrawalsByStore[store.id] || 0;
                    const net = income - expenses;
                    return (
                      <tr key={store.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="py-2 pr-2 font-bold text-slate-900 dark:text-white">{getStoreName(store.id)}</td>
                        <td className="py-2 px-2 text-right font-black text-emerald-600">{formatCurrency(income)}</td>
                        <td className="py-2 px-2 text-right font-black text-red-600">{formatCurrency(expenses)}</td>
                        <td className="py-2 px-2 text-right font-black text-yellow-600">{formatCurrency(savings)}</td>
                        <td className="py-2 px-2 text-right font-black text-amber-600">{formatCurrency(withdrawals)}</td>
                        <td className={`py-2 pl-2 text-right font-black ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(net)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="py-2 pr-2 font-black text-slate-900 dark:text-white">TOTAL</td>
                    <td className="py-2 px-2 text-right font-black text-emerald-600">{formatCurrency(periodGrandTotal)}</td>
                    <td className="py-2 px-2 text-right font-black text-red-600">{formatCurrency(periodExpenseTotal)}</td>
                    <td className="py-2 px-2 text-right font-black text-yellow-600">{formatCurrency(periodSavingsTotal)}</td>
                    <td className="py-2 px-2 text-right font-black text-amber-600">{formatCurrency(periodWithdrawalTotal)}</td>
                    <td className={`py-2 pl-2 text-right font-black ${periodNetResult >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(periodNetResult)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Resultado = Ingresos − Gastos. Los ahorros y retiros no restan del resultado: los ahorros siguen siendo
              dinero de la tienda y los retiros (nómina, proveedores, propietario) son salidas de la caja acumulada.
              Los retiros registrados para "ambas" tiendas cuentan en el total pero no en una tienda específica.
            </p>
          </div>

          {/* ── Mejores / Peores días de venta ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">trending_up</span>
                Mejores Días de Venta
              </h3>
              <div className="space-y-2">
                {bestDays.map((d, i) => (
                  <div key={d.date} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-slate-500">#{i + 1} · {d.date}</span>
                    <span className="font-black text-emerald-600">{formatCurrency(d.total)}</span>
                  </div>
                ))}
                {bestDays.length === 0 && <p className="text-sm text-slate-400">Sin datos suficientes</p>}
              </div>
            </div>
            <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500">trending_down</span>
                Días con Menor Venta
              </h3>
              <div className="space-y-2">
                {worstDays.map((d, i) => (
                  <div key={d.date} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-slate-500">#{i + 1} · {d.date}</span>
                    <span className="font-black text-red-500">{formatCurrency(d.total)}</span>
                  </div>
                ))}
                {worstDays.length === 0 && <p className="text-sm text-slate-400">Sin datos suficientes</p>}
              </div>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={`Prom. diario período (${periodDays}d)`}
              value={formatCurrency(periodAvg)}
              sub={`Total: ${formatCurrency(periodGrandTotal)}`}
              icon="today"
              iconColor="text-emerald-500"
              valueColor="text-emerald-600"
            />
            <KpiCard
              label="Prom. últimos 7 días"
              value={formatCurrency(weeklyAvg)}
              sub="Media diaria rolling"
              icon="date_range"
              iconColor="text-blue-500"
              valueColor="text-blue-600"
            />
            <KpiCard
              label={`Prom. mensual (${daysElapsed}d trans.)`}
              value={formatCurrency(monthlyAvg)}
              sub="Mes en curso / días transcurridos"
              icon="calendar_month"
              iconColor="text-purple-500"
              valueColor="text-purple-600"
            />
            <KpiCard
              label="Proyección cierre del mes"
              value={formatCurrency(projection.projected)}
              sub={`Acumulado ${formatCurrency(projection.actual)} + Est. ${formatCurrency(projection.remaining)}`}
              icon="show_chart"
              iconColor="text-orange-500"
              valueColor="text-orange-600"
            />
          </div>

          {/* ── Projection Chart ── */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">show_chart</span>
                Ventas Diarias + Proyección de Cierre
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Mes en curso · Línea sólida = real · Línea punteada = proyectado (regresión lineal)
              </p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const formatted = formatCurrency(value);
                      if (name === 'Real total') return [formatted, name];
                      if (name === 'Proyectado') return [formatted, name];
                      const store = activeStores.find(s => `s_${s.id}` === name);
                      return [formatted, store?.name || name];
                    }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend />

                  {/* Per-store lines (only when multiple stores) */}
                  {storesInData.length > 1 && storesInData.map((store, i) => (
                    <Line
                      key={store.id}
                      type="monotone"
                      dataKey={`s_${store.id}`}
                      name={store.name}
                      stroke={STORE_COLORS[i % STORE_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}

                  {/* Consolidated actual */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Real total"
                    stroke="#10b981"
                    strokeWidth={storesInData.length > 1 ? 2.5 : 3}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />

                  {/* Projected */}
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name="Proyectado"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Daily table ── */}
          {dateList.length > 0 ? (
            <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">table_rows</span>
                Ventas Diarias por Tienda
              </h3>
              <p className="text-sm text-slate-500 mb-4">Desglose día a día — período seleccionado</p>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        Fecha
                      </th>
                      {storesInData.map(store => (
                        <th
                          key={store.id}
                          className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase"
                        >
                          {store.name}
                        </th>
                      ))}
                      {storesInData.length > 1 && (
                        <th className="text-right py-3 px-4 text-xs font-bold text-emerald-600 uppercase">
                          Total día
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dateList.map(date => {
                      const [y, m, d] = date.split('-');
                      const dateLabel = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                        .toLocaleDateString('es-CO', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        });
                      const dayStores: Record<string, number> = incomeMatrix[date] || {};
                      const dayTotal = Object.values(dayStores).reduce((s: number, v: number) => s + v, 0);

                      return (
                        <tr
                          key={date}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white capitalize">
                            {dateLabel}
                          </td>
                          {storesInData.map(store => (
                            <td key={store.id} className="py-3 px-4 text-right tabular-nums">
                              {dayStores[store.id] != null ? (
                                <span className="font-bold text-blue-600">
                                  {formatCurrency(dayStores[store.id])}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          ))}
                          {storesInData.length > 1 && (
                            <td className="py-3 px-4 text-right tabular-nums font-black text-emerald-600">
                              {formatCurrency(dayTotal)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white text-xs uppercase">
                        Total período
                      </td>
                      {storesInData.map(store => (
                        <td
                          key={store.id}
                          className="py-3 px-4 text-right font-black text-blue-600 tabular-nums"
                        >
                          {formatCurrency(periodTotalsByStore[store.id] || 0)}
                        </td>
                      ))}
                      {storesInData.length > 1 && (
                        <td className="py-3 px-4 text-right font-black text-emerald-600 tabular-nums">
                          {formatCurrency(periodGrandTotal)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl block mb-4">
                inbox
              </span>
              <p className="text-slate-500 font-medium">No hay registros para el rango seleccionado</p>
            </div>
          )}

          {/* ── Per-store analysis cards ── */}
          {storesInData.length > 0 && (
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500">storefront</span>
                Análisis por Tienda
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storeProjections.map(({ store, proj }, i) => {
                  const periodTotal = periodTotalsByStore[store.id] || 0;
                  const periodAvgStore = periodTotal / periodDays;
                  const progress = proj.projected > 0
                    ? Math.min(100, (proj.actual / proj.projected) * 100)
                    : 0;
                  const color = STORE_COLORS[i % STORE_COLORS.length];

                  return (
                    <div
                      key={store.id}
                      className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="size-10 rounded-xl flex items-center justify-center text-white font-black text-sm"
                          style={{ backgroundColor: color }}
                        >
                          {store.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">{store.name}</p>
                          <p className="text-xs text-slate-500">Período: {periodDays} días</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <StoreStatRow
                          label="Total período"
                          value={formatCurrency(periodTotal)}
                          bold
                        />
                        <StoreStatRow
                          label="Prom. diario"
                          value={formatCurrency(periodAvgStore)}
                          color="text-blue-600"
                        />
                        <StoreStatRow
                          label="Prom. 7 días"
                          value={formatCurrency(
                            (() => {
                              const now = new Date();
                              const cutoff = formatDateId(new Date(now.getTime() - 6 * 86400000));
                              const today = formatDateId(now);
                              const last7 = monthRegs.filter(
                                r => r.storeId === store.id && r.date >= cutoff && r.date <= today
                              );
                              return last7.reduce((s, r) => s + calculateGrossIncome(r), 0) / 7;
                            })()
                          )}
                          color="text-purple-600"
                        />
                        <StoreStatRow
                          label="Proyección mes"
                          value={formatCurrency(proj.projected)}
                          color="text-emerald-600"
                          bold
                        />

                        {/* Progress bar */}
                        <div className="pt-1">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Avance del mes</span>
                            <span className="font-bold">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress}%`, backgroundColor: color }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>{formatCurrency(proj.actual)} acumulado</span>
                            <span>{formatCurrency(proj.remaining)} estimado</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Consolidated summary card */}
                {storesInData.length > 1 && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="size-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                        <span className="material-symbols-outlined !text-[20px]">store</span>
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">Consolidado</p>
                        <p className="text-xs text-emerald-600 font-bold">Todas las tiendas</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <StoreStatRow label="Total período" value={formatCurrency(periodGrandTotal)} bold />
                      <StoreStatRow
                        label="Prom. diario"
                        value={formatCurrency(periodAvg)}
                        color="text-blue-600"
                      />
                      <StoreStatRow
                        label="Prom. semanal (7d)"
                        value={formatCurrency(weeklyAvg)}
                        color="text-purple-600"
                      />
                      <StoreStatRow
                        label="Prom. mensual"
                        value={formatCurrency(monthlyAvg)}
                        color="text-teal-600"
                      />
                      <div className="border-t border-emerald-200 dark:border-emerald-800 pt-3">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-bold text-slate-500 uppercase">Proyección cierre</span>
                          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(projection.projected)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>{formatCurrency(projection.actual)} acumulado</span>
                          <span>+{formatCurrency(projection.remaining)} estimado</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: string;
  iconColor: string;
  valueColor: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, iconColor, valueColor }) => (
  <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
    <div className="mb-3">
      <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
    </div>
    <p className="text-xs font-bold text-slate-500 uppercase mb-1 leading-tight">{label}</p>
    <p className={`text-xl font-black tabular-nums ${valueColor}`}>{value}</p>
    <p className="text-xs text-slate-400 mt-1 leading-tight">{sub}</p>
  </div>
);

interface StoreStatRowProps {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}

const StoreStatRow: React.FC<StoreStatRowProps> = ({ label, value, color = 'text-slate-900 dark:text-white', bold }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
    <span className={`tabular-nums ${color} ${bold ? 'font-black' : 'font-bold'}`}>{value}</span>
  </div>
);

const InsightSection: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div>
    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">{title}</p>
    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{text}</p>
  </div>
);

export default ExecutiveReport;
