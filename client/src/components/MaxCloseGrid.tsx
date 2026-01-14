import { useState, useEffect, useMemo } from 'react';
import type { ViewMode } from '../App';

interface MaxCloseData {
  year: number;
  month: number;
  close_max: number;
}

interface MaxCloseGridProps {
  ticker: string;
  viewMode: ViewMode;
  defaultExpanded?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MaxCloseGrid({ ticker, viewMode, defaultExpanded = false }: MaxCloseGridProps) {
  const [data, setData] = useState<MaxCloseData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!isExpanded) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use the 1-month period to get all max close data
        const res = await fetch(
          `/api/prices/${ticker}/heatmap?period=1&view=${viewMode}&years=10`
        );
        if (!res.ok) {
          throw new Error('Failed to fetch max close data');
        }
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [ticker, viewMode, isExpanded]);

  const years = [...new Set(data.map((d) => d.year))].sort((a, b) => b - a);

  const cellMap = useMemo(() => {
    const map = new Map<string, MaxCloseData>();
    for (const cell of data) {
      // Parse close_max as number (API returns it as string)
      const closeMax = typeof cell.close_max === 'string' ? parseFloat(cell.close_max) : cell.close_max;
      map.set(`${cell.year}-${cell.month}`, { ...cell, close_max: closeMax });
    }
    return map;
  }, [data]);

  // Calculate max close per month across all years
  const maxCloseByMonth = useMemo(() => {
    const maxMap = new Map<number, number>();
    for (const cell of data) {
      // Parse close_max as number (API returns it as string)
      const closeMax = typeof cell.close_max === 'string' ? parseFloat(cell.close_max as unknown as string) : cell.close_max;
      const current = maxMap.get(cell.month) || 0;
      if (closeMax > current) {
        maxMap.set(cell.month, closeMax);
      }
    }
    return maxMap;
  }, [data]);

  // Overall max close
  const overallMax = useMemo(() => {
    let max = 0;
    for (const val of maxCloseByMonth.values()) {
      if (val > max) max = val;
    }
    return max;
  }, [maxCloseByMonth]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4 shadow-sm">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <h3 className="text-lg font-bold text-gray-900">
            {ticker} - Max Close Price by Month
          </h3>
          {!isExpanded && overallMax > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-blue-600 font-medium">
                All-time High: ${overallMax.toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <span className="text-gray-400 text-sm">
          {isExpanded ? '▼ Collapse' : '▶ Expand'}
        </span>
      </button>

      {isExpanded && (
        <div className="p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-10 text-red-600">
              <p>Error: {error}</p>
            </div>
          )}

          {!isLoading && !error && data.length > 0 && (
            <div className="overflow-x-auto border rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-blue-200 bg-blue-100/50">
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-700 w-16">Year</th>
                    {MONTHS.map((month) => (
                      <th key={month} className="px-2 py-2 text-center text-sm font-medium text-gray-700 w-[55px]">
                        {month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Max Close row per month across all years */}
                  <tr className="border-b-2 border-blue-300 bg-blue-100/80">
                    <td className="px-3 py-2 text-sm font-bold text-blue-800">MAX</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const maxClose = maxCloseByMonth.get(month);
                      const isOverallMax = maxClose === overallMax;
                      return (
                        <td key={month} className="px-1 py-2 text-center">
                          {maxClose ? (
                            <div className={`px-1 py-1 text-xs font-bold ${
                              isOverallMax
                                ? 'bg-green-500 text-white ring-2 ring-green-600 ring-offset-1'
                                : 'bg-blue-500 text-white'
                            }`}>
                              ${maxClose.toFixed(0)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Individual years showing their max close in grid format */}
                  {years.map((year) => (
                    <tr key={year} className="border-b border-blue-100">
                      <td className="px-3 py-1 text-sm font-medium text-gray-700">{year}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const cell = cellMap.get(`${year}-${month}`);
                        const maxClose = maxCloseByMonth.get(month);
                        const isMax = cell && maxClose && Math.abs(cell.close_max - maxClose) < 0.01;
                        return (
                          <td key={month} className="px-1 py-1">
                            {cell ? (
                              <div
                                className={`h-8 flex items-center justify-center text-xs font-medium ${
                                  isMax
                                    ? 'bg-blue-500 text-white ring-2 ring-blue-600 ring-offset-1'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                ${cell.close_max.toFixed(0)}
                              </div>
                            ) : (
                              <div className="h-8 bg-gray-100 flex items-center justify-center text-xs text-gray-400">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && !error && data.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
