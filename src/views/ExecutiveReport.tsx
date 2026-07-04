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
import { calculateGrossIncome, calculateExpensesTotal, calculateQRBreakdown, calculateNotebookTotal, calculateServicesTotal, calculateQRTotal } from '../utils/calculations';
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

// accell (almacen-2): hasta el 7 jun 2026 los domingos se abría solo hasta las
// 2 pm; desde la nueva administración se abre todo el día
const ACCELL_DOMINGO_DIA_COMPLETO_DESDE = '2026-06-08';
const DOMINGO_HORARIO_ANTERIOR_REF = { date: '2026-06-07', total: 321000 };

const WITHDRAWAL_TYPE_LABELS: Record<CashWithdrawalType, { label: string; icon: string }> = {
  propietario: { label: 'Retiros del Propietario', icon: 'person' },
  proveedor: { label: 'Pagos a Proveedores', icon: 'local_shipping' },
  prestamo: { label: 'Préstamos', icon: 'handshake' },
  nomina: { label: 'Nómina', icon: 'payments' },
  otro: { label: 'Otros Retiros', icon: 'more_horiz' },
};

const STORE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f97316'];

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

  // ── Período cerrado: termina antes del mes en curso ──────────────────────
  // Para un período ya cerrado no tiene sentido proyectar el cierre del mes
  // actual: se omiten las proyecciones en la vista, el PDF y el análisis IA.
  const isPastPeriod = useMemo(() => {
    if (!endDate) return false;
    const currentMonthStart = formatDateIdLocal(getMonthRange(getTodayBogota()).start);
    return endDate < currentMonthStart;
  }, [endDate]);

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

  // ── Domingos en accell (almacen-2): impacto del cambio de horario ─────────
  // Hasta el domingo 2026-06-07 solo se abría hasta las 2 pm (ese día vendió
  // $321.000). Desde la nueva administración se abre todo el día y los
  // domingos venden por encima del millón — el resaltado compara ambos
  // horarios para evidenciar el impacto del cambio.
  const isSundayDate = (date: string) => new Date(date + 'T12:00:00').getDay() === 0;
  const accellSundays = useMemo(() => {
    const accellRegs = filterRegs.filter(r => r.storeId === 'almacen-2');
    const sundays = accellRegs
      .filter(r => isSundayDate(r.date))
      .map(r => ({
        date: r.date,
        total: calculateGrossIncome(r),
        fullDay: r.date >= ACCELL_DOMINGO_DIA_COMPLETO_DESDE,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const fullDaySundays = sundays.filter(s => s.fullDay);
    const oldSundays = sundays.filter(s => !s.fullDay);
    const total = sundays.reduce((s, d) => s + d.total, 0);
    const avgFullDay = fullDaySundays.length > 0
      ? fullDaySundays.reduce((s, d) => s + d.total, 0) / fullDaySundays.length
      : 0;
    // Referencia del horario anterior: los domingos viejos del período si los
    // hay; si no, el último domingo conocido con ese horario (7 jun 2026)
    const avgOld = oldSundays.length > 0
      ? oldSundays.reduce((s, d) => s + d.total, 0) / oldSundays.length
      : DOMINGO_HORARIO_ANTERIOR_REF.total;
    const upliftPct = avgOld > 0 && fullDaySundays.length > 0
      ? ((avgFullDay - avgOld) / avgOld) * 100
      : null;
    return { sundays, fullDaySundays, oldSundays, total, avgFullDay, avgOld, upliftPct };
  }, [filterRegs]);

  const showAccellSundays =
    accellSundays.sundays.length > 0 && (selectedStore === 'todas' || selectedStore === 'almacen-2');

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

  // ── Export PDF programático: texto real + tablas nativas + gráfico vectorial ──
  const exportPDF = async () => {
    if (!hasQueried) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // formatCurrency usa NBSP entre $ y el número; normalizar a espacio simple
      const money = (n: number) => formatCurrency(n).replace(/ /g, ' ');
      const fmtDate = (iso: string) => iso.split('-').reverse().join('/');
      const storeLabel = selectedStore === 'todas' ? 'Todas las tiendas' : getStoreName(selectedStore);

      const SLATE = { dark: [15, 23, 42] as [number, number, number], mid: [100, 116, 139] as [number, number, number] };
      const EMERALD: [number, number, number] = [16, 185, 129];
      const RED: [number, number, number] = [220, 38, 38];

      const ensureSpace = (h: number) => {
        if (y + h > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const sectionTitle = (text: string) => {
        ensureSpace(14);
        doc.setFillColor(...EMERALD);
        doc.rect(margin, y, 1.6, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.setTextColor(...SLATE.dark);
        doc.text(text, margin + 4, y + 4);
        y += 9;
      };

      const paragraph = (text: string) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(text, contentW);
        for (const line of lines) {
          ensureSpace(4.5);
          doc.text(line, margin, y);
          y += 4.5;
        }
        y += 2;
      };

      const tableDefaults = {
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8 },
        headStyles: { fillColor: SLATE.dark, textColor: 255, fontStyle: 'bold' as const },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      };
      const afterTable = () => { y = (doc as any).lastAutoTable.finalY + 8; };

      // ── Encabezado ──
      doc.setFillColor(...SLATE.dark);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('Reporte Ejecutivo — Distriaccell', margin, 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`${storeLabel}   ·   Período: ${fmtDate(startDate)} a ${fmtDate(endDate)}   ·   Generado: ${fmtDate(getTodayId())}`, margin, 21);
      y = 38;

      // ── KPIs principales ──
      const kpis = [
        { label: 'INGRESOS DEL PERÍODO', value: money(periodGrandTotal), color: EMERALD },
        { label: 'GASTOS DEL PERÍODO', value: money(periodExpenseTotal), color: RED },
        { label: 'RESULTADO NETO', value: money(periodNetResult), color: periodNetResult >= 0 ? EMERALD : RED },
        { label: 'PROMEDIO DIARIO', value: money(periodAvg), color: SLATE.dark },
      ];
      const boxW = (contentW - 3 * 4) / 4;
      kpis.forEach((kpi, i) => {
        const x = margin + i * (boxW + 4);
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, boxW, 18, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.4);
        doc.setTextColor(...SLATE.mid);
        doc.text(kpi.label, x + 3, y + 5.5);
        doc.setFontSize(10);
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value, x + 3, y + 12.5);
      });
      y += 26;

      // ── Resumen ejecutivo (IA) — sin la sección de Recomendaciones ──
      if (insights) {
        sectionTitle('Resumen Ejecutivo');
        const blocks: Array<[string, string]> = [
          ['Resumen General', insights.resumenGeneral],
          ['Análisis de Tendencias', insights.analisisTendencias],
          // En períodos cerrados no tiene sentido hablar de proyecciones
          ...(!isPastPeriod ? [['Proyecciones', insights.proyecciones] as [string, string]] : []),
          ['Días Destacados', insights.diasDestacados],
        ];
        blocks.forEach(([title, text]) => {
          if (!text) return;
          ensureSpace(9);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...SLATE.dark);
          doc.text(title, margin, y);
          y += 4.5;
          paragraph(text);
        });
      }

      // ── Gráfico vectorial: evolución diaria de ingresos y gastos ──
      const dailyTotals = dateList.map(d => {
        const income = Object.values(incomeMatrix[d] || {}).reduce((s: number, v: number) => s + v, 0);
        const expenses = filterRegs
          .filter(r => r.date === d)
          .reduce((s, r) => s + calculateExpensesTotal(r.expenses || []), 0);
        return { date: d, income, expenses };
      });

      if (dailyTotals.length > 1) {
        const chartH = 52;
        const chartPadL = 16;
        ensureSpace(chartH + 22);
        sectionTitle('Evolución Diaria del Período');

        const plotX = margin + chartPadL;
        const plotW = contentW - chartPadL;
        const plotY = y;
        const plotH = chartH - 10;
        const maxVal = Math.max(...dailyTotals.map(p => p.income), 1);

        // Rejilla y etiquetas del eje Y
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        for (let g = 0; g <= 4; g++) {
          const gy = plotY + plotH - (plotH * g) / 4;
          doc.setDrawColor(226, 232, 240);
          doc.line(plotX, gy, plotX + plotW, gy);
          doc.setTextColor(...SLATE.mid);
          doc.text(`${((maxVal * g) / 4 / 1e6).toFixed(1)}M`, plotX - 1.5, gy + 1, { align: 'right' });
        }

        // Barras de ingresos
        const slotW = plotW / dailyTotals.length;
        const barW = Math.min(slotW * 0.65, 6);
        dailyTotals.forEach((p, i) => {
          const barH = (p.income / maxVal) * plotH;
          const bx = plotX + i * slotW + (slotW - barW) / 2;
          doc.setFillColor(...EMERALD);
          doc.rect(bx, plotY + plotH - barH, barW, barH, 'F');
        });

        // Línea de gastos
        doc.setDrawColor(...RED);
        doc.setLineWidth(0.5);
        for (let i = 1; i < dailyTotals.length; i++) {
          const x1 = plotX + (i - 1) * slotW + slotW / 2;
          const x2 = plotX + i * slotW + slotW / 2;
          const y1 = plotY + plotH - (dailyTotals[i - 1].expenses / maxVal) * plotH;
          const y2 = plotY + plotH - (dailyTotals[i].expenses / maxVal) * plotH;
          doc.line(x1, y1, x2, y2);
        }
        doc.setLineWidth(0.2);

        // Etiquetas del eje X (día del mes; saltar si hay demasiados puntos)
        const labelStep = Math.ceil(dailyTotals.length / 20);
        doc.setTextColor(...SLATE.mid);
        dailyTotals.forEach((p, i) => {
          if (i % labelStep !== 0) return;
          doc.text(String(parseInt(p.date.slice(8, 10), 10)), plotX + i * slotW + slotW / 2, plotY + plotH + 3.5, { align: 'center' });
        });

        // Leyenda
        const legendY = plotY + plotH + 7;
        doc.setFillColor(...EMERALD);
        doc.rect(plotX, legendY - 2, 3, 2.2, 'F');
        doc.text('Ingresos', plotX + 4.5, legendY);
        doc.setDrawColor(...RED);
        doc.setLineWidth(0.5);
        doc.line(plotX + 22, legendY - 1, plotX + 26, legendY - 1);
        doc.setLineWidth(0.2);
        doc.text('Gastos', plotX + 27.5, legendY);
        y = legendY + 8;
      }

      // ── Tabla: ingresos y egresos por tienda ──
      sectionTitle('Ingresos y Egresos por Tienda');
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [['Tienda', 'Ingresos', 'Gastos', 'Ahorros', 'Retiros', 'Resultado']],
        body: [
          ...storesInData.map(store => [
            getStoreName(store.id),
            money(periodTotalsByStore[store.id] || 0),
            money(expensesByStore[store.id] || 0),
            money(savingsByStore[store.id] || 0),
            money(withdrawalsByStore[store.id] || 0),
            money((periodTotalsByStore[store.id] || 0) - (expensesByStore[store.id] || 0)),
          ]),
          [
            { content: 'TOTAL', styles: { fontStyle: 'bold' as const } },
            { content: money(periodGrandTotal), styles: { fontStyle: 'bold' as const } },
            { content: money(periodExpenseTotal), styles: { fontStyle: 'bold' as const } },
            { content: money(periodSavingsTotal), styles: { fontStyle: 'bold' as const } },
            { content: money(periodWithdrawalTotal), styles: { fontStyle: 'bold' as const } },
            { content: money(periodNetResult), styles: { fontStyle: 'bold' as const } },
          ],
        ],
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      });
      afterTable();

      // ── Tabla: gastos por categoría ──
      if (expensesByCategory.length > 0) {
        sectionTitle('Gastos por Categoría');
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          head: [['Categoría', 'Monto', '% del total']],
          body: expensesByCategory.map(c => [
            c.label,
            money(c.total),
            `${periodExpenseTotal > 0 ? ((c.total / periodExpenseTotal) * 100).toFixed(1) : '0'}%`,
          ]),
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });
        afterTable();
      }

      // ── Tabla: otras salidas (ahorros + retiros por tipo) ──
      if (periodSavingsTotal > 0 || withdrawalsByType.length > 0) {
        sectionTitle('Otras Salidas de Dinero');
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          head: [['Concepto', 'Monto']],
          body: [
            ...(periodSavingsTotal > 0 ? [['Ahorros del período', money(periodSavingsTotal)]] : []),
            ...withdrawalsByType.map(w => [w.label, money(w.total)]),
            [
              { content: 'Total retiros de caja', styles: { fontStyle: 'bold' as const } },
              { content: money(periodWithdrawalTotal), styles: { fontStyle: 'bold' as const } },
            ],
          ],
          columnStyles: { 1: { halign: 'right' } },
        });
        afterTable();
      }

      // ── Tabla: ingresos bancarios ──
      sectionTitle('Ingresos Bancarios (incluidos en las ventas)');
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [['QR', 'Transferencia', 'Tarjeta']],
        body: [[money(qrBreakdown.qr), money(qrBreakdown.transferencia), money(qrBreakdown.tarjeta)]],
        columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      });
      afterTable();

      // ── Tabla: mejores y peores días ──
      if (bestDays.length > 0) {
        sectionTitle('Mejores y Peores Días de Venta');
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          head: [['Mejores días', 'Ventas', 'Peores días', 'Ventas']],
          body: bestDays.map((b, i) => [
            fmtDate(b.date),
            money(b.total),
            worstDays[i] ? fmtDate(worstDays[i].date) : '',
            worstDays[i] ? money(worstDays[i].total) : '',
          ]),
          columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
        });
        afterTable();
      }

      // ── Domingos en accell: impacto del nuevo horario ──
      if (showAccellSundays) {
        sectionTitle('Domingos en accell.com — Impacto del Nuevo Horario');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...SLATE.mid);
        doc.text('Antes se abría solo hasta las 2 pm; con la nueva administración se abre todo el día.', margin, y);
        y += 5;
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          head: [['Domingo', 'Horario', 'Ventas']],
          body: [
            ...accellSundays.sundays.map(s => [
              fmtDate(s.date),
              s.fullDay ? 'Todo el día' : 'Hasta 2 pm (anterior)',
              money(s.total),
            ]),
            [
              { content: 'Promedio domingos con horario completo', colSpan: 2, styles: { fontStyle: 'bold' as const } },
              { content: money(accellSundays.avgFullDay), styles: { fontStyle: 'bold' as const } },
            ],
            [
              {
                content: accellSundays.oldSundays.length > 0
                  ? 'Promedio domingos con horario anterior (hasta 2 pm)'
                  : `Referencia horario anterior (domingo ${fmtDate(DOMINGO_HORARIO_ANTERIOR_REF.date)})`,
                colSpan: 2,
              },
              money(accellSundays.avgOld),
            ],
            [
              { content: 'Mejora con el nuevo horario', colSpan: 2, styles: { fontStyle: 'bold' as const } },
              {
                content: accellSundays.upliftPct !== null
                  ? `${accellSundays.upliftPct >= 0 ? '+' : ''}${accellSundays.upliftPct.toFixed(0)}%`
                  : '—',
                styles: { fontStyle: 'bold' as const },
              },
            ],
          ],
          headStyles: { ...tableDefaults.headStyles, fillColor: [180, 83, 9] as [number, number, number] },
          columnStyles: { 2: { halign: 'right' } },
        });
        afterTable();
      }

      // ── Proyección del mes en curso (omitida en períodos ya cerrados) ──
      if (!isPastPeriod && projection.projected > 0) {
        sectionTitle('Proyección de Cierre del Mes en Curso');
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          head: [['Tienda', 'Acumulado', 'Proyección de cierre']],
          body: [
            ...storeProjections.map(({ store, proj }) => [
              store.name,
              money(proj.actual),
              money(proj.projected),
            ]),
            [
              { content: 'CONSOLIDADO', styles: { fontStyle: 'bold' as const } },
              { content: money(projection.actual), styles: { fontStyle: 'bold' as const } },
              { content: money(projection.projected), styles: { fontStyle: 'bold' as const } },
            ],
          ],
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });
        afterTable();
      }

      // ── Anexo: reportes diarios de ventas del período ──
      if (filterRegs.length > 0) {
        sectionTitle('Detalle Diario de Ventas');
        const sortedRegs = [...filterRegs].sort(
          (a, b) => a.date.localeCompare(b.date) || getStoreName(a.storeId).localeCompare(getStoreName(b.storeId))
        );
        let tSys = 0, tNote = 0, tServ = 0, tTot = 0, tQR = 0, tExp = 0, tSav = 0;
        // Filas de domingos de accell: se resaltan en ámbar (día de doble turno)
        const sundayRowIdx = new Set<number>();
        sortedRegs.forEach((r, i) => {
          if (r.storeId === 'almacen-2' && isSundayDate(r.date)) sundayRowIdx.add(i);
        });
        const dailyBody = sortedRegs.map(r => {
          const sys = r.systemSales || 0;
          const note = calculateNotebookTotal(r.notebookSales || []);
          const serv = calculateServicesTotal(r.technicalServices || []);
          const total = sys + note + serv;
          const qr = calculateQRTotal(r.qrPayments || []);
          const exp = calculateExpensesTotal(r.expenses || []);
          const sav = r.dailySavings || 0;
          tSys += sys; tNote += note; tServ += serv; tTot += total; tQR += qr; tExp += exp; tSav += sav;
          return [
            fmtDate(r.date),
            getStoreName(r.storeId),
            money(sys),
            money(note),
            money(serv),
            money(total),
            money(qr),
            money(exp),
            money(sav),
          ];
        });
        const boldCell = (content: string) => ({ content, styles: { fontStyle: 'bold' as const } });
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          styles: { ...tableDefaults.styles, fontSize: 7, cellPadding: 1.4 },
          head: [['Fecha', 'Tienda', 'Sistema', 'Cuaderno', 'Servicios', 'Total Ventas', 'QR/Banco', 'Gastos', 'Ahorro']],
          body: [
            ...dailyBody,
            [
              boldCell('TOTAL'), boldCell(''),
              boldCell(money(tSys)), boldCell(money(tNote)), boldCell(money(tServ)),
              boldCell(money(tTot)), boldCell(money(tQR)), boldCell(money(tExp)), boldCell(money(tSav)),
            ],
          ],
          columnStyles: {
            2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' },
            7: { halign: 'right' }, 8: { halign: 'right' },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && sundayRowIdx.has(data.row.index)) {
              data.cell.styles.fillColor = [254, 243, 199]; // ámbar: domingo accell (doble turno)
            }
          },
        });
        afterTable();
      }

      // ── Pie de página con numeración ──
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...SLATE.mid);
        doc.text(`Distriaccell — Reporte Ejecutivo ${fmtDate(startDate)} a ${fmtDate(endDate)}`, margin, pageH - 7);
        doc.text(`Página ${p} de ${pageCount}`, pageW - margin, pageH - 7, { align: 'right' });
      }

      doc.save(`reporte-ejecutivo-${startDate || 'distriaccell'}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setExporting(false);
    }
  };

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
        // Domingos de accell: impacto del cambio de horario (antes hasta las
        // 2 pm, ahora todo el día)
        ...(showAccellSundays
          ? {
              ventasDomingosAccell: {
                contexto: 'Hasta el 7 de junio de 2026 accell.com abría los domingos solo hasta las 2 pm. Desde la nueva administración se abre todo el día.',
                domingosHorarioCompleto: accellSundays.fullDaySundays,
                promedioDomingoHorarioCompleto: accellSundays.avgFullDay,
                referenciaHorarioAnterior: accellSundays.oldSundays.length > 0
                  ? { domingos: accellSundays.oldSundays, promedio: accellSundays.avgOld }
                  : { domingo: DOMINGO_HORARIO_ANTERIOR_REF.date, ventas: DOMINGO_HORARIO_ANTERIOR_REF.total },
                mejoraPorcentualConNuevoHorario: accellSundays.upliftPct,
              },
            }
          : {}),
        // Período cerrado: no se envían proyecciones (proyectar el mes en curso
        // no aporta nada al análisis de un período que ya terminó)
        ...(isPastPeriod
          ? { periodoCerrado: true }
          : {
              proyeccionCierreMes: projection,
              proyeccionPorTienda: storeProjections.map(({ store, proj }) => ({
                tienda: store.name,
                proyeccion: proj,
              })),
            }),
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
    previousPeriodComparison, bestDays, worstDays, projection, storeProjections, isPastPeriod,
    accellSundays, showAccellSundays,
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
                {!isPastPeriod && <InsightSection title="Proyecciones" text={insights.proyecciones} />}
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
            {!isPastPeriod && (
              <KpiCard
                label="Proyección cierre del mes"
                value={formatCurrency(projection.projected)}
                sub={`Acumulado ${formatCurrency(projection.actual)} + Est. ${formatCurrency(projection.remaining)}`}
                icon="show_chart"
                iconColor="text-orange-500"
                valueColor="text-orange-600"
              />
            )}
          </div>

          {/* ── Projection Chart (solo si el período toca el mes en curso) ── */}
          {!isPastPeriod && (
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
          )}

          {/* ── Domingos en accell.com (doble turno) ── */}
          {showAccellSundays && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">wb_sunny</span>
                Domingos en accell.com — Impacto del Nuevo Horario
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Antes se abría solo hasta las 2 pm; con la nueva administración se abre todo el día
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Domingos horario completo</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{accellSundays.fullDaySundays.length}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Prom. domingo (todo el día)</p>
                  <p className="text-xl font-black text-amber-600">{formatCurrency(accellSundays.avgFullDay)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                    {accellSundays.oldSundays.length > 0 ? 'Prom. horario anterior (≤2 pm)' : 'Ref. horario anterior (7 jun)'}
                  </p>
                  <p className="text-xl font-black text-slate-400">{formatCurrency(accellSundays.avgOld)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">Mejora con nuevo horario</p>
                  <p className={`text-xl font-black ${accellSundays.upliftPct !== null && accellSundays.upliftPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {accellSundays.upliftPct !== null
                      ? `${accellSundays.upliftPct >= 0 ? '+' : ''}${accellSundays.upliftPct.toFixed(0)}%`
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {accellSundays.sundays.map(s => (
                  <div
                    key={s.date}
                    className={`rounded-lg px-3 py-1.5 text-sm border ${
                      s.fullDay
                        ? 'bg-white dark:bg-slate-900/50 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 opacity-75'
                    }`}
                  >
                    <span className="text-slate-500 mr-2">{s.date.split('-').reverse().slice(0, 2).join('/')}</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatCurrency(s.total)}</span>
                    {!s.fullDay && <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">hasta 2 pm</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Desde julio se podrá comparar mes contra mes el desempeño de los domingos con el horario completo.
              </p>
            </div>
          )}

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
                          className={`transition-colors ${
                            isSundayDate(date)
                              ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/30'
                          }`}
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
                        {!isPastPeriod && (
                          <>
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
                          </>
                        )}
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
                      {!isPastPeriod && (
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
                      )}
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
