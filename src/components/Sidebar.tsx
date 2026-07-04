
import React from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onLogout }) => {
  const { user, hasPermission } = useAuth();

  const allMenuItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', permission: 'read' },
    { id: 'income', icon: 'edit_note', label: 'Registro Diario', permission: 'daily-register' },
    { id: 'general-balance', icon: 'account_balance', label: 'Balance General', permission: 'all' },
    { id: 'expenses', icon: 'savings', label: 'Ahorro', permission: 'all' },
    { id: 'employees', icon: 'group', label: 'Empleados', permission: 'all' },
    { id: 'suppliers', icon: 'local_shipping', label: 'Proveedores', permission: 'manage-suppliers' },
    { id: 'reports', icon: 'bar_chart', label: 'Reportes', permission: 'all' },
    { id: 'executive-report', icon: 'trending_up', label: 'Reporte Ejecutivo', permission: 'all' },
  ];

  // Filtrar items según permisos del usuario
  const menuItems = allMenuItems.filter(item => hasPermission(item.permission));

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-[#1a1a2e] border-r border-slate-200 dark:border-slate-800 transition-colors h-full shadow-sm">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="size-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
            <span className="material-symbols-outlined !text-[28px]">smartphone</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">DistriAccell</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Gestión</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                currentView === item.id
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`material-symbols-outlined !text-[22px] ${currentView === item.id ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
        {/* Gestión de Tiendas - Solo para super-admin */}
        {hasPermission('all') && (
          <button
            onClick={() => onNavigate('stores')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              currentView === 'stores'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined !text-[22px] ${currentView === 'stores' ? 'fill-1' : ''}`}>
              storefront
            </span>
            <span className="text-sm font-semibold">Tiendas</span>
          </button>
        )}

        {/* Corrección de Registros - Solo para super-admin */}
        {hasPermission('all') && (
          <button
            onClick={() => onNavigate('migrate-records')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              currentView === 'migrate-records'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined !text-[22px] ${currentView === 'migrate-records' ? 'fill-1' : ''}`}>
              swap_horiz
            </span>
            <span className="text-sm font-semibold">Corregir Registros</span>
          </button>
        )}

        {/* Gestión de Usuarios - Solo para super-admin */}
        {hasPermission('all') && (
          <button
            onClick={() => onNavigate('users')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              currentView === 'users'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined !text-[22px] ${currentView === 'users' ? 'fill-1' : ''}`}>
              manage_accounts
            </span>
            <span className="text-sm font-semibold">Usuarios</span>
          </button>
        )}

        {/* Configuración - Solo para super-admin */}
        {hasPermission('all') && (
          <button
            onClick={() => onNavigate('config')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              currentView === 'config'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined !text-[22px] ${currentView === 'config' ? 'fill-1' : ''}`}>
              settings
            </span>
            <span className="text-sm font-semibold">Configuración</span>
          </button>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-all"
        >
          <span className="material-symbols-outlined !text-[22px]">logout</span>
          <span className="text-sm font-semibold">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
