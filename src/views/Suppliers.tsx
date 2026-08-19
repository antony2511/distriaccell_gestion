import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Supplier, SupplierInvoice, SupplierTransaction, PaymentMethod } from '../types';
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  registerPayment,
  getSupplierTransactions,
  getSupplierInvoices,
  createSupplierInvoice,
  deleteSupplierInvoice,
  calculateDaysSinceLastPayment,
  getPaymentStatusColor,
  isInvoiceOverdue
} from '../services/suppliers.service';
import { formatCurrency } from '../utils/currency';

const todayId = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const INVOICE_STATUS_LABEL: Record<SupplierInvoice['status'], string> = {
  pending: 'Pendiente',
  partial: 'Abono parcial',
  paid: 'Pagada'
};

const invoiceStatusClasses = (invoice: SupplierInvoice) => {
  if (invoice.status === 'paid') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (isInvoiceOverdue(invoice)) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  if (invoice.status === 'partial') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
};

const Suppliers: React.FC = () => {
  const { hasPermission, user, activeStores } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Formulario simplificado de proveedor
  const [formData, setFormData] = useState({
    name: ''
  });

  // Formulario de nueva factura
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    concept: '',
    amount: 0,
    issueDate: todayId(),
    dueDate: '',
    storeId: ''
  });

  // Formulario de pago
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    concept: '',
    paymentMethod: 'efectivo' as PaymentMethod,
    reference: '',
    observations: '',
    storeId: ''
  });

  // Verificar permisos
  if (!hasPermission('manage-suppliers') && !hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            No tienes permisos para gestionar proveedores.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getAllSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      alert('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupplier = async () => {
    try {
      if (!formData.name) {
        alert('Por favor ingresa el nombre del proveedor');
        return;
      }

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, { name: formData.name });
        alert('✅ Proveedor actualizado correctamente');
      } else {
        await createSupplier({ name: formData.name, currentBalance: 0 });
        alert('✅ Proveedor creado correctamente. Ahora puedes agregarle facturas.');
      }

      setShowForm(false);
      resetForm();
      loadSuppliers();
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
      alert('❌ Error al guardar proveedor');
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({ name: supplier.name });
    setShowForm(true);
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el proveedor "${name}"?`)) return;

    try {
      await deleteSupplier(id);
      alert('✅ Proveedor eliminado correctamente');
      loadSuppliers();
    } catch (error) {
      console.error('Error al eliminar proveedor:', error);
      alert('❌ Error al eliminar proveedor');
    }
  };

  const handleOpenPaymentModal = (supplier: Supplier) => {
    setPaymentSupplier(supplier);
    setPaymentData({
      amount: 0,
      concept: `Abono a cuenta - ${supplier.name}`,
      paymentMethod: 'efectivo',
      reference: '',
      observations: '',
      storeId: user?.storeId && user.storeId !== 'ambos' ? user.storeId : (activeStores[0]?.id || '')
    });
    setShowPaymentModal(true);
  };

  const handleRegisterPayment = async () => {
    // Evita el doble registro por doble clic mientras Firestore responde
    if (!paymentSupplier || !user || savingPayment) return;

    try {
      if (paymentData.amount <= 0) {
        alert('El monto debe ser mayor a 0');
        return;
      }

      if (!paymentData.storeId) {
        alert('Debes seleccionar de qué tienda sale el dinero');
        return;
      }

      if (paymentData.amount > paymentSupplier.currentBalance) {
        if (!confirm('El monto es mayor al saldo. ¿Deseas continuar?')) return;
      }

      setSavingPayment(true);
      await registerPayment(
        paymentSupplier.id,
        paymentData.amount,
        paymentData.concept,
        paymentData.storeId,
        paymentData.paymentMethod,
        user.id,
        user.name,
        paymentData.reference,
        paymentData.observations
      );

      alert('✅ Pago registrado correctamente');
      setShowPaymentModal(false);
      setPaymentSupplier(null);
      await loadSuppliers();
      if (historySupplier?.id === paymentSupplier.id) {
        await refreshHistorySupplierData(paymentSupplier.id);
      }
    } catch (error) {
      console.error('Error al registrar pago:', error);
      alert('❌ Error al registrar pago');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleViewHistory = async (supplier: Supplier) => {
    setHistorySupplier(supplier);
    setShowHistoryModal(true);
    setLoadingTransactions(true);

    try {
      const [transactionsData, invoicesData] = await Promise.all([
        getSupplierTransactions(supplier.id),
        getSupplierInvoices(supplier.id)
      ]);
      setTransactions(transactionsData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      alert('❌ Error al cargar historial de pagos');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const refreshHistorySupplierData = async (supplierId: string) => {
    const [invoicesData, transactionsData] = await Promise.all([
      getSupplierInvoices(supplierId),
      getSupplierTransactions(supplierId)
    ]);
    setInvoices(invoicesData);
    setTransactions(transactionsData);
  };

  const resetForm = () => {
    setFormData({ name: '' });
    setEditingSupplier(null);
  };

  const resetInvoiceForm = () => {
    setInvoiceData({
      invoiceNumber: '',
      concept: '',
      amount: 0,
      issueDate: todayId(),
      dueDate: '',
      storeId: user?.storeId && user.storeId !== 'ambos' ? user.storeId : (activeStores[0]?.id || '')
    });
  };

  const handleOpenInvoiceForm = () => {
    resetInvoiceForm();
    setShowInvoiceForm(true);
  };

  const handleCreateInvoice = async () => {
    if (!historySupplier || !user || savingInvoice) return;

    try {
      if (!invoiceData.concept.trim()) {
        alert('Ingresa el concepto de la factura');
        return;
      }
      if (invoiceData.amount <= 0) {
        alert('El monto debe ser mayor a 0');
        return;
      }
      if (!invoiceData.storeId) {
        alert('Selecciona la tienda donde se registra la factura');
        return;
      }

      setSavingInvoice(true);
      await createSupplierInvoice(
        historySupplier.id,
        {
          invoiceNumber: invoiceData.invoiceNumber.trim() || undefined,
          concept: invoiceData.concept.trim(),
          amount: invoiceData.amount,
          issueDate: new Date(invoiceData.issueDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
          storeId: invoiceData.storeId
        },
        user.id
      );

      alert('✅ Factura registrada correctamente');
      setShowInvoiceForm(false);
      await refreshHistorySupplierData(historySupplier.id);
      await loadSuppliers();
    } catch (error) {
      console.error('Error al registrar factura:', error);
      alert('❌ Error al registrar factura');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoice: SupplierInvoice) => {
    if (!historySupplier) return;
    if (!confirm(`¿Eliminar la factura "${invoice.concept}"?`)) return;

    try {
      await deleteSupplierInvoice(invoice);
      await refreshHistorySupplierData(historySupplier.id);
      await loadSuppliers();
    } catch (error) {
      console.error('Error al eliminar factura:', error);
      alert('❌ No se puede eliminar: esta factura ya tiene abonos registrados');
    }
  };

  const getDaysColor = (days: number) => {
    const status = getPaymentStatusColor(days);
    if (status === 'green') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    if (status === 'orange') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando proveedores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">🏭 Gestión de Proveedores</h2>
            <p className="text-blue-100 text-sm mt-1">Control de deudas y pagos</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors"
          >
            + Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Tabla de proveedores */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left py-4 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Proveedor
                </th>
                <th className="text-right py-4 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Saldo Actual
                </th>
                <th className="text-center py-4 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Fecha Inicio
                </th>
                <th className="text-center py-4 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Días sin Abono
                </th>
                <th className="text-center py-4 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl mb-4 block">
                      inventory_2
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      No hay proveedores registrados
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const daysSincePayment = calculateDaysSinceLastPayment(supplier.lastPaymentDate);

                  return (
                    <tr
                      key={supplier.id}
                      onClick={() => handleViewHistory(supplier)}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{supplier.name}</p>
                        <p className="text-xs text-slate-500 mt-1">Haz clic para ver historial</p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-lg font-black text-red-600">{formatCurrency(supplier.currentBalance)}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {supplier.debtStartDate
                            ? new Date(supplier.debtStartDate).toLocaleDateString('es-CO')
                            : '—'}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-black ${getDaysColor(daysSincePayment)}`}>
                            {daysSincePayment > 999 ? 'Sin pagos' : `${daysSincePayment} días`}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPaymentModal(supplier);
                            }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                            title="Registrar pago"
                          >
                            💵 Pagar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSupplier(supplier);
                            }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-blue-600 text-xl">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSupplier(supplier.id, supplier.name);
                            }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <span className="material-symbols-outlined text-red-600 text-xl">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario Simplificado */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
              <h3 className="text-xl font-black">
                {editingSupplier ? '✏️ Editar Proveedor' : '➕ Nuevo Proveedor'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del proveedor *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Ej: Distribuidora XYZ"
                />
              </div>

              {!editingSupplier && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Después de crear el proveedor podrás agregarle sus facturas (con monto y fecha de inicio cada una) desde su historial.
                </p>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSupplier}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors"
                >
                  {editingSupplier ? 'Actualizar' : 'Crear'} Proveedor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago */}
      {showPaymentModal && paymentSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
              <h3 className="text-xl font-black">💵 Registrar Pago</h3>
              <p className="text-green-100 text-sm mt-1">{paymentSupplier.name}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Info del proveedor */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Saldo actual</p>
                <p className="text-2xl font-black text-red-600">{formatCurrency(paymentSupplier.currentBalance)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Si el proveedor tiene varias facturas pendientes, el pago se aplica automáticamente a la más antigua primero.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monto del pago *
                </label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ¿De qué tienda sale el dinero? *
                </label>
                <select
                  value={paymentData.storeId}
                  onChange={(e) => setPaymentData({ ...paymentData, storeId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Selecciona una tienda</option>
                  {activeStores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Método de pago *
                </label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="banco">Banco</option>
                  <option value="otro">Otro</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {paymentData.paymentMethod === 'efectivo'
                    ? 'El pago en efectivo se descuenta del balance de la tienda seleccionada.'
                    : 'Los pagos por banco/Nequi/transferencia NO descuentan del balance en efectivo.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Concepto
                </label>
                <input
                  type="text"
                  value={paymentData.concept}
                  onChange={(e) => setPaymentData({ ...paymentData, concept: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Referencia/Comprobante
                </label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Opcional"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentSupplier(null);
                  }}
                  className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  disabled={savingPayment}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                >
                  {savingPayment ? 'Registrando...' : 'Registrar Pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Pagos */}
      {showHistoryModal && historySupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
              <h3 className="text-xl font-black">📜 Detalle del Proveedor</h3>
              <p className="text-purple-100 text-sm mt-1">{historySupplier.name}</p>
              <p className="text-purple-100 text-xs mt-1">
                Saldo actual: <span className="font-black">{formatCurrency(historySupplier.currentBalance)}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Facturas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase">🧾 Facturas</h4>
                  <button
                    onClick={handleOpenInvoiceForm}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    + Nueva Factura
                  </button>
                </div>

                {loadingTransactions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    Este proveedor no tiene facturas registradas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-black ${invoiceStatusClasses(invoice)}`}>
                              {isInvoiceOverdue(invoice) ? 'Vencida' : INVOICE_STATUS_LABEL[invoice.status]}
                            </span>
                            {invoice.invoiceNumber && (
                              <span className="text-xs text-slate-500">Factura #{invoice.invoiceNumber}</span>
                            )}
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white mt-1">{invoice.concept}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Inicio: {new Date(invoice.issueDate).toLocaleDateString('es-CO')}
                            {invoice.dueDate && ` · Vence: ${new Date(invoice.dueDate).toLocaleDateString('es-CO')}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900 dark:text-white">
                            {formatCurrency(invoice.balance)}
                          </p>
                          {invoice.balance !== invoice.amount && (
                            <p className="text-xs text-slate-500">de {formatCurrency(invoice.amount)}</p>
                          )}
                          {invoice.balance === invoice.amount && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice)}
                              className="text-xs text-red-600 hover:underline mt-1"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de movimientos */}
              <div>
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase mb-3">
                  Historial de Movimientos
                </h4>
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Cargando historial...</p>
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 text-6xl mb-4 block">
                    receipt_long
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">
                    No hay transacciones registradas
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        transaction.type === 'payment'
                          ? 'bg-green-50 dark:bg-green-900/10 border-green-500'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-black ${
                              transaction.type === 'payment'
                                ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200'
                                : 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {transaction.type === 'payment' ? '💵 PAGO' : '🛒 COMPRA'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(transaction.date).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">{transaction.concept}</p>
                          {transaction.paymentMethod && (
                            <p className="text-xs text-slate-500 mt-1">Método: {transaction.paymentMethod}</p>
                          )}
                          {transaction.reference && (
                            <p className="text-xs text-slate-500">Ref: {transaction.reference}</p>
                          )}
                          {transaction.observations && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                              {transaction.observations}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className={`text-xl font-black ${
                            transaction.type === 'payment'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {transaction.type === 'payment' ? '-' : '+'}{formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 p-4">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistorySupplier(null);
                  setTransactions([]);
                  setInvoices([]);
                }}
                className="w-full px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Factura */}
      {showInvoiceForm && historySupplier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
              <h3 className="text-xl font-black">🧾 Nueva Factura</h3>
              <p className="text-blue-100 text-sm mt-1">{historySupplier.name}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Número de factura
                </label>
                <input
                  type="text"
                  value={invoiceData.invoiceNumber}
                  onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Concepto *
                </label>
                <input
                  type="text"
                  value={invoiceData.concept}
                  onChange={(e) => setInvoiceData({ ...invoiceData, concept: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder="Ej: Compra de repuestos"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monto *
                </label>
                <input
                  type="number"
                  value={invoiceData.amount}
                  onChange={(e) => setInvoiceData({ ...invoiceData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha de inicio *
                  </label>
                  <input
                    type="date"
                    value={invoiceData.issueDate}
                    onChange={(e) => setInvoiceData({ ...invoiceData, issueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha de vencimiento
                  </label>
                  <input
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tienda *
                </label>
                <select
                  value={invoiceData.storeId}
                  onChange={(e) => setInvoiceData({ ...invoiceData, storeId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Selecciona una tienda</option>
                  {activeStores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowInvoiceForm(false)}
                  className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={savingInvoice}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                >
                  {savingInvoice ? 'Guardando...' : 'Guardar Factura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
