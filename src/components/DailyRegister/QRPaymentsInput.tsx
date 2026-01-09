import React, { useState } from 'react';
import { QRPayment } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface QRPaymentsInputProps {
  payments: QRPayment[];
  onAddPayment: (payment: Omit<QRPayment, 'id' | 'timestamp'>) => void;
  onRemovePayment: (id: string) => void;
  disabled?: boolean;
}

type PaymentMethod = 'QR' | 'TRANSFERENCIA' | 'TARJETA';

interface TempPayment {
  tempId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  customerName: string;
}

const QRPaymentsInput: React.FC<QRPaymentsInputProps> = ({ payments, onAddPayment, onRemovePayment, disabled }) => {
  const [isEnabled, setIsEnabled] = useState(payments.length > 0);
  const [showInfo, setShowInfo] = useState(false);
  const [tempPayments, setTempPayments] = useState<TempPayment[]>([{
    tempId: Date.now().toString(),
    paymentMethod: 'QR' as PaymentMethod,
    amount: 0,
    customerName: ''
  }]);

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
    if (isEnabled && payments.length > 0) {
      if (confirm('¿Deseas limpiar todos los pagos por QR/Transferencia?')) {
        payments.forEach(payment => onRemovePayment(payment.id));
      }
    }
  };

  const addNewLine = () => {
    setTempPayments([...tempPayments, {
      tempId: Date.now().toString(),
      paymentMethod: 'QR' as PaymentMethod,
      amount: 0,
      customerName: ''
    }]);
  };

  const removeLine = (tempId: string) => {
    if (tempPayments.length === 1) return; // Mantener al menos una línea
    setTempPayments(tempPayments.filter(p => p.tempId !== tempId));
  };

  const updateLine = (tempId: string, field: keyof TempPayment, value: any) => {
    setTempPayments(tempPayments.map(p =>
      p.tempId === tempId ? { ...p, [field]: value } : p
    ));
  };

  const handleAddAll = () => {
    // Filtrar solo las líneas que tienen monto válido
    const validPayments = tempPayments.filter(p => p.amount > 0);

    if (validPayments.length === 0) {
      alert('⚠️ Agrega al menos un pago con monto válido');
      return;
    }

    // Agregar todos los pagos válidos
    validPayments.forEach(payment => {
      onAddPayment({
        description: payment.paymentMethod,
        amount: payment.amount,
        customerName: payment.customerName || undefined
      });
    });

    // Resetear el formulario a una sola línea vacía
    setTempPayments([{
      tempId: Date.now().toString(),
      paymentMethod: 'QR' as PaymentMethod,
      amount: 0,
      customerName: ''
    }]);
  };

  const total = payments.reduce((acc, payment) => acc + payment.amount, 0);
  const tempTotal = tempPayments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border-2 border-orange-200 dark:border-orange-800 shadow-sm overflow-hidden">
      {/* Header with toggle */}
      <div className="p-4 bg-orange-100 dark:bg-orange-900/20 border-b-2 border-orange-200 dark:border-orange-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-600 text-2xl">qr_code_2</span>
          <h3 className="font-bold text-sm">🏦 Pagos por QR / Transferencia</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 ${
            isEnabled ? 'bg-orange-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Content */}
      {isEnabled && (
        <>
          {/* Warning banner */}
          <div className="p-4 border-b border-orange-100 dark:border-orange-800">
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
          </div>

          {/* Form - Multiple lines */}
          <div className="p-5 border-b border-orange-100 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/20 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">
                💳 Pagos a agregar
              </label>
              <button
                onClick={addNewLine}
                disabled={disabled}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nueva línea
              </button>
            </div>

            {/* Payment lines */}
            <div className="space-y-2">
              {tempPayments.map((payment, index) => (
                <div key={payment.tempId} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-700 p-3 rounded-lg border border-orange-200 dark:border-orange-600">
                  {/* Método de pago */}
                  <div className="md:col-span-5">
                    <select
                      value={payment.paymentMethod}
                      onChange={(e) => updateLine(payment.tempId, 'paymentMethod', e.target.value as PaymentMethod)}
                      disabled={disabled}
                      className="w-full h-10 text-sm rounded-lg border-orange-200 dark:border-orange-500 dark:bg-slate-600 focus:ring-2 focus:ring-orange-500 disabled:opacity-50 font-semibold"
                    >
                      <option value="QR">QR</option>
                      <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                      <option value="TARJETA">TARJETA</option>
                    </select>
                  </div>

                  {/* Monto */}
                  <div className="md:col-span-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600 font-bold">$</span>
                      <input
                        type="number"
                        value={payment.amount || ''}
                        onChange={(e) => updateLine(payment.tempId, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        disabled={disabled}
                        className="w-full h-10 pl-8 pr-3 text-sm rounded-lg border-orange-200 dark:border-orange-500 dark:bg-slate-600 focus:ring-2 focus:ring-orange-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0"
                        step="1000"
                      />
                    </div>
                  </div>

                  {/* Cliente (opcional) */}
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={payment.customerName}
                      onChange={(e) => updateLine(payment.tempId, 'customerName', e.target.value)}
                      placeholder="Cliente (opcional)"
                      disabled={disabled}
                      className="w-full h-10 text-sm rounded-lg border-orange-200 dark:border-orange-500 dark:bg-slate-600 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                      maxLength={50}
                    />
                  </div>

                  {/* Botón eliminar */}
                  <div className="md:col-span-1 flex justify-center">
                    <button
                      onClick={() => removeLine(payment.tempId)}
                      disabled={disabled || tempPayments.length === 1}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Eliminar línea"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Temp total preview */}
            {tempTotal > 0 && (
              <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3">
                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                  Total a agregar: <span className="font-black text-lg ml-2">{formatCurrency(tempTotal)}</span>
                </p>
              </div>
            )}

            {/* Add button */}
            <button
              onClick={handleAddAll}
              disabled={disabled || tempPayments.every(p => p.amount <= 0)}
              className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Agregar pagos
            </button>
          </div>

          {/* Lista de pagos agregados */}
          {payments.length > 0 && (
            <div className="p-5 bg-white dark:bg-slate-800 space-y-3">
              <h4 className="text-xs font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest mb-3">
                📋 Pagos registrados ({payments.length})
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {payment.description}
                      </p>
                      {payment.customerName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          Cliente: {payment.customerName}
                        </p>
                      )}
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                    {!disabled && (
                      <button
                        onClick={() => onRemovePayment(payment.id)}
                        className="ml-3 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Total registrado */}
              <div className="bg-orange-600 text-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Total a cuenta bancaria:</span>
                  <span className="text-2xl font-black">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Expandable info */}
          <div className="p-4">
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
              <div className="mt-3 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
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
        </>
      )}
    </div>
  );
};

export default QRPaymentsInput;
