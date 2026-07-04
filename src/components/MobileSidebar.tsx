import React from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  currentView,
  onNavigate,
  onLogout
}) => {
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

  const menuItems = allMenuItems.filter(item => hasPermission(item.permission));

  const handleNavigate = (view: View) => {
    onNavigate(view);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#1a1a2e] border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out z-50 lg:hidden flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header con botón cerrar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                <span className="material-symbols-outlined !text-[28px]">smartphone</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">DistriAccell</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Gestión</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id as View)}
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

          {/* Admin options */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
            {hasPermission('all') && (
              <button
                onClick={() => handleNavigate('stores')}
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

            {hasPermission('all') && (
              <button
                onClick={() => handleNavigate('migrate-records')}
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

            {hasPermission('all') && (
              <button
                onClick={() => handleNavigate('users')}
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

            {hasPermission('all') && (
              <button
                onClick={() => handleNavigate('config')}
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
          </div>
        </div>

        {/* Logout button */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-all"
          >
            <span className="material-symbols-outlined !text-[22px]">logout</span>
            <span className="text-sm font-semibold">Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default MobileSidebar;
