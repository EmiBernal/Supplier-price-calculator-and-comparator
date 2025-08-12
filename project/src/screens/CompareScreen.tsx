import React, { useState, useEffect, useMemo } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table } from '../components/Table';
import { PriceComparison } from '../tipos/database';
import { Search, List, LayoutGrid, CalendarDays, XCircle } from 'lucide-react';
import { Screen } from '../types';

interface CompareScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const CompareScreen: React.FC<CompareScreenProps> = ({ onNavigate }) => {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<'table' | 'detailed'>('detailed');

  // Filtros
  const [dateFrom, setDateFrom] = useState(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState('');     // YYYY-MM-DD
  const [familia, setFamilia] = useState('');

  // Helpers fecha (evita off-by-one por timezone)
  const toYMD = (d: Date) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const setLastNDays = (n: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (n - 1));
    setDateFrom(toYMD(start));
    setDateTo(toYMD(end));
  };
  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(toYMD(start));
    setDateTo(toYMD(end));
  };

  const dateRangeInvalid = useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    return new Date(dateFrom) > new Date(dateTo);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadComparisons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (dateRangeInvalid) return;
      loadComparisons(searchTerm);
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, dateFrom, dateTo, familia, dateRangeInvalid]);

  const loadComparisons = async (search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (familia) params.append('familia', familia);

      const url = `/api/price-comparisons?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      setComparisons(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading comparisons:', err);
      setComparisons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutChange = () => {
    setLayout((prev) => (prev === 'detailed' ? 'table' : 'detailed'));
  };

  const getDifference = (internal?: number | null, external?: number | null) => {
    if (external == null || external === 0 || internal == null) return null;
    const diff = ((internal - external) / external) * 100;
    return parseFloat(diff.toFixed(2));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setFamilia('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Comparar Gampacks" />

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-2">
          {/* Buscar */}
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Buscar</label>
            <div className="relative">
              <Input
                aria-label="Buscar por nombre o código"
                placeholder="Buscar por nombre o código"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-white/70 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Desde */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
            />
          </div>

          {/* Hasta */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
            />
          </div>

          {/* Familia */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Familia (categoría)</label>
            <Input
              placeholder="Ej: bolsas, films..."
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
              className="dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20"
            />
          </div>

          {/* Limpiar */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-3 py-2 rounded text-sm
                         bg-gray-200 hover:bg-gray-300
                         dark:bg-white/10 dark:hover:bg-white/20 dark:text-white
                         border border-transparent dark:border-white/10"
            >
              <span className="inline-flex items-center justify-center">
                <XCircle size={18} className="mr-2" />
                Limpiar filtros
              </span>
            </button>
          </div>
        </div>

        {/* Atajos de fecha */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center text-xs text-gray-600 dark:text-white/80">
            <CalendarDays className="mr-1" size={14} /> Atajos:
          </span>
          <button
            type="button"
            onClick={() => setLastNDays(7)}
            className="px-2 py-1 text-xs rounded border
                       border-gray-300 dark:border-white/10
                       text-gray-700 dark:text-white
                       bg-white dark:bg-white/10
                       hover:bg-gray-100 dark:hover:bg-white/20"
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={() => setLastNDays(30)}
            className="px-2 py-1 text-xs rounded border
                       border-gray-300 dark:border-white/10
                       text-gray-700 dark:text-white
                       bg-white dark:bg-white/10
                       hover:bg-gray-100 dark:hover:bg-white/20"
          >
            Últimos 30 días
          </button>
          <button
            type="button"
            onClick={setThisMonth}
            className="px-2 py-1 text-xs rounded border
                       border-gray-300 dark:border-white/10
                       text-gray-700 dark:text-white
                       bg-white dark:bg-white/10
                       hover:bg-gray-100 dark:hover:bg-white/20"
          >
            Este mes
          </button>
        </div>

        {/* Aviso rango inválido */}
        {dateRangeInvalid && (
          <div className="mb-3 text-sm text-red-600 dark:text-red-400">
            El rango de fechas es inválido: <strong>Desde</strong> no puede ser mayor que <strong>Hasta</strong>.
          </div>
        )}

        {/* Header acciones */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-700 dark:text-white">
            Total productos: <strong className="dark:text-white">{comparisons.length}</strong>
            {(dateFrom || dateTo) && (
              <span className="ml-2 text-gray-600 dark:text-white/70">
                {dateFrom ? `Desde ${dateFrom}` : ''}{dateFrom && dateTo ? ' · ' : ''}{dateTo ? `Hasta ${dateTo}` : ''}
              </span>
            )}
          </p>
          <button
            className="px-3 py-2 rounded flex items-center
                       bg-gray-200 hover:bg-gray-300
                       dark:bg-white/10 dark:hover:bg-white/20 dark:text-white
                       border border-transparent dark:border-white/10"
            onClick={handleLayoutChange}
          >
            {layout === 'detailed' ? <List size={18} /> : <LayoutGrid size={18} />}
            <span className="ml-2 text-sm">Cambiar vista</span>
          </button>
        </div>

        {/* Contenido */}
        {layout === 'table' ? (
          <Table
            columns={[
              { key: 'internalProduct', label: 'Producto Interno', sortable: true, render: (v) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'externalProduct', label: 'Producto Proveedor', sortable: true, render: (v) => <span className="dark:text-white">{v ?? '—'}</span> },
              {
                key: 'internalFinalPrice',
                label: 'Final Interno',
                sortable: true,
                render: (v) => <span className="dark:text-white">{typeof v === 'number' ? `$${v.toFixed(2)}` : '—'}</span>,
              },
              {
                key: 'externalFinalPrice',
                label: 'Final Proveedor',
                sortable: true,
                render: (v) => <span className="dark:text-white">{typeof v === 'number' ? `$${v.toFixed(2)}` : '—'}</span>,
              },
              { key: 'internalDate', label: 'Fecha Interna', render: (v) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'externalDate', label: 'Fecha Proveedor', render: (v) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'supplier', label: 'Proveedor', render: (v) => <span className="dark:text-white">{v ?? '—'}</span> },
              {
                key: 'priceDifference',
                label: 'Diferencia',
                render: (_v, row) => {
                  const diff = getDifference(row.internalFinalPrice as number | null, row.externalFinalPrice as number | null);
                  return (
                    <span className="inline-block px-2 py-0.5 rounded dark:bg-white/10 dark:text-white font-medium">
                      {diff == null ? 'N/A' : `${diff}%`}
                    </span>
                  );
                },
              },
            ]}
            data={comparisons}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {loading && <div className="text-sm text-gray-600 dark:text-white/70">Cargando...</div>}
            {!loading && comparisons.map((item, i) => {
              const internal = typeof item.internalFinalPrice === 'number' ? item.internalFinalPrice : null;
              const external = typeof item.externalFinalPrice === 'number' ? item.externalFinalPrice : null;
              const diff = getDifference(internal, external);

              return (
                <div
                  key={i}
                  className="border rounded-xl p-4 shadow-sm
                             bg-white dark:bg-white/5
                             border-gray-200 dark:border-white/10
                             hover:shadow-md transition duration-300"
                >
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-700 dark:text-white/80 mb-2">
                    <div>
                      <p className="text-gray-500 dark:text-white/60">Fecha Interna</p>
                      <p className="font-medium dark:text-white">{item.internalDate ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 dark:text-white/60">Fecha Proveedor</p>
                      <p className="font-medium dark:text-white">{item.externalDate ?? '—'}</p>
                      <p className="text-gray-500 dark:text-white/60 mt-1">
                        Proveedor: <span className="font-semibold text-gray-900 dark:text-white">{item.supplier ?? '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-white/60">Producto Gampack</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{item.internalProduct ?? '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-white/60 mt-1">Precio Interno</p>
                      <p className="text-lg font-bold text-green-600">
                        {internal != null ? `$${internal.toFixed(2)}` : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-white/60">Diferencia</p>
                      <p className="text-lg font-semibold dark:text-white bg-white/10 inline-block px-2 py-0.5 rounded">
                        {diff == null ? 'N/A' : `${diff}%`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-white/60">Producto Proveedor</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{item.externalProduct ?? '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-white/60 mt-1">Precio Externo</p>
                      <p className="text-lg font-bold text-blue-600">
                        {external != null ? `$${external.toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && comparisons.length === 0 && (
              <div className="text-sm text-gray-600 dark:text-white/70">No hay resultados para los filtros seleccionados.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
