import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Store } from '../types';
import { createStore, updateStore, toggleStoreStatus } from '../services/store.service';

const STORE_COLORS = [
  { id: 'orange', label: 'Naranja', bg: 'bg-orange-500' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-500' },
  { id: 'green', label: 'Verde', bg: 'bg-green-500' },
  { id: 'purple', label: 'Morado', bg: 'bg-purple-500' },
  { id: 'pink', label: 'Rosa', bg: 'bg-pink-500' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-500' },
];

const colorBg: Record<string, string> = {
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
};

export default function StoreManagement() {
  const { hasPermission, stores, refreshStores } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    color: 'orange',
    status: 'activo' as 'activo' | 'inactivo',
  });

  if (!hasPermission('all')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="size-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-600 text-5xl">lock</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-400">Solo el super administrador puede gestionar tiendas.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingStore) {
        await updateStore(editingStore.id, {
          name: formData.name,
          address: formData.address || '',
          phone: formData.phone || '',
          color: formData.color,
          status: formData.status,
        });
        setSuccess('Tienda actualizada correctamente');
      } else {
        await createStore({
          name: formData.name,
          address: formData.address || '',
          phone: formData.phone || '',
          color: formData.color,
          status: 'activo',
        });
        setSuccess('Tienda creada correctamente');
      }
      await refreshStores();
      handleCloseModal();
    } catch (err: any) {
      setError(err.message || 'Error al guardar tienda');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (store: Store) => {
    const newStatus = store.status === 'activo' ? 'inactivo' : 'activo';
    try {
      await toggleStoreStatus(store.id, newStatus);
      setSuccess(`Tienda ${newStatus === 'activo' ? 'activada' : 'desactivada'} correctamente`);
      await refreshStores();
    } catch {
      setError('Error al cambiar estado de la tienda');
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      address: store.address || '',
      phone: store.phone || '',
      color: store.color || 'orange',
      status: store.status,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStore(null);
    setFormData({ name: '', address: '', phone: '', color: 'orange', status: 'activo' });
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            Gestión de Tiendas
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Crea y administra las tiendas del sistema
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="material-symbols-outlined !text-[18px]">add_business</span>
          Nueva Tienda
        </button>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total Tiendas</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stores.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Activas</p>
          <p className="text-3xl font-black text-green-600">{stores.filter(s => s.status === 'activo').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Inactivas</p>
          <p className="text-3xl font-black text-gray-400">{stores.filter(s => s.status === 'inactivo').length}</p>
        </div>
      </div>

      {/* Grid de tiendas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {stores.map((store) => (
          <div
            key={store.id}
            className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
              store.status === 'inactivo' ? 'opacity-60 border-gray-200 dark:border-gray-700' : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Color banner */}
            <div className={`h-2 ${colorBg[store.color || 'orange'] || 'bg-orange-500'}`} />

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`size-12 ${colorBg[store.color || 'orange'] || 'bg-orange-500'} rounded-xl flex items-center justify-center text-white shadow-md`}>
                    <span className="material-symbols-outlined !text-[24px]">storefront</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{store.name}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      store.status === 'activo'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {store.status === 'activo' ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </div>

              {(store.address || store.phone) && (
                <div className="mb-4 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  {store.address && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined !text-[16px]">location_on</span>
                      <span className="truncate">{store.address}</span>
                    </div>
                  )}
                  {store.phone && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined !text-[16px]">phone</span>
                      <span>{store.phone}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                ID: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{store.id}</code>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleEdit(store)}
                  className="flex-1 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined !text-[16px]">edit</span>
                  Editar
                </button>
                <button
                  onClick={() => handleToggleStatus(store)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                    store.status === 'activo'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  <span className="material-symbols-outlined !text-[16px]">
                    {store.status === 'activo' ? 'pause_circle' : 'play_circle'}
                  </span>
                  {store.status === 'activo' ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {stores.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="size-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-gray-400 !text-[40px]">store</span>
            </div>
            <p className="text-gray-500 font-medium">No hay tiendas registradas</p>
            <p className="text-gray-400 text-sm mt-1">Crea la primera tienda con el botón de arriba</p>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingStore ? 'Editar Tienda' : 'Nueva Tienda'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre de la tienda *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ej: Distriaccell Centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Calle 123 # 45-67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="300 123 4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color identificador
                </label>
                <div className="flex gap-2 flex-wrap">
                  {STORE_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.id })}
                      className={`size-8 rounded-full ${c.bg} transition-transform ${
                        formData.color === c.id ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white scale-110' : ''
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {editingStore && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'activo' | 'inactivo' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="activo">Activa</option>
                    <option value="inactivo">Inactiva</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editingStore ? 'Actualizar' : 'Crear Tienda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
