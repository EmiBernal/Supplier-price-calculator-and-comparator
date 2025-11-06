import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

import { apiFetch } from '../lib/api';
import { Input } from './Input';
import { isFiniteNumber, safeToFixed } from '../utils/number';

type GampackProduct = {
  id_interno: number;
  cod_interno: string | null;
  nom_interno: string | null;
  precio_final: number | null;
  fecha: string | null;
  mes_actualizacion?: string | null;
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

const differenceColor = (difference: number | null): string => {
  if (!isFiniteNumber(difference)) return 'text-gray-400';
  if (difference < 0) return 'text-green-400';
  if (difference > 0) return 'text-red-400';
  return 'text-gray-400';
};

const differenceLabel = (difference: number | null): string => {
  if (!isFiniteNumber(difference)) return 'Diferencia: sin datos ⚪';
  const formatted = `${difference > 0 ? '+' : ''}${safeToFixed(difference, 1)}%`;
  if (difference < 0) {
    return `Diferencia: ${formatted} 🟢`;
  }
  if (difference > 0) {
    return `Diferencia: ${formatted} 🔴`;
  }
  return `Diferencia: ${formatted} ⚪`;
};

export const SimplifiedComparisonView: React.FC<SimplifiedComparisonViewProps> = ({
  className,
}) => {
  const [gampackItems, setGampackItems] = useState<GampackProduct[]>([]);
  const [gampackSearch, setGampackSearch] = useState('');
  const [loadingGampack, setLoadingGampack] = useState(false);
  const [gampackError, setGampackError] = useState<string | null>(null);

  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const [relations, setRelations] = useState<SimplifiedRelation[]>([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [relationsError, setRelationsError] = useState<string | null>(null);

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

  const filteredGampackItems = useMemo(() => {
    if (!gampackSearch.trim()) return gampackItems;
    const search = gampackSearch.trim().toLowerCase();
    return gampackItems.filter((item) => {
      const haystack = [item.nom_interno, item.cod_interno]
        .map((value) => value?.toString().toLowerCase() ?? '')
        .join(' ');
      return haystack.includes(search);
    });
  }, [gampackItems, gampackSearch]);

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

  const relationsByGampack = useMemo(() => {
    const grouped = new Map<number | 'unknown', SimplifiedRelation[]>();
    relations.forEach((relation) => {
      const key = relation.gampackId ?? 'unknown';
      const list = grouped.get(key) ?? [];
      list.push(relation);
      grouped.set(key, list);
    });
    return grouped;
  }, [relations]);

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const baseClasses = ['grid grid-cols-1 gap-6 p-4 md:grid-cols-2', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={baseClasses}>
      <section className="flex flex-col rounded-lg bg-gray-900/90 p-4 shadow-lg ring-1 ring-black/30">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-white">Productos Gampack</h2>
          <p className="text-sm text-gray-400">
            Seleccioná uno o varios productos para descubrir sus relaciones con proveedores.
          </p>
        </header>

        <div className="mb-4 flex flex-col gap-3">
          <Input
            value={gampackSearch}
            onChange={(event) => setGampackSearch(event.target.value)}
            placeholder="Buscar por nombre o código"
            className="border-gray-700 bg-gray-950/40 text-gray-100 placeholder:text-gray-500 focus:border-green-400 focus:ring-green-400"
          />

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{loadingGampack ? 'Cargando productos…' : `${filteredGampackItems.length} resultados`}</span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-gray-700 px-3 py-1 font-medium text-gray-300 transition hover:border-green-500 hover:text-white"
            >
              Limpiar selección
            </button>
          </div>
        </div>

        {gampackError && (
          <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {gampackError}
          </p>
        )}

        <div className="relative flex-1 overflow-hidden rounded-lg border border-gray-800">
          {loadingGampack && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/70">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-gray-200" />
              <span className="text-sm text-gray-200">Cargando productos…</span>
            </div>
          )}

          <ul className="max-h-[70vh] divide-y divide-gray-800 overflow-y-auto">
            {filteredGampackItems.length === 0 && !loadingGampack ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500">
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
                      'cursor-pointer px-4 py-3 transition-all',
                      'hover:bg-green-600/20',
                      isSelected
                        ? 'bg-green-600/30 text-white'
                        : 'text-gray-200',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{product.nom_interno ?? 'Sin nombre'}</p>
                        <p className="text-xs text-gray-400">Código: {product.cod_interno ?? '—'}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden="true" />
                      )}
                    </div>
                    {product.precio_final != null && (
                      <p className="mt-2 text-sm text-gray-300">
                        Precio final: {formatCurrency(product.precio_final)}
                      </p>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>

      <section className="flex flex-col rounded-lg bg-gray-900/90 p-4 shadow-lg ring-1 ring-black/30">
        <header className="mb-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-white">Productos relacionados</h2>
          <p className="text-sm text-gray-400">
            {selectedProducts.length === 0
              ? 'Seleccioná uno o varios productos Gampack para ver sus relaciones.'
              : 'Compará los precios de proveedores frente a los valores de Gampack.'}
          </p>
        </header>

        {relationsError && (
          <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {relationsError}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {selectedDetails.length > 0 ? (
            selectedDetails.map((product) => (
              <span
                key={product.id}
                className="inline-flex items-center gap-2 rounded-full bg-green-600/20 px-3 py-1 text-xs font-medium text-green-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {product.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500">
              Aún no seleccionaste productos.
            </span>
          )}
        </div>

        {selectedProducts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-950/40 p-6 text-center text-sm text-gray-500">
            Seleccioná uno o varios productos Gampack para ver sus relaciones.
          </div>
        ) : loadingRelations ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 p-6 text-sm text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-gray-200" /> Cargando relaciones…
          </div>
        ) : relations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-950/40 p-6 text-center text-sm text-gray-500">
            No encontramos productos de proveedores relacionados con tu selección.
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {selectedDetails.map((product) => {
              const productRelations = relationsByGampack.get(product.id) ?? [];

              return (
                <article
                  key={product.id}
                  className="rounded-xl border border-gray-800 bg-gray-950/30 p-4"
                >
                  <header className="mb-3 flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      Producto Gampack
                    </span>
                    <h3 className="text-base font-semibold text-white">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Código {product.code} · Precio {formatCurrency(product.price)}
                    </p>
                  </header>

                  {productRelations.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-800 bg-gray-950/40 px-3 py-2 text-sm text-gray-500">
                      No hay proveedores relacionados para este producto.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {productRelations.map((relation) => (
                        <li
                          key={relation.id}
                          className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 transition hover:border-green-500/60"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {relation.supplier} · {relation.supplierProductName}
                              </p>
                              <p className="text-xs text-gray-500">
                                Código {relation.supplierProductCode} · Actualización {relation.supplierDate ?? '—'}
                              </p>
                            </div>
                            <div className="text-sm text-gray-300">
                              <p>Proveedor: {formatCurrency(relation.supplierPrice)}</p>
                              <p>Gampack: {formatCurrency(relation.gampackPrice)}</p>
                            </div>
                          </div>
                          <p className={`mt-3 text-sm font-semibold ${differenceColor(relation.differencePct)}`}>
                            {differenceLabel(relation.differencePct)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}

            {Array.from(relationsByGampack.entries())
              .filter(([key]) => key === 'unknown')
              .map(([, orphanRelations]) => (
                <article key="unknown" className="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
                  <header className="mb-3">
                    <h3 className="text-base font-semibold text-white">Relaciones sin producto interno</h3>
                    <p className="text-xs text-gray-500">
                      Estos registros no pudieron vincularse a un producto Gampack específico.
                    </p>
                  </header>
                  <ul className="space-y-3">
                    {orphanRelations.map((relation) => (
                      <li
                        key={relation.id}
                        className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 transition hover:border-green-500/60"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {relation.supplier} · {relation.supplierProductName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Código {relation.supplierProductCode} · Actualización {relation.supplierDate ?? '—'}
                            </p>
                          </div>
                          <div className="text-sm text-gray-300">
                            <p>Proveedor: {formatCurrency(relation.supplierPrice)}</p>
                            <p>Gampack: {formatCurrency(relation.gampackPrice)}</p>
                          </div>
                        </div>
                        <p className={`mt-3 text-sm font-semibold ${differenceColor(relation.differencePct)}`}>
                          {differenceLabel(relation.differencePct)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
          </div>
        )}
      </section>
    </div>
  );
};

export { SimplifiedComparisonView as GampackRelationsView };
