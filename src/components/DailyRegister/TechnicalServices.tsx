import React, { useState, useEffect } from 'react';
import { TechnicalService, ServiceType } from '../../types';
import { SERVICE_TYPES } from '../../constants/categories';
import { formatCurrency } from '../../utils/currency';
import { groupServicesByTechnician } from '../../utils/calculations';
import { getEmployeesByStore } from '../../services/employee.service';
import { useDailyRegister } from '../../contexts/DailyRegisterContext';

interface TechnicalServicesProps {
  services: TechnicalService[];
  onAddService: (service: Omit<TechnicalService, 'id' | 'timestamp'>) => void;
  onRemoveService: (id: string) => void;
  disabled?: boolean;
}

interface TempService {
  tempId: string;
  serviceType: ServiceType;
  deviceModel: string;
  amount: number;
  customerName: string;
}

const TechnicalServices: React.FC<TechnicalServicesProps> = ({
  services,
  onAddService,
  onRemoveService,
  disabled
}) => {
  const { selectedStore } = useDailyRegister();
  const [isEnabled, setIsEnabled] = useState(services.length > 0);
  const [technician, setTechnician] = useState<{ id: string; name: string } | null>(null);
  const [loadingTechnician, setLoadingTechnician] = useState(true);
  const [tempServices, setTempServices] = useState<TempService[]>([{
    tempId: Date.now().toString(),
    serviceType: 'pantalla' as ServiceType,
    deviceModel: '',
    amount: 0,
    customerName: ''
  }]);

  // Cargar técnico del almacén actual
  useEffect(() => {
    const loadTechnician = async () => {
      try {
        setLoadingTechnician(true);
        console.log('🔍 Buscando técnicos para almacén:', selectedStore);

        const employees = await getEmployeesByStore(selectedStore);
        console.log('👥 Empleados encontrados:', employees.length);
        console.log('📋 Empleados:', employees.map(e => ({ name: e.name, role: e.role, status: e.status })));

        // Buscar técnico activo primero
        let tech = employees.find(emp => emp.role === 'tecnico' && emp.status === 'activo');

        // Si no hay técnico activo, buscar cualquier técnico (inactivo, de vacaciones, etc.)
        if (!tech) {
          tech = employees.find(emp => emp.role === 'tecnico');
          if (tech) {
            console.warn(`⚠️ Técnico "${tech.name}" encontrado pero con estado: ${tech.status}`);
          }
        }

        if (tech) {
          console.log('✅ Técnico seleccionado:', tech.name, `(${tech.status})`);
          setTechnician({ id: tech.id, name: tech.name });
        } else {
          setTechnician(null);
          console.warn('❌ No se encontró ningún técnico para este almacén');
          console.log('💡 Empleados disponibles:', employees.map(e => `${e.name} (${e.role})`));
        }
      } catch (error) {
        console.error('Error al cargar técnico:', error);
        setTechnician(null);
      } finally {
        setLoadingTechnician(false);
      }
    };

    if (isEnabled) {
      loadTechnician();
    }
  }, [selectedStore, isEnabled]);

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
    if (isEnabled && services.length > 0) {
      if (confirm('¿Deseas eliminar todos los servicios técnicos registrados?')) {
        services.forEach(service => onRemoveService(service.id));
      }
    }
  };

  const addNewLine = () => {
    setTempServices([...tempServices, {
      tempId: Date.now().toString(),
      serviceType: 'pantalla',
      deviceModel: '',
      amount: 0,
      customerName: ''
    }]);
  };

  const removeLine = (tempId: string) => {
    if (tempServices.length === 1) return;
    setTempServices(tempServices.filter(s => s.tempId !== tempId));
  };

  const updateLine = (tempId: string, field: keyof TempService, value: any) => {
    setTempServices(tempServices.map(s =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    ));
  };

  const handleAddAll = () => {
    if (!technician) {
      alert(
        '⚠️ No hay un técnico disponible para este almacén.\n\n' +
        'Por favor:\n' +
        '1. Verifica que existe un empleado con rol "Técnico"\n' +
        '2. Verifica que esté asignado al almacén correcto\n' +
        '3. Verifica que su estado sea "Activo"\n\n' +
        'Abre la consola del navegador (F12) para ver más detalles.'
      );
      return;
    }

    const validServices = tempServices.filter(s => s.deviceModel && s.amount > 0);

    if (validServices.length === 0) {
      alert('⚠️ Agrega al menos un servicio con modelo y monto válido');
      return;
    }

    validServices.forEach(service => {
      onAddService({
        serviceType: service.serviceType,
        deviceModel: service.deviceModel,
        technicianName: technician.name,
        amount: service.amount,
        customerName: service.customerName || undefined
      });
    });

    setTempServices([{
      tempId: Date.now().toString(),
      serviceType: 'pantalla',
      deviceModel: '',
      amount: 0,
      customerName: ''
    }]);
  };

  const total = services.reduce((acc, service) => acc + service.amount, 0);
  const tempTotal = tempServices.reduce((acc, s) => acc + s.amount, 0);
  const servicesByTech = groupServicesByTechnician(services);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header with toggle */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-600">build</span>
          <h3 className="font-bold text-sm">🔧 Servicios Técnicos</h3>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 ${
            isEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Content */}
      {isEnabled && (
        <>
          {/* Form - Multiple lines */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-purple-50/30 dark:bg-purple-900/10 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                  🔧 Servicios a agregar
                </label>
                {loadingTechnician ? (
                  <span className="text-xs text-slate-400">Cargando técnico...</span>
                ) : technician ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <span className="text-xs text-purple-700 dark:text-purple-300">👨‍🔧</span>
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{technician.name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-red-500">⚠️ No hay técnico disponible</span>
                )}
              </div>
              <button
                onClick={addNewLine}
                disabled={disabled || !technician}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nueva línea
              </button>
            </div>

            {/* Service lines */}
            <div className="space-y-2">
              {tempServices.map((service) => (
                <div key={service.tempId} className="bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3">
                      <select
                        value={service.serviceType}
                        onChange={(e) => updateLine(service.tempId, 'serviceType', e.target.value as ServiceType)}
                        disabled={disabled}
                        className="w-full h-10 text-xs rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        {SERVICE_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.icon} {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <input
                        type="text"
                        value={service.deviceModel}
                        onChange={(e) => updateLine(service.tempId, 'deviceModel', e.target.value)}
                        placeholder="Modelo del equipo"
                        disabled={disabled}
                        className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <input
                        type="number"
                        value={service.amount || ''}
                        onChange={(e) => updateLine(service.tempId, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="Monto"
                        disabled={disabled}
                        className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 text-right font-bold focus:ring-2 focus:ring-purple-500 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0"
                        step="1000"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={service.customerName}
                        onChange={(e) => updateLine(service.tempId, 'customerName', e.target.value)}
                        placeholder="Cliente (opc)"
                        disabled={disabled}
                        className="w-full h-10 text-sm rounded-lg border-slate-200 dark:border-slate-500 dark:bg-slate-600 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      {tempServices.length > 1 && (
                        <button
                          onClick={() => removeLine(service.tempId)}
                          disabled={disabled}
                          className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total preview and submit button */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-600">
              <div>
                <span className="text-xs text-slate-500">Total a agregar: </span>
                <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                  {formatCurrency(tempTotal)}
                </span>
              </div>
              <button
                onClick={handleAddAll}
                disabled={disabled || !technician || tempServices.every(s => !s.deviceModel || s.amount <= 0)}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">check_circle</span>
                Agregar Todo
              </button>
            </div>
          </div>

          {/* Services grouped by technician */}
          <div className="p-5 space-y-4">
            {Object.entries(servicesByTech).map(([techName, techServices]) => {
              const techTotal = techServices.reduce((acc, s) => acc + s.amount, 0);

              return (
                <div key={techName} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  {/* Technician header */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <span className="text-lg">👨‍🔧</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{techName}</p>
                        <p className="text-xs text-slate-500">{techServices.length} servicio(s)</p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                      {formatCurrency(techTotal)}
                    </p>
                  </div>

                  {/* Services list */}
                  <div className="space-y-2">
                    {techServices.map((service) => {
                      const serviceType = SERVICE_TYPES.find(t => t.id === service.serviceType);
                      return (
                        <div
                          key={service.id}
                          className="group flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-bold">
                              {serviceType?.icon} {serviceType?.label} - {service.deviceModel}
                            </p>
                            {service.customerName && (
                              <p className="text-xs text-slate-500 mt-0.5">Cliente: {service.customerName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-mono font-bold text-purple-600">{formatCurrency(service.amount)}</p>
                            <button
                              onClick={() => onRemoveService(service.id)}
                              disabled={disabled}
                              className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {services.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-2 opacity-20">build_circle</span>
                <p className="text-sm">No hay servicios técnicos registrados</p>
              </div>
            )}
          </div>

          {/* Footer with total */}
          <div className="p-5 bg-purple-50 dark:bg-purple-900/20 border-t border-purple-200 dark:border-purple-800 flex justify-between items-center">
            <span className="text-sm font-bold text-purple-700 dark:text-purple-400">
              Total servicios técnicos:
            </span>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
        </>
      )}

      {/* Collapsed state */}
      {!isEnabled && (
        <div className="p-8 text-center text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-2 opacity-20">build_circle</span>
          <p className="text-sm">Activa el switch si se realizaron servicios técnicos hoy</p>
        </div>
      )}
    </div>
  );
};

export default TechnicalServices;
