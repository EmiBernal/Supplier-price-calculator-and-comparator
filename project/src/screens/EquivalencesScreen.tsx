import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table } from '../components/Table';
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
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchEquivalences = async (search: string = '') => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:4000/api/lista_precios?search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('Error al obtener datos');
      const data = await response.json();
      setEquivalences(data);
    } catch (error) {
      console.error('Error fetching equivalences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchEquivalences(searchTerm);
  };

  const handleSort = (key: string) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);

    const sorted = [...equivalences].sort((a, b) => {
      const aValue = a[key as keyof ProductEquivalence];
      const bValue = b[key as keyof ProductEquivalence];

      if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setEquivalences(sorted);
  };

  const columns = [
    { key: 'supplier', label: 'Supplier', sortable: true },
    { key: 'externalCode', label: 'External Code', sortable: true },
    { key: 'externalName', label: 'External Name', sortable: true },
    { key: 'internalCode', label: 'Internal Code', sortable: true },
    { key: 'internalName', label: 'Internal Name', sortable: true },
    {
      key: 'matchingCriteria',
      label: 'Matching Criteria',
      sortable: true,
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'manual' ? 'bg-blue-100 text-blue-800' :
          value === 'name' ? 'bg-green-100 text-green-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    { key: 'date', label: 'Date', sortable: true }
  ];

  useEffect(() => {
    fetchEquivalences();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation 
          onBack={() => onNavigate('home')} 
          title="Equivalencia entre productos"
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Busca por nombre o por codigo..."
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

          {/* Results Count */}
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {loading ? 'Cargando...' : `Mostrando ${equivalences.length} equivalencias${equivalences.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Table */}
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
