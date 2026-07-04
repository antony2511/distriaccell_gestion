import React, { useEffect } from 'react';
import { useDailyRegister } from '../contexts/DailyRegisterContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateShort, formatDateId } from '../utils/dates';
import { calculateNotebookTotal, calculateServicesTotal, calculateQRTotal, calculateGrossIncome } from '../utils/calculations';
import { getDailyRegistersByRange, reopenSundayRegister } from '../services/dailyRegister.service';

// Components
import SystemSalesInput from '../components/DailyRegister/SystemSalesInput';
import NotebookSales from '../components/DailyRegister/NotebookSales';
import TechnicalServices from '../components/DailyRegister/TechnicalServices';
import QRPaymentsInput from '../components/DailyRegister/QRPaymentsInput';
import ExpenseForm from '../components/DailyRegister/ExpenseForm';
import SavingsInput from '../components/DailyRegister/SavingsInput';
import AutomaticBalance from '../components/DailyRegister/AutomaticBalance';

const DailyRegister: React.FC = () => {
  const { user, activeStores } = useAuth();
  const {
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

  // Domingos en accell (almacen-2): la caja se cierra al medio día por cambio
  // de turno, así que se permite reabrir para un segundo cierre/reporte.
  const isSunday = new Date(selectedDate + 'T12:00:00').getDay() === 0;
  const canStartSecondShift =
    currentRegister.isClosed &&
    isSunday &&
    selectedStore === 'almacen-2' &&
    !currentRegister.shift1ClosedAt;

  const [isReopening, setIsReopening] = React.useState(false);

  const handleStartSecondShift = async () => {
    if (!confirm('Se reabrirá el registro para el turno de la tarde.\nEl arqueo del turno 1 queda guardado y su reporte ya fue enviado.\nAl cerrar el día se enviará el reporte del cierre final. ¿Continuar?')) {
      return;
    }
    setIsReopening(true);
    try {
      await reopenSundayRegister(selectedDate, selectedStore, user?.name || '');
      await loadRegister(selectedDate, selectedStore);
      alert('✅ Registro reabierto para el segundo turno');
    } catch (error) {
      alert('❌ Error al reabrir: ' + error);
    } finally {
      setIsReopening(false);
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
  const qrPaymentsTotal = calculateQRTotal(currentRegister.qrPayments || []);
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
                {activeStores.map(store => (
                  <option key={store.id} value={store.id} className="text-slate-900">
                    {store.name}
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
                {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
              </span>
            </div>
          </div>
        </div>

        {/* Day status */}
        {currentRegister.isClosed && (
          <div className="mt-4 bg-green-500/30 backdrop-blur-sm border-2 border-green-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="material-symbols-outlined">lock</span>
              <span className="font-bold text-sm">
                {currentRegister.shift1ClosedAt
                  ? 'Domingo cerrado — se enviaron los reportes de ambos turnos'
                  : 'Este día ya está cerrado y no puede modificarse'}
              </span>
            </div>
            {canStartSecondShift && (
              <button
                onClick={handleStartSecondShift}
                disabled={isReopening}
                className="bg-white text-orange-600 font-black text-sm px-4 py-2 rounded-lg hover:bg-orange-50 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                <span className="material-symbols-outlined !text-[18px]">sync_alt</span>
                {isReopening ? 'Reabriendo…' : 'Iniciar 2° turno (domingo)'}
              </button>
            )}
          </div>
        )}
        {!currentRegister.isClosed && currentRegister.shift1ClosedAt && (
          <div className="mt-4 bg-amber-500/30 backdrop-blur-sm border-2 border-amber-300 rounded-xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined">sync_alt</span>
            <span className="font-bold text-sm">
              Turno 2 en curso — el turno 1 cerró con {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(currentRegister.shift1ActualCash || 0)} contados.
              Al cerrar el día se enviará el reporte del cierre final con el total del domingo.
            </span>
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
                payments={currentRegister.qrPayments || []}
                onAddPayment={addQRPayment}
                onRemovePayment={removeQRPayment}
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
            qrPayments={qrPaymentsTotal}
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
