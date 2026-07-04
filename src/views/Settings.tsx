import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotificationSettings,
  updateNotificationSettings,
  getBudgetSettings,
  updateBudgetSettings,
  NotificationSettings
} from '../services/settings.service';
import { sendTestEmail } from '../services/notification.service';
import { EXPENSE_CATEGORIES } from '../constants/categories';

// Map category id -> Material Symbol icon name
const CATEGORY_ICONS: Record<string, string> = {
  'insumos': 'inventory_2',
  'servicios-tecnicos': 'build',
  'inventario': 'smartphone',
  'administrativos': 'description',
  'servicios-publicos': 'bolt',
  'transporte': 'directions_car',
  'comidas': 'restaurant',
  'mantenimiento': 'home_repair_service',
  'otros': 'more_horiz',
};

const Settings: React.FC = () => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBudgets, setSavingBudgets] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true
  });
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  // Solo super-admin puede acceder
  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            No tienes permisos para acceder a la configuración del sistema.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [currentSettings, currentBudgets] = await Promise.all([
        getNotificationSettings(),
        getBudgetSettings(),
      ]);
      setSettings(currentSettings);
      // Initialize budgets with 0 for any missing categories
      const normalized: Record<string, number> = {};
      EXPENSE_CATEGORIES.forEach(c => {
        normalized[c.id] = currentBudgets[c.id] || 0;
      });
      setBudgets(normalized);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      alert('❌ Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(settings);
      alert('✅ Configuración guardada correctamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.managerEmail) {
      setTestStatus({ type: 'error', message: 'Ingresa un correo principal antes de probar.' });
      return;
    }
    setTestingEmail(true);
    setTestStatus(null);
    try {
      await sendTestEmail(settings.managerEmail, settings.managerName || 'Gerente');
      setTestStatus({ type: 'success', message: `Correo de prueba enviado a ${settings.managerEmail}. Revisa tu bandeja (y spam).` });
    } catch (error: any) {
      setTestStatus({ type: 'error', message: error.message || 'Error desconocido al enviar.' });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveBudgets = async () => {
    setSavingBudgets(true);
    try {
      await updateBudgetSettings(budgets);
      alert('✅ Presupuestos guardados correctamente');
    } catch (error) {
      console.error('Error al guardar presupuestos:', error);
      alert('❌ Error al guardar los presupuestos');
    } finally {
      setSavingBudgets(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl">settings</span>
          <div>
            <h2 className="text-2xl font-black">⚙️ Configuración del Sistema</h2>
            <p className="text-blue-100 text-sm">Gestiona las notificaciones y preferencias</p>
          </div>
        </div>
      </div>

      {/* Sección de Notificaciones */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">notifications</span>
          Notificaciones Automáticas
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Configura el envío automático de reportes diarios cuando se cierre el registro.
        </p>

        <div className="space-y-6">
          {/* Switch principal */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div>
              <label className="font-bold text-slate-900 dark:text-white">
                Activar notificaciones automáticas
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Enviar reportes automáticamente al cerrar el día
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {settings.enabled && (
            <>
              {/* Configuración de Email Principal */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-blue-600">email</span>
                  <h4 className="font-bold text-slate-900 dark:text-white">Correo Principal</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del destinatario
                    </label>
                    <input
                      type="text"
                      value={settings.managerName || ''}
                      onChange={(e) => setSettings({ ...settings, managerName: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nombre del gerente"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      value={settings.managerEmail || ''}
                      onChange={(e) => setSettings({ ...settings, managerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="gerente@ejemplo.com"
                    />
                  </div>
                </div>
              </div>

              {/* Configuración de Email Secundario */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-purple-600">forward_to_inbox</span>
                  <h4 className="font-bold text-slate-900 dark:text-white">Correo Secundario (Opcional)</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del destinatario
                    </label>
                    <input
                      type="text"
                      value={settings.secondaryName || ''}
                      onChange={(e) => setSettings({ ...settings, secondaryName: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Nombre del supervisor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      value={settings.secondaryEmail || ''}
                      onChange={(e) => setSettings({ ...settings, secondaryEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="supervisor@ejemplo.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      El reporte también se enviará a este correo si lo configuras
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botón guardar */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tarjeta de prueba de correo */}
      <div className="bg-green-600 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-white text-4xl">mark_email_read</span>
          <div>
            <h3 className="text-xl font-black text-white">Probar envío de correo</h3>
            <p className="text-green-100 text-sm">Envía un correo de prueba al correo del gerente configurado</p>
          </div>
        </div>

        {testStatus && (
          <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm font-medium ${
            testStatus.type === 'success'
              ? 'bg-green-700 border border-green-500 text-white'
              : 'bg-red-500 border border-red-400 text-white'
          }`}>
            <span className="material-symbols-outlined text-base shrink-0">
              {testStatus.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{testStatus.message}</span>
          </div>
        )}

        <button
          onClick={handleTestEmail}
          disabled={testingEmail}
          className="w-full px-6 py-4 bg-white hover:bg-green-50 text-green-700 font-black text-lg rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        >
          {testingEmail ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              Enviando correo de prueba...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-2xl">send</span>
              Enviar correo de prueba
            </>
          )}
        </button>
      </div>

      {/* Budget Section */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600">savings</span>
          Presupuesto Mensual por Categoría
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Define cuánto puedes gastar mensualmente en cada categoría. Deja en 0 si no quieres límite.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPENSE_CATEGORIES.map(cat => (
            <div key={cat.id} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="size-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="material-symbols-outlined !text-[20px] text-slate-600 dark:text-slate-300">
                  {CATEGORY_ICONS[cat.id] || 'label'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 truncate" title={cat.label}>
                  {cat.label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={budgets[cat.id] || 0}
                    onChange={(e) => setBudgets({ ...budgets, [cat.id]: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-6 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent tabular-nums"
                    placeholder="0"
                  />
                </div>
                {(budgets[cat.id] || 0) > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Límite: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(budgets[cat.id])}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveBudgets}
            disabled={savingBudgets}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {savingBudgets ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                Guardar Presupuestos
              </>
            )}
          </button>
        </div>
      </div>

      {/* Información de configuración */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-600 text-2xl">info</span>
          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
              📧 Configuración de Nodemailer (SMTP)
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Los correos se envían desde el servidor usando Nodemailer. Configura las siguientes variables de entorno en el archivo <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">.env</code>:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
              <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SMTP_HOST</code> — Servidor SMTP (ej: <code>smtp.gmail.com</code>)</li>
              <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SMTP_PORT</code> — Puerto (587 para TLS, 465 para SSL)</li>
              <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SMTP_SECURE</code> — <code>true</code> si es SSL (puerto 465)</li>
              <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SMTP_USER</code> — Correo remitente</li>
              <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SMTP_PASS</code> — Contraseña o App Password</li>
              <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SMTP_FROM</code> — Nombre y correo del remitente (opcional)</li>
            </ul>
            <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                ✨ <strong>Una vez configurado:</strong> Cada vez que se cierre el registro diario, se enviará automáticamente un reporte completo en HTML al correo del gerente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
