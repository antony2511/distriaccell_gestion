import React, { useState } from 'react';
import { formatCurrency } from '../../utils/currency';

interface QRPaymentsInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const QRPaymentsInput: React.FC<QRPaymentsInputProps> = ({ value, onChange, disabled }) => {
  const [showInfo, setShowInfo] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value) || 0;
    onChange(numValue);
  };

  return (
    <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border-2 border-orange-200 dark:border-orange-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-orange-100 dark:bg-orange-900/20 border-b-2 border-orange-200 dark:border-orange-800 flex items-center gap-2">
        <span className="material-symbols-outlined text-orange-600 text-2xl">qr_code_2</span>
        <h3 className="font-bold text-sm">🏦 Pagos por QR / Transferencia</h3>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Warning banner */}
        <div className="bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-orange-600 flex-shrink-0">info</span>
            <div>
              <p className="text-xs font-bold text-orange-800 dark:text-orange-200 mb-1">
                ⚠️ Este dinero fue directo a la cuenta bancaria, no a caja física
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                Los pagos por QR no se incluyen en el efectivo esperado en caja, ya que el dinero llegó directamente a la cuenta bancaria.
              </p>
            </div>
          </div>
        </div>

        {/* Input */}
        <label className="block">
          <span className="block text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest mb-2">
            Pagos recibidos por QR o transferencia bancaria
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
              step="1000"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="material-symbols-outlined text-orange-600 text-3xl">account_balance</span>
            </div>
          </div>
        </label>

        {/* Preview */}
        {value > 0 && (
          <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3">
            <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
              A cuenta bancaria: <span className="font-black text-lg ml-2">{formatCurrency(value)}</span>
            </p>
          </div>
        )}

        {/* Expandable info */}
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-full p-3 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg transition-colors flex items-center justify-between"
        >
          <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
            ¿Cómo funcionan los pagos por QR?
          </span>
          <span className={`material-symbols-outlined text-orange-600 transition-transform ${showInfo ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {showInfo && (
          <div className="bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <h4 className="font-bold text-sm text-orange-700 dark:text-orange-300">Explicación detallada:</h4>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-orange-600">•</span>
                <span>Estos montos se registran como <strong>ingresos</strong> en el total del día</span>
              </li>
              <li className="flex gap-2">
                <span className="text-orange-600">•</span>
                <span>
                  <strong>NO</strong> se suman al efectivo físico esperado en caja
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-orange-600">•</span>
                <span>El dinero llegó directamente a la cuenta bancaria de la empresa</span>
              </li>
              <li className="flex gap-2">
                <span className="text-orange-600">•</span>
                <span>Aparecen en el resumen con color naranja para distinguirlos</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRPaymentsInput;
