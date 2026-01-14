import { useState, useEffect, useMemo } from 'react';
import type { CalculationMethod, Timeframe, FilterCriteria } from '../App';

interface MonthAggregate {
  month: number;
  win_rate: number;
  avg_return: number;
  min_return: number;
  max_return: number;
  count: number;
}

interface HeatmapResponse {
  ticker: string;
  holdingPeriod: number;
  viewMode: string;
  calcMethod: CalculationMethod;
  aggregates: MonthAggregate[];
}

interface BestMonth {
  ticker: string;
  month: number;
  monthName: string;
  holdingPeriod: number;
  avgGainPerMonth: number;
  totalGain: number;
  winRate: number;
  isFavorite?: boolean;
}

interface BestMonthsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string | null;
  calcMethod: CalculationMethod;
  filters: FilterCriteria;
  favorites: Set<string>;
  onToggleFavorite: (key: string) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIMEFRAMES: Timeframe[] = [3, 6, 12];

export function BestMonthsDrawer({
  isOpen,
  ticker,
  calcMethod,
  filters,
  favorites,
  onToggleFavorite
}: BestMonthsDrawerProps) {
  const [rawData, setRawData] = useState<Record<number, BestMonth[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all', '3', '6', '12']));

  // Local filters for the panel
  const [localFilters, setLocalFilters] = useState({
    monthFilter: '' as string, // empty = all months
    minWinRate: filters.minWinRate,
    minAvgGain: filters.minAvgGain,
  });

  // Sync with parent filters when they change
  useEffect(() => {
    setLocalFilters(prev => ({
      ...prev,
      minWinRate: filters.minWinRate,
      minAvgGain: filters.minAvgGain,
    }));
  }, [filters.minWinRate, filters.minAvgGain]);

  useEffect(() => {
    if (!isOpen || !ticker) return;

    const fetchAllTimeframes = async () => {
      setIsLoading(true);
      const results: Record<number, BestMonth[]> = {};

      try {
        await Promise.all(
          TIMEFRAMES.map(async (period) => {
            const res = await fetch(
              `/api/prices/${ticker}/heatmap?period=${period}&view=entry&calcMethod=${calcMethod}&years=10`
            );
            if (res.ok) {
              const json: HeatmapResponse = await res.json();
              // For open-to-close, actual holding is period + 1 months (buy open month 1, sell close month N)
              const actualHoldingMonths = calcMethod === 'openClose' ? period + 1 : period;
              results[period] = json.aggregates
                .map((agg) => ({
                  ticker: ticker,
                  month: agg.month,
                  monthName: MONTHS[agg.month - 1],
                  holdingPeriod: period,
                  avgGainPerMonth: agg.avg_return / actualHoldingMonths,
                  totalGain: agg.avg_return,
                  winRate: agg.win_rate,
                }))
                .sort((a, b) => b.avgGainPerMonth - a.avgGainPerMonth);
            }
          })
        );
        setRawData(results);
      } catch (error) {
        console.error('Failed to fetch best months data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllTimeframes();
  }, [isOpen, ticker, calcMethod]);

  // Apply local filters to data
  const filteredData = useMemo(() => {
    const result: Record<number, BestMonth[]> = {};
    for (const [period, months] of Object.entries(rawData)) {
      result[Number(period)] = months.filter((m) => {
        // Month filter
        if (localFilters.monthFilter && m.monthName !== localFilters.monthFilter) {
          return false;
        }
        // Win rate filter
        if (m.winRate < localFilters.minWinRate) {
          return false;
        }
        // Avg gain filter
        if (m.avgGainPerMonth < localFilters.minAvgGain) {
          return false;
        }
        return true;
      });
    }
    return result;
  }, [rawData, localFilters]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Combine all timeframes for "All Time Periods" section
  const allBestMonths: BestMonth[] = Object.values(filteredData)
    .flat()
    .sort((a, b) => b.avgGainPerMonth - a.avgGainPerMonth)
    .slice(0, 20);

  const getFavoriteKey = (tickerStr: string, month: number, period: number) => `${tickerStr}-${month}-${period}`;

  const renderTable = (months: BestMonth[], showDuration: boolean = true) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
          <th className="pb-2 pl-2">Stock</th>
          <th className="pb-2">Buy</th>
          {showDuration && <th className="pb-2 text-center">Hold</th>}
          <th className="pb-2 text-right">Avg/Mo</th>
          <th className="pb-2 text-right pr-2">Win %</th>
        </tr>
      </thead>
      <tbody>
        {months.map((m, idx) => {
          const favKey = getFavoriteKey(m.ticker, m.month, m.holdingPeriod);
          const isFav = favorites.has(favKey);
          return (
            <tr
              key={`${m.ticker}-${m.month}-${m.holdingPeriod}-${idx}`}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="py-2 pl-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleFavorite(favKey)}
                    className={`transition-colors ${
                      isFav ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'
                    }`}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'currentColor'} stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: isFav ? 1 : 0.6 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                  <span className="font-semibold text-blue-600">{m.ticker}</span>
                </div>
              </td>
              <td className="py-2 font-medium text-gray-800">{m.monthName}</td>
              {showDuration && (
                <td className="py-2 text-center text-gray-600">{m.holdingPeriod}mo</td>
              )}
              <td className={`py-2 text-right font-medium ${
                m.avgGainPerMonth >= 2 ? 'text-green-600' :
                m.avgGainPerMonth >= 0.5 ? 'text-green-500' : 'text-gray-600'
              }`}>
                {m.avgGainPerMonth >= 0 ? '+' : ''}{m.avgGainPerMonth.toFixed(2)}%
              </td>
              <td className={`py-2 text-right pr-2 font-medium ${
                m.winRate >= 70 ? 'text-green-600' :
                m.winRate >= 60 ? 'text-green-500' : 'text-gray-600'
              }`}>
                {m.winRate}%
              </td>
            </tr>
          );
        })}
        {months.length === 0 && (
          <tr>
            <td colSpan={showDuration ? 5 : 4} className="py-4 text-center text-gray-400">
              No entries meet filter criteria
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderSection = (title: string, sectionKey: string, months: BestMonth[], showDuration: boolean = true) => (
    <div key={sectionKey} className="border-b border-gray-200">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-800">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{months.length} entries</span>
          <span className={`text-gray-400 transition-transform ${expandedSections.has(sectionKey) ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>
      {expandedSections.has(sectionKey) && (
        <div className="px-4 pb-4">
          {renderTable(months, showDuration)}
        </div>
      )}
    </div>
  );

  // Side panel (not overlay)
  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Best Entry Months</h2>
            {ticker && (
              <p className="text-xs text-gray-600">{ticker} • {calcMethod === 'maxMax' ? 'Max→Max' : 'Open→Close'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="space-y-2">
          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-12">Month:</label>
            <select
              value={localFilters.monthFilter}
              onChange={(e) => setLocalFilters(f => ({ ...f, monthFilter: e.target.value }))}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Months</option>
              {MONTHS.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          {/* Min Win Rate */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-12">Win %:</label>
            <input
              type="number"
              value={localFilters.minWinRate}
              onChange={(e) => setLocalFilters(f => ({ ...f, minWinRate: Number(e.target.value) }))}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              min={0}
              max={100}
              step={5}
            />
            <span className="text-xs text-gray-500">+</span>
          </div>

          {/* Min Avg Gain */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-12">Avg/Mo:</label>
            <input
              type="number"
              value={localFilters.minAvgGain}
              onChange={(e) => setLocalFilters(f => ({ ...f, minAvgGain: Number(e.target.value) }))}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              min={-50}
              max={50}
              step={0.5}
            />
            <span className="text-xs text-gray-500">+</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!ticker ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a stock to see best months
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div>
            {renderSection('All Time Periods', 'all', allBestMonths, true)}
            {TIMEFRAMES.map((period) => (
              renderSection(
                `${period} Month Hold`,
                String(period),
                filteredData[period] || [],
                false
              )
            ))}
          </div>
        )}
      </div>

      {/* Footer with favorites count */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-pink-500">❤️ {favorites.size} favorite{favorites.size !== 1 ? 's' : ''}</span>
          <span>Sorted by Avg/Mo</span>
        </div>
      </div>
    </div>
  );
}
