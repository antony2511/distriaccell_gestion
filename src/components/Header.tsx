
import React, { useEffect, useState } from 'react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface HeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentView: View;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleDarkMode, currentView }) => {
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
      case 'reports': return 'Reportes y Análisis';
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
    <header className="h-16 bg-white/80 dark:bg-[#1a1a2e]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40 transition-colors">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{getTitle()}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 w-64 border border-transparent focus-within:border-orange-500/50 transition-all">
          <span className="material-symbols-outlined text-slate-400 !text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="bg-transparent border-none text-xs focus:ring-0 w-full ml-2 p-0 h-5 dark:text-white"
          />
        </div>

        <button 
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <span className="material-symbols-outlined !text-[22px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <div className="flex items-center gap-3 ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none">{user?.name || 'Usuario'}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {user?.role === 'super-admin' ? 'Todas las tiendas' : storeName || 'Cargando...'}
            </p>
          </div>
          <div className="size-9 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm border border-white dark:border-slate-800 shadow-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
