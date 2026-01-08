import React, { useState } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';

/**
 * Página temporal para crear el primer usuario administrador
 * Usar solo una vez durante la configuración inicial
 */
const SetupAdmin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>('');

  // Formulario
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Creando usuario administrador...');

      // 1. Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const userId = userCredential.user.uid;
      console.log('✅ Usuario creado en Authentication:', userId);

      // 2. Crear documento de usuario en Firestore
      await setDoc(doc(db, 'users', userId), {
        id: userId,
        name: formData.name,
        email: formData.email,
        role: 'super-admin',
        storeId: 'almacen-1',
        status: 'activo',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('✅ Usuario guardado en Firestore');
      setSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado. Puedes iniciar sesión directamente.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es muy débil');
      } else {
        setError(err.message || 'Error al crear usuario');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <div className="size-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <span className="material-symbols-outlined !text-[40px]">admin_panel_settings</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
            Configuración Inicial
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Crear usuario administrador para DistriAccell Gestión
          </p>
        </div>

        {!success && (
          <form onSubmit={handleCreateAdmin} className="space-y-6">
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <p className="text-sm text-orange-900 dark:text-orange-100 flex items-start gap-2">
                <span className="material-symbols-outlined flex-shrink-0">info</span>
                <span>
                  Ingresa TU correo real. Serás el GERENTE con acceso completo a todo el sistema (ahorro, nómina, reportes).
                </span>
              </p>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                placeholder="tu@correo.com"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Contraseña (mínimo 6 caracteres)
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl p-4">
                <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                  <span className="material-symbols-outlined flex-shrink-0">error</span>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold rounded-xl shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creando usuario...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">person_add</span>
                  Crear Usuario Administrador
                </>
              )}
            </button>
          </form>
        )}

        {success && (
          <div className="text-center space-y-6">
            <div className="size-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-green-600 text-5xl">check_circle</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-green-600 dark:text-green-400 mb-2">
                ¡Usuario Creado Exitosamente!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                Tu cuenta de administrador ha sido creada
              </p>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mt-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Email:</strong> {formData.email}
                </p>
              </div>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all"
            >
              <span className="material-symbols-outlined">arrow_forward</span>
              Ir al Login
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupAdmin;
