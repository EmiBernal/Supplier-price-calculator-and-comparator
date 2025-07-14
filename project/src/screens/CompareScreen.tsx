import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table } from '../components/Table';
import { database } from '../utils/database';
import { PriceComparison } from '../types/database';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';

interface CompareScreenProps {
  onNavigate: (screen: string) => void;
}

export const CompareScreen: React.FC<CompareScreenProps> = ({ onNavigate }) => {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('finalPrice');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadComparisons();
  }, []);

  const loadComparisons = async () => {
    setLoading(true);
    try {
      const data = await database.getPriceComparisons();
      setComparisons(data);
    } catch (error) {
      console.error('Error loading price comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await database.getPriceComparisons(searchTerm);
      setComparisons(data);
    } catch (error) {
      console.error('Error searching comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);

    const sorted = [...comparisons].sort((a, b) => {
      const aValue = a[key as keyof PriceComparison];
      const bValue = b[key as keyof PriceComparison];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return newDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (aValue < bValue) return newDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return newDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setComparisons(sorted);
  };

  const columns = [
    { key: 'internalProduct', label: 'Internal Product', sortable: true },
    { key: 'supplier', label: 'Supplier', sortable: true },
    { 
      key: 'finalPrice', 
      label: 'Final Price', 
      sortable: true,
      render: (value: number) => `$${value.toFixed(2)}`
    },
    { 
      key: 'companyType', 
      label: 'Company Type', 
      sortable: true,
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'supplier' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    { key: 'saleConditions', label: 'Sale Conditions', sortable: true },
    { 
      key: 'priceDifference', 
      label: 'Price Difference (%)', 
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center space-x-1">
          {value > 0 ? (
            <TrendingUp size={16} className="text-red-500" />
          ) : value < 0 ? (
            <TrendingDown size={16} className="text-green-500" />
          ) : null}
          <span className={`font-medium ${
            value > 0 ? 'text-red-600' : 
            value < 0 ? 'text-green-600' : 
            'text-gray-600'
          }`}>
            {value > 0 ? '+' : ''}{value.toFixed(2)}%
          </span>
        </div>
      )
    }
  ];

  const stats = {
    totalProducts: comparisons.length,
    lowestPrice: comparisons.length > 0 ? Math.min(...comparisons.map(c => c.finalPrice)) : 0,
    highestPrice: comparisons.length > 0 ? Math.max(...comparisons.map(c => c.finalPrice)) : 0,
    avgPriceDifference: comparisons.length > 0 ? 
      comparisons.reduce((sum, c) => sum + c.priceDifference, 0) / comparisons.length : 0
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation 
          onBack={() => onNavigate('home')} 
          title="Compare Prices"
        />

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Total Products</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Lowest Price</div>
            <div className="text-2xl font-bold text-green-600">${stats.lowestPrice.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Highest Price</div>
            <div className="text-2xl font-bold text-red-600">${stats.highestPrice.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Avg. Price Difference</div>
            <div className="text-2xl font-bold text-gray-900">{stats.avgPriceDifference.toFixed(1)}%</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Search by product or supplier..."
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
              {loading ? 'Loading...' : `Showing ${comparisons.length} comparison${comparisons.length !== 1 ? 's' : ''} (sorted by lowest price)`}
            </p>
          </div>

          {/* Table */}
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