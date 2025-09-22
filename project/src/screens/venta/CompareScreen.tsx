import React, { useState, useEffect, useMemo } from 'react';
import { Navigation } from '../../components/Navigation';
import { Input } from '../../components/Input';
import { Table } from '../../components/Table';
import { Select } from '../../components/Select';
import { PriceComparison } from '../../tipos/database';
import { Search, List, LayoutGrid, CalendarDays, XCircle } from 'lucide-react';
import { Screen } from '../../types';
import { apiFetch } from '../../lib/api';
import { TAXONOMY } from '../../lib/taxonomy';

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
  const [famGenSel, setFamGenSel] = useState('');
  const [famEspSel, setFamEspSel] = useState('');

  // ===== Helpers de fecha =====
  // Convierte Date -> 'YYYY-MM-DD' usando la zona local (sin desfase)
  const toYMD = (d: Date) => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  // Setea un rango [from, to] (inclusive) con seguridad de zona horaria
  const setRange = (from: Date, to: Date) => {
    setDateFrom(toYMD(from));
    setDateTo(toYMD(to));
  };

  // Atajos:
  const setToday = () => {
    const t = new Date();
    setRange(t, t);
  };
  const setYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    setRange(y, y);
  };
  const setBeforeYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    setRange(d, d);
  };
  // Últimos N días (incluye hoy). Ej: N=7 -> hoy y los 6 anteriores
  const setLastNDays = (n: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (n - 1));
    setRange(start, end);
  };
  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setRange(start, end);
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
  }, [searchTerm, dateFrom, dateTo, famGenSel, famEspSel, dateRangeInvalid]);

  // Construye el valor que mandamos como `familia` al backend
  const buildFamiliaQuery = () => {
    if (famGenSel && famEspSel) return `${famGenSel} > ${famEspSel}`; // p.ej. "Desechables > Vasos"
    if (famGenSel) return famGenSel;                                   // p.ej. "Desechables"
    return '';
  };

  const loadComparisons = async (search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const familiaQuery = buildFamiliaQuery();
      if (familiaQuery) params.append('familia', familiaQuery);

      // 🔒 clave: solo pares presentes en relacion_articulos
      params.append('onlyRelated', '1');

      const url = `/api/price-comparisons?${params.toString()}`;
      const res = await apiFetch(url);
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

  // Helpers diferencia
  const getDifferencePct = (internal?: number | null, external?: number | null) => {
    if (external == null || external === 0 || internal == null) return null;
    const diff = ((internal - external) / external) * 100;
    return parseFloat(diff.toFixed(2));
  };
  const getDifferenceAmt = (internal?: number | null, external?: number | null) => {
    if (internal == null || external == null) return null;
    const amt = internal - external;
    return parseFloat(amt.toFixed(2));
  };
  const formatSignedMoney = (n: number) => {
    const sign = n > 0 ? '+' : n < 0 ? '−' : '';
    const abs = Math.abs(n).toFixed(2);
    return `${sign}$${abs}`;
  };

  // Veredicto textual
  function getVerdict(internal?: number | null, external?: number | null) {
    if (internal == null || external == null) {
      return {
        tone: 'na' as const,
        text: 'Sin suficientes datos para comparar.',
        classes: 'text-gray-600 dark:text-white/70'
      };
    }
    if (internal < external) {
      const ahorro = external - internal;
      const pct = (ahorro / external) * 100;
      return {
        tone: 'cheaper' as const,
        text: `Gampack es más barato: ahorrás $${ahorro.toFixed(2)} (${pct.toFixed(2)}%) frente al proveedor.`,
        classes:
          'bg-green-50 text-green-800 border-green-300/40 dark:bg-green-500/10 dark:text-green-200 dark:border-green-500/20'
      };
    }
    if (internal > external) {
      const extra = internal - external;
      const pct = (extra / external) * 100;
      return {
        tone: 'expensive' as const,
        text: `Gampack es más caro: +$${extra.toFixed(2)} (+${pct.toFixed(2)}%) vs el proveedor.`,
        classes:
          'bg-red-50 text-red-800 border-red-300/40 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/20'
      };
    }
    return {
      tone: 'equal' as const,
      text: 'Mismo precio que el proveedor.',
      classes:
        'bg-gray-50 text-gray-800 border-gray-300/40 dark:bg-white/5 dark:text-white dark:border-white/10'
    };
  }

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setFamGenSel('');
    setFamEspSel('');
  };

  const familyOptions = useMemo(() => [
    { value: '', label: 'Todas las familias' },
    ...TAXONOMY.map((family) => ({ value: family.value, label: family.label })),
  ], []);

  const subfamilyOptions = useMemo(() => {
    if (!famGenSel) return [{ value: '', label: 'Todas las subfamilias' }];
    const family = TAXONOMY.find((item) => item.value === famGenSel);
    if (!family) return [{ value: '', label: 'Todas las subfamilias' }];
    return [
      { value: '', label: 'Todas las subfamilias' },
      ...family.subfamilies.map((sub) => ({ value: sub.value, label: sub.label })),
    ];
  }, [famGenSel]);

  useEffect(() => {
    setFamEspSel('');
  }, [famGenSel]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Comparar Gampacks" />

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-2">
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

          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Desde</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Hasta</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full dark:bg-white/10 dark:text-white dark:placeholder-white/60 dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20" />
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Familia</label>
            <Select
              value={famGenSel}
              onChange={(e) => setFamGenSel(e.target.value)}
              options={familyOptions}
              className="dark:bg-white/10 dark:text-white dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-white/80 mb-1">Subfamilia</label>
            <Select
              value={famEspSel}
              onChange={(e) => setFamEspSel(e.target.value)}
              options={subfamilyOptions}
              disabled={!famGenSel}
              className={`dark:bg-white/10 dark:text-white dark:border-white/10 dark:focus:border-white/30 dark:focus:ring-white/20 text-sm ${!famGenSel ? 'opacity-60' : ''}`}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-3 py-2 rounded text-sm bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white border border-transparent dark:border-white/10"
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
          <span className="inline-flex items-center text-xs text-gray-600 dark:text-white/80"><CalendarDays className="mr-1" size={14} /> Atajos:</span>
          <button type="button" onClick={setToday} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20">Hoy</button>
          <button type="button" onClick={setYesterday} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20">Ayer</button>
          <button type="button" onClick={setBeforeYesterday} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20">Antes de ayer</button>
          <button type="button" onClick={() => setLastNDays(7)} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20">Últimos 7 días</button>
          <button type="button" onClick={() => setLastNDays(30)} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20">Últimos 30 días</button>
          <button type="button" onClick={setThisMonth} className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20">Este mes</button>
        </div>

        {dateRangeInvalid && (
          <div className="mb-3 text-sm text-red-600 dark:text-red-400">
            El rango de fechas es inválido: <strong>Desde</strong> no puede ser mayor que <strong>Hasta</strong>.
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-700 dark:text-white">
            Total productos: <strong className="dark:text-white">{comparisons.length}</strong>
            {(dateFrom || dateTo) && (
              <span className="ml-2 text-gray-600 dark:text-white/70">
                {dateFrom ? `Desde ${dateFrom}` : ''}{dateFrom && dateTo ? ' · ' : ''}{dateTo ? `Hasta ${dateTo}` : ''}
              </span>
            )}
          </p>

          {/* Botón Cambiar vista */}
          <button
            onClick={() => handleLayoutChange()}
            aria-pressed={layout === 'table'}
            className={[
              'group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 shadow-sm ring-1',
              'bg-white text-gray-900 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300 active:bg-gray-100',
              'dark:bg-white/10 dark:text-white dark:ring-white/15 dark:hover:bg-white/15 dark:hover:ring-white/20 dark:active:bg-white/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white dark:focus-visible:ring-offset-0',
              'backdrop-blur supports-[backdrop-filter]:backdrop-blur',
            ].join(' ')}
            title="Cambiar vista"
          >
            <span className="inline-flex items-center">
              {layout === 'detailed' ? (
                <List size={18} className="transition-transform duration-200 group-active:scale-95" />
              ) : (
                <LayoutGrid size={18} className="transition-transform duration-200 group-active:scale-95" />
              )}
            </span>
            <span className="transition-colors">Cambiar vista</span>
          </button>
        </div>

        {layout === 'table' ? (
          <Table
            columns={[
              { key: 'internalProduct', label: 'Producto Interno', sortable: true, render: (v: any) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'externalProduct', label: 'Producto Proveedor', sortable: true, render: (v: any) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'internalFinalPrice', label: 'Final Interno', sortable: true, render: (v: any) => <span className="dark:text-white">{typeof v === 'number' ? `$${v.toFixed(2)}` : '—'}</span> },
              { key: 'externalFinalPrice', label: 'Final Proveedor', sortable: true, render: (v: any) => <span className="dark:text-white">{typeof v === 'number' ? `$${v.toFixed(2)}` : '—'}</span> },
              { key: 'internalDate', label: 'Fecha Interna', render: (v: any) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'externalDate', label: 'Fecha Proveedor', render: (v: any) => <span className="dark:text-white">{v ?? '—'}</span> },
              { key: 'supplier', label: 'Proveedor', render: (v: any) => <span className="dark:text-white">{v ?? '—'}</span> },
              {
                key: 'priceDifference',
                label: 'Diferencia',
                render: (_v: any, row: any) => {
                  const pct = getDifferencePct(row.internalFinalPrice as number | null, row.externalFinalPrice as number | null);
                  const amt = getDifferenceAmt(row.internalFinalPrice as number | null, row.externalFinalPrice as number | null);
                  if (pct == null || amt == null) return <span className="dark:text-white">N/A</span>;
                  return (
                    <span className="inline-flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white">{pct}%</span>
                      <span className="text-sm text-gray-700 dark:text-white/80">{formatSignedMoney(amt)}</span>
                    </span>
                  );
                },
              },
              {
                key: 'conclusion',
                label: 'Conclusión',
                render: (_v: any, row: any) => {
                  const internal = typeof row.internalFinalPrice === 'number' ? row.internalFinalPrice : null;
                  const external = typeof row.externalFinalPrice === 'number' ? row.externalFinalPrice : null;
                  const verdict = getVerdict(internal, external);
                  return (
                    <span
                      className={[
                        'inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border',
                        verdict.classes
                      ].join(' ')}
                    >
                      {verdict.text}
                    </span>
                  );
                }
              }
            ]}
            data={comparisons}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {loading && <div className="text-sm text-gray-600 dark:text-white/70">Cargando...</div>}
            {!loading && comparisons.map((item, i) => {
              const internal = typeof item.internalFinalPrice === 'number' ? item.internalFinalPrice : null;
              const external = typeof item.externalFinalPrice === 'number' ? item.externalFinalPrice : null;
              const pct = getDifferencePct(internal, external);
              const amt = getDifferenceAmt(internal, external);
              const verdict = getVerdict(internal, external);

              return (
                <div key={i} className="border rounded-xl p-4 shadow-sm bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:shadow-md transition duration-300">
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
                      <p className="text-lg font-bold text-green-600">{internal != null ? `$${internal.toFixed(2)}` : '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-white/60">Diferencia</p>
                      {pct == null || amt == null ? (
                        <p className="text-sm dark:text-white/80">N/A</p>
                      ) : (
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="px-2 py-0.5 rounded text-sm font-semibold bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white">{pct}%</span>
                          <span className="text-sm text-gray-700 dark:text-white/80">{formatSignedMoney(amt)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-white/60">Producto Proveedor</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{item.externalProduct ?? '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-white/60 mt-1">Precio Externo</p>
                      <p className="text-lg font-bold text-blue-600">{external != null ? `$${external.toFixed(2)}` : '—'}</p>
                    </div>
                  </div>

                  {/* Veredicto textual */}
                  <div
                    className={[
                      'mt-3 px-3 py-2 rounded-lg border text-sm font-medium',
                      verdict.classes
                    ].join(' ')}
                  >
                    {verdict.text}
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

export default CompareScreen;
