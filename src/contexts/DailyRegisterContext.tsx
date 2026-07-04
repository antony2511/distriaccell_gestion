import React, { createContext, useContext, useState, useEffect } from 'react';
import { DailyRegister, Sale, TechnicalService, QRPayment, Expense } from '../types';
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
  selectedStore: string;

  // Setters
  setSelectedDate: (date: string) => void;
  setSelectedStore: (store: string) => void;
  setSystemSales: (amount: number) => void;
  setDailySavings: (amount: number) => void;

  // Ventas del cuaderno
  addNotebookSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void;
  removeNotebookSale: (id: string) => void;
  updateNotebookSale: (id: string, sale: Partial<Sale>) => void;

  // Servicios técnicos
  addTechnicalService: (service: Omit<TechnicalService, 'id' | 'timestamp'>) => void;
  removeTechnicalService: (id: string) => void;

  // Pagos por QR/Transferencia
  addQRPayment: (payment: Omit<QRPayment, 'id' | 'timestamp'>) => void;
  removeQRPayment: (id: string) => void;

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
  loadRegister: (date: string, store: string) => Promise<void>;
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
  const { user, activeStores } = useAuth();
  const [currentRegister, setCurrentRegister] = useState<Partial<DailyRegister>>({
    systemSales: 0,
    notebookSales: [],
    technicalServices: [],
    qrPayments: [],
    expenses: [],
    dailySavings: 0,
    expectedCash: 0,
    actualCash: 0,
    difference: 0,
    isClosed: false
  });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayId());
  const [selectedStore, setSelectedStore] = useState<string>('');

  // Actualizar selectedStore cuando cambia el usuario o las tiendas disponibles
  useEffect(() => {
    if (!user) return;
    if (user.storeId !== 'ambos' && user.storeId !== 'todos') {
      setSelectedStore(user.storeId);
    } else if (activeStores.length > 0) {
      setSelectedStore(prev => {
        const validStore = activeStores.find(s => s.id === prev);
        return validStore ? prev : activeStores[0].id;
      });
    }
  }, [user, activeStores]);

  // Cargar registro al cambiar fecha o almacén
  useEffect(() => {
    if (user && selectedStore) {
      loadRegister(selectedDate, selectedStore);
    }
  }, [selectedDate, selectedStore, user]);

  const loadRegister = async (date: string, store: string) => {
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
          qrPayments: [],
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

  const addQRPayment = (payment: Omit<QRPayment, 'id' | 'timestamp'>) => {
    const newPayment: QRPayment = {
      ...payment,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setCurrentRegister(prev => ({
      ...prev,
      qrPayments: [...(prev.qrPayments || []), newPayment]
    }));
  };

  const removeQRPayment = (id: string) => {
    setCurrentRegister(prev => ({
      ...prev,
      qrPayments: (prev.qrPayments || []).filter(p => p.id !== id)
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
    setDailySavings,
    addNotebookSale,
    removeNotebookSale,
    updateNotebookSale,
    addTechnicalService,
    removeTechnicalService,
    addQRPayment,
    removeQRPayment,
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
