
import React, { useState } from 'react';
import { View } from './types';
import { useAuth } from './contexts/AuthContext';
import { useApp } from './contexts/AppContext';

// Views
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import DailyRegister from './views/DailyRegister';
import IncomeRegistration from './views/IncomeRegistration';
import ExpensesBalance from './views/ExpensesBalance';
import EmployeeManagement from './views/EmployeeManagement';
import Reports from './views/Reports';
import Settings from './views/Settings';
import Suppliers from './views/Suppliers';
import UserManagement from './views/UserManagement';
import StoreManagement from './views/StoreManagement';
import SetupAdmin from './views/SetupAdmin';
import InitializeDB from './views/InitializeDB';
import GeneralBalance from './views/GeneralBalance';
import MigrateRecords from './views/MigrateRecords';
import ExecutiveReport from './views/ExecutiveReport';

// Components
import Sidebar from './components/Sidebar';
import MobileSidebar from './components/MobileSidebar';
import Header from './components/Header';

const App: React.FC = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const { isDarkMode, toggleDarkMode, isOnline } = useApp();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Rutas especiales de administración
  const isSetupMode = window.location.search.includes('setup');
  const isInitDBMode = window.location.search.includes('initdb');

  const handleLogout = async () => {
    await logout();
  };

  // Modo setup para crear el primer usuario
  if (isSetupMode) {
    return <SetupAdmin />;
  }

  // Modo inicialización de base de datos
  if (isInitDBMode) {
    return <InitializeDB />;
  }

  // Mostrar loading mientras se verifica autenticación
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, mostrar login
  if (!user) {
    return <Login />;
  }

  // Renderizar vista actual
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'income':
        return <DailyRegister />;
      case 'expenses':
        return <ExpensesBalance />;
      case 'employees':
        return <EmployeeManagement />;
      case 'suppliers':
        return <Suppliers />;
      case 'users':
        return <UserManagement />;
      case 'stores':
        return <StoreManagement />;
      case 'reports':
        return <Reports />;
      case 'executive-report':
        return <ExecutiveReport />;
      case 'config':
        return <Settings />;
      case 'general-balance':
        return <GeneralBalance />;
      case 'migrate-records':
        return <MigrateRecords />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Indicador de conexión */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm font-medium z-50">
          ⚠️ Sin conexión - Trabajando offline
        </div>
      )}

      {/* Desktop Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <div className={`flex flex-col flex-1 overflow-hidden ${!isOnline ? 'mt-10' : ''}`}>
        <Header
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          currentView={currentView}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
