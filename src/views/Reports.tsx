
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { DailyRegister, SaleCategory, ExpenseCategory, StoreId } from '../types';
import { getDailyRegistersByRange } from '../services/dailyRegister.service';
import { formatDateIdLocal, getTodayBogota, getWeekRange, getMonthRange, getYearRange, getMonthName } from '../utils/dates';
import { calculateGrossIncome, calculateExpensesTotal, calculateQRTotal, calculateNotebookTotal, calculateServicesTotal } from '../utils/calculations';
import { formatCurrency } from '../utils/currency';
import { EXPENSE_CATEGORIES } from '../constants/categories';

type PeriodType = 'week' | 'month' | 'year';
type StoreDay = { income: number; expenses: number; savings: number; qrPayments: number; balance: number };
type ConsolidatedRow = { date: string; stores: Record<string, StoreDay> };

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
  const { user, activeStores, getStoreName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const [prevPeriodRegisters, setPrevPeriodRegisters] = useState<DailyRegister[]>([]);
  const initialStore = user?.storeId === 'ambos' ? 'ambos' : (user?.storeId || 'almacen-1');
  const [selectedStore, setSelectedStore] = useState<StoreId | 'ambos'>(initialStore);

  // Estado para Balance General Consolidado
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [consolidatedStartDate, setConsolidatedStartDate] = useState('');
  const [consolidatedEndDate, setConsolidatedEndDate] = useState('');
  const [consolidatedRegisters, setConsolidatedRegisters] = useState<DailyRegister[]>([]);
  const [loadingConsolidated, setLoadingConsolidated] = useState(false);

  // Estado para Reportes Diarios por Tienda
  const [showDailyByStore, setShowDailyByStore] = useState(false);
  const [dailyByStoreStart, setDailyByStoreStart] = useState('');
  const [dailyByStoreEnd, setDailyByStoreEnd] = useState('');
  const [dailyByStoreRegs, setDailyByStoreRegs] = useState<DailyRegister[]>([]);
  const [loadingDailyByStore, setLoadingDailyByStore] = useState(false);
  const [dailyStoreFilter, setDailyStoreFilter] = useState<StoreId | 'todas'>('todas');
  const [detailRegister, setDetailRegister] = useState<DailyRegister | null>(null);

  // Estado para tendencia 6 meses
  const [sixMonthRegisters, setSixMonthRegisters] = useState<{ monthLabel: string; registers: DailyRegister[] }[]>([]);

  // Cargar datos del período
  useEffect(() => {
    const loadPeriodData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const now = getTodayBogota();

        let range;
        let prevRange;
        if (period === 'week') {
          range = getWeekRange(now);
          const prevStart = new Date(range.start);
          prevStart.setDate(prevStart.getDate() - 7);
          prevRange = getWeekRange(prevStart);
        } else if (period === 'month') {
          range = getMonthRange(now);
          const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevRange = getMonthRange(prevMonthDate);
        } else {
          range = getYearRange(now);
          const prevYearDate = new Date(now.getFullYear() - 1, 0, 1);
          prevRange = getYearRange(prevYearDate);
        }

        const startDate = formatDateIdLocal(range.start);
        const endDate = formatDateIdLocal(range.end);
        const prevStartDate = formatDateIdLocal(prevRange.start);
        const prevEndDate = formatDateIdLocal(prevRange.end);

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

        let registers: DailyRegister[] = [];
        let prevRegs: DailyRegister[] = [];
        if (selectedStore === 'ambos') {
          const [results, prevResults] = await Promise.all([
            Promise.all(activeStores.map(s => getDailyRegistersByRange(startDate, endDate, s.id))),
            Promise.all(activeStores.map(s => getDailyRegistersByRange(prevStartDate, prevEndDate, s.id))),
          ]);
          registers = results.flat();
          prevRegs = prevResults.flat();
        } else {
          [registers, prevRegs] = await Promise.all([
            getDailyRegistersByRange(startDate, endDate, selectedStore),
            getDailyRegistersByRange(prevStartDate, prevEndDate, selectedStore),
          ]);
        }

        setPeriodRegisters(registers);
        setPrevPeriodRegisters(prevRegs);

        // Load 6-month data
        const sixMonthResults = await Promise.all(
          sixMonthsData.map(async (m) => {
            let regs: DailyRegister[] = [];
            if (selectedStore === 'ambos') {
              const r = await Promise.all(activeStores.map(s => getDailyRegistersByRange(m.startDate, m.endDate, s.id)));
              regs = r.flat();
            } else {
              regs = await getDailyRegistersByRange(m.startDate, m.endDate, selectedStore);
            }
            return { monthLabel: m.monthLabel, registers: regs };
          })
        );
        setSixMonthRegisters(sixMonthResults);
      } catch (error) {
        console.error('Error al cargar datos del período:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPeriodData();
  }, [user, period, selectedStore]);

  // Preparar datos para el gráfico de evolución
  const evolutionData = periodRegisters.map(register => {
    const income = calculateGrossIncome(register);
    const expenses = calculateExpensesTotal(register.expenses || []);

    // register.date es 'YYYY-MM-DD'; anclar a mediodía local para que el día
    // no se corra por zona horaria (new Date('YYYY-MM-DD') se interpreta en UTC)
    let label = register.date;
    if (period === 'week') {
      const date = new Date(register.date + 'T12:00:00');
      label = date.toLocaleDateString('es', { weekday: 'short' });
    } else if (period === 'month') {
      label = parseInt(register.date.slice(8, 10), 10).toString();
    } else {
      const date = new Date(register.date + 'T12:00:00');
      label = date.toLocaleDateString('es', { month: 'short' });
    }

    return {
      name: label,
      ventas: income,
      gastos: expenses
    };
  });

  // Calcular distribución de ventas por categoría
  const salesByCategory: Record<string, number> = {
    'Accesorios': 0,
    'Servicios Técnicos': 0,
    'Repuestos': 0,
    'Otros': 0
  };

  periodRegisters.forEach(register => {
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

  const COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#ef4444'];

  // Calcular totales del período
  const totalIncome = periodRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const totalExpenses = periodRegisters.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);
  const totalSavings = periodRegisters.reduce((sum, r) => sum + (r.dailySavings || 0), 0);

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

  // Función para cargar Balance General Consolidado
  const loadConsolidatedBalance = async () => {
    if (!consolidatedStartDate || !consolidatedEndDate) {
      alert('Por favor selecciona un rango de fechas válido');
      return;
    }

    setLoadingConsolidated(true);
    try {
      const results = await Promise.all(
        activeStores.map(s => getDailyRegistersByRange(consolidatedStartDate, consolidatedEndDate, s.id))
      );
      const allRegisters = results.flat();

      const seen = new Map<string, number>();
      allRegisters.forEach(r => {
        const key = `${r.date}_${r.storeId}`;
        seen.set(key, (seen.get(key) || 0) + 1);
      });
      const duplicates = Array.from(seen.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        console.error('⚠️ ADVERTENCIA: Registros duplicados detectados:', duplicates);
      }

      setConsolidatedRegisters(allRegisters);
    } catch (error) {
      console.error('Error al cargar balance consolidado:', error);
      alert('Error al cargar los datos del balance consolidado');
    } finally {
      setLoadingConsolidated(false);
    }
  };

  // Agrupar registros consolidados por fecha (dinámico para N tiendas)
  const consolidatedByDate = consolidatedRegisters.reduce((acc, register) => {
    const date = register.date;
    if (!acc[date]) {
      acc[date] = { date, stores: {} as Record<string, StoreDay> };
    }
    const income = calculateGrossIncome(register);
    const qrPayments = calculateQRTotal(register.qrPayments || []);
    const expenses = calculateExpensesTotal(register.expenses || []);
    const savings = register.dailySavings || 0;
    const balance = income - expenses - savings - qrPayments;
    acc[date].stores[register.storeId] = { income, expenses, savings, qrPayments, balance };
    return acc;
  }, {} as Record<string, ConsolidatedRow>);

  const consolidatedData: ConsolidatedRow[] = (Object.values(consolidatedByDate) as ConsolidatedRow[]).sort((a, b) => b.date.localeCompare(a.date));

  // Totales por tienda
  const totalByStore: Record<string, { income: number; expenses: number; balance: number }> = {};
  activeStores.forEach(s => { totalByStore[s.id] = { income: 0, expenses: 0, balance: 0 }; });
  consolidatedData.forEach(row => {
    activeStores.forEach(s => {
      const sd = row.stores[s.id];
      if (sd) {
        totalByStore[s.id].income += sd.income;
        totalByStore[s.id].expenses += sd.expenses;
        totalByStore[s.id].balance += sd.balance;
      }
    });
  });
  const grandTotal = Object.values(totalByStore).reduce((sum, d) => sum + d.balance, 0);

  // Función para cargar Reportes Diarios por Tienda
  const loadDailyByStore = async () => {
    if (!dailyByStoreStart || !dailyByStoreEnd) {
      alert('Por favor selecciona un rango de fechas válido');
      return;
    }
    setLoadingDailyByStore(true);
    try {
      const results = await Promise.all(
        activeStores.map(s => getDailyRegistersByRange(dailyByStoreStart, dailyByStoreEnd, s.id))
      );
      setDailyByStoreRegs(results.flat().sort((a, b) => b.date.localeCompare(a.date) || a.storeId.localeCompare(b.storeId)));
      setDailyStoreFilter('todas');
    } catch (error) {
      console.error('Error al cargar reportes diarios:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoadingDailyByStore(false);
    }
  };

  const filteredDailyRegs = dailyStoreFilter === 'todas'
    ? dailyByStoreRegs
    : dailyByStoreRegs.filter(r => r.storeId === dailyStoreFilter);

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
            <p className="text-blue-100 text-sm">Análisis de ingresos, gastos y tendencias</p>
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
              Semana
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

        {/* Selector de almacén (solo para super-admin) */}
        {user?.storeId === 'ambos' && (
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
            <p className="text-xs font-bold text-slate-500 uppercase">Ingresos Totales</p>
            <span className="material-symbols-outlined text-green-500">trending_up</span>
          </div>
          <p className="text-2xl font-black text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase">Gastos Totales</p>
            <span className="material-symbols-outlined text-red-500">trending_down</span>
          </div>
          <p className="text-2xl font-black text-red-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase">Balance Neto</p>
            <span className="material-symbols-outlined text-blue-500">account_balance</span>
          </div>
          <p className={`text-2xl font-black ${totalIncome - totalExpenses - totalSavings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(totalIncome - totalExpenses - totalSavings)}
          </p>
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
        <p className="text-sm text-slate-500 mb-6">Distribución y comparación con el período anterior</p>

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

      {/* Balance General Consolidado */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">💰 Balance General Consolidado</h3>
            <p className="text-sm text-slate-500 mt-1">Balance diario (Ingresos - Egresos - Ahorros) de ambos almacenes</p>
          </div>
          <button
            onClick={() => setShowConsolidated(!showConsolidated)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {showConsolidated ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showConsolidated && (
          <div className="space-y-6">
            {/* Selector de rango de fechas */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Seleccionar rango de fechas:</p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Fecha inicial
                  </label>
                  <input
                    type="date"
                    value={consolidatedStartDate}
                    onChange={(e) => setConsolidatedStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Fecha final
                  </label>
                  <input
                    type="date"
                    value={consolidatedEndDate}
                    onChange={(e) => setConsolidatedEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={loadConsolidatedBalance}
                  disabled={loadingConsolidated}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingConsolidated ? 'Cargando...' : 'Consultar'}
                </button>
              </div>
            </div>

            {/* Resumen de totales por tienda */}
            {consolidatedData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {activeStores.map(store => {
                  const totals = totalByStore[store.id] || { income: 0, expenses: 0, balance: 0 };
                  return (
                    <div key={store.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{store.name}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-600">Ingresos</span>
                          <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totals.income)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-500">Egresos</span>
                          <span className="font-bold text-red-600 dark:text-red-400">-{formatCurrency(totals.expenses)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Balance</span>
                          <span className={`font-black ${totals.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(totals.balance)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center justify-between">
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Balance Total</p>
                  <p className={`text-xl font-black ${grandTotal >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600'}`}>{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            )}

            {/* Tabla de balance consolidado */}
            {consolidatedData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Fecha</th>
                      {activeStores.map(store => (
                        <th key={store.id} className="text-right py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                          {store.name}<br/>Balance
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 text-xs font-bold text-green-600 dark:text-green-400 uppercase">
                        Total Día
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedData.map((row) => {
                      const totalBalance = activeStores.reduce((sum, s) => sum + (row.stores[s.id]?.balance || 0), 0);
                      const totalIncomeDayAll = activeStores.reduce((sum, s) => sum + (row.stores[s.id]?.income || 0), 0);
                      const totalExpensesDayAll = activeStores.reduce((sum, s) => sum + (row.stores[s.id]?.expenses || 0), 0);
                      const [year, month, day] = row.date.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      const formattedDate = date.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                      return (
                        <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">
                            {formattedDate}
                            <div className="text-xs text-slate-500 mt-1">
                              Ing: {formatCurrency(totalIncomeDayAll)} | Egr: {formatCurrency(totalExpensesDayAll)}
                            </div>
                          </td>
                          {activeStores.map(store => {
                            const sd = row.stores[store.id];
                            return (
                              <td key={store.id} className="py-3 px-4 text-right">
                                <div className={`text-sm font-bold ${(sd?.balance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {sd ? formatCurrency(sd.balance) : '—'}
                                </div>
                                {sd && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    +{formatCurrency(sd.income)} -{formatCurrency(sd.expenses)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right">
                            <div className={`text-sm font-black ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(totalBalance)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
                      <td className="py-4 px-4 text-sm font-black text-slate-900 dark:text-white uppercase">Balance Total</td>
                      {activeStores.map(store => (
                        <td key={store.id} className="py-4 px-4 text-sm text-right font-black text-blue-600">
                          {formatCurrency(totalByStore[store.id]?.balance || 0)}
                        </td>
                      ))}
                      <td className="py-4 px-4 text-sm text-right font-black text-green-600">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {consolidatedData.length === 0 && !loadingConsolidated && consolidatedStartDate && consolidatedEndDate && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl mb-4">
                  inbox
                </span>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  No hay datos para el rango seleccionado
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ================================================================
          SECTION C — Reportes Diarios por Tienda
      ================================================================ */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">calendar_view_day</span>
              Reportes Diarios por Tienda
            </h3>
            <p className="text-sm text-slate-500 mt-1">Vista general y detallada de registros diarios por almacén</p>
          </div>
          <button
            onClick={() => setShowDailyByStore(!showDailyByStore)}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {showDailyByStore ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showDailyByStore && (
          <div className="space-y-6">
            {/* Controles */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Seleccionar rango de fechas:</p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha inicial</label>
                  <input
                    type="date"
                    value={dailyByStoreStart}
                    onChange={(e) => setDailyByStoreStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha final</label>
                  <input
                    type="date"
                    value={dailyByStoreEnd}
                    onChange={(e) => setDailyByStoreEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={loadDailyByStore}
                  disabled={loadingDailyByStore}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {loadingDailyByStore ? 'Cargando...' : 'Consultar'}
                </button>
              </div>

              {dailyByStoreRegs.length > 0 && activeStores.length > 1 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
                  <button
                    onClick={() => setDailyStoreFilter('todas')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${dailyStoreFilter === 'todas' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                  >
                    Todas
                  </button>
                  {activeStores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => setDailyStoreFilter(store.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${dailyStoreFilter === store.id ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                    >
                      {store.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Totales del rango */}
            {filteredDailyRegs.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Ingresos', value: filteredDailyRegs.reduce((s, r) => s + calculateGrossIncome(r), 0), color: 'text-green-600' },
                  { label: 'QR / Banco', value: filteredDailyRegs.reduce((s, r) => s + calculateQRTotal(r.qrPayments || []), 0), color: 'text-sky-600' },
                  { label: 'Gastos', value: filteredDailyRegs.reduce((s, r) => s + calculateExpensesTotal(r.expenses || []), 0), color: 'text-red-600' },
                  { label: 'Caja Física', value: filteredDailyRegs.reduce((s, r) => s + (calculateGrossIncome(r) - calculateExpensesTotal(r.expenses || []) - (r.dailySavings || 0) - calculateQRTotal(r.qrPayments || [])), 0), color: 'text-blue-600' },
                ].map(card => (
                  <div key={card.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">{card.label}</p>
                    <p className={`text-lg font-black ${card.color}`}>{formatCurrency(card.value)}</p>
                    <p className="text-xs text-slate-400 mt-1">{filteredDailyRegs.length} registros</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tabla general */}
            {filteredDailyRegs.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Tienda</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Ingresos</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">QR</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Gastos</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Ahorros</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Caja Física</th>
                      <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                      <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDailyRegs.map(register => {
                      const income = calculateGrossIncome(register);
                      const qr = calculateQRTotal(register.qrPayments || []);
                      const expenses = calculateExpensesTotal(register.expenses || []);
                      const savings = register.dailySavings || 0;
                      const balance = income - expenses - savings - qr;
                      const [y, m, d] = register.date.split('-');
                      const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                        .toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
                      return (
                        <tr key={`${register.date}_${register.storeId}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white capitalize">{dateStr}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">{getStoreName(register.storeId)}</td>
                          <td className="py-3 px-4 text-right font-bold text-green-600 tabular-nums">{formatCurrency(income)}</td>
                          <td className="py-3 px-4 text-right text-sky-600 tabular-nums text-xs">{qr > 0 ? formatCurrency(qr) : <span className="text-slate-300">—</span>}</td>
                          <td className="py-3 px-4 text-right text-red-600 tabular-nums text-xs">{expenses > 0 ? formatCurrency(expenses) : <span className="text-slate-300">—</span>}</td>
                          <td className="py-3 px-4 text-right text-purple-600 tabular-nums text-xs">{savings > 0 ? formatCurrency(savings) : <span className="text-slate-300">—</span>}</td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className={`font-black ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(balance)}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${register.isClosed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {register.isClosed ? 'Cerrado' : 'Abierto'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setDetailRegister(register)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredDailyRegs.length === 0 && !loadingDailyByStore && dailyByStoreStart && dailyByStoreEnd && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl block mb-4">inbox</span>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No hay registros para el rango seleccionado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      {detailRegister && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailRegister(null); }}
        >
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-3xl my-4">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white capitalize">
                    {(() => {
                      const [y, m, d] = detailRegister.date.split('-');
                      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                        .toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                    })()}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${detailRegister.isClosed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                    {detailRegister.isClosed ? '✓ Cerrado' : 'Abierto'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {getStoreName(detailRegister.storeId)} · Registrado por {detailRegister.registeredByName}
                </p>
              </div>
              <button
                onClick={() => setDetailRegister(null)}
                className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumen */}
              {(() => {
                const income = calculateGrossIncome(detailRegister);
                const qr = calculateQRTotal(detailRegister.qrPayments || []);
                const expenses = calculateExpensesTotal(detailRegister.expenses || []);
                const savings = detailRegister.dailySavings || 0;
                const balance = income - expenses - savings;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Ingresos', value: income, color: 'text-green-600' },
                      { label: 'QR / Banco', value: qr, color: 'text-sky-600' },
                      { label: 'Gastos', value: expenses, color: 'text-red-600' },
                      { label: 'Balance', value: balance, color: balance >= 0 ? 'text-blue-600' : 'text-red-600' },
                    ].map(c => (
                      <div key={c.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">{c.label}</p>
                        <p className={`text-base font-black ${c.color}`}>{formatCurrency(c.value)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Ventas Sistema POS */}
              {detailRegister.systemSales > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-center justify-between border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 !text-[20px]">point_of_sale</span>
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-300">Ventas Sistema POS</span>
                  </div>
                  <span className="text-base font-black text-blue-600">{formatCurrency(detailRegister.systemSales)}</span>
                </div>
              )}

              {/* Ventas Cuaderno */}
              {detailRegister.notebookSales && detailRegister.notebookSales.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500 !text-[18px]">menu_book</span>
                    Ventas Cuaderno
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.notebookSales.length} ítems)</span>
                    <span className="ml-auto font-black text-green-600">{formatCurrency(calculateNotebookTotal(detailRegister.notebookSales))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Descripción</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Categoría</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Cant.</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Precio</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.notebookSales.map(sale => (
                          <tr key={sale.id}>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{sale.description}</td>
                            <td className="py-2 px-3 capitalize text-slate-500">{sale.category}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{sale.quantity}</td>
                            <td className="py-2 px-3 text-right text-slate-600 tabular-nums">{formatCurrency(sale.unitPrice)}</td>
                            <td className="py-2 px-3 text-right font-bold text-green-600 tabular-nums">{formatCurrency(sale.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Servicios Técnicos */}
              {detailRegister.technicalServices && detailRegister.technicalServices.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 !text-[18px]">build</span>
                    Servicios Técnicos
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.technicalServices.length})</span>
                    <span className="ml-auto font-black text-purple-600">{formatCurrency(calculateServicesTotal(detailRegister.technicalServices))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Tipo</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Equipo</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Técnico</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Cliente</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.technicalServices.map(svc => (
                          <tr key={svc.id}>
                            <td className="py-2 px-3 capitalize text-slate-700 dark:text-slate-300">{svc.serviceType}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{svc.deviceModel}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{svc.technicianName}</td>
                            <td className="py-2 px-3 text-slate-500">{svc.customerName || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-purple-600 tabular-nums">{formatCurrency(svc.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagos QR */}
              {detailRegister.qrPayments && detailRegister.qrPayments.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-500 !text-[18px]">qr_code</span>
                    Pagos QR / Transferencias
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.qrPayments.length})</span>
                    <span className="ml-auto font-black text-sky-600">{formatCurrency(calculateQRTotal(detailRegister.qrPayments))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Descripción</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Cliente</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.qrPayments.map(qrp => (
                          <tr key={qrp.id}>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{qrp.description}</td>
                            <td className="py-2 px-3 text-slate-500">{qrp.customerName || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-sky-600 tabular-nums">{formatCurrency(qrp.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gastos */}
              {detailRegister.expenses && detailRegister.expenses.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 !text-[18px]">receipt_long</span>
                    Gastos
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.expenses.length})</span>
                    <span className="ml-auto font-black text-red-600">{formatCurrency(calculateExpensesTotal(detailRegister.expenses))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Concepto</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Categoría</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Responsable</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.expenses.map(exp => {
                          const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                          return (
                            <tr key={exp.id}>
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{exp.concept}</td>
                              <td className="py-2 px-3 text-slate-500">{cat?.label || exp.category}</td>
                              <td className="py-2 px-3 text-slate-500">{exp.responsiblePerson || '—'}</td>
                              <td className="py-2 px-3 text-right font-bold text-red-600 tabular-nums">{formatCurrency(exp.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ahorro */}
              {(detailRegister.dailySavings || 0) > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 flex items-center justify-between border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-600 !text-[20px]">savings</span>
                    <span className="text-sm font-bold text-purple-900 dark:text-purple-300">Ahorro del Día</span>
                  </div>
                  <span className="text-base font-black text-purple-600">{formatCurrency(detailRegister.dailySavings || 0)}</span>
                </div>
              )}

              {/* Cierre de Caja */}
              {detailRegister.isClosed && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-500 !text-[18px]">lock</span>
                    Cierre de Caja
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Esperado</p>
                      <p className="font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(detailRegister.expectedCash || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Real</p>
                      <p className="font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(detailRegister.actualCash || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Diferencia</p>
                      <p className={`font-black tabular-nums ${(detailRegister.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(detailRegister.difference || 0)}
                      </p>
                    </div>
                  </div>
                  {detailRegister.differenceJustification && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Justificación</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{detailRegister.differenceJustification}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sin datos */}
              {!detailRegister.systemSales && !detailRegister.notebookSales?.length && !detailRegister.technicalServices?.length && !detailRegister.qrPayments?.length && !detailRegister.expenses?.length && (
                <div className="text-center py-8 text-slate-400">
                  <span className="material-symbols-outlined text-4xl block mb-2">inventory_2</span>
                  <p className="text-sm">No hay movimientos registrados en este día</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
