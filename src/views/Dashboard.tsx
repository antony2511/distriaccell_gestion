
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { getDailyRegistersByRange } from '../services/dailyRegister.service';
import { formatDateId, getWeekRange, getMonthRange, getYearRange, getMonthName } from '../utils/dates';
import { formatCurrency } from '../utils/currency';
import { calculateGrossIncome, calculateExpensesTotal, calculateServicesTotal } from '../utils/calculations';
import { DailyRegister } from '../types';
import { STORES } from '../constants/categories';

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
    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{title}</p>
    {loading ? (
      <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
    ) : (
      <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{value}</h3>
    )}
  </div>
);

const Dashboard: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const isSuperAdmin = hasPermission('all');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  // Inicializar selectedStore según el usuario
  const initialStore = user?.storeId === 'ambos' ? 'ambos' : (user?.storeId || 'almacen-1');
  const [selectedStore, setSelectedStore] = useState<StoreId | 'ambos'>(initialStore);

  // Cargar datos del período seleccionado
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const now = new Date();

        // Obtener rango según el período seleccionado
        let range;
        if (period === 'week') {
          range = getWeekRange(now);
        } else if (period === 'month') {
          range = getMonthRange(now);
        } else {
          range = getYearRange(now);
        }

        const startDate = formatDateId(range.start);
        const endDate = formatDateId(range.end);

        // Si es "ambos", obtener datos de ambos almacenes
        let registers: DailyRegister[] = [];
        if (selectedStore === 'ambos') {
          const [registers1, registers2] = await Promise.all([
            getDailyRegistersByRange(startDate, endDate, 'almacen-1'),
            getDailyRegistersByRange(startDate, endDate, 'almacen-2')
          ]);
          registers = [...registers1, ...registers2];
        } else {
          registers = await getDailyRegistersByRange(startDate, endDate, selectedStore);
        }

        setPeriodRegisters(registers);

        // Preparar datos para el gráfico según el período
        let data = [];

        if (period === 'week') {
          // Gráfico de 7 días (Lun-Dom)
          const dayNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
          for (let i = 0; i < 7; i++) {
            const date = new Date(range.start);
            date.setDate(date.getDate() + i);
            const dateId = formatDateId(date);
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
            const weekRegisters = registers.filter((r, idx) => {
              const regDate = new Date(r.date || '');
              const dayOfMonth = regDate.getDate();
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
              const regDate = new Date(r.date || '');
              return regDate.getMonth() === month;
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

  // Calcular métricas del período completo
  const periodSales = periodRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const periodServices = periodRegisters.reduce((sum, r) => sum + calculateServicesTotal(r.technicalServices || []), 0);
  const periodExpenses = periodRegisters.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);
  const periodSavings = periodRegisters.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  const periodBalance = periodSales - periodExpenses - periodSavings;

  // Obtener nombre del período para mostrar
  const getPeriodLabel = () => {
    const now = new Date();
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

        {/* Selector de almacén (solo para super-admin) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 border-t border-white/20 pt-4">
            <span className="text-xs font-bold text-orange-100 uppercase">Almacén:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStore('ambos')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'ambos'
                    ? 'bg-white text-orange-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                Ambos
              </button>
              <button
                onClick={() => setSelectedStore('almacen-1')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'almacen-1'
                    ? 'bg-white text-orange-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {STORES[0].label}
              </button>
              <button
                onClick={() => setSelectedStore('almacen-2')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'almacen-2'
                    ? 'bg-white text-orange-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {STORES[1].label}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4 lg:gap-6`}>
        <StatCard
          title="Ventas Totales"
          value={formatCurrency(periodSales)}
          icon="payments"
          trend={0}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Reparaciones"
          value={formatCurrency(periodServices)}
          icon="build"
          trend={0}
          color="purple"
          loading={loading}
        />
        {isSuperAdmin && (
          <StatCard
            title="Egresos"
            value={formatCurrency(periodExpenses)}
            icon="trending_down"
            trend={0}
            color="red"
            loading={loading}
          />
        )}
        {isSuperAdmin && (
          <StatCard
            title="Balance"
            value={formatCurrency(periodBalance)}
            icon="account_balance_wallet"
            trend={0}
            color="green"
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
            const periodServices = periodRegisters.flatMap(r => r.technicalServices || []);
            return periodServices.length > 0 ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-64">
                  {periodServices.map((service) => (
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
                      {periodServices.length}
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
