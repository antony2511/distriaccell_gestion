
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { DailyRegister, SaleCategory, ExpenseCategory } from '../types';
import { getDailyRegistersByRange } from '../services/dailyRegister.service';
import { formatDateId, getWeekRange, getMonthRange, getYearRange } from '../utils/dates';
import { calculateGrossIncome, calculateExpensesTotal, calculateQRTotal } from '../utils/calculations';
import { formatCurrency } from '../utils/currency';
import { STORES } from '../constants/categories';

type PeriodType = 'week' | 'month' | 'year';

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const initialStore = user?.storeId === 'ambos' ? 'ambos' : (user?.storeId || 'almacen-1');
  const [selectedStore, setSelectedStore] = useState<StoreId | 'ambos'>(initialStore);

  // Estado para Balance General Consolidado
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [consolidatedStartDate, setConsolidatedStartDate] = useState('');
  const [consolidatedEndDate, setConsolidatedEndDate] = useState('');
  const [consolidatedRegisters, setConsolidatedRegisters] = useState<DailyRegister[]>([]);
  const [loadingConsolidated, setLoadingConsolidated] = useState(false);

  // Cargar datos del período
  useEffect(() => {
    const loadPeriodData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const now = new Date();

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

    // Formatear fecha según el período
    let label = register.date;
    if (period === 'week') {
      // Mostrar día de la semana
      const date = new Date(register.date);
      label = date.toLocaleDateString('es', { weekday: 'short' });
    } else if (period === 'month') {
      // Mostrar día del mes
      const date = new Date(register.date);
      label = date.getDate().toString();
    } else {
      // Para año, mostrar mes
      const date = new Date(register.date);
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
    // Ventas del cuaderno por categoría
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

    // Servicios técnicos
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

  // Función para cargar Balance General Consolidado
  const loadConsolidatedBalance = async () => {
    if (!consolidatedStartDate || !consolidatedEndDate) {
      alert('Por favor selecciona un rango de fechas válido');
      return;
    }

    setLoadingConsolidated(true);
    try {
      // Cargar registros de ambos almacenes
      const [registers1, registers2] = await Promise.all([
        getDailyRegistersByRange(consolidatedStartDate, consolidatedEndDate, 'almacen-1'),
        getDailyRegistersByRange(consolidatedStartDate, consolidatedEndDate, 'almacen-2')
      ]);

      console.log('=== DEBUG: BALANCE CONSOLIDADO ===');
      console.log('Rango de fechas:', consolidatedStartDate, 'a', consolidatedEndDate);
      console.log('Registros almacen-1:', registers1.length);
      console.log('Registros almacen-2:', registers2.length);
      console.log('Detalle almacen-1:', registers1.map(r => ({
        date: r.date,
        systemSales: r.systemSales,
        notebookSales: r.notebookSales?.length,
        services: r.technicalServices?.length,
        isClosed: r.isClosed,
        id: r.id
      })));
      console.log('Detalle almacen-2:', registers2.map(r => ({
        date: r.date,
        systemSales: r.systemSales,
        notebookSales: r.notebookSales?.length,
        services: r.technicalServices?.length,
        isClosed: r.isClosed,
        id: r.id
      })));

      // Combinar ambos almacenes
      const allRegisters = [...registers1, ...registers2];

      // Verificar duplicados (mismo almacén + misma fecha)
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

  // Agrupar registros consolidados por fecha
  const consolidatedByDate = consolidatedRegisters.reduce((acc, register) => {
    const date = register.date;
    if (!acc[date]) {
      acc[date] = {
        date,
        distriaccell: { income: 0, expenses: 0, savings: 0, qrPayments: 0, balance: 0 },
        accell: { income: 0, expenses: 0, savings: 0, qrPayments: 0, balance: 0 }
      };
    }

    // Calcular totales para cada almacén
    const income = calculateGrossIncome(register); // Sistema + Cuaderno + Servicios
    const qrPayments = calculateQRTotal(register.qrPayments || []);
    const expenses = calculateExpensesTotal(register.expenses || []);
    const savings = register.dailySavings || 0;

    // Balance = Ingresos - Gastos - Ahorro - QR
    // Los QR se RESTAN porque no están físicamente en caja (van directo al banco)
    const balance = income - expenses - savings - qrPayments;

    console.log(`[${date}] ${register.storeId}:`, {
      systemSales: register.systemSales,
      notebookSales: register.notebookSales?.length,
      income,
      qrPayments,
      expenses,
      savings,
      balance: `${income} - ${expenses} - ${savings} - ${qrPayments} = ${balance}`
    });

    if (register.storeId === 'almacen-1') {
      acc[date].distriaccell = { income, expenses, savings, qrPayments, balance };
    } else if (register.storeId === 'almacen-2') {
      acc[date].accell = { income, expenses, savings, qrPayments, balance };
    }

    return acc;
  }, {} as Record<string, {
    date: string;
    distriaccell: { income: number; expenses: number; savings: number; qrPayments: number; balance: number };
    accell: { income: number; expenses: number; savings: number; qrPayments: number; balance: number }
  }>);

  // Convertir a array y ordenar por fecha descendente
  const consolidatedData = Object.values(consolidatedByDate).sort((a, b) => b.date.localeCompare(a.date));

  // Mostrar tabla consolidada en consola
  if (consolidatedData.length > 0) {
    console.log('=== DATOS CONSOLIDADOS FINALES ===');
    console.table(consolidatedData.map(d => ({
      fecha: d.date,
      'Distr.Ing': d.distriaccell.income,
      'Distr.Egr': d.distriaccell.expenses,
      'Distr.Aho': d.distriaccell.savings,
      'Distr.QR': d.distriaccell.qrPayments,
      'Distr.Bal': d.distriaccell.balance,
      'Accell.Ing': d.accell.income,
      'Accell.Egr': d.accell.expenses,
      'Accell.Aho': d.accell.savings,
      'Accell.QR': d.accell.qrPayments,
      'Accell.Bal': d.accell.balance,
      'Total': d.distriaccell.balance + d.accell.balance
    })));
  }

  // Calcular totales consolidados
  const totalDistriaccell = consolidatedData.reduce((sum, d) => sum + d.distriaccell.balance, 0);
  const totalAccell = consolidatedData.reduce((sum, d) => sum + d.accell.balance, 0);
  const grandTotal = totalDistriaccell + totalAccell;

  const totalIncomeDistriaccell = consolidatedData.reduce((sum, d) => sum + d.distriaccell.income, 0);
  const totalIncomeAccell = consolidatedData.reduce((sum, d) => sum + d.accell.income, 0);
  const totalExpensesDistriaccell = consolidatedData.reduce((sum, d) => sum + d.distriaccell.expenses, 0);
  const totalExpensesAccell = consolidatedData.reduce((sum, d) => sum + d.accell.expenses, 0);

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
              <button
                onClick={() => setSelectedStore('almacen-1')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'almacen-1'
                    ? 'bg-white text-blue-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {STORES[0].label}
              </button>
              <button
                onClick={() => setSelectedStore('almacen-2')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  selectedStore === 'almacen-2'
                    ? 'bg-white text-blue-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {STORES[1].label}
              </button>
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

            {/* Resumen de totales */}
            {consolidatedData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Ingresos Distriaccell</p>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(totalIncomeDistriaccell)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Ingresos accell.com</p>
                  <p className="text-xl font-black text-purple-700 dark:text-purple-300">{formatCurrency(totalIncomeAccell)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Egresos Distriaccell</p>
                  <p className="text-xl font-black text-red-700 dark:text-red-300">{formatCurrency(totalExpensesDistriaccell)}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">Egresos accell.com</p>
                  <p className="text-xl font-black text-orange-700 dark:text-orange-300">{formatCurrency(totalExpensesAccell)}</p>
                </div>
              </div>
            )}

            {/* Tabla de balance consolidado */}
            {consolidatedData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Fecha
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                        Distriaccell<br/>Balance
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">
                        accell.com<br/>Balance
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-green-600 dark:text-green-400 uppercase">
                        Balance<br/>Total Día
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedData.map((row) => {
                      const totalBalance = row.distriaccell.balance + row.accell.balance;

                      // Usar fecha directamente sin conversión a Date para evitar problemas de zona horaria
                      const [year, month, day] = row.date.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      const formattedDate = date.toLocaleDateString('es-CO', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <tr
                          key={row.date}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">
                            {formattedDate}
                            <div className="text-xs text-slate-500 mt-1">
                              Ing: {formatCurrency(row.distriaccell.income + row.accell.income)} |
                              Egr: {formatCurrency(row.distriaccell.expenses + row.accell.expenses)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className={`text-sm font-bold ${row.distriaccell.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatCurrency(row.distriaccell.balance)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              +{formatCurrency(row.distriaccell.income)} -{formatCurrency(row.distriaccell.expenses)} -{formatCurrency(row.distriaccell.savings)} -{formatCurrency(row.distriaccell.qrPayments)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className={`text-sm font-bold ${row.accell.balance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                              {formatCurrency(row.accell.balance)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              +{formatCurrency(row.accell.income)} -{formatCurrency(row.accell.expenses)} -{formatCurrency(row.accell.savings)} -{formatCurrency(row.accell.qrPayments)}
                            </div>
                          </td>
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
                      <td className="py-4 px-4 text-sm font-black text-slate-900 dark:text-white uppercase">
                        Balance Total
                      </td>
                      <td className="py-4 px-4 text-sm text-right font-black text-blue-600">
                        {formatCurrency(totalDistriaccell)}
                      </td>
                      <td className="py-4 px-4 text-sm text-right font-black text-purple-600">
                        {formatCurrency(totalAccell)}
                      </td>
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
    </div>
  );
};

export default Reports;
