import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DailyRegister, StoreId } from '../types';
import { getDailyRegistersForStores } from '../services/dailyRegister.service';
import { calculateExpensesTotal, calculateQRTotal, calculateNotebookTotal, calculateServicesTotal } from '../utils/calculations';
import { resumirRegistros, resumirRegistro } from '../utils/periodSummary';
import { formatCurrency } from '../utils/currency';
import { EXPENSE_CATEGORIES } from '../constants/categories';

type StoreDay = { income: number; expenses: number; savings: number; qrPayments: number; balance: number };
type ConsolidatedRow = { date: string; stores: Record<string, StoreDay> };

const DailyClosings: React.FC = () => {
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
            No tienes permisos para ver los cierres diarios. Solo el gerente puede acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return <DailyClosingsContent />;
};

const DailyClosingsContent: React.FC = () => {
  const { activeStores, getStoreName } = useAuth();

  // Estado para Balance General Consolidado
  const [showConsolidated, setShowConsolidated] = useState(true);
  const [consolidatedStartDate, setConsolidatedStartDate] = useState('');
  const [consolidatedEndDate, setConsolidatedEndDate] = useState('');
  const [consolidatedRegisters, setConsolidatedRegisters] = useState<DailyRegister[]>([]);
  const [loadingConsolidated, setLoadingConsolidated] = useState(false);

  // Estado para Reportes Diarios por Tienda
  const [showDailyByStore, setShowDailyByStore] = useState(true);
  const [dailyByStoreStart, setDailyByStoreStart] = useState('');
  const [dailyByStoreEnd, setDailyByStoreEnd] = useState('');
  const [dailyByStoreRegs, setDailyByStoreRegs] = useState<DailyRegister[]>([]);
  const [loadingDailyByStore, setLoadingDailyByStore] = useState(false);
  const [dailyStoreFilter, setDailyStoreFilter] = useState<StoreId | 'todas'>('todas');
  const [detailRegister, setDetailRegister] = useState<DailyRegister | null>(null);

  // Función para cargar Balance General Consolidado
  const loadConsolidatedBalance = async () => {
    if (!consolidatedStartDate || !consolidatedEndDate) {
      alert('Por favor selecciona un rango de fechas válido');
      return;
    }

    setLoadingConsolidated(true);
    try {
      const allRegisters = await getDailyRegistersForStores(consolidatedStartDate, consolidatedEndDate, activeStores.map(s => s.id));

      const seen = new Map<string, number>();
      allRegisters.forEach(r => {
        const key = `${r.date}_${r.storeId}`;
        seen.set(key, (seen.get(key) || 0) + 1);
      });
      const duplicates = Array.from(seen.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        console.error('⚠️ ADVERTENCIA: Registros duplicados detectados:', duplicates);
      }

      setConsolidatedRegisters(allRegisters);
    } catch (error) {
      console.error('Error al cargar balance consolidado:', error);
      alert('Error al cargar los datos del balance consolidado');
    } finally {
      setLoadingConsolidated(false);
    }
  };

  // Agrupar registros consolidados por fecha (dinámico para N tiendas)
  const consolidatedByDate = consolidatedRegisters.reduce((acc, register) => {
    const date = register.date;
    if (!acc[date]) {
      acc[date] = { date, stores: {} as Record<string, StoreDay> };
    }
    const r = resumirRegistro(register);
    acc[date].stores[register.storeId] = { income: r.ventas, expenses: r.gastos, savings: r.ahorro, qrPayments: r.banco, balance: r.cajaEsperada };
    return acc;
  }, {} as Record<string, ConsolidatedRow>);

  const consolidatedData: ConsolidatedRow[] = (Object.values(consolidatedByDate) as ConsolidatedRow[]).sort((a, b) => b.date.localeCompare(a.date));

  // Totales por tienda
  const totalByStore: Record<string, { income: number; expenses: number; balance: number }> = {};
  activeStores.forEach(s => { totalByStore[s.id] = { income: 0, expenses: 0, balance: 0 }; });
  consolidatedData.forEach(row => {
    activeStores.forEach(s => {
      const sd = row.stores[s.id];
      if (sd) {
        totalByStore[s.id].income += sd.income;
        totalByStore[s.id].expenses += sd.expenses;
        totalByStore[s.id].balance += sd.balance;
      }
    });
  });
  const grandTotal = Object.values(totalByStore).reduce((sum, d) => sum + d.balance, 0);

  // Función para cargar Reportes Diarios por Tienda
  const loadDailyByStore = async () => {
    if (!dailyByStoreStart || !dailyByStoreEnd) {
      alert('Por favor selecciona un rango de fechas válido');
      return;
    }
    setLoadingDailyByStore(true);
    try {
      const results = await getDailyRegistersForStores(dailyByStoreStart, dailyByStoreEnd, activeStores.map(s => s.id));
      setDailyByStoreRegs(results.sort((a, b) => b.date.localeCompare(a.date) || a.storeId.localeCompare(b.storeId)));
      setDailyStoreFilter('todas');
    } catch (error) {
      console.error('Error al cargar reportes diarios:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoadingDailyByStore(false);
    }
  };

  const filteredDailyRegs = dailyStoreFilter === 'todas'
    ? dailyByStoreRegs
    : dailyByStoreRegs.filter(r => r.storeId === dailyStoreFilter);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-black mb-1">🗓️ Cierres Diarios</h2>
        <p className="text-orange-100 text-sm">
          Historial de los registros diarios por tienda: caja esperada de cada día, arqueo y detalle de movimientos
        </p>
      </div>

      {/* Balance General Consolidado */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">💰 Caja Esperada por Día</h3>
            <p className="text-sm text-slate-500 mt-1">Efectivo que debía quedar en el cajón cada día: ventas − QR/banco − crédito − gastos − ahorro</p>
          </div>
          <button
            onClick={() => setShowConsolidated(!showConsolidated)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {showConsolidated ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showConsolidated && (
          <div className="space-y-6">
            {/* Selector de rango de fechas */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Seleccionar rango de fechas:</p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Fecha inicial
                  </label>
                  <input
                    type="date"
                    value={consolidatedStartDate}
                    onChange={(e) => setConsolidatedStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Fecha final
                  </label>
                  <input
                    type="date"
                    value={consolidatedEndDate}
                    onChange={(e) => setConsolidatedEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={loadConsolidatedBalance}
                  disabled={loadingConsolidated}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingConsolidated ? 'Cargando...' : 'Consultar'}
                </button>
              </div>
            </div>

            {/* Resumen de totales por tienda */}
            {consolidatedData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {activeStores.map(store => {
                  const totals = totalByStore[store.id] || { income: 0, expenses: 0, balance: 0 };
                  return (
                    <div key={store.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{store.name}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-600">Ingresos</span>
                          <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(totals.income)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-500">Egresos</span>
                          <span className="font-bold text-red-600 dark:text-red-400">-{formatCurrency(totals.expenses)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Caja esperada</span>
                          <span className={`font-black ${totals.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(totals.balance)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center justify-between">
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Caja esperada total</p>
                  <p className={`text-xl font-black ${grandTotal >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600'}`}>{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            )}

            {/* Tabla de balance consolidado */}
            {consolidatedData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Fecha</th>
                      {activeStores.map(store => (
                        <th key={store.id} className="text-right py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                          {store.name}<br/>Caja esperada
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 text-xs font-bold text-green-600 dark:text-green-400 uppercase">
                        Total Día
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedData.map((row) => {
                      const totalBalance = activeStores.reduce((sum, s) => sum + (row.stores[s.id]?.balance || 0), 0);
                      const totalIncomeDayAll = activeStores.reduce((sum, s) => sum + (row.stores[s.id]?.income || 0), 0);
                      const totalExpensesDayAll = activeStores.reduce((sum, s) => sum + (row.stores[s.id]?.expenses || 0), 0);
                      const [year, month, day] = row.date.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      const formattedDate = date.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                      return (
                        <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-white">
                            {formattedDate}
                            <div className="text-xs text-slate-500 mt-1">
                              Ing: {formatCurrency(totalIncomeDayAll)} | Egr: {formatCurrency(totalExpensesDayAll)}
                            </div>
                          </td>
                          {activeStores.map(store => {
                            const sd = row.stores[store.id];
                            return (
                              <td key={store.id} className="py-3 px-4 text-right">
                                <div className={`text-sm font-bold ${(sd?.balance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {sd ? formatCurrency(sd.balance) : '—'}
                                </div>
                                {sd && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    +{formatCurrency(sd.income)} -{formatCurrency(sd.expenses)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right">
                            <div className={`text-sm font-black ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(totalBalance)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
                      <td className="py-4 px-4 text-sm font-black text-slate-900 dark:text-white uppercase">Caja esperada total</td>
                      {activeStores.map(store => (
                        <td key={store.id} className="py-4 px-4 text-sm text-right font-black text-blue-600">
                          {formatCurrency(totalByStore[store.id]?.balance || 0)}
                        </td>
                      ))}
                      <td className="py-4 px-4 text-sm text-right font-black text-green-600">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {consolidatedData.length === 0 && !loadingConsolidated && consolidatedStartDate && consolidatedEndDate && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl mb-4">
                  inbox
                </span>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  No hay datos para el rango seleccionado
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ================================================================
          SECTION C — Reportes Diarios por Tienda
      ================================================================ */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">calendar_view_day</span>
              Reportes Diarios por Tienda
            </h3>
            <p className="text-sm text-slate-500 mt-1">Vista general y detallada de registros diarios por almacén</p>
          </div>
          <button
            onClick={() => setShowDailyByStore(!showDailyByStore)}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {showDailyByStore ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showDailyByStore && (
          <div className="space-y-6">
            {/* Controles */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Seleccionar rango de fechas:</p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha inicial</label>
                  <input
                    type="date"
                    value={dailyByStoreStart}
                    onChange={(e) => setDailyByStoreStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha final</label>
                  <input
                    type="date"
                    value={dailyByStoreEnd}
                    onChange={(e) => setDailyByStoreEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={loadDailyByStore}
                  disabled={loadingDailyByStore}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {loadingDailyByStore ? 'Cargando...' : 'Consultar'}
                </button>
              </div>

              {dailyByStoreRegs.length > 0 && activeStores.length > 1 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
                  <button
                    onClick={() => setDailyStoreFilter('todas')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${dailyStoreFilter === 'todas' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                  >
                    Todas
                  </button>
                  {activeStores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => setDailyStoreFilter(store.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${dailyStoreFilter === store.id ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                    >
                      {store.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Totales del rango */}
            {filteredDailyRegs.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(() => { const t = resumirRegistros(filteredDailyRegs); return [
                  { label: 'Ventas', value: t.ventas, color: 'text-green-600' },
                  { label: 'QR / Banco', value: t.banco, color: 'text-sky-600' },
                  { label: 'Gastos', value: t.gastos, color: 'text-red-600' },
                  { label: 'Caja esperada', value: t.cajaEsperada, color: 'text-blue-600' },
                ]; })().map(card => (
                  <div key={card.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">{card.label}</p>
                    <p className={`text-lg font-black ${card.color}`}>{formatCurrency(card.value)}</p>
                    <p className="text-xs text-slate-400 mt-1">{filteredDailyRegs.length} registros</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tabla general */}
            {filteredDailyRegs.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                      <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase">Tienda</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Ventas</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">QR</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Gastos</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Ahorro</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase">Caja esperada</th>
                      <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                      <th className="text-center py-3 px-4 text-xs font-bold text-slate-500 uppercase">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDailyRegs.map(register => {
                      const { ventas: income, banco: qr, gastos: expenses, ahorro: savings, cajaEsperada: balance } = resumirRegistro(register);
                      const [y, m, d] = register.date.split('-');
                      const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                        .toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
                      return (
                        <tr key={`${register.date}_${register.storeId}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white capitalize">{dateStr}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">{getStoreName(register.storeId)}</td>
                          <td className="py-3 px-4 text-right font-bold text-green-600 tabular-nums">{formatCurrency(income)}</td>
                          <td className="py-3 px-4 text-right text-sky-600 tabular-nums text-xs">{qr > 0 ? formatCurrency(qr) : <span className="text-slate-300">—</span>}</td>
                          <td className="py-3 px-4 text-right text-red-600 tabular-nums text-xs">{expenses > 0 ? formatCurrency(expenses) : <span className="text-slate-300">—</span>}</td>
                          <td className="py-3 px-4 text-right text-purple-600 tabular-nums text-xs">{savings > 0 ? formatCurrency(savings) : <span className="text-slate-300">—</span>}</td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className={`font-black ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(balance)}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${register.isClosed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {register.isClosed ? 'Cerrado' : 'Abierto'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setDetailRegister(register)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredDailyRegs.length === 0 && !loadingDailyByStore && dailyByStoreStart && dailyByStoreEnd && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl block mb-4">inbox</span>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No hay registros para el rango seleccionado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      {detailRegister && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailRegister(null); }}
        >
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-3xl my-4">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white capitalize">
                    {(() => {
                      const [y, m, d] = detailRegister.date.split('-');
                      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
                        .toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                    })()}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${detailRegister.isClosed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                    {detailRegister.isClosed ? '✓ Cerrado' : 'Abierto'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {getStoreName(detailRegister.storeId)} · Registrado por {detailRegister.registeredByName}
                </p>
              </div>
              <button
                onClick={() => setDetailRegister(null)}
                className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumen */}
              {(() => {
                const r = resumirRegistro(detailRegister);
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Ventas', value: r.ventas, color: 'text-green-600' },
                      { label: 'QR / Banco', value: r.banco, color: 'text-sky-600' },
                      { label: 'Gastos', value: r.gastos, color: 'text-red-600' },
                      { label: 'Utilidad', value: r.utilidad, color: r.utilidad >= 0 ? 'text-blue-600' : 'text-red-600' },
                    ].map(c => (
                      <div key={c.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">{c.label}</p>
                        <p className={`text-base font-black ${c.color}`}>{formatCurrency(c.value)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Ventas Sistema POS */}
              {detailRegister.systemSales > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-center justify-between border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 !text-[20px]">point_of_sale</span>
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-300">Ventas Sistema POS</span>
                  </div>
                  <span className="text-base font-black text-blue-600">{formatCurrency(detailRegister.systemSales)}</span>
                </div>
              )}

              {/* Ventas Cuaderno */}
              {detailRegister.notebookSales && detailRegister.notebookSales.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-green-500 !text-[18px]">menu_book</span>
                    Ventas Cuaderno
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.notebookSales.length} ítems)</span>
                    <span className="ml-auto font-black text-green-600">{formatCurrency(calculateNotebookTotal(detailRegister.notebookSales))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Descripción</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Categoría</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Cant.</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Precio</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.notebookSales.map(sale => (
                          <tr key={sale.id}>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{sale.description}</td>
                            <td className="py-2 px-3 capitalize text-slate-500">{sale.category}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{sale.quantity}</td>
                            <td className="py-2 px-3 text-right text-slate-600 tabular-nums">{formatCurrency(sale.unitPrice)}</td>
                            <td className="py-2 px-3 text-right font-bold text-green-600 tabular-nums">{formatCurrency(sale.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Servicios Técnicos */}
              {detailRegister.technicalServices && detailRegister.technicalServices.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 !text-[18px]">build</span>
                    Servicios Técnicos
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.technicalServices.length})</span>
                    <span className="ml-auto font-black text-purple-600">{formatCurrency(calculateServicesTotal(detailRegister.technicalServices))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Tipo</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Equipo</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Técnico</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Cliente</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.technicalServices.map(svc => (
                          <tr key={svc.id}>
                            <td className="py-2 px-3 capitalize text-slate-700 dark:text-slate-300">{svc.serviceType}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{svc.deviceModel}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{svc.technicianName}</td>
                            <td className="py-2 px-3 text-slate-500">{svc.customerName || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-purple-600 tabular-nums">{formatCurrency(svc.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagos QR */}
              {detailRegister.qrPayments && detailRegister.qrPayments.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-500 !text-[18px]">qr_code</span>
                    Pagos QR / Transferencias
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.qrPayments.length})</span>
                    <span className="ml-auto font-black text-sky-600">{formatCurrency(calculateQRTotal(detailRegister.qrPayments))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Descripción</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Cliente</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.qrPayments.map(qrp => (
                          <tr key={qrp.id}>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{qrp.description}</td>
                            <td className="py-2 px-3 text-slate-500">{qrp.customerName || '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-sky-600 tabular-nums">{formatCurrency(qrp.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gastos */}
              {detailRegister.expenses && detailRegister.expenses.length > 0 && (
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 !text-[18px]">receipt_long</span>
                    Gastos
                    <span className="text-xs font-normal text-slate-400 normal-case">({detailRegister.expenses.length})</span>
                    <span className="ml-auto font-black text-red-600">{formatCurrency(calculateExpensesTotal(detailRegister.expenses))}</span>
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Concepto</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Categoría</th>
                          <th className="text-left py-2 px-3 font-bold text-slate-500 uppercase">Responsable</th>
                          <th className="text-right py-2 px-3 font-bold text-slate-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detailRegister.expenses.map(exp => {
                          const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category);
                          return (
                            <tr key={exp.id}>
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{exp.concept}</td>
                              <td className="py-2 px-3 text-slate-500">{cat?.label || exp.category}</td>
                              <td className="py-2 px-3 text-slate-500">{exp.responsiblePerson || '—'}</td>
                              <td className="py-2 px-3 text-right font-bold text-red-600 tabular-nums">{formatCurrency(exp.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ahorro */}
              {(detailRegister.dailySavings || 0) > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 flex items-center justify-between border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-600 !text-[20px]">savings</span>
                    <span className="text-sm font-bold text-purple-900 dark:text-purple-300">Ahorro del Día</span>
                  </div>
                  <span className="text-base font-black text-purple-600">{formatCurrency(detailRegister.dailySavings || 0)}</span>
                </div>
              )}

              {/* Cierre de Caja */}
              {detailRegister.isClosed && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-500 !text-[18px]">lock</span>
                    Cierre de Caja
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Esperado</p>
                      <p className="font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(detailRegister.expectedCash || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Real</p>
                      <p className="font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(detailRegister.actualCash || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Diferencia</p>
                      <p className={`font-black tabular-nums ${(detailRegister.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(detailRegister.difference || 0)}
                      </p>
                    </div>
                  </div>
                  {detailRegister.differenceJustification && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Justificación</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{detailRegister.differenceJustification}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sin datos */}
              {!detailRegister.systemSales && !detailRegister.notebookSales?.length && !detailRegister.technicalServices?.length && !detailRegister.qrPayments?.length && !detailRegister.expenses?.length && (
                <div className="text-center py-8 text-slate-400">
                  <span className="material-symbols-outlined text-4xl block mb-2">inventory_2</span>
                  <p className="text-sm">No hay movimientos registrados en este día</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyClosings;
