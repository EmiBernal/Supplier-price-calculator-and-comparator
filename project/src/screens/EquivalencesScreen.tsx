import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';
import { ProductEquivalence } from '../tipos/database';
import { Search, ArrowLeft, RefreshCw, X, ArrowUp } from 'lucide-react';
import { Screen } from '../types';

interface EquivalencesScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const EquivalencesScreen: React.FC<EquivalencesScreenProps> = ({ onNavigate }) => {
  const [equivalences, setEquivalences] = useState<ProductEquivalence[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<keyof ProductEquivalence | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filtro por criterio
  const [criteriaFilter, setCriteriaFilter] = useState<string>(''); // '', 'manual', 'name', 'codigo'
  // Botón “Top”
  const [showBackToTop, setShowBackToTop] = useState(false);

  const searchInputId = 'equiv-search-input';
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const fetchEquivalences = async (search: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/equivalencias?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Error al obtener equivalencias');
      const data = await res.json();
      setEquivalences(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching equivalences:', error);
      setEquivalences([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEquivalences(''); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { fetchEquivalences(searchTerm.trim()); }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Cerrar <details> abiertos con click afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('details')) {
        document.querySelectorAll('details[open]').forEach((d) => ((d as HTMLDetailsElement).open = false));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Atajos (quitado "r")
// Atajos (sin "r") protegidos si estoy escribiendo
useEffect(() => {
  const isEditable = (el: EventTarget | null) => {
    const n = (el as HTMLElement | null);
    if (!n) return false;
    const tag = (n.tagName || '').toLowerCase();
    return (
      (tag === 'input' || tag === 'textarea' || tag === 'select') ||
      (n as HTMLElement).isContentEditable
    );
  };

  const onKey = (e: KeyboardEvent) => {
    const targetIsEditable = isEditable(e.target);

    if (e.key === 'Escape') {
      onNavigate('home' as Screen);
      return;
    }

    // Atajo "/" para enfocar buscador (solo si no estoy escribiendo en otro campo)
    if (!targetIsEditable && e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      (document.getElementById(searchInputId) as HTMLInputElement | null)?.focus();
      return;
    }

    // Atajo "t" => Top (solo si no estoy escribiendo)
    if (!targetIsEditable && e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [onNavigate]);


  // Mostrar/ocultar botón Top
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Ordenamiento
  const handleSort = (key: keyof ProductEquivalence) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);
    const sorted = [...equivalences].sort((a, b) => {
      const aValue = (a[key] ?? '').toString().toLowerCase();
      const bValue = (b[key] ?? '').toString().toLowerCase();
      if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });
    setEquivalences(sorted);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:4000/api/relacion/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data?.success) {
        setEquivalences((prev) => prev.filter((eq) => (eq as any).id !== id));
      } else {
        alert('Error eliminando relación');
      }
    } catch (error) {
      console.error('❌ Error eliminando relación:', error);
      alert('Error eliminando relación');
    }
  };

  // Filtro por criterio + búsqueda
  const filteredEquivalences = () => {
    const q = searchTerm.trim().toLowerCase();
    return equivalences.filter((r) => {
      const byCriteria = criteriaFilter ? (r.matchingCriteria || '').toLowerCase() === criteriaFilter : true;
      if (!q) return byCriteria;
      const values = [r.supplier, r.externalCode, r.externalName, r.internalCode, r.internalName]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());
      return byCriteria && values.some((v) => v.includes(q));
    });
  };

  const columns: Column<ProductEquivalence>[] = [
    { key: 'supplier', label: 'Proveedor Externo', sortable: true },
    { key: 'externalCode', label: 'Código Externo', sortable: true },
    { key: 'externalName', label: 'Nombre Externo', sortable: true },
    { key: 'externalDate', label: 'Fecha Agregado Externo', sortable: true },
    { key: 'internalCode', label: 'Código Interno', sortable: true },
    { key: 'internalName', label: 'Nombre Interno', sortable: true },
    { key: 'internalDate', label: 'Fecha Agregado Interno', sortable: true },
    {
      key: 'matchingCriteria',
      label: 'Criterio de Relación',
      sortable: true,
      render: (value?: string) => {
        if (!value) {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/80">
              Sin criterio
            </span>
          );
        }
        const colors: Record<string, string> = {
          manual: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
          name: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
          codigo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
        };
        const color = colors[value] || 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white';
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>;
      },
    },
    {
      key: 'actions' as keyof ProductEquivalence,
      label: '',
      sortable: false,
      render: (_value: any, row: ProductEquivalence) => (
        <div className="relative">
          <details className="relative">
            <summary className="list-none text-gray-600 hover:text-black dark:text-white/70 dark:hover:text-white px-2 py-1 text-lg cursor-pointer">⋮</summary>
            <div className="absolute right-0 mt-2 min-w-[160px] bg-white dark:bg-[#0e1526] border border-gray-200 dark:border-white/10 rounded shadow-md z-10 backdrop-blur-sm">
              <button
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-300 dark:hover:bg-white/10"
                onClick={(e) => { e.preventDefault(); handleDelete((row as any).id); }}
              >
                Eliminar
              </button>
            </div>
          </details>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div ref={topAnchorRef} />
      <div className="max-w-7xl mx-auto">
        {/* Header con botón Volver */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => onNavigate('home' as Screen)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white/80 shadow-sm transition"
            aria-label="Volver a la pantalla principal"
          >
            <ArrowLeft size={18} />
            <span>Volver</span>
          </button>
        </div>

        <div className="bg-white dark:bg-[#0e1526] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6">
          {/* Buscador + acciones */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Input
                id={searchInputId}
                placeholder="Buscá por nombre o por código…  (atajo: /)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/60 border-gray-200 dark:border-white/10 focus:border-blue-300 dark:focus:border-white/30 focus:ring-blue-200/50 dark:focus:ring-white/20"
              />
              <Search
                size={20}
                className="absolute left-3 top-2.5 text-gray-400 dark:text-white/70 cursor-pointer"
                onClick={() => fetchEquivalences(searchTerm.trim())}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="ml-1 text-xs text-gray-600 dark:text-white/60">
                {filteredEquivalences().length} registros
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-gray-600 dark:text-white/70">Cargando…</p>
            ) : filteredEquivalences().length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-white/70">No hay equivalencias para mostrar</p>
            ) : (
              <Table
                columns={columns}
                data={filteredEquivalences()}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                getRowKey={(row) => (row as any).id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Botón flotante: volver al top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition"
          title="Volver arriba (atajo: t)"
          aria-label="Volver arriba"
        >
          <ArrowUp size={18} /> Top
        </button>
      )}
    </div>
  );
};
