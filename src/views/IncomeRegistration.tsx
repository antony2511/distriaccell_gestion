
import React, { useState } from 'react';
import { Sale } from '../types';

const IncomeRegistration: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([
    { id: '1', description: 'Protector Pantalla iPhone 13', category: 'Accesorios', method: 'Efectivo', value: 25000 },
    { id: '2', description: 'Servicio Técnico - Cambio Display', category: 'Servicios', method: 'Nequi', value: 120000 },
    { id: '3', description: 'Cargador Tipo C Original', category: 'Accesorios', method: 'Efectivo', value: 45000 },
  ]);

  const [newSale, setNewSale] = useState({ description: '', category: 'Accesorios', method: 'Efectivo', value: '' });

  const handleAddSale = () => {
    if (!newSale.description || !newSale.value) return;
    const sale: Sale = {
      id: Date.now().toString(),
      description: newSale.description,
      category: newSale.category as any,
      method: newSale.method as any,
      value: parseFloat(newSale.value)
    };
    setSales([...sales, sale]);
    setNewSale({ description: '', category: 'Accesorios', method: 'Efectivo', value: '' });
  };

  const removeSale = (id: string) => {
    setSales(sales.filter(s => s.id !== id));
  };

  const totalNotebook = sales.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Registro de Ingresos</h2>
          <p className="text-sm text-slate-500">Gestión de caja y ventas del cuaderno para el cierre diario.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a2e] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <span className="material-symbols-outlined text-orange-600 !text-[20px]">calendar_today</span>
            <span className="text-xs font-bold">24 Oct, 2023</span>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a2e] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <span className="material-symbols-outlined text-orange-600 !text-[20px]">store</span>
            <span className="text-xs font-bold">Sucursal Centro</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">point_of_sale</span>
              <h3 className="font-bold text-sm">Ventas del Sistema (POS)</h3>
            </div>
            <div className="p-5 space-y-5">
              <label className="block">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Reporte Z</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-7 text-lg font-black focus:ring-orange-500 transition-all"
                  />
                </div>
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-orange-600 transition-colors text-3xl mb-2">cloud_upload</span>
                <p className="text-xs font-bold text-orange-600">Adjuntar Cierre (Foto)</p>
                <p className="text-[10px] text-slate-500 mt-1">PNG, JPG hasta 5MB</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl flex gap-3">
            <span className="material-symbols-outlined text-orange-600">warning</span>
            <div>
              <p className="text-xs font-bold text-orange-800 dark:text-orange-200">Verificación Pendiente</p>
              <p className="text-[10px] text-orange-700 dark:text-orange-400 mt-1 leading-relaxed">
                Recuerde que la suma del sistema y el cuaderno debe coincidir con el efectivo físico.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">edit_note</span>
              <h3 className="font-bold text-sm">Ventas del Cuaderno</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Hoy: {sales.length} transacciones</span>
          </div>

          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                <input 
                  type="text" 
                  value={newSale.description}
                  onChange={(e) => setNewSale({ ...newSale, description: e.target.value })}
                  placeholder="Ej. Protector Pantalla" 
                  className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Método</label>
                <select 
                  value={newSale.method}
                  onChange={(e) => setNewSale({ ...newSale, method: e.target.value })}
                  className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option>Efectivo</option>
                  <option>Nequi</option>
                  <option>Banco</option>
                  <option>QR</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor</label>
                <input 
                  type="number" 
                  value={newSale.value}
                  onChange={(e) => setNewSale({ ...newSale, value: e.target.value })}
                  placeholder="0.00" 
                  className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-right"
                />
              </div>
              <div className="md:col-span-1">
                <button 
                  onClick={handleAddSale}
                  className="w-full h-10 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3">Descripción</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sales.map((sale) => (
                  <tr key={sale.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{sale.description}</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {sale.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-black tabular-nums">${sale.value.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <button 
                        onClick={() => removeSale(sale.id)}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <span className="material-symbols-outlined !text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 italic text-xs">
                      No hay registros para hoy. Agregue una venta rápida arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-auto p-5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500">Subtotal Cuaderno:</span>
            <span className="text-2xl font-black text-orange-600 tabular-nums">${totalNotebook.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeRegistration;
