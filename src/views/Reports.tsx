
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { DailyRegister, StoreId } from '../types';
import { getDailyRegistersByRange, getDailyRegistersForStores } from '../services/dailyRegister.service';
import { formatDateIdLocal, getTodayBogota, getMonthRange } from '../utils/dates';
import { calculateGrossIncome, calculateExpensesTotal } from '../utils/calculations';
import { resumirRegistros } from '../utils/periodSummary';
import { PeriodType, PERIOD_LABELS, getPeriodRange, getPeriodLabel, getPrevPeriodLabel } from '../utils/periods';
import { formatCurrency } from '../utils/currency';
import { EXPENSE_CATEGORIES } from '../constants/categories';

const EXPENSE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#14b8a6', '#ec4899', '#64748b'];

const Reports: React.FC = () => {
  const { hasPermission } = useAuth();

  // Solo super-admin puede acceder a esta vista
  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            No tienes permisos para ver los reportes financieros. Solo el gerente puede acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return <ReportsContent />;
};

const ReportsContent: React.FC = () => {
  const { user, activeStores } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const [prevPeriodRegisters, setPrevPeriodRegisters] = useState<DailyRegister[]>([]);
  // Esta vista es solo de super-admin: siempre arranca en la vista global
  // y con el selector de tiendas disponible, sin importar el storeId del usuario
  // (un super-admin puede tener storeId 'almacen-1', 'ambos' o 'todos').
  const [selectedStore, setSelectedStore] = useState<StoreId | 'ambos'>('ambos');

  // Estado para tendencia 6 meses
  const [sixMonthRegisters, setSixMonthRegisters] = useState<{ monthLabel: string; registers: DailyRegister[] }[]>([]);

  // Cargar datos del período
  useEffect(() => {
    const loadPeriodData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const now = getTodayBogota();
        const { startDate, endDate, prevStartDate, prevEndDate } = getPeriodRange(period, now);
        const activeIds = activeStores.map(s => s.id);
        const fetchRange = (from: string, to: string) =>
          selectedStore === 'ambos' ? getDailyRegistersForStores(from, to, activeIds) : getDailyRegistersByRange(from, to, selectedStore);

        // Load 6 months of data for the trend chart
        const sixMonthsData: { monthLabel: string; startDate: string; endDate: string }[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthRange = getMonthRange(monthDate);
          const monthLabel = monthDate.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
          sixMonthsData.push({
            monthLabel,
            startDate: formatDateIdLocal(monthRange.start),
            endDate: formatDateIdLocal(monthRange.end),
          });
        }

        const [registers, prevRegs] = await Promise.all([
          fetchRange(startDate, endDate),
          fetchRange(prevStartDate, prevEndDate),
        ]);

        setPeriodRegisters(registers);
        setPrevPeriodRegisters(prevRegs);

        // Load 6-month data
        const sixMonthResults = await Promise.all(
          sixMonthsData.map(async (m) => ({
            monthLabel: m.monthLabel,
            registers: await fetchRange(m.startDate, m.endDate),
          }))
        );
        setSixMonthRegisters(sixMonthResults);
      } catch (error) {
        console.error('Error al cargar datos del período:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPeriodData();
  }, [user, period, selectedStore, activeStores.length]);

  // Preparar datos para el gráfico de evolución: agrupar por día (o por mes en
  // la vista anual) para consolidar varias tiendas en un solo punto, y ordenar
  // cronológicamente (los registros llegan en orden descendente del servicio)
  const evolutionByKey: Record<string, { ventas: number; gastos: number }> = {};
  periodRegisters.forEach(register => {
    const key = period === 'year' ? register.date.slice(0, 7) : register.date;
    if (!evolutionByKey[key]) evolutionByKey[key] = { ventas: 0, gastos: 0 };
    evolutionByKey[key].ventas += calculateGrossIncome(register);
    evolutionByKey[key].gastos += calculateExpensesTotal(register.expenses || []);
  });

  const evolutionData = Object.entries(evolutionByKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totals]) => {
      // key es 'YYYY-MM-DD' (o 'YYYY-MM' en anual); anclar a mediodía local para
      // que el día no se corra por zona horaria (sin hora se interpreta en UTC)
      let label = key;
      if (period === 'week') {
        label = new Date(key + 'T12:00:00').toLocaleDateString('es', { weekday: 'short' });
      } else if (period === 'month') {
        label = parseInt(key.slice(8, 10), 10).toString();
      } else {
        label = new Date(key + '-15T12:00:00').toLocaleDateString('es', { month: 'short' });
      }
      return { name: label, ventas: totals.ventas, gastos: totals.gastos };
    });

  // Distribución de ventas: incluye el sistema POS para que la torta sume lo
  // mismo que "Ventas Totales" (antes solo mostraba cuaderno + servicios)
  const salesByCategory: Record<string, number> = {
    'Sistema POS': 0,
    'Accesorios': 0,
    'Servicios Técnicos': 0,
    'Repuestos': 0,
    'Otros': 0
  };

  periodRegisters.forEach(register => {
    salesByCategory['Sistema POS'] += register.systemSales || 0;

    if (register.notebookSales && register.notebookSales.length > 0) {
      register.notebookSales.forEach(sale => {
        if (sale.category === 'accesorios') {
          salesByCategory['Accesorios'] += sale.subtotal;
        } else if (sale.category === 'servicios') {
          salesByCategory['Servicios Técnicos'] += sale.subtotal;
        } else if (sale.category === 'repuestos') {
          salesByCategory['Repuestos'] += sale.subtotal;
        } else {
          salesByCategory['Otros'] += sale.subtotal;
        }
      });
    }

    if (register.technicalServices && register.technicalServices.length > 0) {
      register.technicalServices.forEach(service => {
        salesByCategory['Servicios Técnicos'] += service.amount;
      });
    }
  });

  const pieData = Object.entries(salesByCategory)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#0f766e', '#2563eb', '#8b5cf6', '#f59e0b', '#ef4444'];

  const resumenPeriodo = resumirRegistros(periodRegisters);

  // ============================================================
  // SECTION A: Análisis de Gastos del Período
  // ============================================================

  // Build expense totals by category for current period
  const expenseByCatCurrent: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach(c => { expenseByCatCurrent[c.id] = 0; });
  periodRegisters.forEach(r => {
    (r.expenses || []).forEach(exp => {
      if (expenseByCatCurrent[exp.category] !== undefined) {
        expenseByCatCurrent[exp.category] += exp.amount;
      } else {
        expenseByCatCurrent[exp.category] = exp.amount;
      }
    });
  });

  // Build expense totals by category for previous period
  const expenseByCatPrev: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach(c => { expenseByCatPrev[c.id] = 0; });
  prevPeriodRegisters.forEach(r => {
    (r.expenses || []).forEach(exp => {
      if (expenseByCatPrev[exp.category] !== undefined) {
        expenseByCatPrev[exp.category] += exp.amount;
      } else {
        expenseByCatPrev[exp.category] = exp.amount;
      }
    });
  });

  // Pie data for expense distribution
  const expensePieData = EXPENSE_CATEGORIES
    .filter(c => expenseByCatCurrent[c.id] > 0)
    .map((c, i) => ({ name: c.label, value: expenseByCatCurrent[c.id], id: c.id }));

  // Alerts: categories with >20% increase
  const expenseAlerts = EXPENSE_CATEGORIES.filter(c => {
    const curr = expenseByCatCurrent[c.id] || 0;
    const prev = expenseByCatPrev[c.id] || 0;
    if (prev === 0) return false;
    const pct = ((curr - prev) / prev) * 100;
    return pct > 20;
  }).map(c => {
    const curr = expenseByCatCurrent[c.id] || 0;
    const prev = expenseByCatPrev[c.id] || 0;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { label: c.label, pct };
  });

  // ============================================================
  // SECTION B: Tendencia de Gastos — Últimos 6 Meses
  // ============================================================

  // Compute total spend per category across all 6 months
  const catTotals6m: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach(c => { catTotals6m[c.id] = 0; });
  sixMonthRegisters.forEach(({ registers }) => {
    registers.forEach(r => {
      (r.expenses || []).forEach(exp => {
        catTotals6m[exp.category] = (catTotals6m[exp.category] || 0) + exp.amount;
      });
    });
  });

  // Top 4 categories by 6-month total
  const top4Cats = Object.entries(catTotals6m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  // Build 6-month line chart data
  const sixMonthChartData = sixMonthRegisters.map(({ monthLabel, registers }) => {
    const row: Record<string, any> = { month: monthLabel };
    top4Cats.forEach(catId => {
      let total = 0;
      registers.forEach(r => {
        (r.expenses || []).forEach(exp => {
          if (exp.category === catId) total += exp.amount;
        });
      });
      row[catId] = total;
    });
    return row;
  });

  const LINE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#ef4444'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header con selector de período */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black mb-1">📊 Reportes Financieros</h2>
            <p className="text-blue-100 text-sm">{getPeriodLabel(period)} · análisis de ventas, gastos y tendencias</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                period === 'week'
                  ? 'bg-white text-blue-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {PERIOD_LABELS.week}
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                period === 'month'
                  ? 'bg-white text-blue-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                period === 'year'
                  ? 'bg-white text-blue-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Año
            </button>
          </div>
        </div>

        {/* Selector de almacén (la vista completa es solo de super-admin) */}
        {(
          <div className="flex items-center gap-2 border-t border-white/20 pt-4 mt-4">
            <span className="text-xs font-bold text-blue-100 uppercase">Almacén:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStore('ambos')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'ambos'
                    ? 'bg-white text-blue-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                Ambos
              </button>
              {activeStores.map(store => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    selectedStore === store.id
                      ? 'bg-white text-blue-600'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {store.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase">Ventas Totales</p>
            <span className="material-symbols-outlined text-green-500">trending_up</span>
          </div>
          <p className="text-2xl font-black text-green-600">{formatCurrency(resumenPeriodo.ventas)}</p>
        </div>
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase">Gastos Totales</p>
            <span className="material-symbols-outlined text-red-500">trending_down</span>
          </div>
          <p className="text-2xl font-black text-red-600">{formatCurrency(resumenPeriodo.gastos)}</p>
        </div>
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase">Utilidad (ventas − gastos)</p>
            <span className="material-symbols-outlined text-blue-500">account_balance</span>
          </div>
          <p className={`text-2xl font-black ${resumenPeriodo.utilidad >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(resumenPeriodo.utilidad)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Ahorro apartado: {formatCurrency(resumenPeriodo.ahorro)} (no resta)</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a2e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6">Evolución de Ingresos y Egresos</h3>
          {evolutionData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-500">
              No hay datos para este período
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="ventas" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                  <Area type="monotone" dataKey="gastos" stroke="#94a3b8" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1a1a2e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6">Distribución de Ventas</h3>
          {pieData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              No hay ventas en este período
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{d.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================================================================
          SECTION A — Análisis de Gastos del Período
      ================================================================ */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500">pie_chart</span>
          Análisis de Gastos del Período
        </h3>
        <p className="text-sm text-slate-500 mb-6">Distribución y comparación con {getPrevPeriodLabel(period)}</p>

        {/* Alerts */}
        {expenseAlerts.length > 0 && (
          <div className="space-y-2 mb-6">
            {expenseAlerts.map(alert => (
              <div key={alert.label} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5">
                <span className="material-symbols-outlined text-amber-600 !text-[18px]">warning</span>
                <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  {alert.label} aumentó <strong>{alert.pct}%</strong> respecto al período anterior
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Expense Pie Chart */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Distribución por categoría</h4>
            {expensePieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                No hay gastos en este período
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`exp-cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {expensePieData.map((d, i) => (
                <div key={d.id} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                  <span className="text-[10px] font-bold text-slate-500 truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Table */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Comparación período anterior</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left pb-2 font-bold text-slate-500 uppercase text-[10px]">Categoría</th>
                    <th className="text-right pb-2 font-bold text-slate-500 uppercase text-[10px]">Este período</th>
                    <th className="text-right pb-2 font-bold text-slate-500 uppercase text-[10px]">Anterior</th>
                    <th className="text-right pb-2 font-bold text-slate-500 uppercase text-[10px]">Var%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {EXPENSE_CATEGORIES.filter(c => expenseByCatCurrent[c.id] > 0 || expenseByCatPrev[c.id] > 0).map(c => {
                    const curr = expenseByCatCurrent[c.id] || 0;
                    const prev = expenseByCatPrev[c.id] || 0;
                    const pct = prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
                    const isHigh = pct !== null && pct > 20;
                    const isLow = pct !== null && pct < 0;
                    return (
                      <tr key={c.id}>
                        <td className="py-2 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{c.label}</td>
                        <td className="py-2 text-right font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(curr)}</td>
                        <td className="py-2 text-right tabular-nums text-slate-400">{formatCurrency(prev)}</td>
                        <td className="py-2 text-right">
                          {pct === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={`font-bold px-1.5 py-0.5 rounded ${isHigh ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : isLow ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'text-slate-500'}`}>
                              {pct > 0 ? '+' : ''}{pct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          SECTION B — Tendencia de Gastos — Últimos 6 Meses
      ================================================================ */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">show_chart</span>
          Tendencia de Gastos — Últimos 6 Meses
        </h3>
        <p className="text-sm text-slate-500 mb-6">Top 4 categorías por volumen de gasto</p>

        {sixMonthChartData.length === 0 || top4Cats.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
            No hay datos de gastos en los últimos 6 meses
          </div>
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sixMonthChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip formatter={(value: number, name: string) => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.id === name);
                    return [formatCurrency(value), cat?.label || name];
                  }} />
                  <Legend formatter={(value: string) => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.id === value);
                    return cat?.label || value;
                  }} />
                  {top4Cats.map((catId, i) => (
                    <Line
                      key={catId}
                      type="monotone"
                      dataKey={catId}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
