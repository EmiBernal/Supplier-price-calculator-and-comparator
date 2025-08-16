import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';
import { ProductEquivalence } from '../tipos/database';
import { Search } from 'lucide-react';
import { Screen } from '../types';
import { Button } from '../components/Button';

interface EquivalencesScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const EquivalencesScreen: React.FC<EquivalencesScreenProps> = ({ onNavigate }) => {
  const [equivalences, setEquivalences] = useState<ProductEquivalence[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<keyof ProductEquivalence | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openMenuId, setOpenMenuId] = useState<number | string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch data
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

  useEffect(() => {
    fetchEquivalences('');
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchEquivalences(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Cerrar menú si se hace clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      const res = await fetch(`http://localhost:4000/api/relacion/${id}`, {
        method: 'DELETE',
      });
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
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'actions' as keyof ProductEquivalence,
      label: '',
      sortable: false,
      render: (_value: any, row: ProductEquivalence) => (
        <div className="relative" ref={menuRef}>
          <details className="relative">
            <summary className="list-none text-gray-600 hover:text-black dark:text-white/70 dark:hover:text-white px-2 py-1 text-lg cursor-pointer">
              ⋮
            </summary>
            <div className="absolute right-0 mt-2 min-w-[140px] bg-white dark:bg-[#0e1526] border border-gray-200 dark:border-white/10 rounded shadow-md z-10 backdrop-blur-sm">
              <button
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-300 dark:hover:bg-white/10"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete((row as any).id);
                }}
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
      <div className="max-w-7xl mx-auto">


        <div className="bg-white dark:bg-[#0e1526] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 p-6">
          {/* Buscador */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Buscá por nombre o por código…"
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
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-gray-600 dark:text-white/70">Cargando…</p>
            ) : equivalences.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-white/70">No hay equivalencias para mostrar</p>
            ) : (
              <Table
                columns={columns}
                data={equivalences}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                getRowKey={(row) => (row as any).id}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
