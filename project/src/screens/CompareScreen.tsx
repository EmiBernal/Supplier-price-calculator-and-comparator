import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Input } from '../components/Input';
import { Table, Column } from '../components/Table';
import { PriceComparison } from '../tipos/database';
import { Search, List, LayoutGrid } from 'lucide-react';
import { Screen } from '../types';

interface CompareScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const CompareScreen: React.FC<CompareScreenProps> = ({ onNavigate }) => {
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<'table' | 'detailed'>('detailed');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [familia, setFamilia] = useState('');

  useEffect(() => {
    loadComparisons();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadComparisons(searchTerm);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, dateFrom, dateTo, familia]);

  const loadComparisons = async (search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      if (familia) params.append('familia', familia);

      const url = `/api/price-comparisons?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      setComparisons(data);
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

  const getDifference = (internal: number, external: number) => {
  // Diferencia en porcentaje comparada contra el precio externo (competencia)
  // Si el resultado es positivo, Gampack es más caro
  // Si es negativo, Gampack es más barato
  if (external === 0) return 0;
  const diff = ((internal - external) / external) * 100;
  return parseFloat(diff.toFixed(2));
};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <Navigation onBack={() => onNavigate('home')} title="Comparar Gampacks" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <Input placeholder="Buscar producto por nombre o código" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
          </div>
          <Input type="date" placeholder="Desde" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" placeholder="Hasta" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Input placeholder="Familia (categoría)" value={familia} onChange={(e) => setFamilia(e.target.value)} />
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Total productos: <strong>{comparisons.length}</strong></p>
          <button className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded flex items-center" onClick={handleLayoutChange}>
            {layout === 'detailed' ? <List size={18} /> : <LayoutGrid size={18} />}
            <span className="ml-2 text-sm">Cambiar vista</span>
          </button>
        </div>

        {layout === 'table' ? (
          <Table
            columns={[
              { key: 'internalProduct', label: 'Producto Interno', sortable: true },
              { key: 'externalProduct', label: 'Producto Externo', sortable: true },
              {
                key: 'internalFinalPrice',
                label: 'Final Interno',
                sortable: true,
                render: (v) => `$${(v as number).toFixed(2)}`,
              },
              {
                key: 'externalFinalPrice',
                label: 'Final Externo',
                sortable: true,
                render: (v) => `$${(v as number).toFixed(2)}`,
              },
              { key: 'internalDate', label: 'Fecha Interna' },
              { key: 'externalDate', label: 'Fecha Externa' },
              { key: 'supplier', label: 'Proveedor' },
              {
                key: 'priceDifference',
                label: 'Diferencia',
                render: (_v, row) => {
                  const diff = getDifference(row.internalFinalPrice, row.externalFinalPrice);
                  return (
                    <span className="transition-all duration-300 font-medium text-indigo-600">
                      {diff}%
                    </span>
                  );
                },
              },
            ]}
            data={comparisons}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {comparisons.map((item, i) => {
              const diff = getDifference(item.internalFinalPrice, item.externalFinalPrice);
              return (
                <div key={i} className="border rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition duration-300">
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-300 mb-2">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Fecha Interna</p>
                      <p>{item.internalDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 dark:text-gray-400">Fecha Externa</p>
                      <p>{item.externalDate}</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">Proveedor: <span className="font-semibold text-gray-700 dark:text-gray-100">{item.supplier}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Producto Gampack</p>
                      <p className="text-base font-semibold text-gray-800 dark:text-gray-100">{item.internalProduct}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Precio Interno</p>
                      <p className="text-lg font-bold text-green-600">${item.internalFinalPrice.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Diferencia</p>
                      <p className="text-lg font-semibold text-indigo-600 transition-all duration-300">{diff}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Producto Proveedor</p>
                      <p className="text-base font-semibold text-gray-800 dark:text-gray-100">{item.externalProduct}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Precio Externo</p>
                      <p className="text-lg font-bold text-blue-600">${item.externalFinalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
