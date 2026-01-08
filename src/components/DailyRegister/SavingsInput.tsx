import React from 'react';
import { formatCurrency } from '../../utils/currency';

interface SavingsInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  last7DaysSavings?: number[];
}

const SavingsInput: React.FC<SavingsInputProps> = ({ value, onChange, disabled, last7DaysSavings = [] }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value) || 0;
    onChange(numValue);
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-purple-50 dark:from-orange-900/10 dark:to-purple-900/10 rounded-2xl border-2 border-orange-200 dark:border-orange-800 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/20 dark:to-purple-900/20 border-b-2 border-orange-200 dark:border-orange-700 flex items-center gap-2">
        <span className="text-2xl">💰</span>
        <h3 className="font-bold text-sm">Ahorro del Día</h3>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Info banner */}
        <div className="bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-orange-600 flex-shrink-0">savings</span>
            <div>
              <p className="text-xs font-bold text-orange-800 dark:text-orange-200 mb-1">
                Este monto se guardará automáticamente en el fondo de ahorro
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                El ahorro se registra como salida de efectivo del día y se acumula automáticamente en el Módulo de Ahorro.
              </p>
            </div>
          </div>
        </div>

        {/* Input */}
        <label className="block">
          <span className="block text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest mb-2">
            Monto a guardar en el fondo de ahorro
          </span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 font-bold text-2xl">$</span>
            <input
              type="number"
              value={value || ''}
              onChange={handleChange}
              disabled={disabled}
              placeholder="0"
              className="w-full bg-white dark:bg-slate-800 border-2 border-orange-300 dark:border-orange-700 rounded-xl py-4 pl-12 pr-4 text-3xl font-black text-orange-700 dark:text-orange-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
              min="0"
              step="5000"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="material-symbols-outlined text-orange-600 text-3xl">account_balance_wallet</span>
            </div>
          </div>
        </label>

        {/* Preview */}
        {value > 0 && (
          <div className="bg-gradient-to-r from-orange-100 to-purple-100 dark:from-orange-900/30 dark:to-purple-900/30 border border-orange-300 dark:border-orange-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                Ahorro de hoy:
              </span>
              <span className="font-black text-2xl text-orange-700 dark:text-orange-400">
                {formatCurrency(value)}
              </span>
            </div>
          </div>
        )}

        {/* Link to savings module */}
        <div className="pt-2">
          <button
            className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-bold flex items-center gap-1 transition-colors"
            onClick={() => {/* Navigate to savings module */}}
          >
            <span>Ver fondo de ahorro completo</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {/* Mini trend */}
        {last7DaysSavings.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2">Últimos 7 días:</p>
            <div className="flex items-end gap-1 h-12">
              {last7DaysSavings.map((amount, i) => {
                const maxAmount = Math.max(...last7DaysSavings, 1);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-orange-500 to-purple-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                    style={{ height: `${(amount / maxAmount) * 100}%`, minHeight: amount > 0 ? '4px' : '0' }}
                    title={formatCurrency(amount)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavingsInput;
