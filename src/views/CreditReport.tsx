import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CreditSale, DailyRegister, StoreId } from '../types';
import { getDailyRegistersByRange, getDailyRegistersForStores } from '../services/dailyRegister.service';
import { getTodayId, formatDateShort, getTodayBogota, getMonthRange, getMonthName, formatDateIdLocal } from '../utils/dates';
import { formatCurrency } from '../utils/currency';
import {
  calcCreditSale,
  CREDIT_SURCHARGE_RATE,
  CREDIT_STORE_SHARE_RATE,
  CREDIT_FINANCIER_SHARE_RATE,
  MONTHLY_CREDIT_LIMIT,
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

  // ============================================================
  // Cupo mensual de financiación — todas las tiendas, mes a mes
  // ============================================================
  const [cupoMonth, setCupoMonth] = useState<Date>(() => getTodayBogota());
  const [cupoSales, setCupoSales] = useState<CreditRow[]>([]);
  const [cupoLoading, setCupoLoading] = useState(false);

  useEffect(() => {
    if (activeStores.length === 0) return;
    let cancelled = false;
    const loadCupo = async () => {
      setCupoLoading(true);
      try {
        const { start, end } = getMonthRange(cupoMonth);
        const s = formatDateIdLocal(start);
        const e = formatDateIdLocal(end);
        const results = await getDailyRegistersForStores(s, e, activeStores.map((st) => st.id));
        const flat: CreditRow[] = [];
        results.forEach((r) => {
          (r.creditSales || []).forEach((sale) => flat.push({ date: r.date, storeId: r.storeId, sale }));
        });
        if (!cancelled) setCupoSales(flat);
      } catch (error) {
        console.error('Error al cargar cupo mensual de crédito:', error);
      } finally {
        if (!cancelled) setCupoLoading(false);
      }
    };
    loadCupo();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupoMonth, activeStores.length]);

  const cupoTotals = cupoSales.reduce(
    (acc, { sale }) => {
      const b = calcCreditSale(sale);
      acc.count += 1;
      // El cupo se mide sobre el COSTO del stock (lo que hay que reponer),
      // no sobre el precio de venta — así lo pidió el dueño: el presupuesto
      // es para poder reponer los productos que se van a crédito.
      acc.consumido += b.purchasePrice;
      acc.vendido += b.productValue; // precio de venta total, solo informativo aquí
      acc.abonos += b.downPayment; // lo que nos han avanzado
      acc.financiado += b.financedValue; // lo que queda por cobrarle a la financiera
      acc.ganancia += b.profit;
      return acc;
    },
    { count: 0, consumido: 0, vendido: 0, abonos: 0, financiado: 0, ganancia: 0 }
  );

  const today = getTodayBogota();
  const isCupoCurrentMonth = cupoMonth.getFullYear() === today.getFullYear() && cupoMonth.getMonth() === today.getMonth();
  const canGoNextCupoMonth =
    cupoMonth.getFullYear() < today.getFullYear() ||
    (cupoMonth.getFullYear() === today.getFullYear() && cupoMonth.getMonth() < today.getMonth());
  const { end: cupoMonthEnd } = getMonthRange(cupoMonth);
  const daysInCupoMonth = cupoMonthEnd.getDate();
  const daysElapsed = isCupoCurrentMonth ? today.getDate() : daysInCupoMonth;
  const cupoProjected = daysElapsed > 0 ? (cupoTotals.consumido / daysElapsed) * daysInCupoMonth : 0;

  const cupoPct = Math.min(100, (cupoTotals.consumido / MONTHLY_CREDIT_LIMIT) * 100);
  const cupoDisponible = MONTHLY_CREDIT_LIMIT - cupoTotals.consumido;
  const cupoBarColor =
    cupoTotals.consumido >= MONTHLY_CREDIT_LIMIT ? 'bg-red-500' : cupoPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const cupoTextColor =
    cupoTotals.consumido >= MONTHLY_CREDIT_LIMIT ? 'text-red-600' : cupoPct >= 70 ? 'text-amber-600' : 'text-emerald-600';
  const costoPromedio = cupoTotals.count > 0 ? cupoTotals.consumido / cupoTotals.count : 0;

  const loadData = async () => {
    if (!startDate || !endDate) {
      alert('Selecciona un rango de fechas válido');
      return;
    }
    setLoading(true);
    try {
      let registers: DailyRegister[] = [];
      if (storeFilter === 'ambos') {
        registers = await getDailyRegistersForStores(startDate, endDate, activeStores.map((s) => s.id));
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
      acc.downPayment += b.downPayment;
      acc.downPaymentCash += b.downPaymentInCash ? b.downPayment : 0;
      acc.financed += b.financedValue;
      acc.margin += b.margin;
      acc.storeShare += b.storeShare;
      acc.financierShare += b.financierShare;
      acc.profit += b.profit;
      return acc;
    },
    { count: 0, purchase: 0, product: 0, sold: 0, downPayment: 0, downPaymentCash: 0, financed: 0, margin: 0, storeShare: 0, financierShare: 0, profit: 0 }
  );

  const exportCsv = () => {
    const header = [
      'Fecha',
      'Tienda',
      'Equipo',
      'Precio compra',
      'Precio venta',
      `Recargo ${PCT(CREDIT_SURCHARGE_RATE)}`,
      'Valor vendido',
      'Abono',
      'Abono pagado con',
      'Monto financiado',
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
        b.purchasePrice,
        b.productValue,
        Math.round(b.surcharge),
        Math.round(b.soldValue),
        Math.round(b.downPayment),
        b.downPaymentInCash ? 'efectivo' : 'QR/transferencia',
        Math.round(b.financedValue),
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
    { label: 'Costo del stock (compra)', value: totals.purchase, color: 'text-slate-700 dark:text-slate-200', hint: 'lo que nos costó ese equipo' },
    { label: 'Monto vendido', value: totals.sold, color: 'text-indigo-600', hint: `${totals.count} ventas · precio + ${PCT(CREDIT_SURCHARGE_RATE)}` },
    { label: 'Margen del producto', value: totals.margin, color: 'text-blue-600', hint: 'venta − compra' },
    { label: `+ Comisión financiación (${PCT(CREDIT_STORE_SHARE_RATE)})`, value: totals.storeShare, color: 'text-blue-600', hint: 'la otra mitad de la ganancia' },
    { label: '= Ganancia', value: totals.profit, color: 'text-green-600', hint: 'margen + comisión de financiación' },
    { label: 'Abonos recibidos', value: totals.downPayment, color: 'text-emerald-600', hint: `${formatCurrency(totals.downPaymentCash)} en efectivo` },
    { label: 'Monto financiado (por cobrar)', value: totals.financed, color: 'text-indigo-600', hint: 'vendido − abono' },
    { label: `Retiene la financiera (${PCT(CREDIT_FINANCIER_SHARE_RATE)})`, value: totals.financierShare, color: 'text-slate-500', hint: 'no es nuestro' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-black mb-1">💳 Reporte de Crédito Celulares/Tablet</h2>
        <p className="text-indigo-100 text-sm">
          Cupo mensual, costo del stock, abonos, monto financiado y ganancias de las ventas a crédito.
        </p>
      </div>

      {/* Cupo Mensual de Financiación — todas las tiendas */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">account_balance_wallet</span>
            Cupo Mensual de Financiación
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCupoMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="size-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              title="Mes anterior"
            >
              <span className="material-symbols-outlined !text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize w-36 text-center">
              {getMonthName(cupoMonth)} {cupoMonth.getFullYear()}
            </span>
            <button
              onClick={() => setCupoMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              disabled={!canGoNextCupoMonth}
              className="size-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Mes siguiente"
            >
              <span className="material-symbols-outlined !text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        {cupoLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Cargando cupo del mes...</div>
        ) : (
          <>
            {/* Consumido vs cupo */}
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Consumido (costo del stock):{' '}
                <span className={`text-xl font-black ${cupoTextColor}`}>{formatCurrency(cupoTotals.consumido)}</span>
                <span className="text-slate-400"> de {formatCurrency(MONTHLY_CREDIT_LIMIT)}</span>
              </p>
              <p className={`text-sm font-black ${cupoTextColor}`}>{cupoPct.toFixed(0)}%</p>
            </div>
            <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${cupoBarColor} transition-all`}
                style={{ width: `${Math.min(100, cupoPct)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 mb-4">
              <p className="text-xs text-slate-500">
                {cupoDisponible >= 0 ? (
                  <>Disponible: <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(cupoDisponible)}</span></>
                ) : (
                  <span className="font-bold text-red-600">Cupo superado por {formatCurrency(-cupoDisponible)}</span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {cupoTotals.count} equipo{cupoTotals.count !== 1 ? 's' : ''} financiado{cupoTotals.count !== 1 ? 's' : ''}
                {cupoTotals.count > 0 && <> · costo promedio {formatCurrency(costoPromedio)}</>}
              </p>
            </div>

            {isCupoCurrentMonth && cupoTotals.count > 0 && daysElapsed < daysInCupoMonth && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 text-xs font-medium ${
                  cupoProjected > MONTHLY_CREDIT_LIMIT
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500'
                }`}
              >
                <span className="material-symbols-outlined !text-[16px]">
                  {cupoProjected > MONTHLY_CREDIT_LIMIT ? 'warning' : 'trending_up'}
                </span>
                Al ritmo actual ({formatCurrency(cupoTotals.consumido)} en {daysElapsed} días), terminarías el mes en{' '}
                <strong>{formatCurrency(cupoProjected)}</strong>
                {cupoProjected > MONTHLY_CREDIT_LIMIT ? ' — por encima del cupo' : ''}.
              </div>
            )}

            {/* Desglose del mes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Vendido (precio de venta)</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{formatCurrency(cupoTotals.vendido)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Abonos recibidos</p>
                <p className="text-sm font-black text-emerald-600">{formatCurrency(cupoTotals.abonos)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Por cobrar a la financiera</p>
                <p className="text-sm font-black text-indigo-600">{formatCurrency(cupoTotals.financiado)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ganancia del mes</p>
                <p className="text-sm font-black text-green-600">{formatCurrency(cupoTotals.ganancia)}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              El cupo se mide sobre el <strong>costo del stock</strong> (precio de compra) financiado en el mes — es lo
              que necesitas para reponer ese inventario, no el precio de venta. Todas las tiendas. Ajustable en el
              código (<code>MONTHLY_CREDIT_LIMIT</code>).
            </p>
          </>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <th className="text-left py-3 px-3 font-bold">Equipo</th>
                      <th className="text-right py-3 px-3 font-bold">P. compra</th>
                      <th className="text-right py-3 px-3 font-bold">P. venta</th>
                      <th className="text-right py-3 px-3 font-bold">Vendido +{PCT(CREDIT_SURCHARGE_RATE)}</th>
                      <th className="text-right py-3 px-3 font-bold">Abono</th>
                      <th className="text-right py-3 px-3 font-bold">Financiado</th>
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
                          <td className="py-3 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {b.downPayment > 0 ? (
                              <>
                                {formatCurrency(b.downPayment)}
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  {b.downPaymentInCash ? 'efectivo' : 'QR/transf'}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(b.financedValue)}
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
                      <td className="py-3 px-3 text-right tabular-nums text-emerald-600">
                        {formatCurrency(totals.downPayment)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-indigo-600">
                        {formatCurrency(totals.financed)}
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
