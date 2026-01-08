import React from 'react';
import { formatCurrency } from '../../utils/currency';

interface SystemSalesInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const SystemSalesInput: React.FC<SystemSalesInputProps> = ({ value, onChange, disabled }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value) || 0;
    onChange(numValue);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-2">
        <span className="material-symbols-outlined text-orange-600">point_of_sale</span>
        <h3 className="font-bold text-sm">💳 Ventas del Sistema (POS)</h3>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <label className="block">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Total de ventas registradas en el sistema POS
          </span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
            <input
              type="number"
              value={value || ''}
              onChange={handleChange}
              disabled={disabled}
              placeholder="0"
              className="w-full bg-green-50 dark:bg-green-900/10 border-2 border-green-200 dark:border-green-800 rounded-xl py-4 pl-10 pr-4 text-3xl font-black text-green-700 dark:text-green-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all placeholder:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
              min="0"
              step="1000"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="material-symbols-outlined text-green-600 text-3xl">calculate</span>
            </div>
          </div>
        </label>

        {/* Preview formatted */}
        {value > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">
              Formato: <span className="font-black text-lg ml-2">{formatCurrency(value)}</span>
            </p>
          </div>
        )}

        {/* Info card */}
        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl flex gap-3">
          <span className="material-symbols-outlined text-orange-600 flex-shrink-0">info</span>
          <div>
            <p className="text-xs font-bold text-orange-800 dark:text-orange-200">Importante</p>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1 leading-relaxed">
              Este valor se suma directamente al total de ingresos del día.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSalesInput;
