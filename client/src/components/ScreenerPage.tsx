import { useState, useEffect, useMemo, useRef } from 'react';
import type { CalculationMethod } from '../App';

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

interface ScreenerResult {
  ticker: string;
  entryMonth: number;
  entryMonthName: string;
  holdingPeriod: number;
  avgReturn: number;
  avgPerMonth: number;
  winRate: number;
  count: number;
  minReturn: number;
  maxReturn: number;
  marketReturn: number;
  marketPerMonth: number;
  alpha: number;
  score?: number; // Composite score: (winRate/100) * avgPerMonth * sqrt(count)
}

interface ScreenerResponse {
  results: ScreenerResult[];
  totalPatterns: number;
  totalStocks: number;
  filters: {
    minWinRate: number;
    minAvgPerMonth: number;
    minYears: number;
    holdingPeriods: number[];
    calcMethod: string;
    years: number;
  };
}

export type SentimentFilter = 'hide-avoided' | 'all' | 'favorites-only';
export type TickerSentiment = 'up' | 'down' | null;

interface ScreenerPageProps {
  calcMethod: CalculationMethod;
  onSelectTicker?: (ticker: string, entryMonth: number, holdingPeriod: number) => void;
  upcomingOnly?: boolean;
  tickerSentiments?: Record<string, 'up' | 'down'>;
  onSentimentChange?: (ticker: string, sentiment: TickerSentiment) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (key: string) => void;
}

// Get upcoming months (current + next 2)
function getUpcomingMonths(): number[] {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  return [
    currentMonth,
    currentMonth === 12 ? 1 : currentMonth + 1,
    currentMonth >= 11 ? (currentMonth === 11 ? 1 : 2) : currentMonth + 2,
  ];
}

