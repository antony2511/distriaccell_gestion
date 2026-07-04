
import React, { useState, useEffect } from 'react';
import { Expense, DailyRegister, SavingsWithdrawal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/currency';
import { calculateGrossIncome, calculateExpensesTotal } from '../utils/calculations';
import { getDailyRegistersByRange, saveSavingsWithdrawal, getSavingsWithdrawals, getTotalSavings } from '../services/dailyRegister.service';
import { formatDateIdLocal, getTodayBogota, getWeekRange, getMonthRange, getYearRange, getMonthName } from '../utils/dates';
import { getBudgetSettings } from '../services/settings.service';
import { EXPENSE_CATEGORIES } from '../constants/categories';

type PeriodType = 'week' | 'month' | 'year';

// Map category id -> Material Symbol icon name
const CATEGORY_ICONS: Record<string, string> = {
  'insumos': 'inventory_2',
  'servicios-tecnicos': 'build',
  'inventario': 'smartphone',
  'administrativos': 'description',
  'servicios-publicos': 'bolt',
  'transporte': 'directions_car',
  'comidas': 'restaurant',
  'mantenimiento': 'home_repair_service',
  'otros': 'more_horiz',
};

const CAT_COLORS = ['blue', 'purple', 'orange', 'green', 'red', 'amber', 'teal', 'pink', 'slate'];

const colorClasses: Record<string, { bar: string; badge: string; text: string; bg: string }> = {
  blue:   { bar: 'bg-blue-500',   badge: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',   text: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  purple: { bar: 'bg-purple-500', badge: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300', text: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  orange: { bar: 'bg-orange-500', badge: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', text: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  green:  { bar: 'bg-green-500',  badge: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',  text: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30' },
  red:    { bar: 'bg-red-500',    badge: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',    text: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30' },
  amber:  { bar: 'bg-amber-500',  badge: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',  text: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/30' },
  teal:   { bar: 'bg-teal-500',   badge: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',   text: 'text-teal-600',   bg: 'bg-teal-100 dark:bg-teal-900/30' },
  pink:   { bar: 'bg-pink-500',   badge: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300',   text: 'text-pink-600',   bg: 'bg-pink-100 dark:bg-pink-900/30' },
  slate:  { bar: 'bg-slate-500',  badge: 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300',  text: 'text-slate-600',  bg: 'bg-slate-100 dark:bg-slate-800/50' },
};

const ExpensesBalance: React.FC = () => {
  const { hasPermission, user, activeStores } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [totalSavingsAccumulated, setTotalSavingsAccumulated] = useState(0);
  const [withdrawals, setWithdrawals] = useState<SavingsWithdrawal[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('todos');
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

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
            No tienes permisos para ver ahorro y balances. Solo el gerente puede acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Cuando cambian las tiendas disponibles, inicializar selectedStore
  useEffect(() => {
    if (!user) return;
    if (user.storeId !== 'ambos' && user.storeId !== 'todos') {
      setSelectedStore(user.storeId);
    }
  }, [user]);

  const storeFilter = selectedStore === 'todos' ? undefined : selectedStore;

  // Cargar datos del período
  useEffect(() => {
    const loadPeriodData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const now = getTodayBogota();

        let range;
        if (period === 'week') {
          range = getWeekRange(now);
        } else if (period === 'month') {
          range = getMonthRange(now);
        } else {
          range = getYearRange(now);
        }

        const startDate = formatDateIdLocal(range.start);
        const endDate = formatDateIdLocal(range.end);
        const [registers, budgetData] = await Promise.all([
          getDailyRegistersByRange(startDate, endDate, storeFilter),
          getBudgetSettings(),
        ]);
        setPeriodRegisters(registers);
        setBudgets(budgetData);

        // Cargar total de ahorro acumulado y retiros filtrados por tienda
        const [totalSavings, allWithdrawals] = await Promise.all([
          getTotalSavings(storeFilter),
          getSavingsWithdrawals(storeFilter)
        ]);
        setTotalSavingsAccumulated(totalSavings);
        setWithdrawals(allWithdrawals);
      } catch (error) {
        console.error('Error al cargar datos del período:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPeriodData();
  }, [user, period, selectedStore]);

  // Calcular totales del período
  const allExpenses = periodRegisters.flatMap(r => r.expenses || []);
  const totalExpenses = calculateExpensesTotal(allExpenses);
  const totalGrossIncome = periodRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const totalSavings = periodRegisters.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  const periodBalance = totalGrossIncome - totalExpenses - totalSavings;

  // Build category groups
  const expensesByCategory = allExpenses.reduce<Record<string, Expense[]>>((acc, exp) => {
    const catId = exp.category as string;
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(exp);
    return acc;
  }, {});

  const categoryGroups = (Object.entries(expensesByCategory) as [string, Expense[]][])
    .map(([catId, expenses], idx) => {
      const catMeta = EXPENSE_CATEGORIES.find(c => c.id === catId);
      const label = catMeta?.label || catId;
      const total = calculateExpensesTotal(expenses);
      const colorIdx = EXPENSE_CATEGORIES.findIndex(c => c.id === catId);
      const color = CAT_COLORS[colorIdx >= 0 ? colorIdx % CAT_COLORS.length : idx % CAT_COLORS.length];
      const icon = CATEGORY_ICONS[catId] || 'label';
      return { catId, label, expenses, total, color, icon };
    })
    .sort((a, b) => b.total - a.total);

  const topCategory = categoryGroups[0];

  // Obtener nombre del período
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-right-2 duration-500">
      {/* Header con selector de período */}
      <div className="bg-gradient-to-r from-orange-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black mb-1">💰 Gastos y Balance</h2>
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

        {/* Selector de tienda */}
        {activeStores.length > 1 && (
          <div className="flex items-center gap-2 border-t border-white/20 pt-4 mt-4 flex-wrap">
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2 text-orange-600">
                <span className="material-symbols-outlined">receipt_long</span>
                <h3 className="font-bold text-slate-900 dark:text-white">Gastos del Período</h3>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 uppercase">
                Total: {formatCurrency(totalExpenses)}
              </span>
            </div>

            <div className="p-5 space-y-3">
              {/* Summary bar */}
              {allExpenses.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total gastos</p>
                    <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalExpenses)}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Categorías</p>
                    <p className="text-base font-black text-slate-900 dark:text-white">{categoryGroups.length}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Mayor gasto</p>
                    <p className="text-[11px] font-black text-slate-900 dark:text-white truncate" title={topCategory?.label}>
                      {topCategory?.label || '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Accordion */}
              {categoryGroups.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-slate-400 !text-[32px]">receipt_long</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No hay gastos en este período</p>
                </div>
              ) : (
                categoryGroups.map((group, idx) => {
                  const pct = totalExpenses > 0 ? (group.total / totalExpenses) * 100 : 0;
                  const budget = budgets[group.catId] || 0;
                  const budgetPct = budget > 0 ? Math.min((group.total / budget) * 100, 100) : 0;
                  const overBudget = budget > 0 && group.total > budget;
                  const cls = colorClasses[group.color] || colorClasses['slate'];
                  const isExpanded = expandedCat === group.catId;

                  return (
                    <div
                      key={group.catId}
                      className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden"
                    >
                      {/* Category header row */}
                      <button
                        onClick={() => setExpandedCat(isExpanded ? null : group.catId)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
                      >
                        <div className={`size-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cls.bg}`}>
                          <span className={`material-symbols-outlined !text-[18px] ${cls.text}`}>{group.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{group.label}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cls.badge}`}>
                                {group.expenses.length}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="font-black text-sm text-slate-900 dark:text-white tabular-nums">{formatCurrency(group.total)}</span>
                              <span className="material-symbols-outlined !text-[16px] text-slate-400 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                expand_more
                              </span>
                            </div>
                          </div>
                          {/* Progress bar: % of total expenses */}
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mb-1">
                            <div
                              className={`h-1.5 rounded-full ${cls.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">{pct.toFixed(1)}% del total</span>
                            {budget > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-1">
                                  <div
                                    className={`h-1 rounded-full ${overBudget ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${budgetPct}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-bold ${overBudget ? 'text-red-500' : 'text-slate-400'}`}>
                                  {overBudget ? '⚠ Excede ppto.' : `${formatCurrency(group.total)} / ${formatCurrency(budget)}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">Sin presupuesto</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded list */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/60">
                          {group.expenses.map(exp => (
                            <div key={exp.id} className="flex items-start justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{exp.concept}</p>
                                {exp.subcategory && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">{exp.subcategory}</p>
                                )}
                              </div>
                              <span className="font-black text-sm text-slate-700 dark:text-slate-200 tabular-nums ml-4 flex-shrink-0">
                                {formatCurrency(exp.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined !text-[120px] text-green-600">savings</span>
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="size-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600">
                  <span className="material-symbols-outlined text-[28px]">savings</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Gestión de Ahorro</h3>
                  <p className="text-xs text-slate-500">Total acumulado y retiros</p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawalModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined !text-[18px]">arrow_circle_down</span>
                Retirar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <p className="text-xs text-slate-500 mb-1">Ahorro Acumulado</p>
                <p className="text-2xl font-black text-green-700 dark:text-green-400">
                  {formatCurrency(totalSavingsAccumulated)}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Este {period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}</p>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-300">
                  {formatCurrency(totalSavings)}
                </p>
              </div>
            </div>

            {withdrawals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 relative z-10">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Últimos retiros:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {withdrawals.slice(0, 3).map((w) => (
                    <div key={w.id} className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">{w.date.toLocaleDateString('es')}</span>
                      <span className="font-bold text-red-600">-{formatCurrency(w.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden sticky top-20">
            <div className="p-5 bg-orange-600 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">calculate</span>
                Balance del Período
              </h3>
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">
                {period === 'week' ? 'Semanal' : period === 'month' ? 'Mensual' : 'Anual'}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Ventas Totales</span>
                <span className="font-bold text-green-600">{formatCurrency(totalGrossIncome)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">(-) Gastos Totales</span>
                <span className="font-bold text-red-500">-{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">(-) Ahorro Retirado</span>
                <span className="font-bold text-red-500">-{formatCurrency(totalSavings)}</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800 border-t border-dashed my-2" />
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold">Balance Neto</span>
                <span className={`text-2xl font-black tabular-nums ${
                  periodBalance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(periodBalance)}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-6">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Registros del período:</span>
                  <span className="font-bold">{periodRegisters.length} {periodRegisters.length === 1 ? 'día' : 'días'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Gastos totales:</span>
                  <span className="font-bold">{allExpenses.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Promedio diario:</span>
                  <span className="font-bold">{formatCurrency(periodRegisters.length > 0 ? totalGrossIncome / periodRegisters.length : 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de retiro de ahorro */}
      {showWithdrawalModal && (
        <WithdrawalModal
          onClose={() => setShowWithdrawalModal(false)}
          onSuccess={async () => {
            setShowWithdrawalModal(false);
            const [totalSavings, allWithdrawals] = await Promise.all([
              getTotalSavings(storeFilter),
              getSavingsWithdrawals(storeFilter)
            ]);
            setTotalSavingsAccumulated(totalSavings);
            setWithdrawals(allWithdrawals);
          }}
          userId={user?.id || ''}
          userName={user?.name || ''}
          storeId={storeFilter}
          currentSavings={totalSavingsAccumulated}
        />
      )}
    </div>
  );
};

// Modal de retiro de ahorro
const WithdrawalModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  storeId?: string;
  currentSavings: number;
}> = ({ onClose, onSuccess, userId, userName, storeId, currentSavings }) => {
  const [formData, setFormData] = useState({
    amount: 0,
    justification: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.amount <= 0) {
      alert('❌ El monto debe ser mayor a 0');
      return;
    }

    if (formData.amount > currentSavings) {
      alert('❌ El monto a retirar no puede ser mayor al ahorro acumulado');
      return;
    }

    if (!formData.justification.trim()) {
      alert('❌ Debe proporcionar una justificación para el retiro');
      return;
    }

    setSaving(true);
    try {
      await saveSavingsWithdrawal({
        date: new Date(),
        amount: formData.amount,
        justification: formData.justification,
        authorizedBy: userId,
        authorizedByName: userName,
        storeId: storeId,
      });

      alert('✅ Retiro registrado correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error al registrar retiro:', error);
      alert('❌ Error al registrar el retiro: ' + error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Retirar Ahorro</h3>
            <p className="text-xs text-slate-500 mt-1">Disponible: {formatCurrency(currentSavings)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Monto a Retirar *
            </label>
            <input
              type="number"
              required
              min="0"
              step="1000"
              max={currentSavings}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Justificación *
            </label>
            <textarea
              required
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              rows={3}
              placeholder="Motivo del retiro..."
            />
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-orange-600 !text-[20px]">info</span>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <p className="font-bold mb-1">Importante:</p>
                <p>Este retiro se registrará y reducirá el ahorro acumulado total. Asegúrate de tener autorización antes de proceder.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Procesando...' : 'Retirar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpensesBalance;
