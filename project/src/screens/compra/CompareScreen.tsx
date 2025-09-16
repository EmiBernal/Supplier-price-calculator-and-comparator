import React, { useEffect, useMemo, useState } from 'react';
import { Navigation } from '../../components/Navigation';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { apiFetch } from '../../lib/api';
import type {
  CompraComparisonGroup,
  CompraComparisonResponse,
  CompraComparisonSummary,
} from '../../tipos/database';
import { Screen } from '../../types';
import {
  Search,
  Users,
  TrendingDown,
  Sparkles,
  ArrowUpDown,
  Filter,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';

interface CompareScreenProps {
  onNavigate: (screen: Screen) => void;
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('es-AR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return currencyFormatter.format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return percentFormatter.format(value / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: '2-digit' });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return value;
  }
}

export const CompareScreen: React.FC<CompareScreenProps> = ({ onNavigate }) => {
  const [groups, setGroups] = useState<CompraComparisonGroup[]>([]);
  const [summary, setSummary] = useState<CompraComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minProviders, setMinProviders] = useState(2);
  const [sort, setSort] = useState<'best_price' | 'name'>('best_price');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, minProviders, sort, order]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('q', debouncedSearch);
        if (minProviders) params.set('min_providers', String(minProviders));
        if (sort) params.set('sort', sort);
        if (order) params.set('order', order);
        params.set('page', String(page));
        params.set('page_size', String(pageSize));

        const res = await apiFetch(`/api/compra/compare?${params.toString()}`, {
          headers: { 'X-Role': 'compra' },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Error HTTP ${res.status}`);
        }

        const data: CompraComparisonResponse = await res.json();
        setGroups(Array.isArray(data.items) ? data.items : []);
        setSummary(data.summary ?? null);
        if (typeof data.totalPages === 'number') setTotalPages(Math.max(data.totalPages, 1));
        if (typeof data.pageSize === 'number') setPageSize(data.pageSize);
        if (typeof data.page === 'number' && data.page !== page) setPage(data.page);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        console.error('No se pudo cargar el comparador de compras:', e);
        setError('No pudimos cargar la información. Probá nuevamente.');
        setGroups([]);
        setSummary(null);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [debouncedSearch, minProviders, sort, order, page, pageSize]);

  const bestOpportunity = summary?.bestOpportunity ?? null;

  const heroSubtitle = useMemo(() => {
    if (!summary) return 'Explorá dónde conviene comprar cada referencia y negociá con datos frescos.';
    const formattedSavings = formatCurrency(summary.potentialSavings);
    return `Analizamos ${summary.totalGroups.toLocaleString('es-AR')} clusters y detectamos ${formattedSavings} de ahorro potencial.`;
  }, [summary]);

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setMinProviders(2);
    setSort('best_price');
    setOrder('asc');
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((prev) => {
      if (direction === 'prev') return Math.max(1, prev - 1);
      if (totalPages <= 0) return prev;
      return Math.min(totalPages, prev + 1);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-200 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Navigation onBack={() => onNavigate('home')} title="Comparador multi-proveedor" />

        <section className="relative overflow-hidden rounded-[32px] border border-white/60 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-xl backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-200/80 via-transparent to-sky-200/60 dark:from-emerald-500/20 dark:via-transparent dark:to-sky-600/30" aria-hidden />
          <div className="relative px-6 py-10 sm:px-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-200">
                  <Sparkles size={16} className="text-emerald-500" aria-hidden />
                  Inteligencia para Compras
                </div>
                <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Explorá el mejor precio disponible en cada producto
                </h1>
                <p className="mt-3 text-base sm:text-lg text-slate-700 dark:text-slate-200/80">
                  {heroSubtitle}
                </p>
              </div>
              <div className="shrink-0 rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-white/10 px-6 py-5 shadow-md">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Ahorro promedio</p>
                <p className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(summary?.averageSpread ?? 0)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">por producto con múltiples proveedores</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <article className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-6 py-5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Users size={22} aria-hidden />
                <span className="text-sm font-semibold uppercase tracking-wide">Clusters analizados</span>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-900/5 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                Datos en vivo
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
              {summary ? summary.totalGroups.toLocaleString('es-AR') : '—'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Con al menos {minProviders} proveedores activos</p>
          </article>

          <article className="rounded-3xl border border-emerald-400/40 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-200/70 via-white/70 to-emerald-100/70 dark:from-emerald-500/15 dark:via-white/5 dark:to-emerald-500/5 px-6 py-5 shadow-md">
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-200">
              <TrendingDown size={22} aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-wide">Ahorro potencial</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-emerald-700 dark:text-emerald-200">
              {formatCurrency(summary?.potentialSavings ?? null)}
            </p>
            <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70">Entre el precio máximo y mínimo de cada grupo</p>
          </article>

          <article className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-6 py-5 shadow-md">
            <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
              <Percent size={22} aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-wide">Diferencia promedio</span>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
              {formatPercent(summary?.averageSpreadPercent ?? null)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Entre primera y última opción por producto</p>
          </article>
        </section>

        {bestOpportunity && (
          <section className="mt-6 rounded-3xl border border-fuchsia-400/40 dark:border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-200/70 via-white/60 to-sky-200/60 dark:from-fuchsia-500/15 dark:via-white/5 dark:to-sky-500/10 px-6 py-5 shadow-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-200 font-semibold">Oportunidad destacada</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {bestOpportunity.name || 'Producto sin nombre'}
                </h2>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Mejor opción: <strong>{bestOpportunity.bestProvider ?? '—'}</strong> · Peor opción: <strong>{bestOpportunity.worstProvider ?? '—'}</strong>
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">Ahorro</p>
                  <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-200">{formatCurrency(bestOpportunity.priceSpread ?? null)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">% Mejora</p>
                  <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-200">{formatPercent(bestOpportunity.priceSpreadPercent ?? null)}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-2">
                Buscador inteligente
              </label>
              <div className="relative">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, código o proveedor"
                  className="pl-11 pr-4 h-11 rounded-2xl border-slate-200/70 dark:border-white/15 bg-white/90 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400"
                />
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-none w-full lg:w-auto">
              <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  Mínimo de proveedores
                  <Filter size={14} aria-hidden />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMinProviders((prev) => Math.max(1, prev - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300/70 dark:border-white/20 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    aria-label="Reducir mínimo de proveedores"
                  >
                    −
                  </button>
                  <span className="text-xl font-bold text-slate-900 dark:text-white">{minProviders}</span>
                  <button
                    type="button"
                    onClick={() => setMinProviders((prev) => Math.min(10, prev + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300/70 dark:border-white/20 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    aria-label="Incrementar mínimo de proveedores"
                  >
                    +
                  </button>
                </div>
              </div>

              <Select
                label="Ordenar por"
                value={sort}
                onChange={(event) => setSort(event.target.value as 'best_price' | 'name')}
                options={[
                  { value: 'best_price', label: 'Mejor precio' },
                  { value: 'name', label: 'Nombre' },
                ]}
                className="rounded-2xl border-slate-200/70 dark:border-white/15 bg-white/90 dark:bg-white/10 text-slate-900 dark:text-white"
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Dirección</label>
                <button
                  type="button"
                  onClick={() => setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/70 dark:border-white/15 bg-white/90 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/25"
                >
                  <ArrowUpDown size={18} aria-hidden />
                  {order === 'asc' ? 'Ascendente' : 'Descendente'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-white/10 px-3 py-1">
                <Search size={14} />
                Filtro: “{debouncedSearch}”
              </span>
            )}
            {minProviders !== 2 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-white/10 px-3 py-1">
                <Users size={14} />
                {minProviders}+ proveedores
              </span>
            )}
            {(debouncedSearch || minProviders !== 2 || sort !== 'best_price' || order !== 'asc') && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 dark:border-white/20 px-3 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <RefreshCcw size={14} />
                Reiniciar filtros
              </button>
            )}
          </div>
        </section>

        <section className="mt-8 space-y-5">
          {error && (
            <div className="rounded-2xl border border-red-200/70 dark:border-red-400/30 bg-red-50/80 dark:bg-red-500/10 px-6 py-4 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 p-6 shadow-md">
                  <div className="h-6 w-2/3 rounded-lg bg-slate-200/80 dark:bg-white/10" />
                  <div className="mt-4 h-4 w-1/3 rounded-lg bg-slate-200/80 dark:bg-white/10" />
                  <div className="mt-6 space-y-3">
                    <div className="h-16 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                    <div className="h-16 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                    <div className="h-16 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 p-10 text-center shadow-md">
              <ShieldCheck size={42} className="mx-auto text-slate-300 dark:text-slate-500" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-slate-800 dark:text-white">Sin coincidencias por ahora</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Ajustá tus filtros o cargá nuevas listas de proveedores para ver comparaciones multi-proveedor.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const bestProvider = group.providers[0];
              return (
                <article
                  key={group.key}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 shadow-lg transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-fuchsia-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
                  <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Producto clusterizado</p>
                      <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {group.name || group.code || 'Producto sin nombre definido'}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {group.code && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-white/10 px-3 py-1">
                            Código: {group.code}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 px-3 py-1">
                          <Users size={14} aria-hidden />
                          {group.providerCount} proveedores
                        </span>
                        {group.lastUpdated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-white/10 px-3 py-1">
                            Actualizado {formatDate(group.lastUpdated)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                      <div className="rounded-2xl border border-emerald-400/40 dark:border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-200 font-semibold">Mejor precio</p>
                        <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-200">{formatCurrency(group.bestPrice)}</p>
                        <p className="text-xs text-emerald-900/70 dark:text-emerald-100/70">{bestProvider?.provider ?? '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-fuchsia-300/40 dark:border-fuchsia-300/30 bg-fuchsia-500/10 dark:bg-fuchsia-500/15 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-200 font-semibold">Ahorro</p>
                        <p className="mt-2 text-xl font-bold text-fuchsia-700 dark:text-fuchsia-200">{formatCurrency(group.priceSpread)}</p>
                        <p className="text-xs text-fuchsia-900/70 dark:text-fuchsia-100/70">{formatPercent(group.priceSpreadPercent)}</p>
                      </div>
                    </div>
                  </header>

                  {group.nameAlternatives.length > 1 && (
                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                      Alias detectados: {group.nameAlternatives.slice(0, 4).join(' · ')}
                    </p>
                  )}

                  <div className="mt-6 space-y-3">
                    {group.providers.map((provider, index) => {
                      const isBest = index === 0;
                      const isWorst = index === group.providers.length - 1;
                      return (
                        <div
                          key={`${group.key}-${provider.provider}-${index}`}
                          className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 transition-all sm:flex-row sm:items-center sm:justify-between ${
                            isBest
                              ? 'border-emerald-400/60 bg-emerald-500/10 dark:border-emerald-400/30 dark:bg-emerald-500/15'
                              : isWorst
                              ? 'border-slate-200/70 dark:border-white/15 bg-white/60 dark:bg-white/5'
                              : 'border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{provider.provider}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {provider.name || 'Sin descripción'}
                            </p>
                            {provider.code && (
                              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Código: {provider.code}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-lg font-bold ${
                                isBest
                                  ? 'text-emerald-700 dark:text-emerald-200'
                                  : isWorst
                                  ? 'text-fuchsia-700 dark:text-fuchsia-200'
                                  : 'text-slate-800 dark:text-white'
                              }`}
                            >
                              {formatCurrency(provider.price)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Vigente al {formatDate(provider.date)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })
          )}
        </section>

        <footer className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Mostrando <strong>{groups.length}</strong> de{' '}
            <strong>{summary ? summary.totalGroups : groups.length}</strong> grupos disponibles.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handlePageChange('prev')}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/15 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Página {Math.min(page, totalPages)} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange('next')}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/15 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CompareScreen;
