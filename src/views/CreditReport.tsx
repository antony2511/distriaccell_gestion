import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditSale, DailyRegister, StoreId } from '../types';
import { getDailyRegistersByRange } from '../services/dailyRegister.service';
import { getTodayId, formatDateShort } from '../utils/dates';
import { formatCurrency } from '../utils/currency';
import {
  calcCreditSale,
  CREDIT_SURCHARGE_RATE,
  CREDIT_STORE_SHARE_RATE,
  CREDIT_FINANCIER_SHARE_RATE,
} from '../utils/calculations';

type CreditRow = {
  date: string;
  storeId: StoreId;
  sale: CreditSale;
};

const PCT = (r: number) => `${(r * 100).toFixed(0)}%`;

const monthStart = () => `${getTodayId().slice(0, 8)}01`;

const CreditReport: React.FC = () => {
  const { hasPermission } = useAuth();

  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-slate-600 dark:text-slate-400">
            No tienes permisos para ver el reporte de crédito.
          </p>
        </div>
      </div>
    );
  }

  return <CreditReportContent />;
};

const CreditReportContent: React.FC = () => {
  const { activeStores, getStoreName } = useAuth();
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(getTodayId());
  const [storeFilter, setStoreFilter] = useState<StoreId | 'ambos'>('ambos');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [queried, setQueried] = useState(false);

  const loadData = async () => {
    if (!startDate || !endDate) {
      alert('Selecciona un rango de fechas válido');
      return;
    }
    setLoading(true);
    try {
      let registers: DailyRegister[] = [];
      if (storeFilter === 'ambos') {
        const results = await Promise.all(
          activeStores.map((s) => getDailyRegistersByRange(startDate, endDate, s.id))
        );
        registers = results.flat();
      } else {
        registers = await getDailyRegistersByRange(startDate, endDate, storeFilter);
      }

      const flat: CreditRow[] = [];
      registers.forEach((r) => {
        (r.creditSales || []).forEach((sale) => {
          flat.push({ date: r.date, storeId: r.storeId, sale });
        });
      });
      flat.sort((a, b) => b.date.localeCompare(a.date) || a.storeId.localeCompare(b.storeId));
      setRows(flat);
      setQueried(true);
    } catch (error) {
      console.error('Error al cargar reporte de crédito:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce(
    (acc, { sale }) => {
      const b = calcCreditSale(sale);
      acc.count += 1;
      acc.purchase += b.purchasePrice;
      acc.product += b.productValue;
      acc.sold += b.soldValue;
      acc.margin += b.margin;
      acc.storeShare += b.storeShare;
      acc.financierShare += b.financierShare;
      acc.profit += b.profit;
      return acc;
    },
    { count: 0, purchase: 0, product: 0, sold: 0, margin: 0, storeShare: 0, financierShare: 0, profit: 0 }
  );

  const exportCsv = () => {
    const header = [
      'Fecha',
      'Tienda',
      'Equipo',
      'Cliente',
      'Precio compra',
      'Precio venta',
      `Recargo ${PCT(CREDIT_SURCHARGE_RATE)}`,
      'Valor vendido/financiado',
      'Margen',
      `Tienda ${PCT(CREDIT_STORE_SHARE_RATE)}`,
      `Financiera ${PCT(CREDIT_FINANCIER_SHARE_RATE)}`,
      'Ganancia',
    ];
    const lines = rows.map(({ date, storeId, sale }) => {
      const b = calcCreditSale(sale);
      return [
        date,
        getStoreName(storeId),
        (sale.deviceModel || '').replace(/;/g, ','),
        (sale.customerName || '').replace(/;/g, ','),
        b.purchasePrice,
        b.productValue,
        Math.round(b.surcharge),
        Math.round(b.soldValue),
        b.margin,
        Math.round(b.storeShare),
        Math.round(b.financierShare),
        Math.round(b.profit),
      ].join(';');
    });
    const csv = [header.join(';'), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credito_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summaryCards = [
    { label: 'Monto vendido / financiado', value: totals.sold, color: 'text-indigo-600', hint: `${totals.count} ventas` },
    { label: 'Ganancia', value: totals.profit, color: 'text-green-600', hint: `margen + ${PCT(CREDIT_STORE_SHARE_RATE)}` },
    { label: 'Margen del producto', value: totals.margin, color: 'text-blue-600', hint: 'venta − compra' },
    { label: `Retiene la financiera (${PCT(CREDIT_FINANCIER_SHARE_RATE)})`, value: totals.financierShare, color: 'text-slate-500', hint: 'no es nuestro' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-black mb-1">💳 Reporte de Crédito Celulares/Tablet</h2>
        <p className="text-indigo-100 text-sm">
          Monto financiado, monto vendido y ganancias de las ventas a crédito por rango de fechas.
        </p>
      </div>

      {/* Controles */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tienda</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStoreFilter('ambos')}
                className={`px-3 py-2 rounded-lg font-bold text-xs transition-all ${
                  storeFilter === 'ambos'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Todas
              </button>
              {activeStores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => setStoreFilter(store.id)}
                  className={`px-3 py-2 rounded-lg font-bold text-xs transition-all ${
                    storeFilter === store.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {store.name}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? 'Cargando...' : 'Consultar'}
          </button>
        </div>
      </div>

      {queried && (
        <>
          {/* Cards de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((c) => (
              <div
                key={c.label}
                className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
              >
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">{c.label}</p>
                <p className={`text-2xl font-black ${c.color}`}>{formatCurrency(c.value)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{c.hint}</p>
              </div>
            ))}
          </div>

          {/* Tabla */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Detalle ({totals.count})
              </h3>
              {rows.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined !text-[18px]">download</span>
                  Exportar CSV
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl mb-3">
                  inbox
                </span>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  No hay ventas a crédito en el rango seleccionado
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700 text-[10px] uppercase text-slate-500">
                      <th className="text-left py-3 px-3 font-bold">Fecha</th>
                      <th className="text-left py-3 px-3 font-bold">Tienda</th>
                      <th className="text-left py-3 px-3 font-bold">Equipo / Cliente</th>
                      <th className="text-right py-3 px-3 font-bold">P. compra</th>
                      <th className="text-right py-3 px-3 font-bold">P. venta</th>
                      <th className="text-right py-3 px-3 font-bold">Vendido +{PCT(CREDIT_SURCHARGE_RATE)}</th>
                      <th className="text-right py-3 px-3 font-bold">Margen</th>
                      <th className="text-right py-3 px-3 font-bold">Tienda {PCT(CREDIT_STORE_SHARE_RATE)}</th>
                      <th className="text-right py-3 px-3 font-bold">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map(({ date, storeId, sale }) => {
                      const b = calcCreditSale(sale);
                      return (
                        <tr
                          key={`${date}_${storeId}_${sale.id}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {formatDateShort(date + 'T12:00:00')}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500">{getStoreName(storeId)}</td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {sale.deviceModel || 'Equipo'}
                            </span>
                            {sale.customerName && (
                              <span className="block text-xs text-slate-400">{sale.customerName}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-500">
                            {formatCurrency(b.purchasePrice)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {formatCurrency(b.productValue)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(b.soldValue)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                            {formatCurrency(b.margin)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-500">
                            {formatCurrency(b.storeShare)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-black text-green-600 dark:text-green-400">
                            {formatCurrency(b.profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 font-black">
                      <td className="py-3 px-3 uppercase text-xs" colSpan={3}>
                        Total
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-500">
                        {formatCurrency(totals.purchase)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(totals.product)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-indigo-600">
                        {formatCurrency(totals.sold)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-blue-600">
                        {formatCurrency(totals.margin)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-500">
                        {formatCurrency(totals.storeShare)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-green-600">
                        {formatCurrency(totals.profit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CreditReport;
