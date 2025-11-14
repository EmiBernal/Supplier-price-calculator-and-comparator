import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Loader2,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
} from 'lucide-react';

import { apiFetch } from '../lib/api';
import { Input } from './Input';
import { isFiniteNumber, safeToFixed } from '../utils/number';
import { useTheme } from '../context/theme';
import { getBestSearchRank, normalizeSearchTerm } from '../utils/search';

type GampackProduct = {
  id_interno: number;
  cod_interno: string | null;
  nom_interno: string | null;
  precio_final: number | null;
  fecha: string | null;
  mes_actualizacion?: string | null;
  tiene_relacion?: boolean | number | string | null;
  relatedCount?: number | null;
  relationsCount?: number | null;
  related_count?: number | null;
  relations_count?: number | null;
  relations?: unknown;
  related?: unknown;
  relatedProducts?: unknown;
  related_products?: unknown;
};

type RawRelation = {
  id: number;
  id_lista_interna: number | null;
  id_lista_precios: number | null;
  criterio_relacion: string | null;
  relation_created_at: string | null;
  cod_externo: string | null;
  nom_externo: string | null;
  precio_externo: number | null;
  fecha_externa: string | null;
  proveedor: string | null;
  cod_interno: string | null;
  nom_interno: string | null;
  precio_interno: number | null;
  fecha_interna: string | null;
};

type SimplifiedRelation = {
  id: number;
  gampackId: number | null;
  gampackName: string;
  gampackCode: string;
  gampackPrice: number | null;
  gampackDate: string | null;
  supplier: string;
  supplierProductName: string;
  supplierProductCode: string;
  supplierPrice: number | null;
  supplierDate: string | null;
  differencePct: number | null;
};

type SelectedSummary = {
  id: number;
  name: string;
  code: string;
  price: number | null;
};

interface SimplifiedComparisonViewProps {
  className?: string;
}

type SortOption = 'original' | 'gampack' | 'proveedor';

const SORT_STORAGE_KEY = 'simplifiedComparisonViewSort';
const PROVIDERS_STORAGE_KEY = 'simplifiedComparisonViewProviders';

const parseIdsFromQuery = (raw: unknown): number[] => {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const ids = new Set<number>();
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    value
      .split(',')
      .map((chunk) => Number.parseInt(chunk.trim(), 10))
      .filter((num) => Number.isFinite(num) && num > 0)
      .forEach((num) => ids.add(num));
  });
  return Array.from(ids);
};

const formatCurrency = (value: number | null): string => {
  const formatted = safeToFixed(value, 2);
  return formatted === '—' ? '—' : `$${formatted}`;
};

const buildSimplifiedRelations = (rows: RawRelation[]): SimplifiedRelation[] => {
  const seen = new Map<string, SimplifiedRelation>();

  rows.forEach((row) => {
    const supplier = (row.proveedor ?? '').trim() || 'Sin proveedor';
    const externalCode = row.cod_externo ?? '';
    const externalName = row.nom_externo ?? '';
    const gampackCode = row.cod_interno ?? '';
    const gampackName = row.nom_interno ?? '';
    const gampackPrice = row.precio_interno ?? null;
    const supplierPrice = row.precio_externo ?? null;

    const key = [supplier, externalCode, externalName, gampackCode, gampackName]
      .map((chunk) => chunk.toLowerCase().trim())
      .join('|');

    if (seen.has(key)) {
      return;
    }

    const differencePct =
      gampackPrice == null || supplierPrice == null || gampackPrice === 0
        ? null
        : ((supplierPrice - gampackPrice) / gampackPrice) * 100;

    seen.set(key, {
      id: row.id,
      gampackId: row.id_lista_interna ?? null,
      gampackName: gampackName || 'Sin nombre',
      gampackCode: gampackCode || '—',
      gampackPrice,
      gampackDate: row.fecha_interna ?? null,
      supplier,
      supplierProductName: externalName || 'Sin nombre',
      supplierProductCode: externalCode || '—',
      supplierPrice,
      supplierDate: row.fecha_externa ?? null,
      differencePct,
    });
  });

  return Array.from(seen.values()).sort((a, b) => a.supplier.localeCompare(b.supplier, 'es'));
};

