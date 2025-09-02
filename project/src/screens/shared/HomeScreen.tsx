import React, { useEffect, useMemo, useState } from 'react';
import { Screen } from '../../types';
import {
  Upload, GitCompare, BarChart3, ArrowRight, Package, Factory, Link2, Search, ChevronDown, Sun, Moon
} from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  userRole?: 'compra' | 'venta';
  onLogout?: () => void;
}

type Stats = {
  totalProducts: number;
  internalCount: number;
  externalCount: number;
  activeSuppliers: number;
  suppliersWithNewPriceToday: number;
  pendingLinks: number;
};

type ProviderStat = { proveedor: string; products: number };

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, userRole, onLogout }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [openProviders, setOpenProviders] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');

  // === A) Header con el rol para multi-DB ===
  const roleHeader = (userRole ?? localStorage.getItem('role') ?? '').toString();

  // === Tema (oscuro/claro) - mismo comportamiento que login ===
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(d => !d);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const res = await fetch('http://localhost:4000/api/stats', {
          credentials: 'include',
          headers: { 'X-Role': roleHeader }
        });
        if (!res.ok) throw new Error('Stats error');
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error('No se pudieron cargar las stats:', e);
        setStats({
          totalProducts: 0,
          internalCount: 0,
          externalCount: 0,
          activeSuppliers: 0,
          suppliersWithNewPriceToday: 0,
          pendingLinks: 0,
        });
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [roleHeader]);

  useEffect(() => {
    const fetchProvidersSmart = async () => {
      setLoadingProviders(true);
      try {
        const r1 = await fetch('http://localhost:4000/api/providers/summary', {
          credentials: 'include',
          headers: { 'X-Role': roleHeader }
        });
        if (r1.ok) {
          const rows: ProviderStat[] = await r1.json();
          setProviders(rows || []);
          return;
        }
        throw new Error('summary_not_available');
      } catch {
        try {
          const r2 = await fetch('http://localhost:4000/api/lista_precios?search=', {
            credentials: 'include',
            headers: { 'X-Role': roleHeader }
          });
          if (!r2.ok) throw new Error('fallback_error');
          const all = await r2.json();
          const countByProv = new Map<string, number>();
          for (const row of all) {
            const prov = (row?.proveedor ?? '').toString().trim();
            if (!prov) continue;
            countByProv.set(prov, (countByProv.get(prov) || 0) + 1);
          }
          const list: ProviderStat[] = Array.from(countByProv.entries())
            .map(([proveedor, products]) => ({ proveedor, products }))
            .sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'));
          setProviders(list);
        } catch (e) {
          console.error('No se pudo obtener la lista de proveedores:', e);
          setProviders([]);
        } finally {
          setLoadingProviders(false);
        }
        return;
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProvidersSmart();
  }, [roleHeader]);

  const number = (n?: number) => (typeof n === 'number' ? n.toLocaleString('es-AR') : '0');

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(p => p.proveedor.toLowerCase().includes(q));
  }, [providers, providerQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0b0f1a] transition-colors">
      <main className="flex-1">
        <div className="relative max-w-7xl mx-auto px-6 py-10">

          {/* === HEADER === */}
          <div
            className="
              w-full rounded-2xl border
              bg-white/90 border-gray-200 shadow-sm
              dark:bg-[#0f162a]/90 dark:border-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
              backdrop-blur
              px-5 sm:px-6 py-4 sm:py-5
              flex items-center justify-between gap-4
            "
          >
            {/* Izquierda: Logo + textos */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#22378C] to-[#6CC04A]" />
                <div className="absolute inset-[2px] rounded-[14px] bg-[#0f162a] dark:bg-[#0f162a] flex items-center justify-center">
                  <span className="text-white text-lg sm:text-xl font-extrabold tracking-wide">GP</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs tracking-wider uppercase text-gray-500 dark:text-white/50">
                  GAMPACK · PLATAFORMA
                </div>
                <div className="leading-tight">
                  <h1 className="text-2xl sm:text-3xl font-extrabold">
                    <span className="bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent">
                      Comparador de precios
                    </span>
                  </h1>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-white/70 truncate">
                  Organización de proveedores y sistema de comparación de precios.
                </p>
              </div>
            </div>

            {/* Derecha: controles (tema + logout) */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Botón tema (igual estilo que login, con halo) */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
                title={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
                className={[
                  "group relative inline-flex items-center justify-center overflow-hidden",
                  "rounded-lg p-2 text-sm",
                  "border bg-gray-100 text-gray-800 border-gray-200",
                  "dark:bg-white/5 dark:text-white dark:border-white/10",
                  // halo animado
                  "before:absolute before:inset-0 before:-z-10 before:rounded-[10px]",
                  "before:bg-gradient-to-r before:from-indigo-500/0 before:via-indigo-500/30 before:to-pink-500/0",
                  "before:opacity-0 group-hover:before:opacity-100 before:blur-[10px] before:transition-opacity",
                  // elevación
                  "hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] dark:hover:shadow-[0_8px_30px_rgba(99,102,241,0.25)]",
                  "transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                ].join(" ")}
              >
                <span className="sr-only">{`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}</span>
                <span className="transition-transform duration-200 group-active:scale-95">
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </span>
              </button>

              {/* Botón logout (chip con rol) */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch('http://localhost:4000/api/auth/logout', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                    }).catch(() => {});
                  } finally {
                    try {
                      localStorage.removeItem('auth_token');
                      localStorage.removeItem('user');
                      localStorage.removeItem('role');
                      sessionStorage.clear();
                    } catch {}
                    onLogout?.();
                    setTimeout(() => {
                      if (window.location.pathname !== '/login') window.location.assign('/login');
                      else window.location.reload();
                    }, 10);
                  }
                }}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className={[
                  "group relative inline-flex items-center justify-center overflow-hidden",
                  "rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium",
                  "border bg-gray-100 text-gray-800 border-gray-200",
                  "dark:bg-white/5 dark:text-white dark:border-white/10",
                  // borde/halo animado
                  "before:absolute before:inset-0 before:-z-10 before:rounded-[10px]",
                  "before:bg-gradient-to-r before:from-indigo-500/0 before:via-indigo-500/30 before:to-pink-500/0",
                  "before:opacity-0 group-hover:before:opacity-100 before:blur-[10px] before:transition-opacity",
                  // elevación
                  "hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] dark:hover:shadow-[0_8px_30px_rgba(99,102,241,0.25)]",
                  "transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                ].join(" ")}
              >
                {/* Estado normal: muestra rol */}
                <span className="flex items-center gap-1.5 transition-all duration-200 group-hover:opacity-0 group-hover:-translate-y-1">
                  <span className="opacity-80">Bienvenido ·</span>
                  <span className="font-semibold">
                    {userRole === 'compra' ? 'Compras' : userRole === 'venta' ? 'Ventas' : 'Usuario'}
                  </span>
                </span>

                {/* Estado hover: cambia a “Cerrar sesión” */}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                  <span aria-hidden className="inline-block w-3 h-3 rounded-[2px] border border-current" />
                  <span className="font-semibold">Cerrar sesión</span>
                </span>
              </button>
            </div>
          </div>
          {/* === /HEADER === */}

          {/* Grid principal (tarjetas grandes) */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <button
              onClick={() => onNavigate('manual')}
              className="group text-left rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl p-8 min-h-44 md:min-h-56 backdrop-blur-xl transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-blue-100 dark:bg-white/10">
                  <Upload size={24} strokeWidth={1.8} className="text-blue-700 dark:text-blue-300" aria-hidden />
                </div>
                <ArrowRight size={20} strokeWidth={1.8} className="text-gray-600 dark:text-gray-300 opacity-50 transition-transform group-hover:translate-x-2" aria-hidden />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">Ingreso y búsqueda</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-white/80 max-w-[28ch]">Cargar o buscar productos manualmente.</p>
            </button>

            <button
              onClick={() => onNavigate('equivalences')}
              className="group text-left rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl p-8 min-h-44 md:min-h-56 backdrop-blur-xl transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-green-100 dark:bg-white/10">
                  <GitCompare size={24} strokeWidth={1.8} className="text-green-600 dark:text-green-300" aria-hidden />
                </div>
                <ArrowRight size={20} strokeWidth={1.8} className="text-gray-600 dark:text-gray-300 opacity-50 transition-transform group-hover:translate-x-2" aria-hidden />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">Vinculaciones</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-white/80">
                <span className="block">Relacionar productos manualmente</span>
                <span className="block">Detectá coincidencias por nombre, revisá el motivo y confirmá o descartá cada relación.</span>
              </p>
            </button>

            <button
              onClick={() => onNavigate('compare')}
              className="group text-left rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl p-8 min-h-44 md:min-h-56 backdrop-blur-xl transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-indigo-100 dark:bg-white/10">
                  <BarChart3 size={24} strokeWidth={1.8} className="text-indigo-700 dark:text-indigo-300" aria-hidden />
                </div>
                <ArrowRight size={20} strokeWidth={1.8} className="text-gray-600 dark:text-gray-300 opacity-50 transition-transform group-hover:translate-x-2" aria-hidden />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">Comparador de precios</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-white/80 max-w-[28ch]">Análisis y diferencias por proveedor.</p>
            </button>
          </div>

          {/* Banda de KPIs */}
          <section className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-md hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-white/10">
                  <Package size={18} strokeWidth={1.8} className="text-blue-700 dark:text-blue-200" aria-hidden />
                </div>
                <span className="text-sm opacity-70">Productos cargados</span>
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '—' : number(stats?.totalProducts)}
              </div>
              <div className="text-xs text-gray-500 dark:text-white/60">
                {loadingStats ? '' : `${number(stats?.internalCount)} internos · ${number(stats?.externalCount)} externos`}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-md hover:shadow-lg transition-all">
              <button
                onClick={() => setOpenProviders(o => !o)}
                className="w-full flex items-center justify-between text-gray-900 dark:text-white group"
                aria-expanded={openProviders}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-100 dark:bg-white/10">
                    <Factory size={18} strokeWidth={1.8} className="text-green-700 dark:text-green-200" aria-hidden />
                  </div>
                  <div className="text-left">
                    <div className="text-sm opacity-70">Proveedores activos</div>
                    <div className="text-2xl font-bold">
                      {loadingStats ? '—' : number(stats?.activeSuppliers)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/60">
                      {loadingStats ? '' : `${number(stats?.suppliersWithNewPriceToday)} con precio nuevo hoy`}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={`transition-transform duration-300 ${openProviders ? 'rotate-180' : ''} opacity-70`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  openProviders ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="relative mb-3">
                    <input
                      value={providerQuery}
                      onChange={(e) => setProviderQuery(e.target.value)}
                      placeholder="Buscar proveedor…"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/10 text-sm text-gray-800 dark:text-white/90 placeholder-gray-400 dark:placeholder-white/50"
                    />
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400 dark:text-white/60" />
                  </div>

                  <div className="max-h-56 overflow-auto rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-white/5">
                    {loadingProviders ? (
                      <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="h-8 rounded-md bg-gray-200/70 dark:bg-white/10 animate-pulse" />
                        ))}
                      </div>
                    ) : filteredProviders.length === 0 ? (
                      <div className="p-4 text-sm text-gray-600 dark:text-white/70">Sin resultados.</div>
                    ) : (
                      <ul className="divide-y divide-gray-200/60 dark:divide-white/10">
                        {filteredProviders.map((p) => (
                          <li
                            key={p.proveedor}
                            className="flex items-center justify-between px-4 py-2 hover:bg-gray-50/60 dark:hover:bg-white/10 transition"
                          >
                            <span className="truncate text-sm text-gray-900 dark:text-white">{p.proveedor}</span>
                            <span className="ml-3 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200">
                              {number(p.products)} prod.
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('equivalences')}
              className="text-left rounded-2xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-md hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-white/10">
                  <Link2 size={18} strokeWidth={1.8} className="text-purple-700 dark:text-purple-200" aria-hidden />
                </div>
                <span className="text-sm opacity-70">Pendientes de vinculación</span>
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '—' : number(stats?.pendingLinks)}
              </div>
              <div className="text-xs text-gray-500 dark:text-white/60">
                Hacé clic para revisar y confirmar/descartar relaciones
              </div>
            </button>
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6 text-gray-700 dark:text-white/70 text-sm text-center">
          © Comparador de precios de Gampack 2025. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};

export default HomeScreen;
