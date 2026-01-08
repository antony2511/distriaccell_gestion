import React, { createContext, useContext, useState, useEffect } from 'react';
import { DailyRegister, Sale, TechnicalService, Expense, StoreId } from '../types';
import { useAuth } from './AuthContext';
import { getTodayId } from '../utils/dates';
import {
  calculateExpectedCash,
  calculateDifference,
  calculateCashReceived,
  calculateTotalOutflows
} from '../utils/calculations';
import {
  getDailyRegister,
  saveDailyRegister,
  closeDailyRegister as closeRegisterService
} from '../services/dailyRegister.service';

interface DailyRegisterContextType {
  currentRegister: Partial<DailyRegister>;
  loading: boolean;
  selectedDate: string;
  selectedStore: StoreId;

  // Setters
  setSelectedDate: (date: string) => void;
  setSelectedStore: (store: StoreId) => void;
  setSystemSales: (amount: number) => void;
  setQrPayments: (amount: number) => void;
  setDailySavings: (amount: number) => void;

  // Ventas del cuaderno
  addNotebookSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  removeNotebookSale: (id: string) => void;
  updateNotebookSale: (id: string, sale: Partial<Sale>) => void;

  // Servicios técnicos
  addTechnicalService: (service: Omit<TechnicalService, 'id' | 'timestamp'>) => void;
  removeTechnicalService: (id: string) => void;

  // Gastos
  addExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void;
  removeExpense: (id: string) => void;

  // Cálculos
  expectedCash: number;
  cashReceived: number;
  totalOutflows: number;

  // Acciones
  saveRegister: () => Promise<void>;
  closeDay: (actualCash: number, justification?: string) => Promise<void>;
  loadRegister: (date: string, store: StoreId) => Promise<void>;
}

const DailyRegisterContext = createContext<DailyRegisterContextType | undefined>(undefined);

export const useDailyRegister = () => {
  const context = useContext(DailyRegisterContext);
  if (!context) {
    throw new Error('useDailyRegister debe usarse dentro de DailyRegisterProvider');
  }
  return context;
};

export const DailyRegisterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentRegister, setCurrentRegister] = useState<Partial<DailyRegister>>({
    systemSales: 0,
    notebookSales: [],
    technicalServices: [],
    qrPayments: 0,
    expenses: [],
    dailySavings: 0,
    expectedCash: 0,
    actualCash: 0,
    difference: 0,
    isClosed: false
  });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayId());
  const [selectedStore, setSelectedStore] = useState<StoreId>('almacen-1');

  // Actualizar selectedStore cuando cambia el usuario
  useEffect(() => {
    if (user && user.storeId !== 'ambos') {
      // Si el usuario tiene un almacén específico, seleccionarlo automáticamente
      console.log('🏪 Actualizando almacén seleccionado a:', user.storeId, 'para usuario:', user.name);
      setSelectedStore(user.storeId as StoreId);
    }
  }, [user]);

  // Cargar registro al cambiar fecha o almacén
  useEffect(() => {
    if (user) {
      loadRegister(selectedDate, selectedStore);
    }
  }, [selectedDate, selectedStore, user]);

  const loadRegister = async (date: string, store: StoreId) => {
    setLoading(true);
    try {
      const register = await getDailyRegister(date, store);
      if (register) {
        setCurrentRegister(register);
      } else {
        // Crear nuevo registro vacío
        setCurrentRegister({
          date,
          storeId: store,
          registeredBy: user?.id || '',
          registeredByName: user?.name || '',
          systemSales: 0,
          notebookSales: [],
          technicalServices: [],
          qrPayments: 0,
          expenses: [],
          dailySavings: 0,
          expectedCash: 0,
          actualCash: 0,
          difference: 0,
          isClosed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error al cargar registro:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cálculos automáticos
  const expectedCash = calculateExpectedCash(currentRegister);
  const cashReceived = calculateCashReceived(currentRegister);
  const totalOutflows = calculateTotalOutflows(currentRegister);

  // Actualizar expectedCash cuando cambien los valores
  useEffect(() => {
    setCurrentRegister(prev => ({
      ...prev,
      expectedCash,
      difference: calculateDifference(prev.actualCash || 0, expectedCash)
    }));
  }, [expectedCash]);

  const setSystemSales = (amount: number) => {
    setCurrentRegister(prev => ({ ...prev, systemSales: amount }));
  };

  const setQrPayments = (amount: number) => {
    setCurrentRegister(prev => ({ ...prev, qrPayments: amount }));
  };

  const setDailySavings = (amount: number) => {
    setCurrentRegister(prev => ({ ...prev, dailySavings: amount }));
  };

  const addNotebookSale = (sale: Omit<Sale, 'id' | 'timestamp'>) => {
    const newSale: Sale = {
      ...sale,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setCurrentRegister(prev => ({
      ...prev,
      notebookSales: [...(prev.notebookSales || []), newSale]
    }));
  };

  const removeNotebookSale = (id: string) => {
    setCurrentRegister(prev => ({
      ...prev,
      notebookSales: (prev.notebookSales || []).filter(s => s.id !== id)
    }));
  };

  const updateNotebookSale = (id: string, sale: Partial<Sale>) => {
    setCurrentRegister(prev => ({
      ...prev,
      notebookSales: (prev.notebookSales || []).map(s =>
        s.id === id ? { ...s, ...sale } : s
      )
    }));
  };

  const addTechnicalService = (service: Omit<TechnicalService, 'id' | 'timestamp'>) => {
    const newService: TechnicalService = {
      ...service,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setCurrentRegister(prev => ({
      ...prev,
      technicalServices: [...(prev.technicalServices || []), newService]
    }));
  };

  const removeTechnicalService = (id: string) => {
    setCurrentRegister(prev => ({
      ...prev,
      technicalServices: (prev.technicalServices || []).filter(s => s.id !== id)
    }));
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'timestamp'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setCurrentRegister(prev => ({
      ...prev,
      expenses: [...(prev.expenses || []), newExpense]
    }));
  };

  const removeExpense = (id: string) => {
    setCurrentRegister(prev => ({
      ...prev,
      expenses: (prev.expenses || []).filter(e => e.id !== id)
    }));
  };

  const saveRegister = async () => {
    try {
      await saveDailyRegister({
        ...currentRegister,
        date: selectedDate,
        storeId: selectedStore,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error al guardar registro:', error);
      throw error;
    }
  };

  const closeDay = async (actualCash: number, justification?: string) => {
    try {
      await closeRegisterService(
        selectedDate,
        selectedStore,
        actualCash,
        justification,
        user?.id || ''
      );
      await loadRegister(selectedDate, selectedStore);
    } catch (error) {
      console.error('Error al cerrar día:', error);
      throw error;
    }
  };

  const value: DailyRegisterContextType = {
    currentRegister,
    loading,
    selectedDate,
    selectedStore,
    setSelectedDate,
    setSelectedStore,
    setSystemSales,
    setQrPayments,
    setDailySavings,
    addNotebookSale,
    removeNotebookSale,
    updateNotebookSale,
    addTechnicalService,
    removeTechnicalService,
    addExpense,
    removeExpense,
    expectedCash,
    cashReceived,
    totalOutflows,
    saveRegister,
    closeDay,
    loadRegister
  };

  return (
    <DailyRegisterContext.Provider value={value}>
      {children}
    </DailyRegisterContext.Provider>
  );
};
