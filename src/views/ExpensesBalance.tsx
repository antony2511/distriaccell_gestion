
import React, { useState, useEffect } from 'react';
import { Expense, DailyRegister, StoreId, SavingsWithdrawal } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/currency';
import { calculateGrossIncome, calculateExpensesTotal } from '../utils/calculations';
import { getDailyRegistersByRange, saveSavingsWithdrawal, getSavingsWithdrawals, getTotalSavings } from '../services/dailyRegister.service';
import { formatDateId, getWeekRange, getMonthRange, getYearRange, getMonthName } from '../utils/dates';

type PeriodType = 'week' | 'month' | 'year';

const ExpensesBalance: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [periodRegisters, setPeriodRegisters] = useState<DailyRegister[]>([]);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [totalSavingsAccumulated, setTotalSavingsAccumulated] = useState(0);
  const [withdrawals, setWithdrawals] = useState<SavingsWithdrawal[]>([]);

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

  // Cargar datos del período
  useEffect(() => {
    const loadPeriodData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const storeId = user.storeId === 'ambos' ? 'almacen-1' : user.storeId;
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
        const registers = await getDailyRegistersByRange(startDate, endDate, storeId);
        setPeriodRegisters(registers);

        // Cargar total de ahorro acumulado y retiros
        const [totalSavings, allWithdrawals] = await Promise.all([
          getTotalSavings(storeId),
          getSavingsWithdrawals()
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
  }, [user, period]);

  // Calcular totales del período
  const allExpenses = periodRegisters.flatMap(r => r.expenses || []);
  const totalExpenses = calculateExpensesTotal(allExpenses);
  const totalGrossIncome = periodRegisters.reduce((sum, r) => sum + calculateGrossIncome(r), 0);
  const totalSavings = periodRegisters.reduce((sum, r) => sum + (r.dailySavings || 0), 0);
  const periodBalance = totalGrossIncome - totalExpenses - totalSavings;

  // Obtener nombre del período
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

            <div className="p-6">

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                      <th className="pb-3 px-2">Concepto</th>
                      <th className="pb-3">Categoría</th>
                      <th className="pb-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-500">
                          No hay gastos en este período
                        </td>
                      </tr>
                    ) : (
                      allExpenses.map((exp) => (
                        <tr key={exp.id}>
                          <td className="py-4 px-2 font-medium">{exp.concept}</td>
                          <td className="py-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-4 text-right font-black tabular-nums">{formatCurrency(exp.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
            // Recargar datos
            if (user) {
              const storeId = user.storeId === 'ambos' ? 'almacen-1' : user.storeId;
              const [totalSavings, allWithdrawals] = await Promise.all([
                getTotalSavings(storeId),
                getSavingsWithdrawals()
              ]);
              setTotalSavingsAccumulated(totalSavings);
              setWithdrawals(allWithdrawals);
            }
          }}
          userId={user?.id || ''}
          userName={user?.name || ''}
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
  currentSavings: number;
}> = ({ onClose, onSuccess, userId, userName, currentSavings }) => {
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
