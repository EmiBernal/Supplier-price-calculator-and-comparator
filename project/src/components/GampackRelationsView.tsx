import React, { useEffect, useMemo, useState } from 'react';
import { Input } from './Input';
import { Table, Column } from './Table';
import { apiFetch } from '../lib/api';
import { Loader2, ArrowUpDown, ChevronDown, ChevronUp, Filter } from 'lucide-react';

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

export type RelationRow = {
  id: number;
  supplier: string;
  externalId: number | null;
  externalCode: string;
  externalName: string;
  externalPrice: number | null;
  externalDate: string | null;
  gampackId: number | null;
  gampackCode: string;
  gampackName: string;
  gampackPrice: number | null;
  gampackDate: string | null;
  relationCriteria: string;
  relationCreatedAt: string | null;
};

const DEFAULT_COLUMN_KEYS: Array<keyof RelationRow> = [
  'supplier',
  'externalCode',
  'externalName',
  'externalPrice',
  'externalDate',
  'gampackCode',
  'gampackName',
  'gampackPrice',
  'gampackDate',
  'relationCriteria',
];

const DEFAULT_COLUMNS: Column<RelationRow>[] = [
  {
    key: 'supplier',
    label: 'Proveedor',
    sortable: true,
  },
  {
    key: 'externalCode',
    label: 'Código externo',
    sortable: true,
    render: (value: string) => value || '—',
  },
  {
    key: 'externalName',
    label: 'Producto proveedor',
    sortable: true,
    render: (value: string) => value || '—',
  },
  {
    key: 'externalPrice',
    label: 'Precio proveedor',
    sortable: true,
    align: 'right',
    render: (value: number | null) =>
      typeof value === 'number' ? `$${value.toFixed(2)}` : '—',
  },
  {
    key: 'externalDate',
    label: 'Actualización proveedor',
    sortable: true,
    render: (value: string | null) => value ?? '—',
  },
  {
    key: 'gampackCode',
    label: 'Código Gampack',
    sortable: true,
    render: (value: string) => value || '—',
  },
  {
    key: 'gampackName',
    label: 'Producto Gampack',
    sortable: true,
    render: (value: string) => value || '—',
  },
  {
    key: 'gampackPrice',
    label: 'Precio Gampack',
    sortable: true,
    align: 'right',
    render: (value: number | null) =>
      typeof value === 'number' ? `$${value.toFixed(2)}` : '—',
  },
  {
    key: 'gampackDate',
    label: 'Actualización Gampack',
    sortable: true,
    render: (value: string | null) => value ?? '—',
  },
  {
    key: 'relationCriteria',
    label: 'Criterio de relación',
    sortable: true,
    render: (value: string) => value || '—',
  },
];

const columnConfigMap: Record<string, Column<RelationRow>> = DEFAULT_COLUMNS.reduce(
  (acc, column) => {
    acc[String(column.key)] = column;
    return acc;
  },
  {} as Record<string, Column<RelationRow>>
);

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

interface GampackRelationsViewProps {
  className?: string;
}