type DifferenceBadgeConfig = {
  Icon: LucideIcon;
  badgeClasses: string;
  label: string;
  percentage: string;
};

const differenceBadgeConfig = (difference: number | null): DifferenceBadgeConfig => {
  if (!isFiniteNumber(difference)) {
    return {
      Icon: Minus,
      badgeClasses: 'bg-gray-500/10 text-gray-400',
      label: 'Datos insuficientes',
      percentage: '—',
    } satisfies DifferenceBadgeConfig;
  }

  const percentage = `${difference > 0 ? '+' : ''}${safeToFixed(difference, 1)}%`;

  if (difference < 0) {
    return {
      Icon: TrendingDown,
      badgeClasses: 'bg-emerald-500/10 text-emerald-400',
      label: 'Gampack más barato',
      percentage,
    } satisfies DifferenceBadgeConfig;
  }

  if (difference > 0) {
    return {
      Icon: TrendingUp,
      badgeClasses: 'bg-red-500/10 text-red-400',
      label: 'Proveedor más barato',
      percentage,
    } satisfies DifferenceBadgeConfig;
  }

  return {
    Icon: Minus,
    badgeClasses: 'bg-gray-500/10 text-gray-400',
    label: 'Precios iguales',
    percentage,
  } satisfies DifferenceBadgeConfig;
};

const normalizeBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', 't', '1', 'si', 'sí', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      return parsed > 0;
    }
  }
  return null;
};

const normalizeNumberLike = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const hasActiveRelations = (product: GampackProduct): boolean => {
  const booleanLike = normalizeBooleanLike(product.tiene_relacion);
  if (booleanLike != null) {
    return booleanLike;
  }

  const numericCandidates = [
    normalizeNumberLike(product.relatedCount),
    normalizeNumberLike(product.relationsCount),
    normalizeNumberLike(product.related_count),
    normalizeNumberLike(product.relations_count),
  ];

  if (numericCandidates.some((value) => value != null && value > 0)) {
    return true;
  }

  const arrayCandidates = [
    product.relations,
    product.related,
    product.relatedProducts,
    product.related_products,
  ];

  if (arrayCandidates.some((value) => Array.isArray(value) && value.length > 0)) {
    return true;
  }

  return false;
};

