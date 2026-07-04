
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { getDailyRegistersByRange } from '../services/dailyRegister.service';
import { formatDateIdLocal, getTodayBogota, getWeekRange, getMonthRange, getYearRange, getMonthName } from '../utils/dates';
import { formatCurrency } from '../utils/currency';
import { calculateGrossIncome, calculateExpensesTotal, calculateServicesTotal, calculateQRTotal } from '../utils/calculations';
import { DailyRegister } from '../types';

type PeriodType = 'week' | 'month' | 'year';

const StatCard = ({ title, value, icon, trend, color, loading }: any) => (
  <div className="bg-white dark:bg-[#1a1a2e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-500`}>
        <span className="material-symbols-outlined !text-[24px]">{icon}</span>
      </div>
      {trend !== 0 && !loading && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 truncate" title={title}>{title}</p>
    {loading ? (
      <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
    ) : (
      <h3 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tabular-nums break-words" title={value}>{value}</h3>
    )}
  </div>
);

// Helper: calculate trend % between current and previous values
const calcTrend = (current: number, prev: number): number => {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 100);
};

const Dashboard: React.FC = () => {
  const { hasPermission, user, activeStores } = useAuth();
  const isSuperAdmin = hasPermission('all');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const [prevRegisters, setPrevRegisters] = useState<DailyRegister[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  // Inicializar selectedStore según el usuario
  const initialStore = (user?.storeId === 'ambos' || user?.storeId === 'todos') ? 'todos' : (user?.storeId || 'todos');
  const [selectedStore, setSelectedStore] = useState<string>(initialStore);

  // Cargar datos del período seleccionado
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const now = getTodayBogota();

        // Obtener rango según el período seleccionado
        let range;
        let prevRange;

        if (period === 'week') {
          range = getWeekRange(now);
          // Previous week: 7 days before current week start
          const prevStart = new Date(range.start);
          prevStart.setDate(prevStart.getDate() - 7);
          prevRange = getWeekRange(prevStart);
        } else if (period === 'month') {
          range = getMonthRange(now);
          // Previous calendar month
          const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevRange = getMonthRange(prevMonthDate);
        } else {
          range = getYearRange(now);
          // Previous year
          const prevYearDate = new Date(now.getFullYear() - 1, 0, 1);
          prevRange = getYearRange(prevYearDate);
        }

        const startDate = formatDateIdLocal(range.start);
        const endDate = formatDateIdLocal(range.end);
        const prevStartDate = formatDateIdLocal(prevRange.start);
        const prevEndDate = formatDateIdLocal(prevRange.end);

        // Si es "todos", obtener datos de todas las tiendas sin filtro
        const storeArg = (selectedStore === 'todos' || selectedStore === 'ambos') ? undefined : selectedStore;

        const [registers, prev] = await Promise.all([
          getDailyRegistersByRange(startDate, endDate, storeArg),
          getDailyRegistersByRange(prevStartDate, prevEndDate, storeArg),
        ]);

        setPeriodRegisters(registers);
        setPrevRegisters(prev);

        // Preparar datos para el gráfico según el período
        let data = [];

        if (period === 'week') {
          // Gráfico de 7 días (Lun-Dom)
          const dayNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
          for (let i = 0; i < 7; i++) {
            const date = new Date(range.start);
            date.setDate(date.getDate() + i);
            const dateId = formatDateIdLocal(date);
            const dayRegister = registers.find(r => r.date === dateId);

            data.push({
              name: dayNames[i],
              ventas: dayRegister ? calculateGrossIncome(dayRegister) : 0,
              gastos: dayRegister ? calculateExpensesTotal(dayRegister.expenses || []) : 0
            });
          }
        } else if (period === 'month') {
          // Gráfico por semanas del mes
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const weeks = Math.ceil(daysInMonth / 7);

          for (let week = 0; week < weeks; week++) {
            const weekRegisters = registers.filter((r) => {
              // r.date es 'YYYY-MM-DD'; extraer el día del texto — new Date(r.date)
              // lo interpretaría en UTC y correría el día en hora Colombia
              const dayOfMonth = parseInt((r.date || '').slice(8, 10), 10);
              return dayOfMonth >= (week * 7 + 1) && dayOfMonth <= ((week + 1) * 7);
            });

            const ventas = weekRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
            const gastos = weekRegisters.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);

            data.push({
              name: `Sem ${week + 1}`,
              ventas,
              gastos
            });
          }
        } else {
          // Gráfico por meses del año
          const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

          for (let month = 0; month < 12; month++) {
            const monthRegisters = registers.filter(r => {
              return parseInt((r.date || '').slice(5, 7), 10) - 1 === month;
            });

            const ventas = monthRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
            const gastos = monthRegisters.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);

            data.push({
              name: monthNames[month],
              ventas,
              gastos
            });
          }
        }

        setChartData(data);
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user, period, selectedStore]);

  // Calcular métricas del período completo — current
  // Las ventas pagadas por QR/transferencia YA están dentro de las ventas del
  // sistema/cuaderno (por eso el cierre diario las RESTA del efectivo esperado).
  // No sumarlas de nuevo aquí: el desglose QR es informativo (dinero que fue al
  // banco en vez de a caja), no un ingreso adicional.
  const periodSales = periodRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const periodQRPayments = periodRegisters.reduce((sum, r) => sum + calculateQRTotal(r.qrPayments || []), 0);
  const periodServices = periodRegisters.reduce((sum, r) => sum + calculateServicesTotal(r.technicalServices || []), 0);
  const periodExpenses = periodRegisters.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);
  const periodSavings = periodRegisters.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  const periodTotalIncome = periodSales;
  const periodBalance = periodTotalIncome - periodExpenses - periodSavings;

  // Calcular métricas del período anterior — previous
  const prevSales = prevRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const prevQRPayments = prevRegisters.reduce((sum, r) => sum + calculateQRTotal(r.qrPayments || []), 0);
  const prevExpenses = prevRegisters.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);
  const prevSavings = prevRegisters.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  const prevTotalIncome = prevSales;
  const prevBalance = prevTotalIncome - prevExpenses - prevSavings;

  // Trends
  const trendTotalIncome = calcTrend(periodTotalIncome, prevTotalIncome);
  const trendQRPayments = calcTrend(periodQRPayments, prevQRPayments);
  // For expenses: increase is bad — negate so StatCard shows red when expenses go up
  const trendExpenses = -calcTrend(periodExpenses, prevExpenses);
  const trendSavings = calcTrend(periodSavings, prevSavings);
  const trendBalance = calcTrend(periodBalance, prevBalance);

  // Obtener nombre del período para mostrar
  const getPeriodLabel = () => {
    const now = getTodayBogota();
    if (period === 'week') {
      const range = getWeekRange(now);
      return `Semana del ${range.start.getDate()} al ${range.end.getDate()} de ${getMonthName(now)}`;
    } else if (period === 'month') {
      return `${getMonthName(now)} ${now.getFullYear()}`;
    } else {
      return `Año ${now.getFullYear()}`;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header con selector de período */}
      <div className="bg-gradient-to-r from-orange-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-black mb-1">📊 Dashboard de Ventas</h2>
            <p className="text-orange-100 text-sm">{getPeriodLabel()}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                period === 'week'
                  ? 'bg-white text-orange-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                period === 'month'
                  ? 'bg-white text-orange-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                period === 'year'
                  ? 'bg-white text-orange-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              Año
            </button>
          </div>
        </div>

        {/* Selector de tienda (solo para super-admin y admin con acceso a todas) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 border-t border-white/20 pt-4 flex-wrap">
            <span className="text-xs font-bold text-orange-100 uppercase">Tienda:</span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedStore('todos')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'todos'
                    ? 'bg-white text-orange-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                Todas
              </button>
              {activeStores.map(store => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    selectedStore === store.id
                      ? 'bg-white text-orange-600'
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

      {/* KPI Row */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-1'} gap-4 lg:gap-6`}>
        <StatCard
          title="Ventas Totales"
          value={formatCurrency(periodTotalIncome)}
          icon="payments"
          trend={trendTotalIncome}
          color="blue"
          loading={loading}
        />
        {isSuperAdmin && (
          <StatCard
            title="QR/Transfer (incluido en ventas)"
            value={formatCurrency(periodQRPayments)}
            icon="qr_code_2"
            trend={trendQRPayments}
            color="orange"
            loading={loading}
          />
        )}
        {isSuperAdmin && (
          <StatCard
            title="Egresos"
            value={formatCurrency(periodExpenses)}
            icon="trending_down"
            trend={trendExpenses}
            color="red"
            loading={loading}
          />
        )}
        {isSuperAdmin && (
          <StatCard
            title="Ahorros"
            value={formatCurrency(periodSavings)}
            icon="savings"
            trend={trendSavings}
            color="yellow"
            loading={loading}
          />
        )}
        {isSuperAdmin && (
          <StatCard
            title="Balance Neto"
            value={formatCurrency(periodBalance)}
            icon="account_balance_wallet"
            trend={trendBalance}
            color={periodBalance >= 0 ? "green" : "red"}
            loading={loading}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a2e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white">Rendimiento del Período</h3>
            <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
              {period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}
            </div>
          </div>
          {loading ? (
            <div className="h-72 w-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-sm text-slate-500">Cargando datos...</p>
              </div>
            </div>
          ) : chartData.length > 0 && chartData.some(d => d.ventas > 0 || d.gastos > 0) ? (
            <div style={{ width: '100%', height: '288px' }}>
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="ventas" fill="#2563eb" radius={[4, 4, 0, 0]} name="Ventas" />
                  <Bar dataKey="gastos" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 w-full flex items-center justify-center">
              <div className="text-center">
                <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-slate-400 !text-[32px]">bar_chart</span>
                </div>
                <p className="text-sm text-slate-500 font-medium">No hay datos esta semana</p>
                <p className="text-xs text-slate-400 mt-1">Los datos aparecerán cuando se registren ventas</p>
              </div>
            </div>
          )}
        </div>

        {/* Technical Services Period */}
        <div className="bg-white dark:bg-[#1a1a2e] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">
            Servicios del {period === 'week' ? 'Período' : period === 'month' ? 'Mes' : 'Año'}
          </h3>
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (() => {
            const periodServicesArr = periodRegisters.flatMap(r => r.technicalServices || []);
            return periodServicesArr.length > 0 ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-64">
                  {periodServicesArr.map((service) => (
                    <div key={service.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{service.deviceModel}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Técnico: {service.technicianName}</p>
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">
                        {formatCurrency(service.amount)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Total servicios:</span>
                    <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                      {periodServicesArr.length}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-slate-400 !text-[32px]">build</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No hay servicios en este período</p>
                  <p className="text-xs text-slate-400 mt-1">Los servicios aparecerán aquí cuando se registren</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
