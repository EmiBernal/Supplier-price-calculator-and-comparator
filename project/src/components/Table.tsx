import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  /** NUEVO: alineación opcional por columna */
  align?: 'left' | 'right' | 'center';
  /** NUEVO: clase extra por columna */
  className?: string;
}

interface TableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: keyof T) => void;
  sortKey?: keyof T | '';
  sortDirection?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T) => string | number;

  /** NUEVO: personalización de estilos (opcional) */
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  rowClassName?: (row: T, index: number) => string;
  cellClassName?: (col: Column<T>, row: T) => string;
  emptyMessage?: string;
}

/** helper chiquito para concatenar clases */
const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export function Table<T extends object>({
  columns,
  data,
  onSort,
  sortKey,
  sortDirection,
  onRowClick,
  getRowKey,
  className,
  headerClassName,
  bodyClassName,
  rowClassName,
  cellClassName,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  const handleSort = (key: keyof T) => {
    if (onSort) onSort(key);
  };

  return (
    <div
      className={cx(
        // Contenedor de alto contraste
        'overflow-x-auto rounded-2xl shadow-lg border',
        'bg-white dark:bg-white/5',
        'border-gray-100 dark:border-white/10',
        className
      )}
    >
      <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
        <thead
          className={cx(
            // Encabezado contrastado en dark
            'bg-white/80 text-gray-700',
            'dark:bg-white/10 dark:text-white',
            'backdrop-blur-sm',
            headerClassName
          )}
        >
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cx(
                  'px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider select-none',
                  'text-gray-700 dark:text-white',
                  col.sortable
                    ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-white'
                    : ''
                )}
                onClick={() => col.sortable && handleSort(col.key as keyof T)}
              >
                <div className="flex items-center gap-1">
                  <span>{col.label}</span>
                  {col.sortable && sortKey === col.key && (
                    <span className="text-indigo-600 dark:text-white">
                      {sortDirection === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody
          className={cx(
            // Cuerpo más claro en dark
            'bg-white/80 dark:bg-white/5 divide-y divide-gray-100 dark:divide-white/10',
            bodyClassName
          )}
        >
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-12 text-gray-500 dark:text-white/70"
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {data.map((row, idx) => {
            const baseRow =
              'transition duration-150 ' +
              (onRowClick ? 'cursor-pointer ' : '') +
              // Zebra + hover en oscuro
              'hover:bg-indigo-50/60 dark:hover:bg-white/10 ' +
              'odd:bg-white even:bg-white/70 ' +
              'dark:odd:bg-white/[0.04] dark:even:bg-white/[0.02]';

            return (
              <tr
                key={getRowKey ? getRowKey(row) : idx}
                className={cx(baseRow, rowClassName?.(row, idx))}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => {
                  const raw =
                    col.key in row ? (row[col.key as keyof T] as unknown as any) : undefined;

                  const alignCls =
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';

                  return (
                    <td
                      key={String(col.key)}
                      className={cx(
                        'px-6 py-4 whitespace-nowrap text-sm',
                        'text-gray-800 dark:text-white',
                        alignCls,
                        col.className,
                        cellClassName?.(col, row)
                      )}
                    >
                      {col.render ? col.render(raw, row) : (raw as React.ReactNode)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