export const GampackRelationsView: React.FC<GampackRelationsViewProps> = ({
  className,
}) => {
  const [gampackItems, setGampackItems] = useState<GampackProduct[]>([]);
  const [loadingGampack, setLoadingGampack] = useState(false);
  const [gampackError, setGampackError] = useState<string | null>(null);
  const [gampackSearch, setGampackSearch] = useState('');

  const [selectedGampacks, setSelectedGampacks] = useState<number[]>([]);

  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [relationsError, setRelationsError] = useState<string | null>(null);

  const [relationSearch, setRelationSearch] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  const [columnOrder, setColumnOrder] = useState<Array<keyof RelationRow>>(
    DEFAULT_COLUMN_KEYS
  );
  const [sortKey, setSortKey] = useState<keyof RelationRow | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
        setGampackItems(Array.isArray(data) ? data : []);
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
      setSelectedGampacks(idsFromQuery);
    }
  }, []);

  useEffect(() => {
    if (selectedGampacks.length === 0) {
      setRelations([]);
      setSelectedProviders([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadRelations = async () => {
      setLoadingRelations(true);
      setRelationsError(null);
      try {
        const params = new URLSearchParams();
        selectedGampacks.forEach((id) => {
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
          ? buildRelationRows(data as RawRelation[])
          : [];
        setRelations(parsed);
        setSelectedProviders((current) => {
          const providers = new Set(
            parsed.map((row) => row.supplier).filter((name) => !!name)
          );
          if (providers.size === 0) return [];
          if (current.length === 0) return Array.from(providers);
          return current.filter((name) => providers.has(name));
        });
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
  }, [selectedGampacks]);

  const providerOptions = useMemo(() => {
    const providers = new Set<string>();
    relations.forEach((relation) => {
      if (relation.supplier) {
        providers.add(relation.supplier);
      }
    });
    return Array.from(providers).sort((a, b) => a.localeCompare(b, 'es'));
  }, [relations]);

  useEffect(() => {
    if (providerOptions.length > 0 && selectedProviders.length === 0) {
      setSelectedProviders(providerOptions);
    }
  }, [providerOptions, selectedProviders.length]);

  const filteredRelations = useMemo(() => {
    const search = relationSearch.trim().toLowerCase();
    const allowedProviders = new Set(selectedProviders);

    return relations.filter((relation) => {
      if (allowedProviders.size > 0 && !allowedProviders.has(relation.supplier)) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        relation.externalCode,
        relation.externalName,
        relation.gampackCode,
        relation.gampackName,
        relation.supplier,
      ]
        .map((value) => value?.toString().toLowerCase() ?? '')
        .join(' ');

      return haystack.includes(search);
    });
  }, [relations, relationSearch, selectedProviders]);

  const sortedRelations = useMemo(() => {
    const rows = [...filteredRelations];
    if (!sortKey) return rows;

    const compare = (a: RelationRow, b: RelationRow) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return -1;
      if (valueB == null) return 1;

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueA - valueB;
      }

      const dateKeys: Array<keyof RelationRow> = [
        'externalDate',
        'gampackDate',
        'relationCreatedAt',
      ];
      if (dateKeys.includes(sortKey)) {
        const aTime = Date.parse(String(valueA));
        const bTime = Date.parse(String(valueB));
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return -1;
        if (Number.isNaN(bTime)) return 1;
        return aTime - bTime;
      }

      return String(valueA).localeCompare(String(valueB), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    };

    rows.sort(compare);
    if (sortDirection === 'desc') {
      rows.reverse();
    }
    return rows;
  }, [filteredRelations, sortDirection, sortKey]);

  const orderedColumns = useMemo(() => {
    return columnOrder
      .map((key) => columnConfigMap[String(key)])
      .filter((column): column is Column<RelationRow> => Boolean(column));
  }, [columnOrder]);

  const toggleGampackSelection = (id: number, checked: boolean) => {
    setSelectedGampacks((current) => {
      const selection = new Set(current);
      if (checked) {
        selection.add(id);
      } else {
        selection.delete(id);
      }
      return Array.from(selection);
    });
  };

  const toggleProvider = (name: string, checked: boolean) => {
    setSelectedProviders((current) => {
      const set = new Set(current);
      if (checked) {
        set.add(name);
      } else {
        set.delete(name);
      }
      return Array.from(set);
    });
  };

  const handleSort = (key: keyof RelationRow) => {
    setSortDirection((current) =>
      sortKey === key ? (current === 'asc' ? 'desc' : 'asc') : 'asc'
    );
    setSortKey(key);
  };

  const moveColumn = (key: keyof RelationRow, direction: 'up' | 'down') => {
    setColumnOrder((current) => {
      const index = current.indexOf(key);
      if (index === -1) return current;
      const next = [...current];
      if (direction === 'up' && index > 0) {
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
      } else if (direction === 'down' && index < current.length - 1) {
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
      }
      return next;
    });
  };

  const resetColumns = () => setColumnOrder(DEFAULT_COLUMN_KEYS);

  const gampackList = useMemo(() => {
    const search = gampackSearch.trim().toLowerCase();
    if (!search) return gampackItems;
    return gampackItems.filter((item) => {
      const composite = [item.cod_interno, item.nom_interno]
        .map((value) => value?.toLowerCase() ?? '')
        .join(' ');
      return composite.includes(search);
    });
  }, [gampackItems, gampackSearch]);

  const selectedCount = selectedGampacks.length;
  const relationsCount = sortedRelations.length;

  return (
    <div className={['flex flex-col gap-4', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Relación de productos Gampack
          </h2>
          <p className="text-sm text-gray-600 dark:text-white/70">
            {selectedCount > 0 || relationsCount > 0 ? (
              <span>
                {selectedCount}{' '}
                {selectedCount === 1
                  ? 'producto Gampack seleccionado'
                  : 'productos Gampack seleccionados'}{' '}
                — {relationsCount}{' '}
                {relationsCount === 1
                  ? 'producto relacionado encontrado'
                  : 'productos relacionados encontrados'}
              </span>
            ) : (
              'Seleccioná productos Gampack para ver las relaciones.'
            )}
          </p>
        </div>
        {relationsError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            {relationsError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <section className="lg:w-5/12 xl:w-1/3">
          <div className="flex h-full flex-col gap-3 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <header className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Productos Gampack
                </h3>
                <p className="text-xs text-gray-500 dark:text-white/60">
                  Seleccioná uno o más productos para ver los proveedores relacionados.
                </p>
              </div>
              {loadingGampack && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-white/60" />
              )}
            </header>

            <Input
              value={gampackSearch}
              onChange={(event) => setGampackSearch(event.target.value)}
              placeholder="Buscar por nombre o código"
              className="dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
            />

            {gampackError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                {gampackError}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/60">
              <span>{gampackList.length} resultados</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                  onClick={() => setSelectedGampacks(gampackList.map((item) => item.id_interno))}
                  disabled={gampackList.length === 0}
                >
                  Seleccionar visibles
                </button>
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                  onClick={() => setSelectedGampacks([])}
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-gray-100 bg-white/70 dark:border-white/10 dark:bg-white/5" style={{ maxHeight: '420px' }}>
              {gampackList.length === 0 && !loadingGampack ? (
                <p className="px-4 py-6 text-sm text-gray-500 dark:text-white/60">
                  No se encontraron productos con los filtros aplicados.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/10">
                  {gampackList.map((item) => {
                    const id = item.id_interno;
                    const checked = selectedGampacks.includes(id);
                    return (
                      <li
                        key={id}
                        className="flex items-start gap-3 px-4 py-3 text-sm text-gray-700 transition hover:bg-blue-50/60 dark:text-white/80 dark:hover:bg-white/10"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-white/20 dark:bg-transparent"
                          checked={checked}
                          onChange={(event) => toggleGampackSelection(id, event.target.checked)}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {item.nom_interno ?? 'Sin nombre'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-white/60">
                            Código: {item.cod_interno ?? '—'}
                          </span>
                          {item.precio_final != null && (
                            <span className="text-xs text-gray-500 dark:text-white/60">
                              Precio final: ${Number(item.precio_final).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="flex-1">
          <div className="flex h-full flex-col gap-4 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Productos relacionados
                </h3>
                <p className="text-xs text-gray-500 dark:text-white/60">
                  Visualizá los productos externos vinculados a los Gampack seleccionados.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/60">
                  <Filter className="h-3.5 w-3.5" />
                  {selectedProviders.length} / {providerOptions.length} proveedores
                </div>
                <button
                  type="button"
                  onClick={resetColumns}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" /> Reset columnas
                </button>
              </div>
            </header>

            <div className="grid gap-3 lg:grid-cols-2">
              <Input
                value={relationSearch}
                onChange={(event) => setRelationSearch(event.target.value)}
                placeholder="Filtrar por proveedor, código o nombre"
                className="dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
              />

              <div className="rounded-xl border border-gray-100 bg-white/70 p-3 text-xs shadow-sm dark:border-white/10 dark:bg-white/5">
                <p className="mb-2 font-semibold text-gray-700 dark:text-white/80">Filtrar por proveedor</p>
                {providerOptions.length === 0 ? (
                  <p className="text-gray-500 dark:text-white/60">
                    No hay proveedores para la selección actual.
                  </p>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                    {providerOptions.map((provider) => {
                      const checked = selectedProviders.includes(provider);
                      return (
                        <label
                          key={provider}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-gray-600 transition hover:bg-blue-50/60 dark:text-white/70 dark:hover:bg-white/10"
                        >
                          <span className="flex-1 text-xs font-medium text-gray-700 dark:text-white">
                            {provider}
                          </span>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-white/20 dark:bg-transparent"
                            checked={checked}
                            onChange={(event) => toggleProvider(provider, event.target.checked)}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                {providerOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                      onClick={() => setSelectedProviders(providerOptions)}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                      onClick={() => setSelectedProviders([])}
                    >
                      Ninguno
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-white/80">
                Ordenar columnas
              </p>
              <div className="flex flex-col gap-2">
                {columnOrder.map((columnKey) => {
                  const column = columnConfigMap[String(columnKey)];
                  if (!column) return null;
                  return (
                    <div
                      key={String(columnKey)}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-white/10 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                    >
                      <span className="font-medium">{column.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveColumn(columnKey, 'up')}
                          className="rounded-full border border-gray-200 p-1 text-gray-500 transition hover:border-blue-200 hover:text-blue-600 dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white"
                          aria-label={`Subir columna ${column.label}`}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumn(columnKey, 'down')}
                          className="rounded-full border border-gray-200 p-1 text-gray-500 transition hover:border-blue-200 hover:text-blue-600 dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white"
                          aria-label={`Bajar columna ${column.label}`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              {selectedGampacks.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-white/20 dark:bg-white/5 dark:text-white/70">
                  Seleccioná uno o más productos Gampack para ver sus relaciones.
                </div>
              ) : loadingRelations ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-gray-200 bg-white/70 p-6 text-sm text-gray-500 shadow-inner dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando relaciones...
                </div>
              ) : relations.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-white/20 dark:bg-white/5 dark:text-white/70">
                  No hay productos relacionados para la selección actual.
                </div>
              ) : (
                <Table
                  data={sortedRelations}
                  columns={orderedColumns}
                  onSort={handleSort}
                  sortKey={sortKey || undefined}
                  sortDirection={sortDirection}
                  emptyMessage="No hay productos relacionados para la selección actual"
                  className="h-full"
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

function buildRelationRows(rows: RawRelation[]): RelationRow[] {
  const seen = new Map<string, RelationRow>();

  rows.forEach((row) => {
    const supplier = (row.proveedor ?? '').trim() || 'Sin proveedor';
    const externalCode = row.cod_externo ?? '';
    const externalName = row.nom_externo ?? '';
    const gampackCode = row.cod_interno ?? '';
    const gampackName = row.nom_interno ?? '';

    const key = [supplier, row.id_lista_precios ?? '', externalCode, externalName]
      .map((value) => String(value ?? '').toLowerCase().trim())
      .join('|');

    if (seen.has(key)) {
      return;
    }

    seen.set(key, {
      id: row.id,
      supplier,
      externalId: row.id_lista_precios,
      externalCode: externalCode || '—',
      externalName: externalName || 'Sin nombre',
      externalPrice: row.precio_externo ?? null,
      externalDate: row.fecha_externa ?? null,
      gampackId: row.id_lista_interna ?? null,
      gampackCode: gampackCode || '—',
      gampackName: gampackName || 'Sin nombre',
      gampackPrice: row.precio_interno ?? null,
      gampackDate: row.fecha_interna ?? null,
      relationCriteria: row.criterio_relacion ?? '',
      relationCreatedAt: row.relation_created_at ?? null,
    });
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.supplier.localeCompare(b.supplier, 'es')
  );
}

