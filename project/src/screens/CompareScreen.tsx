import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';
import { PriceComparison } from '../tipos/database';
import { Search, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { Screen } from '../types';

interface CompareScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const CompareScreen: React.FC<CompareScreenProps> = ({ onNavigate }) => {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof PriceComparison | ''>('internalFinalPrice');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadComparisons();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadComparisons(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);


  const loadComparisons = async (search = '') => {
    setLoading(true);
    try {
      const url = search.trim()
        ? `/api/price-comparisons?search=${encodeURIComponent(search)}`
        : `/api/price-comparisons`; 

      const response = await fetch(url);
      const text = await response.text(); 
      const data = JSON.parse(text); 
      setComparisons(data);
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      setComparisons([]);
    } finally {
      setLoading(false);
    }
  };


  const handleSearch = () => {
    loadComparisons(searchTerm);
  };

  const handleSort = (key: keyof PriceComparison) => {
  const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
  setSortKey(key);
  setSortDirection(newDirection);

  const sorted = [...comparisons].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return newDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
    return 0;
  });

  setComparisons(sorted);
};


  const columns: Column<PriceComparison>[] = [
  { key: 'internalProduct', label: 'Producto Interno', sortable: true },
  { key: 'externalProduct', label: 'Producto Externo', sortable: true },
  { key: 'supplier', label: 'Proveedor', sortable: true },
  {
    key: 'internalNetPrice',
    label: 'Neto Interno',
    sortable: true,
    render: (value) => `$${(value as number).toFixed(2)}`
  },
  {
    key: 'externalNetPrice',
    label: 'Neto Externo',
    sortable: true,
    render: (value) => `$${(value as number).toFixed(2)}`
  },
  {
    key: 'internalFinalPrice',
    label: 'Final Interno',
    sortable: true,
    render: (value) => `$${(value as number).toFixed(2)}`
  },
  {
    key: 'externalFinalPrice',
    label: 'Final Externo',
    sortable: true,
    render: (value) => `$${(value as number).toFixed(2)}`
  },
  {
    key: 'internalDate',
    label: 'Fecha Alta Interna',
    sortable: true
  },
  {
    key: 'externalDate',
    label: 'Fecha Alta Externa',
    sortable: true
  },
  {
    key: 'saleConditions',
    label: 'Relación',
    sortable: true,
    render: (value) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        (value as string) === 'automatic' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
      }`}>
        {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
      </span>
    )
  }
];


  const stats = {
    totalProducts: comparisons.length,
    lowestInternalPrice: comparisons.length > 0 ? Math.min(...comparisons.map(c => c.internalFinalPrice)) : 0,
    highestInternalPrice: comparisons.length > 0 ? Math.max(...comparisons.map(c => c.internalFinalPrice)) : 0,
    lowestExternalPrice: comparisons.length > 0 ? Math.min(...comparisons.map(c => c.externalFinalPrice)) : 0,
    highestExternalPrice: comparisons.length > 0 ? Math.max(...comparisons.map(c => c.externalFinalPrice)) : 0,
    avgPriceDifference: comparisons.length > 0 ?
      comparisons.reduce((sum, c) => sum + c.priceDifference, 0) / comparisons.length : 0,
    betterInternal: comparisons.filter(c => c.internalFinalPrice < c.externalFinalPrice).length,
    betterExternal: comparisons.filter(c => c.externalFinalPrice < c.internalFinalPrice).length,
    samePrice: comparisons.filter(c => c.externalFinalPrice === c.internalFinalPrice).length
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation
          onBack={() => onNavigate('home')}
          title="Comparar Precios"
        />

        {/* Tarjetas principales */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Total de Productos</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Menor Precio Interno</div>
            <div className="text-2xl font-bold text-green-600">${stats.lowestInternalPrice.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Menor Precio Externo</div>
            <div className="text-2xl font-bold text-green-600">${stats.lowestExternalPrice.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Mayor Precio Interno</div>
            <div className="text-2xl font-bold text-red-600">${stats.highestInternalPrice.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Mayor Precio Externo</div>
            <div className="text-2xl font-bold text-red-600">${stats.highestExternalPrice.toFixed(2)}</div>
          </div>
        </div>


        {/* Sección principal */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Búsqueda */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Buscar por producto o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              {loading ? 'Cargando...' : `Mostrando ${comparisons.length} comparación${comparisons.length !== 1 ? 'es' : ''}`}
            </p>
          </div>

          {/* Tabla */}
          <Table
            columns={columns}
            data={comparisons}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
          />
        </div>
      </div>
    </div>
  );
};
