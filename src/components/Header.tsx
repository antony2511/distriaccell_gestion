
import React, { useEffect, useState } from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface HeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentView: View;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleDarkMode, currentView, onMenuClick }) => {
  const { user } = useAuth();
  const [storeName, setStoreName] = useState<string>('');

  useEffect(() => {
    const fetchStoreName = async () => {
      if (user?.storeId) {
        try {
          const storeDoc = await getDoc(doc(db, 'stores', user.storeId));
          if (storeDoc.exists()) {
            setStoreName(storeDoc.data().name);
          }
        } catch (error) {
          console.error('Error al cargar tienda:', error);
        }
      }
    };

    fetchStoreName();
  }, [user?.storeId]);

  const getTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Resumen General';
      case 'income': return 'Registro de Ingresos';
      case 'expenses': return 'Gastos y Balance';
      case 'employees': return 'Gestión de Empleados';
      case 'users': return 'Gestión de Usuarios';
      case 'suppliers': return 'Gestión de Proveedores';
      case 'reports': return 'Reportes y Análisis';
      case 'config': return 'Configuración';
      default: return 'Panel de Control';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'super-admin': return 'Gerente General';
      case 'cajero': return 'Cajero';
      case 'tecnico': return 'Técnico';
      default: return role;
    }
  };

  return (
    <header className="h-16 bg-white/80 dark:bg-[#1a1a2e]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40 transition-colors">
      <div className="flex items-center gap-3">
        {/* Botón hamburguesa - Solo móvil */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <span className="material-symbols-outlined !text-[24px]">menu</span>
        </button>

        {/* Título */}
        <h2 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white truncate">
          {getTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Buscador - Solo desktop */}
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 w-64 border border-transparent focus-within:border-orange-500/50 transition-all">
          <span className="material-symbols-outlined text-slate-400 !text-[20px]">search</span>
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent border-none text-xs focus:ring-0 w-full ml-2 p-0 h-5 dark:text-white"
          />
        </div>

        {/* Botón búsqueda móvil */}
        <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <span className="material-symbols-outlined !text-[22px]">search</span>
        </button>

        {/* Botón dark mode */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <span className="material-symbols-outlined !text-[22px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* User info */}
        <div className="flex items-center gap-2 lg:gap-3 ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none truncate max-w-[150px]">
              {user?.name || 'Usuario'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]">
              {user?.role === 'super-admin' ? 'Todas las tiendas' : storeName || 'Cargando...'}
            </p>
          </div>
          <div className="size-9 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm border border-white dark:border-slate-800 shadow-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
