import React, { useEffect } from 'react';
import { useDailyRegister } from '../contexts/DailyRegisterContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateShort, formatDateId } from '../utils/dates';
import { STORES } from '../constants/categories';
import { calculateNotebookTotal, calculateServicesTotal, calculateGrossIncome } from '../utils/calculations';
import { getDailyRegistersByRange } from '../services/dailyRegister.service';

// Components
import SystemSalesInput from '../components/DailyRegister/SystemSalesInput';
import NotebookSales from '../components/DailyRegister/NotebookSales';
import TechnicalServices from '../components/DailyRegister/TechnicalServices';
import QRPaymentsInput from '../components/DailyRegister/QRPaymentsInput';
import ExpenseForm from '../components/DailyRegister/ExpenseForm';
import SavingsInput from '../components/DailyRegister/SavingsInput';
import AutomaticBalance from '../components/DailyRegister/AutomaticBalance';

const DailyRegister: React.FC = () => {
  const { user } = useAuth();
  const {
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
    addTechnicalService,
    removeTechnicalService,
    addExpense,
    removeExpense,
    expectedCash,
    cashReceived,
    totalOutflows,
    saveRegister,
    closeDay
  } = useDailyRegister();

  const [actualCash, setActualCash] = React.useState(currentRegister.actualCash || 0);
  const [justification, setJustification] = React.useState(currentRegister.differenceJustification || '');
  const [isClosing, setIsClosing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [last7DaysSavings, setLast7DaysSavings] = React.useState<number[]>([]);

  // Cargar últimos 7 días de ahorros
  useEffect(() => {
    const loadLast7DaysSavings = async () => {
      try {
        const today = new Date(selectedDate);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6); // 7 días incluyendo hoy

        const registers = await getDailyRegistersByRange(
          formatDateId(startDate),
          formatDateId(today),
          selectedStore
        );

        // Crear array de 7 días con los ahorros
        const savingsArray: number[] = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          const dateId = formatDateId(date);
          const register = registers.find(r => r.date === dateId);
          savingsArray.push(register?.dailySavings || 0);
        }

        setLast7DaysSavings(savingsArray);
      } catch (error) {
        console.error('Error al cargar últimos 7 días de ahorros:', error);
      }
    };

    loadLast7DaysSavings();
  }, [selectedDate, selectedStore]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveRegister();
      alert('✅ Registro guardado correctamente');
    } catch (error) {
      alert('❌ Error al guardar: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDay = async () => {
    if (!confirm('Una vez cerrado no podrás modificar este día. ¿Continuar?')) {
      return;
    }

    setIsClosing(true);
    try {
      // Primero guardar los datos actuales
      await saveRegister();
      // Luego cerrar el día
      await closeDay(actualCash, justification);
      alert('✅ Día cerrado correctamente');
    } catch (error) {
      alert('❌ Error al cerrar el día: ' + error);
    } finally {
      setIsClosing(false);
    }
  };

  const notebookSalesTotal = calculateNotebookTotal(currentRegister.notebookSales || []);
  const servicesTotal = calculateServicesTotal(currentRegister.technicalServices || []);
  const expensesTotal = currentRegister.expenses?.reduce((acc, e) => acc + e.amount, 0) || 0;
  const grossIncome = calculateGrossIncome(currentRegister);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando registro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-2">📝 Registro Diario</h1>
            <p className="text-orange-100 text-sm">
              Registra todas las transacciones del día. Este es el único punto de entrada de datos del sistema.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Date selector */}
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined">calendar_today</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-white font-bold focus:outline-none"
              />
            </div>

            {/* Store selector */}
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined">store</span>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value as any)}
                className="bg-transparent border-none text-white font-bold focus:outline-none"
              >
                {STORES.map(store => (
                  <option key={store.id} value={store.id} className="text-slate-900">
                    {store.label}
                  </option>
                ))}
              </select>
            </div>

            {/* User info */}
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined">person</span>
              <span className="font-bold text-sm">{user?.name}</span>
            </div>

            {/* Live clock */}
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined">schedule</span>
              <span className="font-bold text-sm">
                {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Day status */}
        {currentRegister.isClosed && (
          <div className="mt-4 bg-green-500/30 backdrop-blur-sm border-2 border-green-300 rounded-xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined">lock</span>
            <span className="font-bold text-sm">Este día ya está cerrado y no puede modificarse</span>
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Ingresos y Gastos */}
        <div className="lg:col-span-2 space-y-8">
          {/* SECCIÓN A: INGRESOS */}
          <div>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600 text-3xl">trending_up</span>
              INGRESOS
            </h2>

            <div className="space-y-6">
              <SystemSalesInput
                value={currentRegister.systemSales || 0}
                onChange={setSystemSales}
                disabled={currentRegister.isClosed}
              />

              <NotebookSales
                sales={currentRegister.notebookSales || []}
                onAddSale={addNotebookSale}
                onRemoveSale={removeNotebookSale}
                disabled={currentRegister.isClosed}
              />

              <TechnicalServices
                services={currentRegister.technicalServices || []}
                onAddService={addTechnicalService}
                onRemoveService={removeTechnicalService}
                disabled={currentRegister.isClosed}
              />

              <QRPaymentsInput
                value={currentRegister.qrPayments || 0}
                onChange={setQrPayments}
                disabled={currentRegister.isClosed}
              />
            </div>
          </div>

          {/* SECCIÓN B: GASTOS */}
          <div>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-3xl">trending_down</span>
              GASTOS
            </h2>

            <div className="space-y-6">
              <ExpenseForm
                expenses={currentRegister.expenses || []}
                onAddExpense={addExpense}
                onRemoveExpense={removeExpense}
                disabled={currentRegister.isClosed}
              />

              <SavingsInput
                value={currentRegister.dailySavings || 0}
                onChange={setDailySavings}
                disabled={currentRegister.isClosed}
                last7DaysSavings={last7DaysSavings}
              />
            </div>
          </div>
        </div>

        {/* Right column - Balance */}
        <div className="lg:col-span-1">
          <AutomaticBalance
            systemSales={currentRegister.systemSales || 0}
            notebookSalesTotal={notebookSalesTotal}
            servicesTotal={servicesTotal}
            qrPayments={currentRegister.qrPayments || 0}
            expensesTotal={expensesTotal}
            dailySavings={currentRegister.dailySavings || 0}
            grossIncome={grossIncome}
            cashReceived={cashReceived}
            totalOutflows={totalOutflows}
            expectedCash={expectedCash}
            actualCash={actualCash}
            onActualCashChange={setActualCash}
            difference={actualCash - expectedCash}
            justification={justification}
            onJustificationChange={setJustification}
            onSave={handleSave}
            onCloseDay={handleCloseDay}
            isClosed={currentRegister.isClosed || false}
            isLoading={isClosing}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
};

export default DailyRegister;
