import React, { useState } from 'react';
import { initializeDatabase } from '../scripts/initializeDatabase';

/**
 * Página para inicializar la base de datos
 * Usar solo UNA VEZ durante la configuración inicial
 */
const InitializeDB: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const handleInitialize = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);
    setLogs([]);

    // Capturar console.log
    const originalLog = console.log;
    console.log = (...args) => {
      setLogs((prev) => [...prev, args.join(' ')]);
      originalLog(...args);
    };

    try {
      await initializeDatabase();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al inicializar base de datos');
    } finally {
      console.log = originalLog;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-3xl w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <div className="size-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <span className="material-symbols-outlined !text-[40px]">storage</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
            Inicializar Base de Datos
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Crear todas las colecciones y datos iniciales en Firestore
          </p>
        </div>

        {!success && !loading && (
          <div className="space-y-6">
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-6">
              <h3 className="font-bold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined">info</span>
                Se crearán las siguientes colecciones:
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>stores</strong> - 2 tiendas (Distriaccell y accell.com)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>employees</strong> - 3 empleados de ejemplo
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>users</strong> - 3 usuarios del sistema (2 admins + 1 gerente)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>suppliers</strong> - 2 proveedores de ejemplo
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>categories</strong> - 8 categorías de gastos
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>settings</strong> - Configuraciones del sistema
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>paymentMethods</strong> - Métodos de pago
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">✓</span>
                  <strong>serviceTypes</strong> - Tipos de servicio técnico
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100 flex items-start gap-2">
                <span className="material-symbols-outlined flex-shrink-0">warning</span>
                <span>
                  <strong>Importante:</strong> Ejecuta esto solo UNA VEZ. Si ya ejecutaste este script,
                  no es necesario volver a ejecutarlo (se sobrescribirán los datos).
                </span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4">
                <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                  <span className="material-symbols-outlined flex-shrink-0">error</span>
                  {error}
                </p>
              </div>
            )}

            <button
              onClick={handleInitialize}
              className="w-full h-14 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold rounded-xl shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              Inicializar Base de Datos
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="size-8 border-4 border-orange-600/30 border-t-orange-600 rounded-full animate-spin" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                Inicializando base de datos...
              </p>
            </div>

            {/* Logs en tiempo real */}
            {logs.length > 0 && (
              <div className="bg-slate-900 rounded-xl p-4 max-h-96 overflow-y-auto custom-scrollbar">
                <div className="space-y-1 font-mono text-sm">
                  {logs.map((log, i) => (
                    <div key={i} className="text-green-400">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="text-center space-y-6">
            <div className="size-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-green-600 text-5xl">check_circle</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-green-600 dark:text-green-400 mb-2">
                ¡Base de Datos Inicializada!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Todas las colecciones han sido creadas correctamente
              </p>
            </div>

            {/* Mostrar logs finales */}
            {logs.length > 0 && (
              <div className="bg-slate-900 rounded-xl p-4 max-h-96 overflow-y-auto custom-scrollbar text-left">
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log, i) => (
                    <div key={i} className="text-green-400">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all"
              >
                <span className="material-symbols-outlined">arrow_forward</span>
                Ir al Sistema
              </a>
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 h-12 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
              >
                <span className="material-symbols-outlined">open_in_new</span>
                Ver en Firebase
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InitializeDB;
