import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';
import { ProductEquivalence } from '../tipos/database';
import { Search } from 'lucide-react';
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
  const [openMenuId, setOpenMenuId] = useState<number | string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const fetchEquivalences = async (search: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/equivalencias-search?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Error al obtener equivalencias');
      const data = await res.json();
      setEquivalences(data);
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
  console.log('🔴 Enviando DELETE para id:', id);
  try {
    const res = await fetch(`http://localhost:4000/api/relacion/${id}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    console.log('🟢 Respuesta del backend:', data);
    if (data.success) {
      setEquivalences((prev) => prev.filter((eq) => eq.id !== id));
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
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Sin criterio
          </span>
        );
      }

      const colors = {
        manual: 'bg-blue-100 text-blue-800',
        name: 'bg-green-100 text-green-800',
        codigo: 'bg-yellow-100 text-yellow-800',
      };

      const color = colors[value as keyof typeof colors] || 'bg-gray-100 text-gray-800';

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
      <div className="relative">
        <details className="relative">
          <summary className="list-none text-gray-600 hover:text-black px-2 py-1 text-lg cursor-pointer">⋮</summary>
          <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded shadow-md z-10">
            <button
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              onClick={(e) => {
                e.preventDefault(); // para que no se propague el click al row
                handleDelete(row.id);
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation
          onBack={() => onNavigate('home')}
          title="Equivalencia entre productos"
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Buscador */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Busca por nombre o por código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search
                size={20}
                className="absolute left-3 top-2.5 text-gray-400 cursor-pointer"
                onClick={() => fetchEquivalences(searchTerm.trim())}
              />
            </div>
          </div>

          {/* Info */}
          <div className="mb-4">
            {equivalences.length === 0 ? (
              <p className="text-sm text-gray-600">No hay equivalencias para mostrar</p>
            ) : (
              <p className="text-sm text-gray-600">
                Mostrando {equivalences.length} equivalencia{equivalences.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            {equivalences.length === 0 ? (
              <p className="text-sm text-gray-600">No hay equivalencias para mostrar</p>
            ) : (
              <Table
                columns={columns}
                data={equivalences}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                getRowKey={(row) => row.id}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
