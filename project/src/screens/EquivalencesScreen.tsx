import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table } from '../components/Table';
import { database } from '../utils/database';
import { ProductEquivalence } from '../types/database';
import { Search } from 'lucide-react';

interface EquivalencesScreenProps {
  onNavigate: (screen: string) => void;
}

export const EquivalencesScreen: React.FC<EquivalencesScreenProps> = ({ onNavigate }) => {
  const [equivalences, setEquivalences] = useState<ProductEquivalence[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadEquivalences();
  }, []);

  const loadEquivalences = async () => {
    setLoading(true);
    try {
      const data = await database.getEquivalences();
      setEquivalences(data);
    } catch (error) {
      console.error('Error loading equivalences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await database.getEquivalences(searchTerm);
      setEquivalences(data);
    } catch (error) {
      console.error('Error searching equivalences:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation 
          onBack={() => onNavigate('home')} 
          title="Product Equivalences"
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Input
                placeholder="Search by name or code..."
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
              {loading ? 'Loading...' : `Showing ${equivalences.length} equivalence${equivalences.length !== 1 ? 's' : ''}`}
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