
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El AuthContext se encargará de actualizar el estado del usuario
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);

      // Mensajes de error en español
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Correo o contraseña incorrectos');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Intenta más tarde');
      } else {
        setError('Error al iniciar sesión. Intenta nuevamente');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] dark:bg-[#111121] p-6">
      <div className="w-full max-w-[1100px] bg-white dark:bg-[#1a1a2e] rounded-[32px] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-700">
        <div className="w-full lg:w-1/2 p-8 sm:p-16 flex flex-col justify-center">
          <div className="max-w-[400px] mx-auto w-full">
            <div className="flex items-center gap-3 mb-12">
              <div className="size-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                <span className="material-symbols-outlined !text-[28px]">smartphone</span>
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight dark:text-white">DistriAccell</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black leading-none">Gestión</p>
              </div>
            </div>

            <div className="space-y-2 mb-10">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Bienvenido de nuevo</h2>
              <p className="text-slate-500 text-sm">Ingresa tus credenciales para acceder al sistema.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-300 ml-1">Correo Electrónico</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 transition-colors">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border-none focus:ring-2 focus:ring-orange-600/50 dark:text-white transition-all"
                    placeholder="ejemplo@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-300">Contraseña</label>
                  <a href="#" className="text-xs font-bold text-orange-600 hover:underline">¿Olvidaste tu contraseña?</a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 transition-colors">lock</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border-none focus:ring-2 focus:ring-orange-600/50 dark:text-white transition-all"
                    placeholder="Ingrese su contraseña"
                  />
                </div>
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
                className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <span className="material-symbols-outlined !text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-10 text-center text-xs text-slate-500">
              ¿No tienes una cuenta? <span className="text-slate-900 dark:text-white font-bold cursor-pointer hover:underline">Contacta al administrador</span>
            </p>
          </div>
        </div>

        <div className="hidden lg:block lg:w-1/2 relative bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-900/90 to-orange-600/40 mix-blend-multiply z-10" />
          <img 
            src="https://picsum.photos/id/160/800/1200" 
            alt="Dashboard Preview" 
            className="absolute inset-0 w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-[10s] ease-linear"
          />
          <div className="absolute bottom-16 left-16 right-16 z-20 space-y-4">
             <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="size-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Sistema de Control Integral</span>
                </div>
                <h3 className="text-2xl font-black text-white leading-tight">Optimiza tu negocio móvil hoy mismo.</h3>
                <p className="text-sm text-white/70 mt-2 leading-relaxed font-medium">Control de inventario, ventas, servicios técnicos y reportes financieros en una sola plataforma centralizada.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
