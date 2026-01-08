import React, { useState } from 'react';
import { formatCurrency } from '../../utils/currency';
import { calculateDifferencePercentage } from '../../utils/calculations';

interface AutomaticBalanceProps {
  // Ingresos
  systemSales: number;
  notebookSalesTotal: number;
  servicesTotal: number;
  qrPayments: number;

  // Gastos
  expensesTotal: number;
  dailySavings: number;

  // Cálculos
  grossIncome: number;
  cashReceived: number;
  totalOutflows: number;
  expectedCash: number;

  // Estado
  actualCash: number;
  onActualCashChange: (value: number) => void;
  difference: number;
  justification: string;
  onJustificationChange: (value: string) => void;

  // Actions
  onSave?: () => void;
  onCloseDay: () => void;
  isClosed: boolean;
  isLoading: boolean;
  isSaving?: boolean;
}

const AutomaticBalance: React.FC<AutomaticBalanceProps> = ({
  systemSales,
  notebookSalesTotal,
  servicesTotal,
  qrPayments,
  expensesTotal,
  dailySavings,
  grossIncome,
  cashReceived,
  totalOutflows,
  expectedCash,
  actualCash,
  onActualCashChange,
  difference,
  justification,
  onJustificationChange,
  onSave,
  onCloseDay,
  isClosed,
  isLoading,
  isSaving = false
}) => {
  const [showDetails, setShowDetails] = useState(true);

  const differencePercentage = calculateDifferencePercentage(Math.abs(difference), expectedCash);
  const requiresJustification = differencePercentage > 5;
  const requiresConfirmation = differencePercentage > 10;

  const getDifferenceColor = () => {
    if (difference === 0) return 'text-orange-600 dark:text-orange-400';
    if (difference > 0) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getDifferenceIcon = () => {
    if (difference === 0) return '🟠';
    if (difference > 0) return '🟢';
    return '🔴';
  };

  const getDifferenceLabel = () => {
    if (difference === 0) return 'Cuadra perfecto';
    if (difference > 0) return `Sobran: ${formatCurrency(difference)}`;
    return `Faltan: ${formatCurrency(Math.abs(difference))}`;
  };

  const canClose = actualCash > 0 && (!requiresJustification || justification.length > 10);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-600 shadow-xl overflow-hidden sticky top-4">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b-2 border-slate-300 dark:border-slate-600 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-2xl">
            account_balance_wallet
          </span>
          <h2 className="font-black text-lg">BALANCE DEL DÍA - EN TIEMPO REAL</h2>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <span className={`material-symbols-outlined transition-transform ${showDetails ? '' : 'rotate-180'}`}>
            expand_less
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {showDetails && (
          <>
            {/* Ingresos section */}
            <div>
              <h3 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                INGRESOS
              </h3>
              <div className="space-y-2 pl-4 border-l-4 border-green-500">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sistema + Cuaderno + Servicios</span>
                  <span className="font-black text-green-600 dark:text-green-400">{formatCurrency(cashReceived)} ✓</span>
                </div>
                {systemSales > 0 && (
                  <div className="flex justify-between items-center text-xs pl-4">
                    <span className="text-slate-500">• Ventas del sistema</span>
                    <span className="font-mono">{formatCurrency(systemSales)}</span>
                  </div>
                )}
                {notebookSalesTotal > 0 && (
                  <div className="flex justify-between items-center text-xs pl-4">
                    <span className="text-slate-500">• Ventas del cuaderno</span>
                    <span className="font-mono">{formatCurrency(notebookSalesTotal)}</span>
                  </div>
                )}
                {servicesTotal > 0 && (
                  <div className="flex justify-between items-center text-xs pl-4">
                    <span className="text-slate-500">• Servicios técnicos</span>
                    <span className="font-mono">{formatCurrency(servicesTotal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Salidas section */}
            <div>
              <h3 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                SALIDAS
              </h3>
              <div className="space-y-2 pl-4 border-l-4 border-red-500">
                {expensesTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Gastos operativos</span>
                    <span className="font-black text-red-600 dark:text-red-400">-{formatCurrency(expensesTotal)}</span>
                  </div>
                )}
                {dailySavings > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Ahorro del día</span>
                    <span className="font-black text-orange-600 dark:text-orange-400">-{formatCurrency(dailySavings)}</span>
                  </div>
                )}
                {qrPayments > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Pagos por QR (directo a banco)</span>
                    <span className="font-black text-blue-600 dark:text-blue-400">-{formatCurrency(qrPayments)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total salidas</span>
                  <span className="font-black text-red-600">-{formatCurrency(totalOutflows)}</span>
                </div>
              </div>
            </div>

            <div className="border-t-4 border-double border-slate-300 dark:border-slate-600 my-4"></div>
          </>
        )}

        {/* Expected cash */}
        <div className="bg-gradient-to-r from-orange-50 to-purple-50 dark:from-orange-900/20 dark:to-purple-900/20 rounded-xl p-4 border-2 border-orange-200 dark:border-orange-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-orange-900 dark:text-orange-100">EFECTIVO ESPERADO EN CAJA</span>
            <span className="text-3xl font-black text-orange-600 dark:text-orange-400 tabular-nums">
              {formatCurrency(expectedCash)}
            </span>
          </div>
        </div>

        {/* Actual cash input */}
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-5">
          <label className="block">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">💵</span>
              <span className="text-sm font-bold text-yellow-900 dark:text-yellow-100">
                Efectivo real contado en caja
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-600 font-bold text-2xl">$</span>
              <input
                type="number"
                value={actualCash || ''}
                onChange={(e) => onActualCashChange(parseFloat(e.target.value) || 0)}
                disabled={isClosed}
                placeholder="Contar físicamente al cierre"
                className="w-full bg-white dark:bg-slate-800 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl py-4 pl-12 pr-4 text-3xl font-black text-yellow-700 dark:text-yellow-400 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all disabled:opacity-50"
                min="0"
              />
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 italic">
              (Contar físicamente al cierre del día)
            </p>
          </label>
        </div>

        {/* Difference */}
        {actualCash > 0 && (
          <div className={`rounded-xl p-5 border-2 ${
            difference === 0
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
              : difference > 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
          }`}>
            <h3 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
              DIFERENCIA
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{getDifferenceIcon()} {getDifferenceLabel()}</span>
              <span className={`text-3xl font-black ${getDifferenceColor()}`}>
                {difference !== 0 && (difference > 0 ? '+' : '')}{formatCurrency(Math.abs(difference))}
              </span>
            </div>
            {differencePercentage > 0 && (
              <p className="text-xs mt-2 text-slate-600 dark:text-slate-400">
                Diferencia del {differencePercentage.toFixed(2)}% respecto al esperado
              </p>
            )}
          </div>
        )}

        {/* Justification */}
        {requiresJustification && actualCash > 0 && !isClosed && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4">
            <label className="block">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-600">warning</span>
                <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  Justificación {requiresConfirmation && '(OBLIGATORIA - diferencia mayor al 10%)'}
                </span>
              </div>
              <textarea
                value={justification}
                onChange={(e) => onJustificationChange(e.target.value)}
                placeholder="Explica la razón de la diferencia..."
                className="w-full bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 min-h-[80px]"
                required={requiresJustification}
              />
            </label>
          </div>
        )}

        {/* Save button */}
        {!isClosed && onSave && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="w-full h-14 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                💾 GUARDAR REGISTRO
              </>
            )}
          </button>
        )}

        {/* Close day button */}
        {!isClosed && (
          <button
            onClick={onCloseDay}
            disabled={!canClose || isLoading}
            className={`w-full h-14 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all ${
              canClose
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Cerrando día...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">lock</span>
                🔒 CERRAR DÍA (no se puede modificar)
              </>
            )}
          </button>
        )}

        {/* Closed status */}
        {isClosed && (
          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-5 text-center">
            <span className="material-symbols-outlined text-green-600 text-5xl mb-2">check_circle</span>
            <p className="text-lg font-black text-green-700 dark:text-green-300">Día Cerrado Correctamente</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Este día ya no puede modificarse
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomaticBalance;
