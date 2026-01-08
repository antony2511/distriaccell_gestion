import React, { useState } from 'react';
import { Sale, SaleCategory } from '../../types';
import { SALE_CATEGORIES } from '../../constants/categories';
import { formatCurrency } from '../../utils/currency';

interface NotebookSalesProps {
  sales: Sale[];
  onAddSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  onRemoveSale: (id: string) => void;
  disabled?: boolean;
}

interface TempSale {
  tempId: string;
  description: string;
  category: SaleCategory;
  quantity: number;
  unitPrice: number;
}

const NotebookSales: React.FC<NotebookSalesProps> = ({ sales, onAddSale, onRemoveSale, disabled }) => {
  const [isEnabled, setIsEnabled] = useState(sales.length > 0);
  const [tempSales, setTempSales] = useState<TempSale[]>([{
    tempId: Date.now().toString(),
    description: '',
    category: 'accesorios' as SaleCategory,
    quantity: 1,
    unitPrice: 0
  }]);

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
    if (isEnabled && sales.length > 0) {
      if (confirm('¿Deseas limpiar todas las ventas del cuaderno?')) {
        sales.forEach(sale => onRemoveSale(sale.id));
      }
    }
  };

  const addNewLine = () => {
    setTempSales([...tempSales, {
      tempId: Date.now().toString(),
      description: '',
      category: 'accesorios',
      quantity: 1,
      unitPrice: 0
    }]);
  };

  const removeLine = (tempId: string) => {
    if (tempSales.length === 1) return; // Mantener al menos una línea
    setTempSales(tempSales.filter(s => s.tempId !== tempId));
  };

  const updateLine = (tempId: string, field: keyof TempSale, value: any) => {
    setTempSales(tempSales.map(s =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    ));
  };

  const handleAddAll = () => {
    // Filtrar solo las líneas que tienen descripción y precio válido
    const validSales = tempSales.filter(s => s.description && s.unitPrice > 0);

    if (validSales.length === 0) {
      alert('⚠️ Agrega al menos un producto con descripción y precio válido');
      return;
    }

    // Agregar todas las ventas válidas
    validSales.forEach(sale => {
      onAddSale({
        description: sale.description,
        category: sale.category,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        subtotal: sale.quantity * sale.unitPrice
      });
    });

    // Resetear el formulario a una sola línea vacía
    setTempSales([{
      tempId: Date.now().toString(),
      description: '',
      category: 'accesorios',
      quantity: 1,
      unitPrice: 0
    }]);
  };

  const total = sales.reduce((acc, sale) => acc + sale.subtotal, 0);
  const tempTotal = tempSales.reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header with toggle */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600">edit_note</span>
          <h3 className="font-bold text-sm">📝 Ventas del Cuaderno</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 ${
            isEnabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'
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
          {/* Form - Multiple lines */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                📦 Productos a agregar
              </label>
              <button
                onClick={addNewLine}
                disabled={disabled}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nueva línea
              </button>
            </div>

            {/* Product lines */}
            <div className="space-y-2">
              {tempSales.map((sale, index) => (
                <div key={sale.tempId} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="md:col-span-5">
                    <input
                      type="text"
                      value={sale.description}
                      onChange={(e) => updateLine(sale.tempId, 'description', e.target.value)}
                      placeholder="Ej: Forro Samsung A52"
                      disabled={disabled}
                      className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                      maxLength={100}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <input
                      type="number"
                      value={sale.quantity}
                      onChange={(e) => updateLine(sale.tempId, 'quantity', parseInt(e.target.value) || 1)}
                      disabled={disabled}
                      className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 text-center font-bold focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                      min="1"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <input
                      type="number"
                      value={sale.unitPrice || ''}
                      onChange={(e) => updateLine(sale.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder="Precio"
                      disabled={disabled}
                      className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 text-right font-bold focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                      min="0"
                      step="1000"
                    />
                  </div>

                  <div className="md:col-span-1 text-right font-bold text-sm text-green-600 dark:text-green-400">
                    {formatCurrency(sale.quantity * sale.unitPrice)}
                  </div>

                  <div className="md:col-span-1 flex justify-end">
                    {tempSales.length > 1 && (
                      <button
                        onClick={() => removeLine(sale.tempId)}
                        disabled={disabled}
                        className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total preview and submit button */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-600">
              <div>
                <span className="text-xs text-slate-500">Total a agregar: </span>
                <span className="text-lg font-black text-green-600 dark:text-green-400">
                  {formatCurrency(tempTotal)}
                </span>
              </div>
              <button
                onClick={handleAddAll}
                disabled={disabled || tempSales.every(s => !s.description || s.unitPrice <= 0)}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">check_circle</span>
                Agregar Todo
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-xs">
                <tr>
                  <th className="px-5 py-3">Descripción</th>
                  <th className="px-5 py-3 text-center">Cant.</th>
                  <th className="px-5 py-3 text-right">P. Unit.</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {sales.map((sale) => (
                  <tr key={sale.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{sale.description}</td>
                    <td className="px-5 py-3 text-center font-bold text-slate-600 dark:text-slate-400">
                      {sale.quantity}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{formatCurrency(sale.unitPrice)}</td>
                    <td className="px-5 py-3 text-right font-black tabular-nums text-green-600">
                      {formatCurrency(sale.subtotal)}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => onRemoveSale(sale.id)}
                        disabled={disabled}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400 italic text-xs">
                      No hay ventas registradas. Agrega una venta usando el formulario arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with total */}
          <div className="p-5 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 flex justify-between items-center">
            <span className="text-sm font-bold text-green-700 dark:text-green-400">
              Total ventas del cuaderno:
            </span>
            <span className="text-2xl font-black text-green-600 dark:text-green-400 tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
        </>
      )}

      {/* Collapsed state */}
      {!isEnabled && (
        <div className="p-8 text-center text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-2 opacity-20">receipt_long</span>
          <p className="text-sm">Activa el switch para registrar ventas del cuaderno</p>
        </div>
      )}
    </div>
  );
};

export default NotebookSales;
