import React, { useState, useEffect, useMemo } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table } from '../components/Table';
import { PriceComparison } from '../tipos/database';
import { Search, List, LayoutGrid, XCircle, CalendarDays } from 'lucide-react';
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

  // ---- Helpers de fechas (evita off-by-one con timezones) ----
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
      if (dateRangeInvalid) return; // evita llamadas con rango inválido
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
      const response = await fetch(url);
      const data = await response.json();
      setComparisons(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading comparisons:', error);
      setComparisons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutChange = () => {
    setLayout((prev) => (prev === 'detailed' ? 'table' : 'detailed'));
  };

  const getDifference = (internal?: number, external?: number) => {
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Comparar Gampacks" />

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-2">
          {/* Buscador alineado con label + icono */}
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Buscar</label>
            <div className="relative">
              <Input
                aria-label="Buscar por nombre o código"
                placeholder="Buscar por nombre o código"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring focus:border-blue-300 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring focus:border-blue-300 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Familia (categoría)</label>
            <Input
              aria-label="Familia"
              placeholder="Ej: bolsas, films..."
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-sm"
            >
              <XCircle size={18} className="mr-2" />
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Atajos de fecha */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center text-xs text-gray-500">
            <CalendarDays className="mr-1" size={14} /> Atajos:
          </span>
          <button
            type="button"
            onClick={() => setLastNDays(7)}
            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={() => setLastNDays(30)}
            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
          >
            Últimos 30 días
          </button>
          <button
            type="button"
            onClick={setThisMonth}
            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
          >
            Este mes
          </button>
        </div>

        {/* Aviso de rango inválido */}
        {dateRangeInvalid && (
          <div className="mb-3 text-sm text-red-600">
            El rango de fechas es inválido: <strong>Desde</strong> no puede ser mayor que <strong>Hasta</strong>.
          </div>
        )}

        {/* Header acciones */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">
            Total productos: <strong>{comparisons.length}</strong>
            {(dateFrom || dateTo) && (
              <span className="ml-2 text-gray-500">
                {dateFrom ? `Desde ${dateFrom}` : ''}{dateFrom && dateTo ? ' · ' : ''}{dateTo ? `Hasta ${dateTo}` : ''}
              </span>
            )}
          </p>
          <button
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded flex items-center"
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
              { key: 'internalProduct', label: 'Producto Interno', sortable: true, render: (v) => v ?? '—' },
              { key: 'externalProduct', label: 'Producto Proveedor', sortable: true, render: (v) => v ?? '—' },
              {
                key: 'internalFinalPrice',
                label: 'Final Interno',
                sortable: true,
                render: (v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '—'),
              },
              {
                key: 'externalFinalPrice',
                label: 'Final Proveedor',
                sortable: true,
                render: (v) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '—'),
              },
              { key: 'internalDate', label: 'Fecha Interna', render: (v) => v ?? '—' },
              { key: 'externalDate', label: 'Fecha Proveedor', render: (v) => v ?? '—' },
              { key: 'supplier', label: 'Proveedor', render: (v) => v ?? '—' },
              {
                key: 'priceDifference',
                label: 'Diferencia',
                render: (_v, row) => {
                  const diff = getDifference(
                    row.internalFinalPrice as number | undefined,
                    row.externalFinalPrice as number | undefined
                  );
                  return (
                    <span className="transition-all duration-300 font-medium text-indigo-600">
                      {diff === null ? 'N/A' : `${diff}%`}
                    </span>
                  );
                },
              },
            ]}
            data={comparisons}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {loading && (
              <div className="text-sm text-gray-500">Cargando...</div>
            )}
            {!loading && comparisons.map((item, i) => {
              const internalPrice = typeof item.internalFinalPrice === 'number' ? item.internalFinalPrice : undefined;
              const externalPrice = typeof item.externalFinalPrice === 'number' ? item.externalFinalPrice : undefined;
              const diff = getDifference(internalPrice, externalPrice);

              return (
                <div key={i} className="border rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition duration-300">
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-2">
                    <div>
                      <p className="text-gray-500">Fecha Interna</p>
                      <p>{item.internalDate ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">Fecha Proveedor</p>
                      <p>{item.externalDate ?? '—'}</p>
                      <p className="text-gray-500 mt-1">
                        Proveedor: <span className="font-semibold text-gray-700">{item.supplier ?? '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <p className="text-xs text-gray-500">Producto Gampack</p>
                      <p className="text-base font-semibold text-gray-800">{item.internalProduct ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-1">Precio Interno</p>
                      <p className="text-lg font-bold text-green-600">
                        {internalPrice != null ? `$${internalPrice.toFixed(2)}` : '—'}
                      </p>
                    </div>
                    <div className="text-center flex flex-col justify-end">
                      <p className="text-xs text-gray-500">Diferencia</p>
                      <p className="text-lg font-semibold text-indigo-600 transition-all duration-300">
                        {diff === null ? 'N/A' : `${diff}%`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Producto Proveedor</p>
                      <p className="text-base font-semibold text-gray-800">{item.externalProduct ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-1">Precio Proveedor</p>
                      <p className="text-lg font-bold text-blue-600">
                        {externalPrice != null ? `$${externalPrice.toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && comparisons.length === 0 && (
              <div className="text-sm text-gray-500">No hay resultados para los filtros seleccionados.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
