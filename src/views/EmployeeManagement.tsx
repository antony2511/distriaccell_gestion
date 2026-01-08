import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Employee, EmployeePayment, StoreId } from '../types';
import {
  getAllEmployees,
  saveEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  getEmployeePayments,
  saveEmployeePayment,
  markPaymentAsPaid,
  calculateCommissions
} from '../services/employee.service';
import { formatCurrency } from '../utils/currency';
import { STORES } from '../constants/categories';
import { formatDateId } from '../utils/dates';

const EmployeeManagement: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [employeePayments, setEmployeePayments] = useState<EmployeePayment[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Solo super-admin puede acceder a esta vista
  if (!hasPermission('all')) {
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
            No tienes permisos para ver la nómina y gestión de empleados. Solo el gerente puede acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  // Cargar empleados
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este empleado?')) return;

    try {
      await deleteEmployee(id);
      await loadEmployees();
      alert('✅ Empleado eliminado correctamente');
    } catch (error) {
      alert('❌ Error al eliminar empleado: ' + error);
    }
  };

  const handleViewPayments = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setLoading(true);
    setShowPaymentsModal(true);

    try {
      const payments = await getEmployeePayments(employee.id);
      setEmployeePayments(payments);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar empleados
  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando empleados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">👥 Gestión de Empleados</h2>
          <p className="text-sm text-slate-500">Administración de personal, salarios y pagos.</p>
        </div>
        <button
          onClick={() => {
            setSelectedEmployee(null);
            setShowEmployeeForm(true);
          }}
          className="flex items-center justify-center gap-2 bg-orange-600 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined !text-[20px]">person_add</span>
          <span>Nuevo Empleado</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 !text-[20px]">search</span>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                filterStatus === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
              }`}
            >
              Todos ({employees.length})
            </button>
            <button
              onClick={() => setFilterStatus('activo')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                filterStatus === 'activo'
                  ? 'bg-orange-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
              }`}
            >
              Activos ({employees.filter(e => e.status === 'activo').length})
            </button>
            <button
              onClick={() => setFilterStatus('inactivo')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                filterStatus === 'inactivo'
                  ? 'bg-orange-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
              }`}
            >
              Inactivos ({employees.filter(e => e.status === 'inactivo').length})
            </button>
          </div>
        </div>

        {/* Tabla de empleados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Empleado</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Tienda</th>
                <th className="px-6 py-4">Salario Base</th>
                <th className="px-6 py-4">Comisión</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        emp.role === 'tecnico' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        emp.role === 'vendedor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        emp.role === 'cajero' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`size-2 rounded-full ${emp.storeId === 'almacen-1' ? 'bg-orange-500' : 'bg-purple-500'}`} />
                        <span className="text-slate-500">
                          {STORES.find(s => s.id === emp.storeId)?.label || emp.storeId}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(emp.baseSalary)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {emp.commissionType && emp.commissionType !== 'none' ? (
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          {emp.commissionRate}% {emp.commissionType === 'service' ? 'servicios' : 'ventas'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sin comisión</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                        emp.status === 'activo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        emp.status === 'vacaciones' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewPayments(emp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                        title="Ver pagos"
                      >
                        <span className="material-symbols-outlined !text-[20px]">payments</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setShowEmployeeForm(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all ml-1"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined !text-[20px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all ml-1"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined !text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Formulario de Empleado */}
      {showEmployeeForm && (
        <EmployeeFormModal
          employee={selectedEmployee}
          onClose={() => {
            setShowEmployeeForm(false);
            setSelectedEmployee(null);
          }}
          onSave={async () => {
            await loadEmployees();
            setShowEmployeeForm(false);
            setSelectedEmployee(null);
          }}
          userId={user?.id || ''}
        />
      )}

      {/* Modal de Pagos */}
      {showPaymentsModal && selectedEmployee && (
        <PaymentsModal
          employee={selectedEmployee}
          payments={employeePayments}
          onClose={() => {
            setShowPaymentsModal(false);
            setSelectedEmployee(null);
          }}
          onRefresh={async () => {
            if (selectedEmployee) {
              const payments = await getEmployeePayments(selectedEmployee.id);
              setEmployeePayments(payments);
            }
          }}
          userId={user?.id || ''}
        />
      )}
    </div>
  );
};

// Componente de formulario de empleado
const EmployeeFormModal: React.FC<{
  employee: Employee | null;
  onClose: () => void;
  onSave: () => void;
  userId: string;
}> = ({ employee, onClose, onSave, userId }) => {
  const [formData, setFormData] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    role: employee?.role || 'vendedor',
    storeId: employee?.storeId || 'almacen-1',
    status: employee?.status || 'activo',
    baseSalary: employee?.baseSalary || 0,
    commissionType: employee?.commissionType || 'none',
    commissionRate: employee?.commissionRate || 0,
    phone: employee?.phone || '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await saveEmployee({
        id: employee?.id,
        ...formData,
        storeId: formData.storeId as StoreId,
        role: formData.role as any,
        status: formData.status as any,
        commissionType: formData.commissionType as any,
        hireDate: employee?.hireDate || new Date(),
        createdAt: employee?.createdAt || new Date(),
        updatedAt: new Date(),
      });

      alert('✅ Empleado guardado correctamente');
      onSave();
    } catch (error) {
      alert('❌ Error al guardar empleado: ' + error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-[#1a1a2e]">
          <h3 className="text-xl font-black">
            {employee ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Rol *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="vendedor">Vendedor</option>
                <option value="tecnico">Técnico</option>
                <option value="cajero">Cajero</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Tienda *
              </label>
              <select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              >
                {STORES.map(store => (
                  <option key={store.id} value={store.id}>{store.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Salario Base Mensual *
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Estado *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="vacaciones">Vacaciones</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Tipo de Comisión
              </label>
              <select
                value={formData.commissionType}
                onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="none">Sin comisión</option>
                <option value="service">Por servicios</option>
                <option value="sales">Por ventas</option>
              </select>
            </div>

            {formData.commissionType !== 'none' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Tasa de Comisión (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Componente de modal de pagos
const PaymentsModal: React.FC<{
  employee: Employee;
  payments: EmployeePayment[];
  onClose: () => void;
  onRefresh: () => void;
  userId: string;
}> = ({ employee, payments, onClose, onRefresh, userId }) => {
  const [showNewPayment, setShowNewPayment] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-[#1a1a2e]">
          <div>
            <h3 className="text-xl font-black">Historial de Pagos</h3>
            <p className="text-sm text-slate-500">{employee.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Salario Base</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(employee.baseSalary)}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Tipo de Comisión</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {employee.commissionType === 'none' ? 'Sin comisión' :
                   employee.commissionType === 'service' ? 'Servicios' : 'Ventas'}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Tasa</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {employee.commissionRate || 0}%
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewPayment(true)}
              className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700"
            >
              Nuevo Pago
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="material-symbols-outlined !text-[48px] mb-2">receipt_long</span>
              <p>No hay pagos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {payment.period} - {payment.periodType}
                    </p>
                    <p className="text-xs text-slate-500">
                      Base: {formatCurrency(payment.baseSalary)} + Comisiones: {formatCurrency(payment.commissions)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(payment.totalAmount)}
                    </p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                      payment.status === 'pagado'
                        ? 'bg-green-100 text-green-700'
                        : payment.status === 'parcial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showNewPayment && (
          <NewPaymentForm
            employee={employee}
            onClose={() => setShowNewPayment(false)}
            onSave={async () => {
              await onRefresh();
              setShowNewPayment(false);
            }}
            userId={userId}
          />
        )}
      </div>
    </div>
  );
};

// Formulario de nuevo pago
const NewPaymentForm: React.FC<{
  employee: Employee;
  onClose: () => void;
  onSave: () => void;
  userId: string;
}> = ({ employee, onClose, onSave, userId }) => {
  const [formData, setFormData] = useState({
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    periodType: 'mensual' as 'quincenal' | 'mensual',
    baseSalary: employee.baseSalary,
    commissions: 0,
    bonuses: 0,
    deductions: 0,
    observations: '',
  });

  const [calculatingCommissions, setCalculatingCommissions] = useState(false);
  const [commissionBreakdown, setCommissionBreakdown] = useState<{
    servicesCount: number;
    totalServices: number;
    servicesCommission: number;
  } | null>(null);

  const totalAmount = formData.baseSalary + formData.commissions + formData.bonuses - formData.deductions;

  // Calcular comisiones automáticamente para técnicos
  const handleCalculateCommissions = async () => {
    setCalculatingCommissions(true);
    try {
      // Calcular fechas del período
      const [year, month] = formData.period.split('-').map(Number);
      let startDate: string;
      let endDate: string;

      if (formData.periodType === 'mensual') {
        // Todo el mes
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0); // Último día del mes
        startDate = formatDateId(start);
        endDate = formatDateId(end);
      } else {
        // Quincenal - por ahora calculamos todo el mes (se puede mejorar para quincenas específicas)
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        startDate = formatDateId(start);
        endDate = formatDateId(end);
      }

      // Llamar al servicio de cálculo de comisiones
      const result = await calculateCommissions(
        employee.id,
        employee.storeId,
        startDate,
        endDate
      );

      // Actualizar el formulario con las comisiones calculadas
      setFormData({
        ...formData,
        commissions: result.servicesCommission
      });

      // Guardar el desglose para mostrarlo
      setCommissionBreakdown({
        servicesCount: result.servicesCount,
        totalServices: result.totalServices,
        servicesCommission: result.servicesCommission
      });

      alert(`✅ Comisiones calculadas: ${result.servicesCount} servicios realizados`);
    } catch (error) {
      console.error('Error al calcular comisiones:', error);
      alert('❌ Error al calcular comisiones: ' + error);
    } finally {
      setCalculatingCommissions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await saveEmployeePayment({
        employeeId: employee.id,
        employeeName: employee.name,
        storeId: employee.storeId,
        ...formData,
        totalAmount,
        status: 'pendiente',
        amountPaid: 0,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      alert('✅ Pago registrado correctamente');
      onSave();
    } catch (error) {
      alert('❌ Error al registrar pago: ' + error);
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50 dark:bg-slate-900/50">
      <h4 className="font-bold mb-4">Registrar Nuevo Pago</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Período (Mes) *
            </label>
            <input
              type="month"
              required
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Tipo de Período *
            </label>
            <select
              value={formData.periodType}
              onChange={(e) => setFormData({ ...formData, periodType: e.target.value as any })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Salario Base
            </label>
            <input
              type="number"
              value={formData.baseSalary}
              onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Comisiones
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={formData.commissions}
                onChange={(e) => setFormData({ ...formData, commissions: parseFloat(e.target.value) })}
                className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              />
              {employee.role === 'tecnico' && employee.commissionType === 'service' && (
                <button
                  type="button"
                  onClick={handleCalculateCommissions}
                  disabled={calculatingCommissions}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {calculatingCommissions ? (
                    <>
                      <span className="animate-spin material-symbols-outlined !text-[16px]">progress_activity</span>
                      <span className="text-xs">Calculando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined !text-[16px]">calculate</span>
                      <span className="text-xs">Auto-calcular</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {commissionBreakdown && (
              <div className="mt-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-2">
                  Desglose de Comisiones del Período:
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Servicios realizados</p>
                    <p className="font-black text-purple-600 dark:text-purple-400">
                      {commissionBreakdown.servicesCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total servicios</p>
                    <p className="font-black text-purple-600 dark:text-purple-400">
                      {formatCurrency(commissionBreakdown.totalServices)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Comisión ({employee.commissionRate}%)</p>
                    <p className="font-black text-purple-600 dark:text-purple-400">
                      {formatCurrency(commissionBreakdown.servicesCommission)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Bonos
            </label>
            <input
              type="number"
              value={formData.bonuses}
              onChange={(e) => setFormData({ ...formData, bonuses: parseFloat(e.target.value) })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Deducciones
            </label>
            <input
              type="number"
              value={formData.deductions}
              onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800"
              rows={2}
            />
          </div>

          <div className="col-span-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">Total a Pagar</p>
            <p className="text-2xl font-black text-orange-600">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700"
          >
            Guardar Pago
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeManagement;
