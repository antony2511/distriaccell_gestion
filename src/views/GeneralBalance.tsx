import React, { useState, useEffect } from 'react';
import { DailyRegister, CashWithdrawal, CashWithdrawalType, StoreId, MonthlyClosing } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/currency';
import { calculateGrossIncome, calculateExpensesTotal, calculateQRBreakdown } from '../utils/calculations';
import {
  getDailyRegistersByRange,
  saveCashWithdrawal,
  getCashWithdrawals
} from '../services/dailyRegister.service';
import {
  getLatestClosing,
  getClosingForPeriod,
  getClosingsByStore,
  saveMonthlyClosing
} from '../services/monthlyClosing.service';
import { formatDateId, formatDateIdLocal, getTodayId, getTodayBogota, getWeekRange, getMonthRange, getYearRange, getMonthName } from '../utils/dates';

type PeriodType = 'week' | 'month' | 'year';

// Fallback cuando una tienda nunca ha tenido un cierre mensual (mismo patrón que getTotalSavings)
const ALL_TIME_START = '2020-01-01';

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const getCurrentPeriod = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

interface StoreFinancials {
  income: number;
  expenses: number;
  savings: number;
  balance: number; // ingresos - gastos - ahorro (sin retiros)
}

const emptyFinancials = (): StoreFinancials => ({ income: 0, expenses: 0, savings: 0, balance: 0 });

const calcFinancials = (registers: DailyRegister[]): StoreFinancials => {
  const income = registers.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const expenses = registers.reduce((sum, r) => sum + calculateExpensesTotal(r.expenses || []), 0);
  const savings = registers.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  return { income, expenses, savings, balance: income - expenses - savings };
};

const withdrawalTypeLabels: Record<CashWithdrawalType, { label: string; icon: string }> = {
  propietario: { label: 'Retiros Propietario', icon: 'person' },
  proveedor: { label: 'Pagos a Proveedores', icon: 'local_shipping' },
  prestamo: { label: 'Préstamos', icon: 'handshake' },
  nomina: { label: 'Nómina', icon: 'payments' },
  otro: { label: 'Otros', icon: 'more_horiz' },
};

