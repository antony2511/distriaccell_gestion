import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDailyRegistersByRange, migrateDailyRegisters } from '../services/dailyRegister.service';
import { formatCurrency } from '../utils/currency';
import { calculateGrossIncome, calculateExpensesTotal } from '../utils/calculations';
import { DailyRegister } from '../types';

const MigrateRecords: React.FC = () => {
  const { hasPermission, user, activeStores } = useAuth();

  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-400">Solo el super administrador puede migrar registros.</p>
        </div>
      </div>
    );
  }

  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-05-31');
  const [preview, setPreview] = useState<DailyRegister[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<{ migrated: number; errors: string[] } | null>(null);

  const handlePreview = async () => {
    if (!fromStoreId || !startDate || !endDate) {
      alert('Selecciona el almacén origen y el rango de fechas');
      return;
    }
    setLoadingPreview(true);
    setResult(null);
    try {
      const registers = await getDailyRegistersByRange(startDate, endDate, fromStoreId);
      setPreview(registers);
    } catch (error) {
      alert('Error al cargar registros: ' + error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleMigrate = async () => {
    if (!fromStoreId || !toStoreId || !startDate || !endDate) {
      alert('Completa todos los campos');
      return;
    }
    if (fromStoreId === toStoreId) {
      alert('El almacén origen y destino no pueden ser el mismo');
      return;
    }
    if (preview.length === 0) {
      alert('No hay registros para migrar. Primero haz la vista previa.');
      return;
    }

    const fromName = activeStores.find(s => s.id === fromStoreId)?.name || fromStoreId;
    const toName = activeStores.find(s => s.id === toStoreId)?.name || toStoreId;

    if (!confirm(
      `⚠️ ATENCIÓN: Vas a mover ${preview.length} registro(s) de "${fromName}" a "${toName}".\n\n` +
      `Rango: ${startDate} → ${endDate}\n\n` +
      `Esta acción es IRREVERSIBLE. ¿Confirmas?`
    )) return;

    setMigrating(true);
    try {
      const res = await migrateDailyRegisters(startDate, endDate, fromStoreId, toStoreId, user?.id || '');
      setResult(res);
      setPreview([]);
    } catch (error) {
      alert('Error durante la migración: ' + error);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-6 text-white shadow-xl">
        <h1 className="text-2xl font-black mb-1">🔄 Corrección de Registros</h1>
        <p className="text-amber-100 text-sm">
          Reasigna registros diarios de un almacén a otro. Úsalo para corregir registros guardados en el almacén equivocado.
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Configuración de la corrección</h2>

        {/* Rango de fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha fin</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Almacenes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Almacén origen (incorrecto)</label>
            <select
              value={fromStoreId}
              onChange={e => { setFromStoreId(e.target.value); setPreview([]); setResult(null); }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {activeStores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Almacén destino (correcto)</label>
            <select
              value={toStoreId}
              onChange={e => setToStoreId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {activeStores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {fromStoreId && toStoreId && fromStoreId === toStoreId && (
          <p className="text-red-500 text-sm">El almacén origen y destino no pueden ser el mismo.</p>
        )}

        <button
          onClick={handlePreview}
          disabled={!fromStoreId || !startDate || !endDate || loadingPreview}
          className="px-5 py-2.5 bg-slate-700 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {loadingPreview ? 'Cargando...' : '🔍 Ver registros a corregir'}
        </button>
      </div>

      {/* Vista previa */}
      {preview.length > 0 && (
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                {preview.length} registro(s) encontrado(s)
              </h3>
              <p className="text-xs text-slate-500">
                Estos registros serán movidos a "{activeStores.find(s => s.id === toStoreId)?.name || toStoreId}"
              </p>
            </div>
            <button
              onClick={handleMigrate}
              disabled={!toStoreId || fromStoreId === toStoreId || migrating}
              className="px-5 py-2.5 bg-orange-600 text-white rounded-lg font-bold text-sm hover:bg-orange-700 transition-all disabled:opacity-50"
            >
              {migrating ? 'Migrando...' : '✅ Confirmar corrección'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Ingresos</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Gastos</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.map(r => {
                  const income = calculateGrossIncome(r);
                  const expenses = calculateExpensesTotal(r.expenses || []);
                  const balance = income - expenses - (r.dailySavings || 0);
                  return (
                    <tr key={r.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">{r.date}</td>
                      <td className="px-4 py-3">
                        {r.isClosed ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Cerrado</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Abierto</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(income)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-500">{formatCurrency(expenses)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview.length === 0 && !loadingPreview && fromStoreId && (
        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 !text-[48px]">search_off</span>
          <p className="text-slate-500 mt-2">No se encontraron registros en ese rango para el almacén seleccionado.</p>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={`rounded-2xl border p-6 ${result.errors.length === 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-amber-50 border-amber-200'}`}>
          <h3 className="font-bold text-lg mb-2">
            {result.errors.length === 0 ? '✅ Corrección completada' : '⚠️ Corrección con errores'}
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {result.migrated} registro(s) migrado(s) correctamente.
          </p>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-red-600 mb-1">Errores:</p>
              <ul className="text-xs text-red-600 space-y-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MigrateRecords;
