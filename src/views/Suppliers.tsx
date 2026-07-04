import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Supplier, SupplierTransaction, PaymentMethod } from '../types';
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  registerPayment,
  getSupplierTransactions,
  calculateDaysSinceLastPayment,
  getPaymentStatusColor
} from '../services/suppliers.service';
import { formatCurrency } from '../utils/currency';

const Suppliers: React.FC = () => {
  const { hasPermission, user, activeStores } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Formulario simplificado de proveedor
  const [formData, setFormData] = useState({
    name: '',
    currentBalance: 0,
    debtStartDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
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

      const supplierData = {
        name: formData.name,
        currentBalance: formData.currentBalance,
        debtStartDate: new Date(formData.debtStartDate)
      };

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, supplierData);
        alert('✅ Proveedor actualizado correctamente');
      } else {
        await createSupplier(supplierData);
        alert('✅ Proveedor creado correctamente');
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
    setFormData({
      name: supplier.name,
      currentBalance: supplier.currentBalance,
      debtStartDate: new Date(supplier.debtStartDate).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    });
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
    if (!paymentSupplier || !user) return;

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
      loadSuppliers();
    } catch (error) {
      console.error('Error al registrar pago:', error);
      alert('❌ Error al registrar pago');
    }
  };

  const handleViewHistory = async (supplier: Supplier) => {
    setHistorySupplier(supplier);
    setShowHistoryModal(true);
    setLoadingTransactions(true);

    try {
      const data = await getSupplierTransactions(supplier.id);
      setTransactions(data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      alert('❌ Error al cargar historial de pagos');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      currentBalance: 0,
      debtStartDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    });
    setEditingSupplier(null);
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
                          {new Date(supplier.debtStartDate).toLocaleDateString('es-CO')}
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

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Saldo actual de la deuda *
                </label>
                <input
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, currentBalance: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha de inicio del saldo *
                </label>
                <input
                  type="date"
                  value={formData.debtStartDate}
                  onChange={(e) => setFormData({ ...formData, debtStartDate: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

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
                  <option value="otro">Otro</option>
                </select>
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
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
                >
                  Registrar Pago
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
              <h3 className="text-xl font-black">📜 Historial de Pagos</h3>
              <p className="text-purple-100 text-sm mt-1">{historySupplier.name}</p>
              <p className="text-purple-100 text-xs mt-1">
                Saldo actual: <span className="font-black">{formatCurrency(historySupplier.currentBalance)}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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

            <div className="border-t border-slate-200 dark:border-slate-700 p-4">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistorySupplier(null);
                  setTransactions([]);
                }}
                className="w-full px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
