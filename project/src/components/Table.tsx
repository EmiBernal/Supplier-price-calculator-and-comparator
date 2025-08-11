import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
}

interface TableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: keyof T) => void;
  sortKey?: keyof T | '';
  sortDirection?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T) => string | number;
}

export function Table<T extends object>({
  columns,
  data,
  onSort,
  sortKey,
  sortDirection,
  onRowClick,
  getRowKey,
}: TableProps<T>) {
  const handleSort = (key: keyof T) => {
    if (onSort) onSort(key);
  };

  return (
    <div className="overflow-x-auto bg-gradient-to-tr from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider ${
                  col.sortable ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''
                }`}
                onClick={() => col.sortable && handleSort(col.key as keyof T)}
              >
                <div className="flex items-center space-x-1">
                  <span>{col.label}</span>
                  {col.sortable && sortKey === col.key && (
                    <span className="text-indigo-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white/80 dark:bg-gray-800/80 divide-y divide-gray-100 dark:divide-gray-700">
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-gray-500 dark:text-gray-400">
                No data available
              </td>
            </tr>
          )}
          {data.map((row, idx) => (
            <tr
              key={getRowKey ? getRowKey(row) : idx}
              className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30 cursor-pointer transition duration-150`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  {col.render
                    ? col.render(col.key in row ? row[col.key as keyof T] : undefined, row)
                    : col.key in row
                    ? (row[col.key as keyof T] as unknown as React.ReactNode)
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
