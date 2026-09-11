import React, { useState } from 'react';
import { CreditSale, CreditDownPaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { calcCreditSale, CREDIT_SURCHARGE_RATE, CREDIT_STORE_SHARE_RATE } from '../../utils/calculations';

interface CreditSalesInputProps {
  creditSales: CreditSale[];
  onAddCreditSale: (sale: Omit<CreditSale, 'id' | 'timestamp'>) => void;
  onRemoveCreditSale: (id: string) => void;
  disabled?: boolean;
}

interface TempCreditSale {
  tempId: string;
  purchasePrice: number;
  productValue: number;
  downPayment: number;
  downPaymentMethod: CreditDownPaymentMethod;
  deviceModel: string;
}

const emptyLine = (): TempCreditSale => ({
  tempId: Date.now().toString() + Math.random().toString(36).slice(2, 6),
  purchasePrice: 0,
  productValue: 0,
  downPayment: 0,
  downPaymentMethod: 'efectivo',
  deviceModel: '',
});

const PCT = (r: number) => `${(r * 100).toFixed(0)}%`;

const CreditSalesInput: React.FC<CreditSalesInputProps> = ({
  creditSales,
  onAddCreditSale,
  onRemoveCreditSale,
  disabled,
}) => {
  const [isEnabled, setIsEnabled] = useState(creditSales.length > 0);
  const [tempSales, setTempSales] = useState<TempCreditSale[]>([emptyLine()]);

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
    if (isEnabled && creditSales.length > 0) {
      if (confirm('¿Deseas limpiar todas las ventas a crédito?')) {
        creditSales.forEach((s) => onRemoveCreditSale(s.id));
      }
    }
  };

  const addNewLine = () => setTempSales([...tempSales, emptyLine()]);

  const removeLine = (tempId: string) => {
    if (tempSales.length === 1) return;
    setTempSales(tempSales.filter((s) => s.tempId !== tempId));
  };

  const updateLine = (
    tempId: string,
    field: keyof TempCreditSale,
    value: string | number | CreditDownPaymentMethod
  ) => {
    setTempSales(tempSales.map((s) => (s.tempId === tempId ? { ...s, [field]: value } : s)));
  };

  const handleAddAll = () => {
    const valid = tempSales.filter((s) => s.productValue > 0);
    if (valid.length === 0) {
      alert('⚠️ Agrega al menos una venta con precio de venta válido');
      return;
    }
    valid.forEach((s) => {
      onAddCreditSale({
        purchasePrice: s.purchasePrice || 0,
        productValue: s.productValue,
        downPayment: Math.min(Math.max(s.downPayment || 0, 0), s.productValue),
        downPaymentMethod: s.downPaymentMethod,
        deviceModel: s.deviceModel || undefined,
      });
    });
    setTempSales([emptyLine()]);
  };

  const registeredSoldTotal = creditSales.reduce((acc, s) => acc + calcCreditSale(s).soldValue, 0);
  const registeredDownTotal = creditSales.reduce((acc, s) => acc + calcCreditSale(s).downPayment, 0);
  const registeredFinancedTotal = creditSales.reduce((acc, s) => acc + calcCreditSale(s).financedValue, 0);
  const registeredProfitTotal = creditSales.reduce((acc, s) => acc + calcCreditSale(s).profit, 0);
  const tempSoldTotal = tempSales.reduce((acc, s) => acc + calcCreditSale(s).soldValue, 0);

  return (
    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-indigo-100 dark:bg-indigo-900/20 border-b-2 border-indigo-200 dark:border-indigo-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600 text-2xl">credit_card</span>
          <h3 className="font-bold text-sm">💳 Crédito celulares/tablet</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
            isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {isEnabled && (
        <>
          {/* Info banner */}
          <div className="p-4 border-b border-indigo-100 dark:border-indigo-800">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-4">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-indigo-600 flex-shrink-0">info</span>
                <div>
                  <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200 mb-1">
                    ⚠️ El precio de venta COMPLETO va en "Ventas del sistema"
                  </p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    Aquí registra el detalle y <strong>cómo pagó el abono</strong>. Según eso se
                    descuenta del efectivo esperado: abono en <strong>efectivo</strong> → solo lo
                    financiado; abono por <strong>QR/transferencia</strong> → el precio completo (nada
                    llegó a caja). El abono <strong>no</strong> se registra además en el bloque QR.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-5 border-b border-indigo-100 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/20 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">
                📱 Ventas a agregar
              </label>
              <button
                onClick={addNewLine}
                disabled={disabled}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nueva línea
              </button>
            </div>

            <div className="space-y-3">
              {tempSales.map((sale) => {
                const b = calcCreditSale(sale);
                return (
                  <div
                    key={sale.tempId}
                    className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-indigo-200 dark:border-indigo-600 space-y-3"
                  >
                    {/* Fila 1: Equipo + eliminar línea */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Equipo <span className="text-slate-400 normal-case">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={sale.deviceModel}
                          onChange={(e) => updateLine(sale.tempId, 'deviceModel', e.target.value)}
                          placeholder="Ej: Samsung A15 128GB"
                          disabled={disabled}
                          className="w-full h-10 px-3 text-sm rounded-lg border-indigo-200 dark:border-indigo-500 dark:bg-slate-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          maxLength={60}
                        />
                      </div>
                      <button
                        onClick={() => removeLine(sale.tempId)}
                        disabled={disabled || tempSales.length === 1}
                        className="h-10 w-10 flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        title="Eliminar línea"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>

                    {/* Fila 2: montos */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Precio de compra */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Precio compra
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                          <input
                            type="number"
                            value={sale.purchasePrice || ''}
                            onChange={(e) =>
                              updateLine(sale.tempId, 'purchasePrice', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            disabled={disabled}
                            className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border-indigo-200 dark:border-indigo-500 dark:bg-slate-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                            step="1000"
                          />
                        </div>
                      </div>

                      {/* Precio de venta */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Precio venta
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 font-bold">$</span>
                          <input
                            type="number"
                            value={sale.productValue || ''}
                            onChange={(e) =>
                              updateLine(sale.tempId, 'productValue', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            disabled={disabled}
                            className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border-indigo-300 dark:border-indigo-500 dark:bg-slate-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold"
                            min="0"
                            step="1000"
                          />
                        </div>
                      </div>

                      {/* Abono del cliente */}
                      <div>
                        <label className="block text-[10px] font-bold text-green-600 dark:text-green-500 uppercase tracking-wide mb-1">
                          Abono
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">$</span>
                          <input
                            type="number"
                            value={sale.downPayment || ''}
                            onChange={(e) =>
                              updateLine(sale.tempId, 'downPayment', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            disabled={disabled}
                            className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border-green-300 dark:border-green-600 dark:bg-slate-600 focus:ring-2 focus:ring-green-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                            step="1000"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 leading-tight">
                          {sale.downPayment > 0 ? (
                            <button
                              type="button"
                              onClick={() => updateLine(sale.tempId, 'downPayment', 0)}
                              disabled={disabled}
                              className="text-indigo-500 hover:underline font-medium"
                            >
                              Poner en 0 (todo financiado)
                            </button>
                          ) : (
                            '0 = todo financiado'
                          )}
                        </p>
                      </div>

                      {/* Método del abono */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Abono pagado con
                        </label>
                        <select
                          value={sale.downPaymentMethod}
                          onChange={(e) =>
                            updateLine(sale.tempId, 'downPaymentMethod', e.target.value as CreditDownPaymentMethod)
                          }
                          disabled={disabled || sale.downPayment <= 0}
                          className="w-full h-10 px-2 text-sm rounded-lg border-indigo-200 dark:border-indigo-500 dark:bg-slate-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-medium"
                        >
                          <option value="efectivo">Efectivo (queda en caja)</option>
                          <option value="transferencia">QR / Transferencia (a banco)</option>
                        </select>
                        <p className="mt-1 text-[10px] text-slate-400 leading-tight">
                          {sale.downPayment <= 0
                            ? 'Sin abono'
                            : sale.downPaymentMethod === 'efectivo'
                            ? 'El abono suma al arqueo'
                            : 'No lo registres también en QR'}
                        </p>
                      </div>
                    </div>

                    {/* Cálculo automático de la línea */}
                    {sale.productValue > 0 && (() => {
                      const cashIn = b.downPaymentInCash ? b.downPayment : 0;   // lo que realmente queda en caja
                      const toBank = b.downPaymentInCash ? 0 : b.downPayment;   // abono que fue al banco
                      const pctCash = b.soldValue > 0 ? (cashIn / b.soldValue) * 100 : 0;
                      const isTodoFinanciado = b.downPayment === 0;
                      return (
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg px-3 py-2.5 border border-indigo-200 dark:border-indigo-700 space-y-2">
                          {/* Barra: efectivo en caja vs lo que no llegó a caja */}
                          <div className="flex h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-600">
                            <div className="bg-emerald-500" style={{ width: `${pctCash}%` }} />
                            <div className="bg-indigo-500" style={{ width: `${100 - pctCash}%` }} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              💵 Queda en caja: {formatCurrency(cashIn)}
                            </span>
                            {toBank > 0 && (
                              <span className="text-sky-700 dark:text-sky-400 font-semibold">
                                🏦 Abono a banco: {formatCurrency(toBank)}
                              </span>
                            )}
                            <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                              📄 Financiado: {formatCurrency(b.financedValue)}
                            </span>
                            {isTodoFinanciado && <span className="text-slate-400">(100% financiado)</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Se descuenta del efectivo esperado:{' '}
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(b.notInCash)}</span>
                            {b.downPaymentInCash
                              ? ' (solo lo financiado — el abono queda en caja)'
                              : ' (precio completo — nada llegó a caja)'}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-indigo-200/60 dark:border-indigo-700/60 pt-1.5">
                            <span>
                              Valor vendido (+{PCT(CREDIT_SURCHARGE_RATE)}):{' '}
                              <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(b.soldValue)}</span>
                            </span>
                            <span>
                              Margen: <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(b.margin)}</span>
                            </span>
                            <span>
                              + Financiación ({PCT(CREDIT_STORE_SHARE_RATE)}):{' '}
                              <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(b.storeShare)}</span>
                            </span>
                            <span>
                              = Ganancia:{' '}
                              <span className="font-black text-green-600 dark:text-green-400">{formatCurrency(b.profit)}</span>
                            </span>
                          </div>
                          {sale.downPayment > b.productValue && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              ⚠ El abono no puede superar el precio de venta ({formatCurrency(b.productValue)}); se registrará ese máximo.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {tempSoldTotal > 0 && (
              <div className="bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 rounded-lg p-3">
                <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                  Valor vendido a agregar:{' '}
                  <span className="font-black text-lg ml-2">{formatCurrency(tempSoldTotal)}</span>
                </p>
              </div>
            )}

            <button
              onClick={handleAddAll}
              disabled={disabled || tempSales.every((s) => s.productValue <= 0)}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Agregar ventas a crédito
            </button>
          </div>

          {/* Lista de ventas registradas */}
          {creditSales.length > 0 && (
            <div className="p-5 bg-white dark:bg-slate-800 space-y-3">
              <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">
                📋 Ventas a crédito registradas ({creditSales.length})
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {creditSales.map((sale) => {
                  const b = calcCreditSale(sale);
                  return (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {sale.deviceModel || 'Equipo a crédito'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Venta {formatCurrency(b.productValue)} · Vendido {formatCurrency(b.soldValue)}
                          {b.downPayment > 0 && (
                            <> · Abono {formatCurrency(b.downPayment)} ({b.downPaymentInCash ? 'efectivo' : 'QR/transf'})</>
                          )} · Financiado {formatCurrency(b.financedValue)}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Ganancia {formatCurrency(b.profit)}{' '}
                          <span className="text-slate-400 font-normal">
                            (margen {formatCurrency(b.margin)} + financiación {formatCurrency(b.storeShare)})
                          </span>
                        </p>
                      </div>
                      {!disabled && (
                        <button
                          onClick={() => onRemoveCreditSale(sale.id)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Valor vendido:</span>
                  <span className="text-2xl font-black">{formatCurrency(registeredSoldTotal)}</span>
                </div>
                {registeredDownTotal > 0 && (
                  <div className="flex items-center justify-between text-indigo-100">
                    <span className="text-xs font-bold">Abonos:</span>
                    <span className="text-sm font-black">{formatCurrency(registeredDownTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-indigo-100">
                  <span className="text-xs font-bold">Financiado:</span>
                  <span className="text-sm font-black">{formatCurrency(registeredFinancedTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-indigo-100">
                  <span className="text-xs font-bold">Ganancia total:</span>
                  <span className="text-sm font-black">{formatCurrency(registeredProfitTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CreditSalesInput;
