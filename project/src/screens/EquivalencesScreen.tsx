import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';  // Asegurate que exportas Column también
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

  const fetchEquivalences = async (search = '') => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/equivalencias?search=${encodeURIComponent(search)}`);
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
    fetchEquivalences();
  }, []);

  const handleSearch = () => {
    fetchEquivalences(searchTerm);
  };

  const handleSort = (key: keyof ProductEquivalence) => {
  const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
  setSortKey(key);
  setSortDirection(newDirection);

  const sorted = [...equivalences].sort((a, b) => {
    const aValue = (a[key] ?? '').toString();
    const bValue = (b[key] ?? '').toString();

    if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
    return 0;
  });

  setEquivalences(sorted);
};


  const columns: Column<ProductEquivalence>[] = [
    { key: 'supplier', label: 'Proveedor', sortable: true },
    { key: 'externalCode', label: 'Código Externo', sortable: true },
    { key: 'externalName', label: 'Nombre Externo', sortable: true },
    { key: 'externalDate', label: 'Fecha Agregado Externo', sortable: true },
    { key: 'internalSupplier', label: 'Proveedor Interno', sortable: false }, // Siempre Gampack
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
      }
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
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Busca por nombre o por código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
              <Search
                size={20}
                className="absolute left-3 top-2.5 text-gray-400 cursor-pointer"
                onClick={handleSearch}
              />
            </div>
          </div>

          {/* Resultados */}
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {loading ? 'Cargando...' : `Mostrando ${equivalences.length} equivalencia${equivalences.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Tabla */}
          <Table
            columns={columns}
            data={equivalences}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
          />
        </div>
      </div>
    </div>
  );
};
