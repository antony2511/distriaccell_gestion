import React, { useEffect } from 'react';
import { useDailyRegister } from '../contexts/DailyRegisterContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateShort, formatDateId } from '../utils/dates';
import { calculateNotebookTotal, calculateServicesTotal, calculateQRTotal, calculateGrossIncome, calculateCreditSoldTotal, calculateCreditProfitTotal, calculateCreditNotInCashTotal, calculateCreditDownPaymentTotal } from '../utils/calculations';
import { getDailyRegistersByRange, reopenSundayRegister, sendDayReport } from '../services/dailyRegister.service';
import { isSundayDoubleShiftDay, SUNDAY_SINGLE_REPORT_FROM, isShift2Open } from '../utils/sundayShifts';

// Components
import SystemSalesInput from '../components/DailyRegister/SystemSalesInput';
import NotebookSales from '../components/DailyRegister/NotebookSales';
import TechnicalServices from '../components/DailyRegister/TechnicalServices';
import QRPaymentsInput from '../components/DailyRegister/QRPaymentsInput';
import CreditSalesInput from '../components/DailyRegister/CreditSalesInput';
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
    updateNotebookSale,
    addTechnicalService,
    removeTechnicalService,
    addQRPayment,
    removeQRPayment,
    addCreditSale,
    removeCreditSale,
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

  // Domingos en accell (almacen-2): la caja se cierra dos veces (mañana y tarde). Cada cierre es
  // independiente, pero el reporte por correo es UNO, al terminar el día.
  const isSundayShiftDay = isSundayDoubleShiftDay(selectedDate, selectedStore);
  const canStartSecondShift =
    currentRegister.isClosed &&
    isSundayShiftDay &&
    !currentRegister.shift1ClosedAt;
  // Cierre de la mañana hecho y sin turno 2: el reporte del día queda pendiente hasta que se envíe
  const canSendDayReport =
    canStartSecondShift &&
    !currentRegister.reportSentAt &&
    selectedDate >= SUNDAY_SINGLE_REPORT_FROM;
  // Turno 2 en curso: la pantalla trabaja SOLO con la tarde (empieza de cero), así que el esperado
  // y todos los totales que ve el cajero ya son de la tarde.
  const isSecondShiftOpen = isShift2Open(currentRegister);

  const [isReopening, setIsReopening] = React.useState(false);

  const handleStartSecondShift = async () => {
    if (!confirm('Se iniciará el turno de la tarde.\nEl turno 1 queda guardado tal cual. El turno 2 empieza de cero (POS, cuaderno, servicios, QR, crédito y gastos) y tiene su propio arqueo.\nEl reporte por correo se enviará una sola vez, al cerrar el turno 2, con la suma de ambos turnos. ¿Continuar?')) {
      return;
    }
    setIsReopening(true);
    try {
      await reopenSundayRegister(selectedDate, selectedStore, user?.name || '');
      await loadRegister(selectedDate, selectedStore);
      // El conteo y la justificación del turno 2 empiezan en blanco (no heredan los del turno 1)
      setActualCash(0);
      setJustification('');
      alert('✅ Registro reabierto para el segundo turno');
    } catch (error) {
      alert('❌ Error al reabrir: ' + error);
    } finally {
      setIsReopening(false);
    }
  };

  const [isSendingReport, setIsSendingReport] = React.useState(false);

  // Domingo sin turno 2: envía ya el reporte del día (el cierre de la mañana no lo envía)
  const handleSendDayReport = async () => {
    if (!confirm('Se enviará por correo el reporte de hoy (un solo reporte del día). ¿Continuar?')) {
      return;
    }
    setIsSendingReport(true);
    try {
      const sent = await sendDayReport(selectedDate, selectedStore);
      await loadRegister(selectedDate, selectedStore);
      alert(sent ? '✅ Reporte enviado por correo' : '⚠️ No se pudo enviar el reporte (revisa Configuración → Notificaciones)');
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleCloseDay = async () => {
    const closeMessage = isSundayShiftDay && !currentRegister.shift1ClosedAt
      ? 'Se cerrará el turno de la mañana con su propio arqueo.\nEl reporte por correo se envía una sola vez al final del día: al cerrar el turno 2, o con "Enviar reporte del día" si hoy no hay turno 2. ¿Continuar?'
      : 'Una vez cerrado no podrás modificar este día. ¿Continuar?';
    if (!confirm(closeMessage)) {
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
  const creditSoldTotal = calculateCreditSoldTotal(currentRegister.creditSales || []);
  const creditProfitTotal = calculateCreditProfitTotal(currentRegister.creditSales || []);
  const creditNotInCashTotal = calculateCreditNotInCashTotal(currentRegister.creditSales || []);
  const creditDownPaymentTotal = calculateCreditDownPaymentTotal(currentRegister.creditSales || []);
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
                  ? 'Domingo cerrado — turnos de mañana y tarde cerrados; se envió un solo reporte del día'
                  : canSendDayReport
                    ? 'Turno de la mañana cerrado — el reporte del día se envía al cerrar el turno 2'
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
            {canSendDayReport && (
              <button
                onClick={handleSendDayReport}
                disabled={isSendingReport}
                className="bg-white/90 text-slate-700 font-black text-sm px-4 py-2 rounded-lg hover:bg-white transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                <span className="material-symbols-outlined !text-[18px]">mail</span>
                {isSendingReport ? 'Enviando…' : 'Enviar reporte del día (sin 2° turno)'}
              </button>
            )}
          </div>
        )}
        {!currentRegister.isClosed && currentRegister.shift1ClosedAt && (
          <div className="mt-4 bg-amber-500/30 backdrop-blur-sm border-2 border-amber-300 rounded-xl p-3 flex items-center gap-2">
            <span className="material-symbols-outlined">sync_alt</span>
            <span className="font-bold text-sm">
              Turno 2 en curso — el turno 1 cerró con {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(currentRegister.shift1ActualCash || 0)} contados.
              El turno 2 empieza de cero (POS, cuaderno, servicios, QR, crédito y gastos) y su arqueo es independiente. Al cerrarlo se envía un solo reporte del día con la suma de ambos turnos.
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
                secondShift={isSecondShiftOpen}
              />

              <NotebookSales
                sales={currentRegister.notebookSales || []}
                onAddSale={addNotebookSale}
                onRemoveSale={removeNotebookSale}
                onUpdateSale={updateNotebookSale}
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

              <CreditSalesInput
                creditSales={currentRegister.creditSales || []}
                onAddCreditSale={addCreditSale}
                onRemoveCreditSale={removeCreditSale}
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
            creditSoldTotal={creditSoldTotal}
            creditProfitTotal={creditProfitTotal}
            creditNotInCashTotal={creditNotInCashTotal}
            creditDownPaymentTotal={creditDownPaymentTotal}
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
