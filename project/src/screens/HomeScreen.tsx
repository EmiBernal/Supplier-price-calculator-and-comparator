import React, { useEffect, useMemo, useState } from 'react';
import { Screen } from '../types';
import { Upload, GitCompare, BarChart3, ArrowRight, Package, Factory, Link2, Search, ChevronDown } from 'lucide-react';
import { TitleHeader } from '../components/TitleHeader';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
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

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Proveedores activos (lista)
  const [providers, setProviders] = useState<ProviderStat[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [openProviders, setOpenProviders] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const res = await fetch('http://localhost:4000/api/stats');
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
  }, []);

  // Carga inteligente de proveedores
  useEffect(() => {
    const fetchProvidersSmart = async () => {
      setLoadingProviders(true);
      try {
        const r1 = await fetch('http://localhost:4000/api/providers/summary');
        if (r1.ok) {
          const rows: ProviderStat[] = await r1.json();
          setProviders(rows || []);
          return;
        }
        throw new Error('summary_not_available');
      } catch {
        try {
          const r2 = await fetch('http://localhost:4000/api/lista_precios?search=');
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
  }, []);

  const number = (n?: number) => (typeof n === 'number' ? n.toLocaleString('es-AR') : '0');

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(p => p.proveedor.toLowerCase().includes(q));
  }, [providers, providerQuery]);

  return (
    // BASE SÓLIDA como en ManualEntryScreen
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0b0f1a] transition-colors">
      {/* OVERLAYS decorativos separados para light/dark (sin interferir con la base) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Versión LIGHT */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#e0f2fe] via-[#f0fdf4] to-[#fef9c3] opacity-80 dark:opacity-0 transition-opacity" />
        {/* Versión DARK */}
        <div className="absolute inset-0 opacity-0 dark:opacity-100 transition-opacity bg-gradient-to-br from-[#0b0f1a] via-[#101624] to-[#1c1f2b]" />
        {/* Partículas (neutralizadas con opacidad baja) */}
        <div className="absolute top-12 left-20 w-20 h-20 bg-[#6CC04A]/20 blur-2xl rounded-full" />
        <div className="absolute bottom-16 right-24 w-28 h-28 bg-[#22378C]/20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-pink-400/10 blur-2xl rounded-full" />
      </div>

      {/* CONTENT */}
      <main className="flex-1 relative">
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="flex items-center gap-5 mb-10">
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#22378C] to-[#6CC04A] shadow-2xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-2xl font-extrabold tracking-wide">GP</span>
              </div>
            </div>
            <div className="flex-1">
              <TitleHeader
                eyebrow="Gampack · Plataforma"
                titleMain="Comparador de precios"
                titleAfter=""
                subtitle="Organización de proveedores y sistema de comparación de precios."
              />
            </div>
          </div>

          {/* Grid principal (tarjetas grandes) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Ingreso y búsqueda */}
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

            {/* Vinculaciones */}
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

            {/* Comparador de precios */}
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
            {/* Productos cargados */}
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

            {/* Proveedores activos */}
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

              {/* Panel expandible */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  openProviders ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden">
                  {/* Buscador */}
                  <div className="relative mb-3">
                    <input
                      value={providerQuery}
                      onChange={(e) => setProviderQuery(e.target.value)}
                      placeholder="Buscar proveedor…"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/10 text-sm text-gray-800 dark:text-white/90 placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400/40"
                    />
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400 dark:text-white/60" />
                  </div>

                  {/* Lista */}
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

            {/* Pendientes de vinculación */}
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

      {/* FOOTER: superficie, no gradiente base */}
      <footer className="mt-auto border-t border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6 text-gray-700 dark:text-white/70 text-sm text-center">
          © Comparador de precios de Gampack 2025. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};

export default HomeScreen;