export const SimplifiedComparisonView: React.FC<SimplifiedComparisonViewProps> = ({
  className,
}) => {
  const { theme } = useTheme();
  const [showProviderFilter, setShowProviderFilter] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(PROVIDERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [];
    } catch (error) {
      console.warn('No se pudo leer la preferencia de proveedores', error);
      return [];
    }
  });
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    if (typeof window === 'undefined') return 'original';
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    return stored === 'gampack' || stored === 'proveedor' ? stored : 'original';
  });

  const [gampackItems, setGampackItems] = useState<GampackProduct[]>([]);
  const [gampackSearch, setGampackSearch] = useState('');
  const [loadingGampack, setLoadingGampack] = useState(false);
  const [gampackError, setGampackError] = useState<string | null>(null);

  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const [relations, setRelations] = useState<SimplifiedRelation[]>([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [relationsError, setRelationsError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SORT_STORAGE_KEY, sortOption);
  }, [sortOption]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      PROVIDERS_STORAGE_KEY,
      JSON.stringify(selectedProviders)
    );
  }, [selectedProviders]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadGampack = async () => {
      setLoadingGampack(true);
      setGampackError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', '500');
        if (gampackSearch.trim()) {
          params.set('search', gampackSearch.trim());
        }

        const response = await apiFetch(`/api/gampack?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los productos Gampack.');
        }
        const data = await response.json();
        if (cancelled) return;
        setGampackItems(Array.isArray(data) ? (data as GampackProduct[]) : []);
      } catch (error) {
        if (cancelled) return;
        if ((error as any)?.name === 'AbortError') return;
        console.error('Error fetching Gampack list', error);
        setGampackError(
          error instanceof Error
            ? error.message
            : 'Ocurrió un error al cargar los productos Gampack.'
        );
        setGampackItems([]);
      } finally {
        if (!cancelled) {
          setLoadingGampack(false);
        }
      }
    };

    loadGampack();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gampackSearch]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const idsFromQuery = parseIdsFromQuery(searchParams.getAll('gampack'));
    if (idsFromQuery.length > 0) {
      setSelectedProducts(idsFromQuery);
    }
  }, []);

  useEffect(() => {
    if (selectedProducts.length === 0) {
      setRelations([]);
      setRelationsError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadRelations = async () => {
      setLoadingRelations(true);
      setRelationsError(null);
      try {
        const params = new URLSearchParams();
        selectedProducts.forEach((id) => {
          params.append('gampack', String(id));
        });

        const response = await apiFetch(`/api/relaciones?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('No se pudieron cargar las relaciones.');
        }
        const data = await response.json();
        if (cancelled) return;
        const parsed = Array.isArray(data)
          ? buildSimplifiedRelations(data as RawRelation[])
          : [];
        setRelations(parsed);
      } catch (error) {
        if (cancelled) return;
        if ((error as any)?.name === 'AbortError') return;
        console.error('Error fetching relations', error);
        setRelations([]);
        setRelationsError(
          error instanceof Error
            ? error.message
            : 'Ocurrió un error al cargar las relaciones.'
        );
      } finally {
        if (!cancelled) {
          setLoadingRelations(false);
        }
      }
    };

    loadRelations();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedProducts]);

  const gampackItemsWithRelations = useMemo(
    () => gampackItems.filter((item) => hasActiveRelations(item)),
    [gampackItems]
  );

  const filteredGampackItems = useMemo(() => {
    const normalizedQuery = normalizeSearchTerm(gampackSearch);
    if (!normalizedQuery) return gampackItemsWithRelations;

    return gampackItemsWithRelations
      .map((item) => ({
        item,
        rank: getBestSearchRank([item.nom_interno, item.cod_interno], normalizedQuery),
      }))
      .filter((entry) => entry.rank != null)
      .sort((a, b) => {
        if (a.rank !== b.rank) {
          return (a.rank ?? 0) - (b.rank ?? 0);
        }
        return (a.item.nom_interno ?? '').localeCompare(b.item.nom_interno ?? '', 'es');
      })
      .map((entry) => entry.item);
  }, [gampackItemsWithRelations, gampackSearch]);

  const selectedDetails = useMemo<SelectedSummary[]>(() => {
    const map = new Map(gampackItems.map((item) => [item.id_interno, item] as const));
    return selectedProducts
      .map((id) => {
        const direct = map.get(id);
        if (direct) {
          return {
            id,
            name: direct.nom_interno ?? 'Sin nombre',
            code: direct.cod_interno ?? '—',
            price: direct.precio_final ?? null,
          } satisfies SelectedSummary;
        }

        const fallback = relations.find((relation) => relation.gampackId === id);
        if (fallback) {
          return {
            id,
            name: fallback.gampackName || 'Sin nombre',
            code: fallback.gampackCode || '—',
            price: fallback.gampackPrice ?? null,
          } satisfies SelectedSummary;
        }

        return {
          id,
          name: `Producto ${id}`,
          code: '—',
          price: null,
        } satisfies SelectedSummary;
      });
  }, [gampackItems, relations, selectedProducts]);

  useEffect(() => {
    if (selectedDetails.length === 0) {
      setExpandedGroups([]);
      return;
    }

    setExpandedGroups((current) =>
      current.filter((groupId) =>
        selectedDetails.some((product) => String(product.id) === groupId)
      )
    );
  }, [selectedDetails]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) =>
      current.includes(groupId)
        ? current.filter((value) => value !== groupId)
        : [...current, groupId]
    );
  };

  const uniqueProviders = useMemo(() => {
    const providers = new Set<string>();
    relations.forEach((relation) => {
      providers.add(relation.supplier);
    });
    return Array.from(providers).sort((a, b) => a.localeCompare(b, 'es'));
  }, [relations]);

  useEffect(() => {
    if (uniqueProviders.length === 0) {
      setShowProviderFilter(false);
      setSelectedProviders([]);
      return;
    }

    setSelectedProviders((current) => {
      const sanitized = current.filter((provider) => uniqueProviders.includes(provider));
      if (arraysEqual(sanitized, current)) {
        return current;
      }
      return sanitized;
    });
  }, [uniqueProviders]);

  const filteredAndSortedRelations = useMemo(() => {
    if (relations.length === 0) return [] as SimplifiedRelation[];

    const activeProviders =
      selectedProviders.length === 0 ? null : new Set(selectedProviders);

    const filtered = !activeProviders
      ? relations
      : relations.filter((relation) => activeProviders.has(relation.supplier));

    if (sortOption === 'original') {
      return filtered;
    }

    const sorted = [...filtered];

    if (sortOption === 'gampack') {
      sorted.sort((a, b) => {
        const aDiff = isFiniteNumber(a.differencePct) ? (a.differencePct as number) : Infinity;
        const bDiff = isFiniteNumber(b.differencePct) ? (b.differencePct as number) : Infinity;
        return aDiff - bDiff;
      });
    } else if (sortOption === 'proveedor') {
      sorted.sort((a, b) => {
        const aDiff = isFiniteNumber(a.differencePct) ? (a.differencePct as number) : -Infinity;
        const bDiff = isFiniteNumber(b.differencePct) ? (b.differencePct as number) : -Infinity;
        return bDiff - aDiff;
      });
    }

    return sorted;
  }, [relations, selectedProviders, sortOption]);

  const relationsByGampack = useMemo(() => {
    const grouped = new Map<number | 'unknown', SimplifiedRelation[]>();
    filteredAndSortedRelations.forEach((relation) => {
      const key = relation.gampackId ?? 'unknown';
      const list = grouped.get(key) ?? [];
      list.push(relation);
      grouped.set(key, list);
    });
    return grouped;
  }, [filteredAndSortedRelations]);

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const toggleProvider = (provider: string) => {
    setSelectedProviders((current) => {
      if (uniqueProviders.length === 0) {
        return [];
      }

      const baseline = current.length === 0 ? uniqueProviders : current;
      const hasProvider = baseline.includes(provider);
      const next = hasProvider
        ? baseline.filter((item) => item !== provider)
        : [...baseline, provider];

      if (next.length === uniqueProviders.length) {
        return [];
      }

      const ordered = uniqueProviders.filter((item) => next.includes(item));
      return ordered;
    });
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const baseClasses = [
    'grid grid-cols-1 gap-6 rounded-2xl p-4 md:grid-cols-2 transition-colors duration-300',
    theme === 'dark'
      ? 'bg-slate-950/90 text-gray-100'
      : 'bg-gray-50 text-gray-900',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const panelClasses =
    'flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-transparent dark:bg-gray-900/90 dark:shadow-lg dark:ring-1 dark:ring-black/30';

  const listContainerClasses =
    'relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/40';

  const overlayClasses =
    'absolute inset-0 z-10 flex items-center justify-center bg-white/85 dark:bg-gray-900/70';

  const resultsListClasses =
    'max-h-[70vh] divide-y divide-gray-200 overflow-y-auto dark:divide-gray-800';

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className={baseClasses}>
        <section className={panelClasses}>
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Productos Gampack</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seleccioná uno o varios productos Gampack con relaciones activas para ver detalles.
            </p>
          </header>

          <div className="mb-4 flex flex-col gap-3">
            <Input
              value={gampackSearch}
              onChange={(event) => setGampackSearch(event.target.value)}
              placeholder="Buscar por nombre o código"
              className="border-gray-300 focus:border-green-500 focus:ring-green-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-500/40"
            />

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{loadingGampack ? 'Cargando productos…' : `${filteredGampackItems.length} resultados`}</span>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-full border border-gray-300 px-3 py-1 font-medium text-gray-600 transition hover:border-green-500 hover:text-green-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-green-500 dark:hover:text-white"
              >
                Limpiar selección
              </button>
            </div>
          </div>

          {gampackError && (
            <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {gampackError}
            </p>
          )}

          <div className={listContainerClasses}>
            {loadingGampack && (
              <div className={overlayClasses}>
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-gray-600 dark:text-gray-200" />
                <span className="text-sm text-gray-700 dark:text-gray-200">Cargando productos…</span>
              </div>
            )}

            {!loadingGampack && gampackItemsWithRelations.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No hay productos Gampack con relaciones registradas.
              </div>
            ) : (
              <ul className={resultsListClasses}>
                {filteredGampackItems.length === 0 && !loadingGampack ? (
                  <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No encontramos resultados con ese criterio.
                  </li>
                ) : (
                  filteredGampackItems.map((product) => {
                    const isSelected = selectedProducts.includes(product.id_interno);
                    return (
                      <li
                        key={product.id_interno}
                        onClick={() => toggleProductSelection(product.id_interno)}
                        className={[
                          'cursor-pointer px-4 py-3 transition-colors duration-150',
                          'hover:bg-green-500/10 dark:hover:bg-green-600/20',
                          isSelected
                            ? 'bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-white'
                            : 'text-gray-700 dark:text-gray-200',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{product.nom_interno ?? 'Sin nombre'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Código: {product.cod_interno ?? '—'}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" aria-hidden="true" />
                          )}
                        </div>
                        {product.precio_final != null && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            Precio final: {formatCurrency(product.precio_final)}
                          </p>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </section>

        <section className={panelClasses}>
          <header className="mb-4 flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Productos relacionados</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedProducts.length === 0
                ? 'Seleccioná uno o varios productos Gampack para ver sus relaciones.'
                : 'Compará los precios de proveedores frente a los valores de Gampack.'}
            </p>
          </header>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm transition hover:border-blue-400 dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setShowProviderFilter((open) => !open)}
                disabled={uniqueProviders.length === 0}
              >
                <span>Filtrar por proveedor</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {showProviderFilter && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-[#1a1f2e]">
                  {uniqueProviders.length === 0 ? (
                    <p className="px-4 py-2 text-sm text-gray-500 dark:text-white/70">
                      No hay proveedores disponibles.
                    </p>
                  ) : (
                    uniqueProviders.map((provider) => {
                      const isChecked =
                        selectedProviders.length === 0 || selectedProviders.includes(provider);
                      return (
                        <label
                          key={provider}
                          className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/10"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleProvider(provider)}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-white/20 dark:bg-transparent dark:text-green-400 dark:focus:ring-green-400"
                          />
                          {provider}
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="sm:w-60 min-w-[180px]">
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:focus:border-blue-400/60 dark:focus:ring-blue-500/30"
              >
                <option value="original">Orden original</option>
                <option value="gampack">Primero los Gampack más baratos</option>
                <option value="proveedor">Primero los proveedores más baratos</option>
              </select>
            </div>
          </div>

          {relationsError && (
            <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {relationsError}
            </p>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {selectedDetails.length > 0 ? (
              selectedDetails.map((product) => (
                <span
                  key={product.id}
                  className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-600/20 dark:text-green-200"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {product.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Aún no seleccionaste productos.
              </span>
            )}
          </div>

          {selectedProducts.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-500">
              Seleccioná uno o varios productos Gampack para ver sus relaciones.
            </div>
          ) : loadingRelations ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white/80 p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-gray-600 dark:text-gray-200" /> Cargando relaciones…
            </div>
          ) : filteredAndSortedRelations.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-500">
              No encontramos productos de proveedores relacionados con tu selección.
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {selectedDetails.map((product) => {
                const productRelations = relationsByGampack.get(product.id) ?? [];
                const groupId = String(product.id);
                const isOpen = expandedGroups.includes(groupId);

                return (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 dark:border-white/10 dark:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupId)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-all duration-300 hover:bg-gray-50 dark:hover:bg-white/10"
                      aria-expanded={isOpen}
                    >
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-white/50">
                          Producto Gampack
                        </p>
                        <p className="text-base font-semibold text-gray-800 dark:text-white">{product.name}</p>
                        <p className="text-sm text-gray-500 dark:text-white/60">
                          Código: {product.code ?? '—'} — Precio: {formatCurrency(product.price)}
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 transform text-gray-500 transition-transform duration-300 dark:text-white/60 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="space-y-3 overflow-hidden border-t border-gray-100 bg-gray-50/40 p-4 dark:border-white/10 dark:bg-white/5"
                        >
                          {productRelations.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-gray-300 bg-white/70 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-white/10 dark:text-gray-400">
                              No hay proveedores relacionados para este producto.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {productRelations.map((relation) => {
                                const updatedAt = relation.supplierDate ?? relation.gampackDate ?? null;
                                const differenceValue = isFiniteNumber(relation.differencePct)
                                  ? (relation.differencePct as number)
                                  : null;
                                const differenceText =
                                  differenceValue == null
                                    ? 'Diferencia: — — Datos insuficientes'
                                    : differenceValue < 0
                                    ? `Diferencia: ${safeToFixed(Math.abs(differenceValue), 1)}% — Gampack más barato`
                                    : differenceValue > 0
                                    ? `Diferencia: ${safeToFixed(differenceValue, 1)}% — Proveedor más barato`
                                    : 'Diferencia: 0.0% — Precios iguales';
                                const relationClasses =
                                  differenceValue == null
                                    ? 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5'
                                    : differenceValue < 0
                                    ? 'border-emerald-400/30 bg-emerald-500/10'
                                    : differenceValue > 0
                                    ? 'border-red-400/30 bg-red-500/10'
                                    : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5';
                                const differenceColor =
                                  differenceValue == null
                                    ? 'text-gray-600 dark:text-white/70'
                                    : differenceValue < 0
                                    ? 'text-emerald-400'
                                    : differenceValue > 0
                                    ? 'text-red-400'
                                    : 'text-gray-600 dark:text-white/70';

                                return (
                                  <div
                                    key={relation.id}
                                    className={`rounded-xl border p-3 transition ${relationClasses}`}
                                  >
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                          {relation.supplier} - {relation.supplierProductName}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-white/70">
                                          Código {relation.supplierProductCode} · Actualización {relation.supplierDate ?? '—'}
                                        </p>
                                      </div>
                                      <div className="text-sm text-gray-700 dark:text-gray-200">
                                        <p>Proveedor: {formatCurrency(relation.supplierPrice)}</p>
                                        <p>Gampack: {formatCurrency(relation.gampackPrice)}</p>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <p className={`text-sm font-medium ${differenceColor}`}>{differenceText}</p>
                                      <span className="text-xs text-gray-600 dark:text-white/60">
                                        Actualización consolidada: {updatedAt ?? '—'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {Array.from(relationsByGampack.entries())
                .filter(([key]) => key === 'unknown')
                .map(([, orphanRelations]) => (
                  <article
                    key="unknown"
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition dark:border-gray-800 dark:bg-gray-950/30"
                  >
                    <header className="mb-3">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">Relaciones sin producto interno</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-500">
                        Estos registros no pudieron vincularse a un producto Gampack específico.
                      </p>
                    </header>
                    <ul className="space-y-3">
                      {orphanRelations.map((relation) => {
                        const badge = differenceBadgeConfig(relation.differencePct);
                        const updatedAt = relation.supplierDate ?? relation.gampackDate ?? null;

                        return (
                          <li
                            key={relation.id}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-3 transition hover:border-green-500/60 dark:border-gray-800 dark:bg-gray-900/60"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {relation.supplier} · {relation.supplierProductName}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-500">
                                  Código {relation.supplierProductCode} · Actualización {relation.supplierDate ?? '—'}
                                </p>
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                <p>Proveedor: {formatCurrency(relation.supplierPrice)}</p>
                                <p>Gampack: {formatCurrency(relation.gampackPrice)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <div
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${badge.badgeClasses}`}
                              >
                                <badge.Icon className="h-4 w-4" aria-hidden="true" />
                                <span>
                                  Diferencia: {badge.percentage}
                                  {` — ${badge.label}`}
                                </span>
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-500">
                                Actualización: {updatedAt ?? '—'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export { SimplifiedComparisonView as GampackRelationsView };
