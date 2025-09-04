import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, Moon, Sun, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const BASE_URL = 'http://localhost:4000';

interface Props {
  onLoginSuccess: (role: 'compra' | 'venta') => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rememberUser') === '1';
    } catch {
      return false;
    }
  });

  // ===== Theme (consistente con el resto de la app) =====
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {}
    // si el usuario no tiene preferencia guardada, respetamos media query
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  // Autorrellenar username si el usuario eligió recordar
  useEffect(() => {
    try {
      const lastUser = localStorage.getItem('lastUsername') || '';
      if (rememberUser && lastUser) setUsername(lastUser);
    } catch {}
  }, [rememberUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error de login');

      // guardamos preferencia de usuario recordado
      try {
        localStorage.setItem('rememberUser', rememberUser ? '1' : '0');
        if (rememberUser) localStorage.setItem('lastUsername', username);
      } catch {}

      try { localStorage.setItem('role', data.role); } catch {}
      onLoginSuccess(data.role);
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = username.trim().length > 0 && password.length >= 4 && !loading;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-400/10" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-400/10" />
      </div>

      {/* Toggle de tema */}
      <button
        type="button"
        aria-label="Cambiar tema"
        onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        className="group fixed right-4 top-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-sm font-medium shadow-sm backdrop-blur transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900/80"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
      </button>

      {/* Contenedor principal */}
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
        <div className="grid w-full grid-cols-1 items-center gap-8 md:grid-cols-2">
          {/* Lado izquierdo: Branding + texto */}
          <div className="order-2 md:order-1">
            <div className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/70 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-200">
              <ShieldCheck className="h-4 w-4" />
              <span>Acceso seguro · Gampack</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
              Calculadora & Comparador de Precios
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Ingresá con tus credenciales para continuar. Soportamos roles de <b>Compra</b> y <b>Venta</b>. El tema oscuro se guarda y se usa en todas las vistas.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500"></span> Diseño moderno y consistente</li>
              <li className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Feedback claro de errores</li>
              <li className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500"></span> Recuerda usuario si lo elegís</li>
            </ul>
          </div>

          {/* Lado derecho: Card de login */}
          <div className="order-1 md:order-2">
            <div className="relative mx-auto w-full max-w-md">
              {/* halo */}
              <div className="absolute -inset-0.5 -z-10 rounded-3xl bg-gradient-to-tr from-blue-500/20 via-emerald-500/20 to-purple-500/20 blur-2xl"></div>

              <form
                onSubmit={handleSubmit}
                className="rounded-3xl border border-gray-200 bg-white/80 p-6 shadow-xl backdrop-blur transition-all dark:border-gray-800 dark:bg-gray-900/70 sm:p-8"
              >
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Iniciar sesión</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Usá tu usuario y contraseña corporativos</p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300">
                    {error}
                  </div>
                )}

                {/* Usuario */}
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Usuario
                </label>
                <div className="group mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950">
                  <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500" />
                  <input
                    type="text"
                    placeholder="Coloca aquí el usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
                    autoComplete="username"
                    inputMode="email"
                  />
                </div>

                {/* Password */}
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Contraseña
                </label>
                <div className="group mb-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950">
                  <Lock className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
                    autoComplete="current-password"
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Remember me + Olvidé */}
                <div className="mb-6 flex items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                      checked={rememberUser}
                      onChange={(e) => setRememberUser(e.target.checked)}
                    />
                    Recordar usuario
                  </label>
                  <button
                    type="button"
                    onClick={() => setError('Si olvidaste tu contraseña, pedí el reseteo al administrador.')} // placeholder amigable
                    className="text-sm text-blue-600 underline-offset-4 transition hover:underline dark:text-blue-400"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {/* Botón submit */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500"
                >
                  <span className="absolute inset-0 -z-10 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition group-hover:opacity-100" />
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Entrar
                    </>
                  )}
                </button>

                {/* Nota legal/ambiental */}
                <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  Al continuar aceptás los términos de uso internos. Las acciones quedan registradas.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
