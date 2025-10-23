import React, { useEffect, useMemo, useState } from 'react';
import { Screen } from '../../types';
import {
  Upload,
  BarChart3,
  ArrowRight,
  Package,
  Factory,
  Search,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { apiFetch, currentRole } from '../../lib/api';

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
};

type ProviderStat = { proveedor: string; products: number };

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, userRole, onLogout }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [openProviders, setOpenProviders] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');

  const roleHeader = (userRole ?? currentRole() ?? '').toString();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const res = await apiFetch('/api/stats', {
          headers: { 'X-Role': roleHeader },
        });
        if (!res.ok) throw new Error('Stats error');
        const data = await res.json();
        setStats({
          totalProducts: data?.totalProducts ?? 0,
          internalCount: data?.internalCount ?? 0,
          externalCount: data?.externalCount ?? 0,
          activeSuppliers: data?.activeSuppliers ?? 0,
          suppliersWithNewPriceToday: data?.suppliersWithNewPriceToday ?? 0,
        });
      } catch (e) {
        console.error('No se pudieron cargar las stats:', e);
        setStats({
          totalProducts: 0,
          internalCount: 0,
          externalCount: 0,
          activeSuppliers: 0,
          suppliersWithNewPriceToday: 0,
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
        const r1 = await apiFetch('/api/providers/summary', {
          headers: { 'X-Role': roleHeader },
        });
        if (r1.ok) {
          const rows: ProviderStat[] = await r1.json();
          setProviders(rows || []);
          return;
        }
        throw new Error('summary_not_available');
      } catch {
        try {
          const r2 = await apiFetch('/api/lista_precios?search=', {
            headers: { 'X-Role': roleHeader },
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
    return providers.filter((p) => p.proveedor.toLowerCase().includes(q));
  }, [providers, providerQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#070a13] transition-colors">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div
            className="
              w-full rounded-3xl border
              bg-white/90 border-gray-200 shadow-sm
              dark:bg-[#0f172a]/90 dark:border-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]
              backdrop-blur
              px-6 py-5
              flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between
            "
          >
            <div className="flex items-start gap-5">
              <div className="relative w-14 h-14 shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#2563eb] to-[#38bdf8]" />
                <div className="absolute inset-[3px] rounded-[14px] bg-[#0f172a] flex items-center justify-center">
                  <span className="text-white text-xl font-extrabold tracking-wide">CP</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-200">
                  <Sparkles size={14} /> Motor de compras
                </div>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
                  Comparador multi-proveedor inteligente
                </h1>
                <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-white/70">
                  Analizá precios, detectá ahorros inmediatos y centralizá la negociación sin depender de vinculaciones.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiFetch('/api/auth/logout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                    }).catch(() => {});
                  } finally {
                    try {
                      localStorage.removeItem('auth_token');
                      localStorage.removeItem('user');
                      localStorage.removeItem('role');
                      sessionStorage.clear();
                    } catch (storageError) {
                      console.error('No se pudo limpiar la sesión local:', storageError);
                    }
                    onLogout?.();
                    if (!onLogout) {
                      setTimeout(() => {
                        if (window.location.pathname !== '/login') window.location.assign('/login');
                        else window.location.reload();
                      }, 10);
                    }
                  }
                }}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="
                  group relative inline-flex items-center justify-center overflow-hidden
                  rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium
                  border bg-gray-100 text-gray-800 border-gray-200
                  dark:bg-white/5 dark:text-white dark:border-white/10
                  before:absolute before:inset-0 before:-z-10 before:rounded-[10px]
                  before:bg-gradient-to-r before:from-sky-500/0 before:via-sky-500/30 before:to-indigo-500/0
                  before:opacity-0 group-hover:before:opacity-100 before:blur-[10px] before:transition-opacity
                  hover:shadow-[0_8px_30px_rgba(56,189,248,0.18)] dark:hover:shadow-[0_8px_30px_rgba(56,189,248,0.3)]
                  transition-all focus:outline-none focus:ring-2 focus:ring-sky-400/40
                "
              >
                <span className="flex items-center gap-1.5 transition-all duration-200 group-hover:opacity-0 group-hover:-translate-y-1">
                  <span className="opacity-80">Sesión ·</span>
                  <span className="font-semibold">Compras</span>
                </span>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                  <span aria-hidden className="inline-block w-3 h-3 rounded-[2px] border border-current" />
                  <span className="font-semibold">Cerrar sesión</span>
                </span>
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            <button
              onClick={() => onNavigate('manual')}
              className="group text-left rounded-3xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl p-8 min-h-44 backdrop-blur-xl transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-blue-100 dark:bg-white/10">
                  <Upload size={24} strokeWidth={1.8} className="text-blue-700 dark:text-blue-300" aria-hidden />
                </div>
                <ArrowRight size={20} strokeWidth={1.8} className="text-gray-600 dark:text-gray-300 opacity-50 transition-transform group-hover:translate-x-2" aria-hidden />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">Ingreso y búsqueda</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-white/80 max-w-[28ch]">Cargá listas, buscá referencias y administrá tus catálogos.</p>
            </button>

            <button
              onClick={() => onNavigate('compare')}
              className="group text-left rounded-3xl border border-indigo-300/60 dark:border-indigo-400/20 bg-gradient-to-br from-indigo-200/70 via-white/80 to-sky-200/70 dark:from-indigo-500/15 dark:via-white/10 dark:to-sky-500/15 hover:shadow-2xl transition-all shadow-lg p-8 min-h-44 backdrop-blur-xl transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-white/10">
                  <BarChart3 size={24} strokeWidth={1.8} className="text-indigo-700 dark:text-indigo-200" aria-hidden />
                </div>
                <ArrowRight size={20} strokeWidth={1.8} className="text-indigo-600/70 dark:text-indigo-200/80 opacity-80 transition-transform group-hover:translate-x-2" aria-hidden />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">Comparador multi-proveedor</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-white/80 max-w-[32ch]">
                Visualizá todos los proveedores por producto, detectá ahorros y negociá con la mejor alternativa en segundos.
              </p>
            </button>
          </div>

          <section className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                onClick={() => setOpenProviders((o) => !o)}
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
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/10 text-sm text-gray-800 dark:text-white/90 placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400/40"
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
          </section>
        </div>
      </main>

      <footer className="mt-auto border-t border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6 text-gray-700 dark:text-white/70 text-sm text-center">
          © Comparador de compras 2025. Impulsado por datos reales de proveedores.
        </div>
      </footer>
    </div>
  );
};

export default HomeScreen;