export function ScreenerPage({ calcMethod: initialCalcMethod, onSelectTicker, upcomingOnly = false, tickerSentiments = {}, onSentimentChange, favorites = new Set(), onToggleFavorite }: ScreenerPageProps) {
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('hide-avoided');

  // Get default months (upcoming 3 for upcomingOnly, all for Top Periods)
  const defaultMonths = useMemo(() => {
    if (!upcomingOnly) return MONTH_OPTIONS.map(m => m.value); // All months
    return getUpcomingMonths();
  }, [upcomingOnly]);

  // Filters
  const [minWinRate, setMinWinRate] = useState(60);
  const [minAvgPerMonth, setMinAvgPerMonth] = useState(0.5);
  const [minYears, setMinYears] = useState(8);
  const [holdingPeriods, setHoldingPeriods] = useState<number[]>([3, 6]);
  const [limit, setLimit] = useState(100);
  const [activeCalcMethod, setActiveCalcMethod] = useState<CalculationMethod>(initialCalcMethod);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(defaultMonths);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  // Sorting - default to composite score
  const [sortBy, setSortBy] = useState<keyof ScreenerResult>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const periods = holdingPeriods.join(',');
        const res = await fetch(
          `/api/screener?minWinRate=${minWinRate}&minAvgPerMonth=${minAvgPerMonth}&minYears=${minYears}&periods=${periods}&calcMethod=${activeCalcMethod}&limit=${limit}`
        );
        if (!res.ok) {
          throw new Error('Failed to fetch screener data');
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [minWinRate, minAvgPerMonth, minYears, holdingPeriods, activeCalcMethod, limit]);

  // Close month dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setMonthDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate composite score: (winRate/100) * avgPerMonth * sqrt(count)
  const calculateScore = (r: ScreenerResult): number => {
    return (r.winRate / 100) * r.avgPerMonth * Math.sqrt(r.count);
  };

  // Sort and filter results by selected months and sentiment
  const sortedResults = useMemo(() => {
    if (!data?.results) return [];

    // Calculate score for each result
    const withScores = data.results.map(r => ({
      ...r,
      score: calculateScore(r),
    }));

    // Filter by selected months
    let filtered = withScores.filter(r => selectedMonths.includes(r.entryMonth));

    // Filter by sentiment
    if (sentimentFilter === 'hide-avoided') {
      // Hide tickers with 'down' sentiment
      filtered = filtered.filter(r => tickerSentiments[r.ticker] !== 'down');
    } else if (sentimentFilter === 'favorites-only') {
      // Only show tickers with 'up' sentiment
      filtered = filtered.filter(r => tickerSentiments[r.ticker] === 'up');
    }
    // 'all' shows everything

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return 0;
    });
    return sorted;
  }, [data?.results, sortBy, sortDir, selectedMonths, sentimentFilter, tickerSentiments]);

  const handleSort = (column: keyof ScreenerResult) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const togglePeriod = (period: number) => {
    setHoldingPeriods(prev => {
      if (prev.includes(period)) {
        if (prev.length === 1) return prev; // Don't remove last period
        return prev.filter(p => p !== period);
      }
      return [...prev, period].sort((a, b) => a - b);
    });
  };

  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        if (prev.length === 1) return prev; // Don't remove last month
        return prev.filter(m => m !== month);
      }
      return [...prev, month].sort((a, b) => a - b);
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths(MONTH_OPTIONS.map(m => m.value));
  };

  const clearMonths = () => {
    // Keep at least one month (first selected or January)
    setSelectedMonths([selectedMonths[0] || 1]);
  };

  const getMonthsDisplayText = (): string => {
    if (selectedMonths.length === 12) return 'All Months';
    if (selectedMonths.length === 0) return 'Select months';
    if (selectedMonths.length <= 3) {
      return selectedMonths.map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ');
    }
    return `${selectedMonths.length} months`;
  };

  const getAlphaColor = (alpha: number): string => {
    if (alpha >= 2) return 'text-green-600 font-bold';
    if (alpha >= 1) return 'text-green-500';
    if (alpha >= 0.5) return 'text-green-400';
    if (alpha >= 0) return 'text-gray-500';
    if (alpha >= -0.5) return 'text-red-400';
    if (alpha >= -1) return 'text-red-500';
    return 'text-red-600 font-bold';
  };

  const getAvgPerMonthColor = (avgPerMonth: number): string => {
    if (avgPerMonth >= 3) return 'bg-green-500 text-white';
    if (avgPerMonth >= 2) return 'bg-green-400 text-white';
    if (avgPerMonth >= 1) return 'bg-green-300 text-gray-800';
    if (avgPerMonth >= 0.5) return 'bg-green-200 text-gray-800';
    if (avgPerMonth >= 0) return 'bg-gray-200 text-gray-700';
    return 'bg-red-200 text-gray-800';
  };

  const getWinRateColor = (winRate: number): string => {
    if (winRate >= 80) return 'text-green-600 font-bold';
    if (winRate >= 70) return 'text-green-500';
    if (winRate >= 60) return 'text-green-400';
    if (winRate >= 50) return 'text-gray-500';
    return 'text-red-500';
  };

  const [scoreTooltipVisible, setScoreTooltipVisible] = useState(false);

  const SortHeader = ({ column, label, highlight = false, tooltip }: { column: keyof ScreenerResult; label: string; highlight?: boolean; tooltip?: string }) => (
    <th
      onClick={() => handleSort(column)}
      onMouseEnter={() => column === 'score' && setScoreTooltipVisible(true)}
      onMouseLeave={() => column === 'score' && setScoreTooltipVisible(false)}
      className={`px-3 py-2 text-left text-xs font-medium cursor-pointer hover:bg-gray-100 select-none relative ${
        highlight ? 'text-green-700 bg-green-50' : 'text-gray-700'
      }`}
      data-sorted={sortBy === column ? sortDir : undefined}
    >
      <div className="flex items-center gap-1">
        {highlight && <span className="text-green-600">★</span>}
        {label}
        {sortBy === column && (
          <span className="text-blue-600">{sortDir === 'desc' ? '▼' : '▲'}</span>
        )}
        {tooltip && (
          <span className="text-gray-400 cursor-help" title={tooltip}>ⓘ</span>
        )}
      </div>
      {column === 'score' && scoreTooltipVisible && (
        <div
          data-testid="score-tooltip"
          className="absolute left-0 top-full mt-1 z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 w-64 font-normal"
        >
          <p className="font-medium mb-1">Composite Score Formula:</p>
          <p className="text-gray-300">Score = (win rate / 100) × average return × √(years of data)</p>
          <p className="text-gray-400 mt-2 text-[10px]">Balances profitability, reliability, and statistical significance.</p>
        </div>
      )}
    </th>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-semibold text-slate-900">
          {upcomingOnly ? 'Upcoming Opportunities' : 'Top Periods'}
        </h2>
        <p className="text-xs text-slate-500">
          {upcomingOnly
            ? 'Best seasonal patterns for the next 3 months'
            : 'All-time best seasonal patterns across all stocks'
          }
        </p>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 p-4 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-6">
          {/* Month Filter Multi-Select */}
          <div className="flex items-center gap-2 relative" ref={monthDropdownRef}>
            <span className="text-sm text-slate-500">Months:</span>
            <button
              onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:ring-1 focus:ring-slate-400 min-w-[120px]"
            >
              <span className="flex-1 text-left">{getMonthsDisplayText()}</span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${monthDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {monthDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                {/* Select All / Clear buttons */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                  <button
                    onClick={selectAllMonths}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearMonths}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Clear
                  </button>
                </div>
                {/* Month checkboxes in 2 columns */}
                <div className="grid grid-cols-2 gap-1 p-2 max-h-64 overflow-y-auto">
                  {MONTH_OPTIONS.map(month => (
                    <label
                      key={month.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMonths.includes(month.value)}
                        onChange={() => toggleMonth(month.value)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{month.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Calculation Method Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Method:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveCalcMethod('maxMax')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeCalcMethod === 'maxMax'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                Max→Max
              </button>
              <button
                onClick={() => setActiveCalcMethod('openClose')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeCalcMethod === 'openClose'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                Open→Close
              </button>
            </div>
          </div>

          {/* Holding Periods */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Periods:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[1, 3, 6, 12].map(period => (
                <button
                  key={period}
                  onClick={() => togglePeriod(period)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    holdingPeriods.includes(period)
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {period}mo
                </button>
              ))}
            </div>
          </div>

          {/* Min Win Rate */}
          <div className="flex items-center gap-1.5">
            <label className="text-sm text-slate-500">Win%</label>
            <input
              type="number"
              value={minWinRate}
              onChange={(e) => setMinWinRate(Number(e.target.value))}
              className="w-14 px-2 py-1 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-400"
              min={0}
              max={100}
              step={5}
            />
          </div>

          {/* Min Avg Per Month */}
          <div className="flex items-center gap-1.5">
            <label className="text-sm text-slate-500">Avg/Mo</label>
            <input
              type="number"
              value={minAvgPerMonth}
              onChange={(e) => setMinAvgPerMonth(Number(e.target.value))}
              className="w-14 px-2 py-1 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-400"
              min={-10}
              max={20}
              step={0.25}
            />
            <span className="text-sm text-slate-400">%</span>
          </div>

          {/* Min Years */}
          <div className="flex items-center gap-1.5">
            <label className="text-sm text-slate-500">Yrs</label>
            <input
              type="number"
              value={minYears}
              onChange={(e) => setMinYears(Math.max(8, Number(e.target.value)))}
              className="w-12 px-2 py-1 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-400"
              min={8}
              max={20}
              step={1}
            />
          </div>

          {/* Limit */}
          <div className="flex items-center gap-1.5">
            <label className="text-sm text-slate-500">Show:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-2 py-1 text-sm bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-400"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* Sentiment Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Tickers:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setSentimentFilter('hide-avoided')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                  sentimentFilter === 'hide-avoided'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
                title="Hide tickers you've marked as avoided"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                Hide 👎
              </button>
              <button
                onClick={() => setSentimentFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sentimentFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
                title="Show all tickers"
              >
                All
              </button>
              <button
                onClick={() => setSentimentFilter('favorites-only')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                  sentimentFilter === 'favorites-only'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
                title="Only show tickers you've liked"
              >
                👍 Only
              </button>
            </div>
          </div>

          {/* Stats */}
          {data && (
            <div className="ml-auto text-sm text-slate-500">
              Showing {sortedResults.length} of {data.totalPatterns} patterns from {data.totalStocks} stocks
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-600">
            <p>Error: {error}</p>
          </div>
        )}

        {!isLoading && !error && sortedResults.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl mb-2">No patterns found</p>
            <p className="text-sm">Try lowering the filter thresholds</p>
          </div>
        )}

        {!isLoading && !error && sortedResults.length > 0 && (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 border-b z-10">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-8">#</th>
                <SortHeader column="score" label="Score" highlight tooltip="Composite score balancing win rate, returns, and years of data" />
                <SortHeader column="ticker" label="Ticker" />
                <SortHeader column="entryMonthName" label="Entry" />
                <SortHeader column="holdingPeriod" label="Hold" />
                <SortHeader column="avgPerMonth" label="Avg/Mo" />
                <SortHeader column="avgReturn" label="Total" />
                <SortHeader column="winRate" label="Win%" />
                <SortHeader column="alpha" label="Alpha" />
                <SortHeader column="marketPerMonth" label="Mkt/Mo" />
                <SortHeader column="count" label="Yrs" />
                <SortHeader column="minReturn" label="Min" />
                <SortHeader column="maxReturn" label="Max" />
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((row, idx) => {
                const currentSentiment = tickerSentiments[row.ticker] || null;
                const favoriteKey = `${row.ticker}-${row.entryMonth}-${row.holdingPeriod}`;
                const isFavorited = favorites.has(favoriteKey);
                return (
                  <tr
                    key={`${row.ticker}-${row.entryMonth}-${row.holdingPeriod}`}
                    className={`border-b hover:bg-indigo-50 cursor-pointer group ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                    onClick={() => onSelectTicker?.(row.ticker, row.entryMonth, row.holdingPeriod)}
                  >
                    <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className={`font-bold text-sm ${row.score && row.score >= 5 ? 'text-green-600' : row.score && row.score >= 3 ? 'text-green-500' : row.score && row.score >= 1 ? 'text-gray-700' : 'text-gray-500'}`}>
                        {row.score?.toFixed(1) ?? '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        <span className="font-bold text-indigo-600 w-16">{row.ticker}</span>
                        {/* Sentiment indicator - fixed width */}
                        <span className="w-5 text-center">
                          {currentSentiment === 'up' && <span className="text-green-500 text-xs">👍</span>}
                          {currentSentiment === 'down' && <span className="text-red-500 text-xs">👎</span>}
                        </span>
                        {/* Action buttons - fixed width container, opacity transition */}
                        <div className="flex items-center gap-0.5 w-20 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onSentimentChange && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSentimentChange(row.ticker, currentSentiment === 'up' ? null : 'up');
                                }}
                                className={`p-1 rounded transition-colors ${
                                  currentSentiment === 'up'
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'text-gray-400 hover:bg-green-50 hover:text-green-500'
                                }`}
                                title={currentSentiment === 'up' ? 'Remove like' : 'Like this ticker'}
                              >
                                <svg className="w-4 h-4" fill={currentSentiment === 'up' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSentimentChange(row.ticker, currentSentiment === 'down' ? null : 'down');
                                }}
                                className={`p-1 rounded transition-colors ${
                                  currentSentiment === 'down'
                                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                    : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                                }`}
                                title={currentSentiment === 'down' ? 'Remove avoid' : 'Avoid this ticker'}
                              >
                                <svg className="w-4 h-4" fill={currentSentiment === 'down' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                </svg>
                              </button>
                            </>
                          )}
                          {onToggleFavorite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(favoriteKey);
                              }}
                              className={`p-1 rounded transition-colors ${
                                isFavorited
                                  ? 'text-pink-500 hover:text-pink-600'
                                  : 'text-gray-400 hover:text-pink-500'
                              }`}
                              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Always show heart if favorited, even when not hovering */}
                        {isFavorited && (
                          <span className="text-pink-500 group-hover:hidden">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">{row.entryMonthName}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{row.holdingPeriod}mo</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-3 py-1 rounded-lg text-base font-bold shadow-sm ${getAvgPerMonthColor(row.avgPerMonth)}`}>
                        {row.avgPerMonth > 0 ? '+' : ''}{row.avgPerMonth.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {row.avgReturn > 0 ? '+' : ''}{row.avgReturn.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-2 text-sm ${getWinRateColor(row.winRate)}`}>
                      {row.winRate}%
                    </td>
                    <td className={`px-3 py-2 text-sm ${getAlphaColor(row.alpha)}`}>
                      {row.alpha > 0 ? '+' : ''}{row.alpha.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {row.marketPerMonth > 0 ? '+' : ''}{row.marketPerMonth.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">{row.count}</td>
                    <td className="px-3 py-2 text-sm text-red-400">
                      {row.minReturn.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-sm text-green-500">
                      +{row.maxReturn.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 p-3 bg-gray-50 border-t text-xs text-gray-500">
        <div className="flex items-center justify-center gap-6">
          <span><strong>Avg/Mo:</strong> Average return per month</span>
          <span><strong>Alpha:</strong> Return vs market (SPY+DIA avg)</span>
          <span><strong>Win%:</strong> % of periods with positive return</span>
          <span><strong>Yrs:</strong> Years of historical data</span>
        </div>
      </div>
    </div>
  );
}