const GeneralBalance: React.FC = () => {
  const { hasPermission, user, activeStores } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const [sinceClosingRegisters, setSinceClosingRegisters] = useState<Record<string, DailyRegister[]>>({});
  const [periodRegisters, setPeriodRegisters] = useState<Record<string, DailyRegister[]>>({});
  const [allWithdrawals, setAllWithdrawals] = useState<CashWithdrawal[]>([]);
  const [latestClosings, setLatestClosings] = useState<Record<string, MonthlyClosing | null>>({});
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [closingModalStoreId, setClosingModalStoreId] = useState<string | null>(null);

  // Solo super-admin puede acceder a esta vista
  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-slate-400 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            No tienes permisos para ver el balance general. Solo el gerente puede acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Cargar datos: para cada tienda, todo lo ocurrido DESDE su último cierre mensual
  // (o desde 2020 si nunca ha tenido uno) + el período elegido (para la actividad reciente)
  const loadData = async () => {
    if (activeStores.length === 0) return;
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

      const todayStr = getTodayId();
      const periodStart = formatDateIdLocal(range.start);
      const periodEnd = formatDateIdLocal(range.end);

      const closings = await Promise.all(activeStores.map((s) => getLatestClosing(s.id)));
      const closingsMap: Record<string, MonthlyClosing | null> = {};
      activeStores.forEach((s, i) => { closingsMap[s.id] = closings[i]; });

      const [sinceClosingResults, periodResults, withdrawals] = await Promise.all([
        Promise.all(activeStores.map((s) => {
          const closing = closingsMap[s.id];
          const sinceStr = closing ? formatDateId(addDays(closing.date, 1)) : ALL_TIME_START;
          return getDailyRegistersByRange(sinceStr, todayStr, s.id);
        })),
        Promise.all(activeStores.map((s) => getDailyRegistersByRange(periodStart, periodEnd, s.id))),
        getCashWithdrawals(), // sin filtro: traemos todas y las categorizamos por tienda nosotros mismos
      ]);

      const sinceClosingMap: Record<string, DailyRegister[]> = {};
      const periodMap: Record<string, DailyRegister[]> = {};
      activeStores.forEach((s, i) => {
        sinceClosingMap[s.id] = sinceClosingResults[i];
        periodMap[s.id] = periodResults[i];
      });

      setLatestClosings(closingsMap);
      setSinceClosingRegisters(sinceClosingMap);
      setPeriodRegisters(periodMap);
      setAllWithdrawals(withdrawals);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period, activeStores]);

  const reloadWithdrawals = async () => {
    const withdrawals = await getCashWithdrawals();
    setAllWithdrawals(withdrawals);
  };

  // ── Cálculos por tienda (todo desde el último cierre mensual de cada una) ──
  const currentPeriod = getCurrentPeriod(getTodayBogota());

  const storeSinceClosingFinancials: Record<string, StoreFinancials> = Object.fromEntries(
    activeStores.map((s) => [s.id, calcFinancials(sinceClosingRegisters[s.id] || [])])
  );
  const storePeriodFinancials: Record<string, StoreFinancials> = Object.fromEntries(
    activeStores.map((s) => [s.id, calcFinancials(periodRegisters[s.id] || [])])
  );
  const storeQRBreakdown = Object.fromEntries(
    activeStores.map((s) => {
      const allQR = (periodRegisters[s.id] || []).flatMap((r) => r.qrPayments || []);
      return [s.id, calculateQRBreakdown(allQR)];
    })
  );

  const closingDateFor = (storeId: string): Date =>
    latestClosings[storeId]?.date || new Date(ALL_TIME_START);

  // Retiros desde el último cierre de cada tienda (legacy 'ambos' no se puede atribuir a una
  // sola tienda — se sigue mostrando aparte, sin filtrar por fecha de cierre)
  const withdrawalsSinceClosingByStore: Record<string, number> = Object.fromEntries(
    activeStores.map((s) => {
      const sinceDate = closingDateFor(s.id);
      const total = allWithdrawals
        .filter((w) => w.storeId === s.id && w.date > sinceDate)
        .reduce((sum, w) => sum + w.amount, 0);
      return [s.id, total];
    })
  );
  const legacyCombinedWithdrawals = allWithdrawals
    .filter((w) => w.storeId === 'ambos')
    .reduce((sum, w) => sum + w.amount, 0);

  const storeAccumulatedBalance: Record<string, number> = Object.fromEntries(
    activeStores.map((s) => {
      const baseAmount = latestClosings[s.id]?.amountRemaining ?? 0;
      const balance = baseAmount + storeSinceClosingFinancials[s.id].balance - (withdrawalsSinceClosingByStore[s.id] || 0);
      return [s.id, balance];
    })
  );

  const selectedStores = activeStores.filter((s) => selectedStoreIds.includes(s.id));
  const isAllStoresSelected = activeStores.length > 0 && selectedStoreIds.length === activeStores.length;

  // ── Consolidado (solo tiendas seleccionadas) ────────────────────────────
  const consolidated = selectedStores.reduce(
    (acc, s) => {
      const f = storeSinceClosingFinancials[s.id] || emptyFinancials();
      acc.income += f.income;
      acc.expenses += f.expenses;
      acc.savings += f.savings;
      acc.withdrawals += withdrawalsSinceClosingByStore[s.id] || 0;
      acc.base += latestClosings[s.id]?.amountRemaining ?? 0;
      return acc;
    },
    { income: 0, expenses: 0, savings: 0, withdrawals: 0, base: 0 }
  );
  // Los retiros históricos "ambos" solo se suman al consolidado cuando se ven todas las tiendas —
  // no se puede repartir de forma confiable entre un subconjunto elegido por el usuario.
  const consolidatedWithdrawals = consolidated.withdrawals + (isAllStoresSelected ? legacyCombinedWithdrawals : 0);
  const consolidatedGrossBalance = consolidated.base + consolidated.income - consolidated.expenses - consolidated.savings;
  const consolidatedNetBalance = consolidatedGrossBalance - consolidatedWithdrawals;

  const periodConsolidated = selectedStores.reduce(
    (acc, s) => {
      const f = storePeriodFinancials[s.id] || emptyFinancials();
      acc.income += f.income;
      acc.expenses += f.expenses;
      acc.savings += f.savings;
      return acc;
    },
    { income: 0, expenses: 0, savings: 0 }
  );

  const qrConsolidated = selectedStores.reduce(
    (acc, s) => {
      const b = storeQRBreakdown[s.id] || { qr: 0, transferencia: 0, tarjeta: 0, otros: 0 };
      acc.qr += b.qr;
      acc.transferencia += b.transferencia;
      acc.tarjeta += b.tarjeta;
      acc.otros += b.otros;
      return acc;
    },
    { qr: 0, transferencia: 0, tarjeta: 0, otros: 0 }
  );

  // Retiros a mostrar en el panel lateral: tiendas seleccionadas, desde el último cierre de cada una
  const filteredWithdrawals = allWithdrawals.filter((w) => {
    if (w.storeId === 'ambos') return isAllStoresSelected;
    if (!selectedStoreIds.includes(w.storeId)) return false;
    return w.date > closingDateFor(w.storeId);
  });
  const withdrawalsByType = filteredWithdrawals.reduce((acc, w) => {
    acc[w.type] = (acc[w.type] || 0) + w.amount;
    return acc;
  }, {} as Record<string, number>);

  const toggleStore = (id: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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

  const currentMonthLabel = getMonthName(getTodayBogota());
  const closingForCurrentPeriod = (storeId: string): MonthlyClosing | null => {
    const closing = latestClosings[storeId];
    return closing && closing.period === currentPeriod ? closing : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando balance general...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Balance General</h2>
            <p className="text-slate-500 text-sm">
              Balance disponible = lo que quedó del último cierre mensual de cada tienda + lo ocurrido desde entonces.
              El filtro de período solo afecta la actividad reciente.
            </p>
          </div>

          {/* Filtro de tiendas combinable — sin preselección, elige explícitamente */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Tiendas a mostrar</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedStoreIds(activeStores.map((s) => s.id))}
                className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all border ${
                  isAllStoresSelected
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                }`}
              >
                Todas
              </button>
              {activeStores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => toggleStore(store.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all border flex items-center gap-1.5 ${
                    selectedStoreIds.includes(store.id)
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 text-orange-700 dark:text-orange-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined !text-[16px]">store</span>
                  {store.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Balance por Tienda (desde el último cierre mensual de cada una) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectedStores.map((store) => {
          const balance = storeAccumulatedBalance[store.id] ?? 0;
          const withdrawn = withdrawalsSinceClosingByStore[store.id] || 0;
          const lastClosing = latestClosings[store.id];
          const currentClosing = closingForCurrentPeriod(store.id);
          const baseAmount = lastClosing?.amountRemaining ?? 0;
          return (
            <div key={store.id} className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 !text-[20px]">store</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{store.name}</h3>
                </div>
                {currentClosing ? (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                    {currentMonthLabel} cerrado
                  </span>
                ) : (
                  <button
                    onClick={() => setClosingModalStoreId(store.id)}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                  >
                    Hacer Cierre de {currentMonthLabel}
                  </button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Base {lastClosing ? `(cierre de ${lastClosing.period})` : '(sin cierres previos)'}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(baseAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ingresos desde entonces</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(storeSinceClosingFinancials[store.id]?.income || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gastos desde entonces</span>
                  <span className="font-semibold text-slate-900 dark:text-white">-{formatCurrency(storeSinceClosingFinancials[store.id]?.expenses || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ahorro desde entonces</span>
                  <span className="font-semibold text-slate-900 dark:text-white">-{formatCurrency(storeSinceClosingFinancials[store.id]?.savings || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Retiros desde entonces</span>
                  <span className="font-semibold text-slate-900 dark:text-white">-{formatCurrency(withdrawn)}</span>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Balance Disponible</span>
                  <span className={`text-lg font-black ${balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600'}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
              <StoreClosingHistory storeId={store.id} storeName={store.name} />
            </div>
          );
        })}
        {selectedStores.length === 0 && (
          <div className="md:col-span-2 text-center py-10 text-slate-400">
            Selecciona al menos una tienda para ver su balance.
          </div>
        )}
      </div>

      {/* Balance General Consolidado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel Principal - Balance */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">Balance Consolidado</h3>
            <p className="text-xs text-slate-500">
              {isAllStoresSelected ? 'Suma de todas las tiendas' : `Suma de ${selectedStores.length} tienda(s) seleccionada(s)`}
            </p>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">Base (saldo de los últimos cierres mensuales)</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(consolidated.base)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">Ingresos desde entonces</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(consolidated.income)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">(-) Gastos Operativos</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">-{formatCurrency(consolidated.expenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">(-) Ahorro</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">-{formatCurrency(consolidated.savings)}</span>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex justify-between items-center py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 -mx-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Balance Bruto</span>
              <span className={`text-xl font-black ${consolidatedGrossBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600'}`}>
                {formatCurrency(consolidatedGrossBalance)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">(-) Retiros de Caja</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">-{formatCurrency(consolidatedWithdrawals)}</span>
            </div>
            {isAllStoresSelected && legacyCombinedWithdrawals > 0 && (
              <p className="text-xs text-slate-400 -mt-2">
                Incluye {formatCurrency(legacyCombinedWithdrawals)} de retiros históricos registrados como "ambas tiendas" (antes de exigir tienda específica).
              </p>
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex justify-between items-center py-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl px-4 -mx-1 border border-orange-100 dark:border-orange-900/20">
              <span className="font-bold text-slate-900 dark:text-white">BALANCE DISPONIBLE</span>
              <span className={`text-2xl font-black ${consolidatedNetBalance >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                {formatCurrency(consolidatedNetBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Panel Lateral - Retiros */}
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Retiros de Caja</h3>
              <p className="text-xs text-slate-500">Salidas del balance</p>
            </div>
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg font-semibold text-sm hover:bg-orange-700 transition-all"
            >
              Retirar
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Total Retirado</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrency(consolidatedWithdrawals)}
              </p>
            </div>

            {Object.keys(withdrawalsByType).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por tipo:</p>
                <div className="space-y-2">
                  {(Object.entries(withdrawalsByType) as [string, number][]).map(([type, amount]) => {
                    const typeInfo = withdrawalTypeLabels[type as CashWithdrawalType];
                    return (
                      <div key={type} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 !text-[16px]">{typeInfo?.icon}</span>
                          <span className="text-slate-600 dark:text-slate-400">{typeInfo?.label || type}</span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredWithdrawals.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Últimos retiros:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredWithdrawals.slice(0, 5).map((w) => (
                    <div key={w.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{w.concept}</p>
                        <p className="text-xs text-slate-400">{w.date.toLocaleDateString('es')}</p>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">-{formatCurrency(w.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredWithdrawals.length === 0 && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 !text-[40px]">account_balance_wallet</span>
                <p className="text-sm text-slate-500 mt-2">No hay retiros registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actividad del período (informativo, no afecta el balance disponible) */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Actividad de este período</h3>
            <p className="text-xs text-slate-500">{getPeriodLabel()} — no afecta el balance disponible acumulado</p>
          </div>
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
            {(['week', 'month', 'year'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  period === p
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Ingresos del período</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(periodConsolidated.income)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Gastos del período</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(periodConsolidated.expenses)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Ahorro del período</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(periodConsolidated.savings)}</p>
          </div>
        </div>

        {/* Desglose QR/Transferencia por tienda */}
        <div className="p-5 pt-0">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Ingresos bancarios (QR / Transferencia) por tienda</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedStores.map((store) => {
              const b = storeQRBreakdown[store.id] || { qr: 0, transferencia: 0, tarjeta: 0, otros: 0 };
              return (
                <div key={store.id} className="border border-orange-100 dark:border-orange-900/30 bg-orange-50/40 dark:bg-orange-900/10 rounded-xl p-4">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white mb-2">{store.name}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">QR</span><span className="font-semibold">{formatCurrency(b.qr)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Transferencia</span><span className="font-semibold">{formatCurrency(b.transferencia)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Tarjeta</span><span className="font-semibold">{formatCurrency(b.tarjeta)}</span></div>
                    {b.otros > 0 && (
                      <div className="flex justify-between"><span className="text-slate-500">Otros</span><span className="font-semibold">{formatCurrency(b.otros)}</span></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedStores.length > 1 && (
            <div className="mt-3 flex justify-end gap-4 text-sm text-slate-500">
              <span>Total QR: <strong className="text-slate-900 dark:text-white">{formatCurrency(qrConsolidated.qr)}</strong></span>
              <span>Total Transferencia: <strong className="text-slate-900 dark:text-white">{formatCurrency(qrConsolidated.transferencia)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Retiro */}
      {showWithdrawalModal && (
        <CashWithdrawalModal
          onClose={() => setShowWithdrawalModal(false)}
          onSuccess={async () => {
            setShowWithdrawalModal(false);
            await reloadWithdrawals();
          }}
          userId={user?.id || ''}
          userName={user?.name || ''}
          stores={activeStores}
          storeAccumulatedBalance={storeAccumulatedBalance}
        />
      )}

      {/* Modal de Cierre Mensual */}
      {closingModalStoreId && (
        <MonthlyClosingModal
          store={activeStores.find((s) => s.id === closingModalStoreId)!}
          period={currentPeriod}
          periodLabel={currentMonthLabel}
          currentBalance={storeAccumulatedBalance[closingModalStoreId] ?? 0}
          userId={user?.id || ''}
          userName={user?.name || ''}
          onClose={() => setClosingModalStoreId(null)}
          onSuccess={async () => {
            setClosingModalStoreId(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
};

// Modal de retiro de caja — exige elegir la tienda de origen
const CashWithdrawalModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  stores: { id: string; name: string }[];
  storeAccumulatedBalance: Record<string, number>;
}> = ({ onClose, onSuccess, userId, userName, stores, storeAccumulatedBalance }) => {
  const [formData, setFormData] = useState({
    type: 'propietario' as CashWithdrawalType,
    amount: 0,
    concept: '',
    beneficiary: '',
    reference: '',
    storeId: '' as StoreId,
  });
  const [saving, setSaving] = useState(false);

  const withdrawalTypes: { value: CashWithdrawalType; label: string; icon: string }[] = [
    { value: 'propietario', label: 'Propietario', icon: 'person' },
    { value: 'proveedor', label: 'Proveedor', icon: 'local_shipping' },
    { value: 'prestamo', label: 'Préstamo', icon: 'handshake' },
    { value: 'otro', label: 'Otro', icon: 'more_horiz' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.amount <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (!formData.storeId) {
      alert('Debes seleccionar de qué tienda sale el dinero');
      return;
    }

    if (!formData.concept.trim()) {
      alert('Debe proporcionar un concepto para el retiro');
      return;
    }

    setSaving(true);
    try {
      await saveCashWithdrawal({
        date: new Date(),
        type: formData.type,
        amount: formData.amount,
        concept: formData.concept,
        beneficiary: formData.beneficiary || undefined,
        reference: formData.reference || undefined,
        authorizedBy: userId,
        authorizedByName: userName,
        storeId: formData.storeId,
      });

      alert('Retiro registrado correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error al registrar retiro:', error);
      alert('Error al registrar el retiro: ' + error);
    } finally {
      setSaving(false);
    }
  };

  const availableAtSelectedStore = formData.storeId ? storeAccumulatedBalance[formData.storeId] : undefined;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Retiro</h3>
            <p className="text-xs text-slate-500">
              {availableAtSelectedStore !== undefined
                ? `Disponible en esta tienda: ${formatCurrency(availableAtSelectedStore)}`
                : 'Elige una tienda para ver el saldo disponible'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tienda de origen */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              ¿De qué tienda sale el dinero?
            </label>
            <select
              required
              value={formData.storeId}
              onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
            >
              <option value="">Selecciona una tienda</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo de retiro */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Tipo de Retiro
            </label>
            <div className="grid grid-cols-4 gap-2">
              {withdrawalTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                    formData.type === type.value
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined !text-[20px]">{type.icon}</span>
                  <span className="text-[10px] font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Monto
            </label>
            <input
              type="number"
              required
              min="0"
              step="1000"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
              placeholder="0"
            />
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Concepto
            </label>
            <input
              type="text"
              required
              value={formData.concept}
              onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
              placeholder="Descripción del retiro"
            />
          </div>

          {/* Beneficiario */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Beneficiario <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={formData.beneficiary}
              onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
              placeholder="Nombre del beneficiario"
            />
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              Referencia <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
              placeholder="Factura, recibo, etc."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Procesando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal de Cierre Mensual — pregunta cuánto sale de la caja y cuánto queda,
// y ese "queda" pasa a ser la base del siguiente período para esta tienda.
const MonthlyClosingModal: React.FC<{
  store: { id: string; name: string };
  period: string;
  periodLabel: string;
  currentBalance: number;
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ store, period, periodLabel, currentBalance, userId, userName, onClose, onSuccess }) => {
  const [amountWithdrawn, setAmountWithdrawn] = useState(0);
  const [amountRemaining, setAmountRemaining] = useState(0);
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [alreadyClosed, setAlreadyClosed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClosingForPeriod(store.id, period).then((existing) => {
      if (!cancelled) setAlreadyClosed(!!existing);
    });
    return () => { cancelled = true; };
  }, [store.id, period]);

  const difference = currentBalance - (amountWithdrawn + amountRemaining);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountWithdrawn < 0 || amountRemaining < 0) {
      alert('Los montos no pueden ser negativos');
      return;
    }

    if (difference !== 0 && !justification.trim()) {
      alert('El total no coincide con el balance calculado — agrega una justificación');
      return;
    }

    setSaving(true);
    try {
      await saveMonthlyClosing({
        storeId: store.id,
        period,
        date: new Date(),
        balanceBeforeClosing: currentBalance,
        amountWithdrawn,
        amountRemaining,
        justification: justification.trim() || undefined,
        authorizedBy: userId,
        authorizedByName: userName,
      });
      alert('Cierre mensual registrado correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error al registrar el cierre mensual:', error);
      alert('Error al registrar el cierre: ' + error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cierre Mensual — {store.name}</h3>
            <p className="text-xs text-slate-500">{periodLabel} · Balance calculado: {formatCurrency(currentBalance)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {alreadyClosed ? (
          <div className="p-5">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Ya existe un cierre para {store.name} en {periodLabel}. No se puede duplicar.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                ¿Cuánto sale de la caja?
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={amountWithdrawn}
                onChange={(e) => setAmountWithdrawn(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                ¿Cuánto queda? (pasa a {periodLabel} siguiente)
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={amountRemaining}
                onChange={(e) => setAmountRemaining(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
                placeholder="0"
              />
            </div>

            <div className={`rounded-lg p-3 text-sm ${difference === 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'}`}>
              Diferencia: {formatCurrency(difference)}
              {difference !== 0 && ' — no coincide con el balance calculado'}
            </div>

            {difference !== 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                  Justificación de la diferencia
                </label>
                <textarea
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-4 py-2.5 text-sm"
                  rows={2}
                  placeholder="Explica por qué no coincide"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || alreadyClosed === null}
                className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? 'Procesando...' : 'Registrar Cierre'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Historial de cierres mensuales de una tienda — colapsable, carga bajo demanda
const StoreClosingHistory: React.FC<{ storeId: string; storeName: string }> = ({ storeId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);

  const handleToggle = async () => {
    if (!open && closings.length === 0) {
      setLoading(true);
      try {
        const data = await getClosingsByStore(storeId);
        setClosings(data);
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        Historial de cierres
        <span className={`material-symbols-outlined !text-[18px] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-slate-400">Cargando...</p>}
          {!loading && closings.length === 0 && <p className="text-xs text-slate-400">Sin cierres registrados.</p>}
          {!loading && closings.map((c) => (
            <div key={c.id} className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
              <span className="text-slate-500">{c.period}</span>
              <span className="text-slate-700 dark:text-slate-300">
                Salió {formatCurrency(c.amountWithdrawn)} · Quedó {formatCurrency(c.amountRemaining)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeneralBalance;
