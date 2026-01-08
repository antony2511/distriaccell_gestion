import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotificationSettings,
  updateNotificationSettings,
  NotificationSettings
} from '../services/settings.service';

const Settings: React.FC = () => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true
  });

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
      const currentSettings = await getNotificationSettings();
      setSettings(currentSettings);
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
              {/* Configuración de Email */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-blue-600">email</span>
                  <h4 className="font-bold text-slate-900 dark:text-white">Correo Electrónico</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del gerente
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
                    <p className="text-xs text-slate-500 mt-1">
                      El reporte diario se enviará automáticamente a este correo cuando se cierre el día
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botón guardar */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Información de configuración */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-600 text-2xl">info</span>
          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
              📧 Configuración de EmailJS
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Para que los reportes se envíen automáticamente por correo electrónico:
            </p>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-decimal">
              <li>
                Crea una cuenta gratuita en{' '}
                <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 font-semibold">
                  emailjs.com
                </a>
                {' '}(200 emails/mes gratis)
              </li>
              <li>
                Configura un servicio de email (Gmail, Outlook, etc.)
              </li>
              <li>
                Crea una plantilla de email con las variables del reporte
              </li>
              <li>
                Actualiza las credenciales en{' '}
                <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">src/services/notification.service.ts</code>:
                <ul className="mt-2 space-y-1 ml-4">
                  <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">EMAILJS_SERVICE_ID</code></li>
                  <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">EMAILJS_TEMPLATE_ID</code></li>
                  <li>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">EMAILJS_PUBLIC_KEY</code></li>
                </ul>
              </li>
              <li>
                Configura el email del gerente en esta pantalla
              </li>
            </ol>
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
