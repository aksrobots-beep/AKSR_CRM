import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  searchable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  searchable?: boolean; // Default to false - search bar is hidden by default
  searchPlaceholder?: string;
  getRowClassName?: (item: T) => string; // Optional function to get custom row className
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
  searchable = true,
  searchPlaceholder = 'Search...',
  getRowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((item) => {
      // First, search through all searchable columns
      const columnMatch = columns.some((column) => {
        // Skip if explicitly marked as not searchable
        if (column.searchable === false) return false;
        
        // Get the raw value from the item
        const value = (item as Record<string, unknown>)[String(column.key)];
        
        // Search raw value - this is more reliable than parsing React elements
        if (value !== null && value !== undefined) {
          // Handle Date objects
          if (value instanceof Date) {
            const dateStr = value.toLocaleDateString().toLowerCase();
            if (dateStr.includes(query)) return true;
          }
          
          // Handle objects - stringify for deep search
          if (typeof value === 'object') {
            const objStr = JSON.stringify(value).toLowerCase();
            if (objStr.includes(query)) return true;
          }
          
          // Handle primitives
          const valueStr = String(value).toLowerCase();
          if (valueStr.includes(query)) return true;
        }
        
        return false;
      });
      
      if (columnMatch) return true;
      
      // Also search all string/number fields in the item (for enriched data like equipmentName, etc.)
      // This allows searching fields that aren't explicitly in columns
      const itemAsRecord = item as Record<string, unknown>;
      for (const key in itemAsRecord) {
        const value = itemAsRecord[key];
        if (value !== null && value !== undefined && typeof value !== 'object' && !(value instanceof Date)) {
          const valueStr = String(value).toLowerCase();
          if (valueStr.includes(query)) return true;
        }
      }
      
      return false;
    });
  }, [data, searchQuery, columns]);

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = (a as Record<string, unknown>)[sortKey];
    const bVal = (b as Record<string, unknown>)[sortKey];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="card overflow-hidden">
      {searchable !== false && (
        <div className="p-4 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-neutral-100 select-none' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && sortKey === column.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-neutral-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr
                  key={item.id}
                  className={`bg-white transition-colors ${
                    onRowClick
                      ? 'hover:bg-neutral-50 cursor-pointer'
                      : ''
                  } ${getRowClassName ? getRowClassName(item) : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={`${item.id}-${String(column.key)}`}
                      className="px-4 py-3 text-sm text-neutral-700"
                    >
                      {column.render
                        ? column.render(item)
                        : String((item as Record<string, unknown>)[String(column.key)] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
