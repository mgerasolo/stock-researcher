import { useState, useEffect, useMemo, useRef } from 'react';
import type { ViewMode, Timeframe, FilterCriteria, CalculationMethod } from '../App';

interface HeatmapCell {
  year: number;
  month: number;
  close_max: number;
  return_pct: number | null;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
}

interface MonthAggregate {
  month: number;
  win_rate: number;
  avg_return: number;
  min_return: number;
  max_return: number;
  count: number;
  alpha: number; // Return vs market (SPY+DIA average)
  market_return: number; // Benchmark return for this period
}

interface HeatmapData {
  ticker: string;
  holdingPeriod: number;
  viewMode: string;
  calcMethod: CalculationMethod;
  data: HeatmapCell[];
  aggregates: MonthAggregate[];
  lastUpdated: string;
}

interface HeatmapProps {
  ticker: string;
  viewMode: ViewMode;
  holdingPeriod: Timeframe;
  calcMethod: CalculationMethod;
  defaultExpanded?: boolean;
  filters?: FilterCriteria;
  highlightMonth?: number; // 1-12, month to highlight from report click
  yearsToShow?: number; // Number of years to display (default 12)
}

interface TooltipState {
  cell: HeatmapCell;
  x: number;
  y: number;
}

interface OutlierTooltipState {
  outlier: OutlierInfo;
  month: number;
  outlierYear: number;
  x: number;
  y: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Outlier detection: calculate if top value is significantly higher than average of others
interface OutlierInfo {
  hasOutlier: boolean;
  severity: 'severe' | 'high' | 'moderate' | null;
  icon: string;
  topValue: number;
  avgOthers: number;
  multiplier: number;
}

function calculateOutlier(values: number[]): OutlierInfo {
  if (values.length < 4) {
    return { hasOutlier: false, severity: null, icon: '', topValue: 0, avgOthers: 0, multiplier: 0 };
  }

  // Sort descending
  const sorted = [...values].sort((a, b) => b - a);
  const topValue = sorted[0];

  // Only check positive outliers that could skew average up
  if (topValue <= 0) {
    return { hasOutlier: false, severity: null, icon: '', topValue: 0, avgOthers: 0, multiplier: 0 };
  }

  // Remove top 2, average the rest
  const remaining = sorted.slice(2);
  const avgOthers = remaining.reduce((sum, v) => sum + v, 0) / remaining.length;

  // Calculate how many standard deviations the top value is from the mean of others
  const variance = remaining.reduce((sum, v) => sum + Math.pow(v - avgOthers, 2), 0) / remaining.length;
  const stdDev = Math.sqrt(variance);

  // Calculate z-score for statistical outlier detection
  const zScore = stdDev > 0 ? (topValue - avgOthers) / stdDev : 0;

  // Use strict criteria - only flag truly extreme outliers
  let severity: 'severe' | 'high' | 'moderate' | null = null;
  let multiplier = 0;

  // Must meet BOTH criteria: high z-score AND significant multiplier/difference
  if (avgOthers > 5) {
    // Standard case: use multiplier AND z-score
    multiplier = topValue / avgOthers;
    // Require both high multiplier AND statistical significance
    if (multiplier >= 10 && zScore >= 3) severity = 'severe';
    else if (multiplier >= 7 && zScore >= 2.5) severity = 'high';
    else if (multiplier >= 5 && zScore >= 2) severity = 'moderate';
  } else if (avgOthers > 0) {
    // Low positive baseline - use stricter absolute difference
    const absoluteDiff = topValue - avgOthers;
    if (absoluteDiff >= 80 && zScore >= 3.5) {
      severity = 'severe';
      multiplier = zScore;
    } else if (absoluteDiff >= 60 && zScore >= 3) {
      severity = 'high';
      multiplier = zScore;
    }
  } else {
    // Negative/zero baseline - only flag extreme positive spikes
    const absoluteDiff = topValue - avgOthers;
    if (absoluteDiff >= 100 && zScore >= 4) {
      severity = 'severe';
      multiplier = zScore;
    } else if (absoluteDiff >= 70 && zScore >= 3.5) {
      severity = 'high';
      multiplier = zScore;
    }
  }

  if (severity) {
    const icon = severity === 'severe' ? '‼️' : severity === 'high' ? '❗' : '⚠️';
    return { hasOutlier: true, severity, icon, topValue, avgOthers, multiplier };
  }

  return { hasOutlier: false, severity: null, icon: '', topValue, avgOthers, multiplier };
}

// Trimmed mean: remove top 2 and bottom 2 outliers for more robust average
function calculateTrimmedMean(values: number[]): number | null {
  if (values.length < 5) {
    // Not enough data to trim, return regular average
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  // Sort ascending
  const sorted = [...values].sort((a, b) => a - b);

  // Remove bottom 2 and top 2
  const trimmed = sorted.slice(2, -2);

  if (trimmed.length === 0) return null;

  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  1: '1 Month',
  3: '3 Month',
  6: '6 Month',
  12: '12 Month',
};

export function Heatmap({ ticker, viewMode, holdingPeriod, calcMethod, defaultExpanded = true, filters, highlightMonth, yearsToShow = 12 }: HeatmapProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [outlierTooltip, setOutlierTooltip] = useState<OutlierTooltipState | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/prices/${ticker}/heatmap?period=${holdingPeriod}&view=${viewMode}&calcMethod=${calcMethod}&years=${yearsToShow}`
        );
        if (!res.ok) {
          throw new Error('Failed to fetch heatmap data');
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
  }, [ticker, viewMode, holdingPeriod, calcMethod, isExpanded, yearsToShow]);

  const getSummaryStats = () => {
    if (!data?.aggregates?.length) return null;
    const avgWinRate = data.aggregates.reduce((sum, a) => sum + a.win_rate, 0) / data.aggregates.length;
    const avgReturn = data.aggregates.reduce((sum, a) => sum + a.avg_return, 0) / data.aggregates.length;
    const bestMonth = data.aggregates.reduce((best, a) => a.avg_return > best.avg_return ? a : best);
    return { avgWinRate, avgReturn, bestMonth };
  };

  const stats = getSummaryStats();
  const years = data ? [...new Set(data.data.map((d) => d.year))].sort((a, b) => b - a) : [];
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    if (data) {
      for (const cell of data.data) {
        map.set(`${cell.year}-${cell.month}`, cell);
      }
    }
    return map;
  }, [data]);

  // Calculate outliers per month (with year tracking)
  const outliersByMonth = useMemo(() => {
    const outliers = new Map<number, { info: OutlierInfo; outlierYear: number }>();
    if (!data?.data) return outliers;

    // Group returns by month with year tracking
    const returnsByMonth = new Map<number, { value: number; year: number }[]>();
    for (const cell of data.data) {
      if (cell.return_pct !== null) {
        const existing = returnsByMonth.get(cell.month) || [];
        existing.push({ value: cell.return_pct, year: cell.year });
        returnsByMonth.set(cell.month, existing);
      }
    }

    // Calculate outliers for each month
    for (const [month, returns] of returnsByMonth) {
      const values = returns.map(r => r.value);
      const info = calculateOutlier(values);

      // Find the year with the outlier (top value)
      let outlierYear = 0;
      if (info.hasOutlier) {
        const topReturn = returns.reduce((max, r) => r.value > max.value ? r : max);
        outlierYear = topReturn.year;
      }

      outliers.set(month, { info, outlierYear });
    }

    return outliers;
  }, [data?.data]);

  // Calculate trimmed averages per month (remove top 2 and bottom 2 outliers)
  const trimmedAvgByMonth = useMemo(() => {
    const trimmed = new Map<number, number>();
    if (!data?.data) return trimmed;

    // Group returns by month
    const returnsByMonth = new Map<number, number[]>();
    for (const cell of data.data) {
      if (cell.return_pct !== null) {
        const existing = returnsByMonth.get(cell.month) || [];
        existing.push(cell.return_pct);
        returnsByMonth.set(cell.month, existing);
      }
    }

    // Calculate trimmed mean for each month
    for (const [month, returns] of returnsByMonth) {
      const trimmedMean = calculateTrimmedMean(returns);
      if (trimmedMean !== null) {
        trimmed.set(month, trimmedMean);
      }
    }

    return trimmed;
  }, [data?.data]);

  // Check if a month meets filter criteria
  const meetsFilterCriteria = (agg: MonthAggregate | undefined): boolean => {
    if (!agg || !filters) return false;
    return agg.win_rate >= filters.minWinRate && agg.avg_return >= filters.minAvgGain;
  };

  // Get highlighted months (from filter criteria)
  const highlightedMonths = useMemo(() => {
    if (!data?.aggregates || !filters) return new Set<number>();
    return new Set(
      data.aggregates
        .filter(agg => meetsFilterCriteria(agg))
        .map(agg => agg.month)
    );
  }, [data?.aggregates, filters]);

  // Check if this month should have report highlight (yellow)
  const isReportHighlight = (month: number) => highlightMonth === month;

  // Check if filter mode is active (filters set AND at least one match)
  const isFilterActive = filters && highlightedMonths.size > 0;

  // Helper to determine if a column should be dimmed (doesn't match filter criteria)
  const shouldDimColumn = (month: number) => {
    if (!isFilterActive) return false;
    if (isReportHighlight(month)) return false; // Never dim report highlights
    return !highlightedMonths.has(month);
  };

  const getAggregate = (month: number) => data?.aggregates.find((a) => a.month === month);

  // Handle mouse move for tooltip positioning
  const handleMouseMove = (e: React.MouseEvent, cell: HeatmapCell) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        cell,
        x: e.clientX - rect.left + 10,
        y: e.clientY - rect.top - 10,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div ref={containerRef} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4 shadow-sm relative">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <h3 className="text-lg font-bold text-gray-900">
            {ticker} - {TIMEFRAME_LABELS[holdingPeriod]} Returns
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            calcMethod === 'maxMax'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-indigo-100 text-indigo-700'
          }`}>
            {calcMethod === 'maxMax' ? 'Max→Max' : 'Open→Close'}
          </span>
          {stats && !isExpanded && (
            <div className="flex items-center gap-4 text-sm">
              <span className={`font-medium ${stats.avgWinRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                Win: {stats.avgWinRate.toFixed(0)}%
              </span>
              <span className={`font-medium ${stats.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Avg: {stats.avgReturn.toFixed(1)}%
              </span>
              {highlightedMonths.size > 0 && (
                <span className="text-blue-600 font-medium">
                  {highlightedMonths.size} match{highlightedMonths.size > 1 ? 'es' : ''}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data?.lastUpdated && (
            <span className="text-xs text-gray-400">
              Data: {new Date(data.lastUpdated).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </span>
          )}
          <span className="text-gray-400 text-sm">
            {isExpanded ? '▼ Collapse' : '▶ Expand'}
          </span>
        </div>
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

          {!isLoading && !error && data && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Match Info Bar */}
              {(highlightedMonths.size > 0 || highlightMonth) && (
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 px-4 py-2">
                  <div className="flex items-center justify-end gap-3 text-sm">
                    {highlightedMonths.size > 0 && (
                      <span className="px-2 py-1 bg-blue-600 text-white rounded font-medium">
                        {highlightedMonths.size} month{highlightedMonths.size > 1 ? 's' : ''} match
                      </span>
                    )}
                    {highlightMonth && (
                      <span className="px-2 py-1 bg-yellow-400 text-yellow-900 rounded font-medium text-xs">
                        📍 {MONTHS[highlightMonth - 1]} from report
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[60px]" />
                    {MONTHS.map((_, idx) => (
                      <col key={idx} className="w-[70px]" />
                    ))}
                    <col className="w-[70px]" /> {/* Total column */}
                    <col className="w-[70px]" /> {/* Avg column */}
                  </colgroup>
                  <thead>
                    {/* Month Headers */}
                    <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                      <th className="px-3 py-2 text-left text-sm font-bold text-gray-700">
                        <span className="text-blue-800 uppercase text-xs tracking-wider">Metric</span>
                      </th>
                      {MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isFromReport = isReportHighlight(monthNum);
                        const isDimmed = shouldDimColumn(monthNum);
                        return (
                          <th
                            key={month}
                            className={`px-1 py-2 text-center text-sm font-bold transition-opacity ${
                              isFromReport
                                ? 'bg-yellow-200 text-yellow-900 ring-2 ring-yellow-400'
                                : isDimmed
                                  ? 'text-gray-400 opacity-40'
                                  : 'text-gray-700'
                            }`}
                          >
                            {month}
                            {isFromReport && <span className="block text-xs">📍</span>}
                          </th>
                        );
                      })}
                      <th className="px-1 py-2 text-center text-sm font-bold text-gray-700 bg-slate-100 border-l-2 border-slate-300">
                        Total
                      </th>
                      <th className="px-1 py-2 text-center text-sm font-bold text-gray-700 bg-slate-100">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Win Rate Row - PRIMARY METRIC */}
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                      <td className="px-3 py-3 text-base font-bold text-gray-900 cursor-help" title="Win Rate: Percentage of years with positive returns for this entry month">Win %</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        return (
                          <td key={month} className={`px-1 py-3 text-center transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            {agg ? (
                              <div className={`text-lg font-bold py-1 rounded ${
                                isFromReport
                                  ? 'ring-2 ring-yellow-500 ring-offset-1'
                                  : ''
                              } ${
                                agg.win_rate >= 70
                                  ? 'bg-green-500 text-green-950'
                                  : agg.win_rate >= 60
                                    ? 'bg-green-400 text-green-950'
                                    : agg.win_rate > 50
                                      ? 'bg-green-300 text-green-900'
                                      : 'text-gray-500'
                              }`}>
                                {agg.win_rate}%
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Overall Win Rate */}
                      {(() => {
                        const totalWins = data?.aggregates?.reduce((sum, a) => sum + (a.win_rate > 50 ? 1 : 0), 0) || 0;
                        const totalMonths = data?.aggregates?.length || 0;
                        const overallWinPct = totalMonths > 0 ? Math.round((totalWins / totalMonths) * 100) : 0;
                        return (
                          <>
                            <td className="px-1 py-3 text-center bg-slate-100 border-l-2 border-slate-300">
                              <span className="text-sm text-gray-500">-</span>
                            </td>
                            <td className="px-1 py-3 text-center bg-slate-100">
                              <span className={`text-lg font-bold ${overallWinPct >= 50 ? 'text-green-700' : 'text-gray-500'}`}>
                                {totalMonths > 0 ? `${Math.round(data!.aggregates.reduce((sum, a) => sum + a.win_rate, 0) / totalMonths)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Average Per Month Row - PRIMARY METRIC using trimmed mean */}
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                      <td className="px-3 py-3 text-base font-bold text-gray-900 cursor-help" title="Average Return Per Month (Trimmed): Total return divided by holding months. Excludes top 2 and bottom 2 outlier years for more reliable average.">
                        Avg/Mo*
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        const outlierData = outliersByMonth.get(month);
                        const outlierInfo = outlierData?.info;
                        const outlierYear = outlierData?.outlierYear || 0;
                        // Use trimmed mean for display
                        const trimmedReturn = trimmedAvgByMonth.get(month);
                        const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;
                        const avgPerMonth = trimmedReturn !== undefined ? trimmedReturn / actualHoldingMonths : null;
                        return (
                          <td key={month} className={`px-1 py-3 text-center transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            {avgPerMonth !== null ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-lg font-bold ${
                                  avgPerMonth >= 0 ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {avgPerMonth.toFixed(2)}%
                                </span>
                                {outlierInfo?.hasOutlier && (
                                  <span
                                    className="cursor-help"
                                    onMouseEnter={(e) => {
                                      const rect = containerRef.current?.getBoundingClientRect();
                                      if (rect && outlierInfo) {
                                        setOutlierTooltip({
                                          outlier: outlierInfo,
                                          month,
                                          outlierYear,
                                          x: e.clientX - rect.left,
                                          y: e.clientY - rect.top - 10,
                                        });
                                      }
                                    }}
                                    onMouseLeave={() => setOutlierTooltip(null)}
                                  >
                                    {outlierInfo.icon}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Overall trimmed average */}
                      {(() => {
                        const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;
                        const trimmedValues = Array.from(trimmedAvgByMonth.values());
                        const overallTrimmedAvg = trimmedValues.length > 0
                          ? trimmedValues.reduce((sum, v) => sum + v, 0) / trimmedValues.length / actualHoldingMonths
                          : 0;
                        return (
                          <>
                            <td className="px-1 py-3 text-center bg-slate-100 border-l-2 border-slate-300">
                              <span className="text-sm text-gray-500">-</span>
                            </td>
                            <td className="px-1 py-3 text-center bg-slate-100">
                              <span className={`text-lg font-bold ${overallTrimmedAvg >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {trimmedValues.length > 0 ? `${overallTrimmedAvg.toFixed(2)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Alpha Row - Return vs Market */}
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 border-b-2 border-blue-300">
                      <td className="px-3 py-2 text-sm font-bold text-gray-700 cursor-help" title="Alpha: Per-month return vs market benchmark (SPY+DIA average). Positive alpha means outperforming the market by that amount each month.">
                        Alpha
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        return (
                          <td key={month} className={`px-1 py-2 text-center transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            {agg ? (
                              <span className={`text-sm font-semibold ${
                                agg.alpha >= 0.5 ? 'text-green-700' : agg.alpha <= -0.5 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {agg.alpha >= 0 ? '+' : ''}{agg.alpha.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Overall Alpha */}
                      {(() => {
                        const alphaValues = data?.aggregates?.map(a => a.alpha) || [];
                        const overallAlpha = alphaValues.length > 0
                          ? alphaValues.reduce((sum, a) => sum + a, 0) / alphaValues.length
                          : 0;
                        return (
                          <>
                            <td className="px-1 py-2 text-center bg-slate-100 border-l-2 border-slate-300">
                              <span className="text-sm text-gray-500">-</span>
                            </td>
                            <td className="px-1 py-2 text-center bg-slate-100">
                              <span className={`text-sm font-semibold ${
                                overallAlpha >= 0.5 ? 'text-green-700' : overallAlpha <= -0.5 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {alphaValues.length > 0 ? `${overallAlpha >= 0 ? '+' : ''}${overallAlpha.toFixed(2)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Average Return Row */}
                    <tr className="bg-blue-50/30">
                      <td className="px-3 py-1 text-sm font-medium text-gray-600 cursor-help" title="Average Total Return: Simple average of all years' total returns for this holding period (not trimmed, includes all outliers)">Avg</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        return (
                          <td key={month} className={`px-1 py-1 text-center transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            {agg ? (
                              <span className={`text-xs ${
                                agg.avg_return >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {agg.avg_return.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Total and Average for Avg row */}
                      {(() => {
                        const totalAvgReturn = data?.aggregates?.reduce((sum, a) => sum + a.avg_return, 0) || 0;
                        const avgCount = data?.aggregates?.length || 0;
                        const overallAvg = avgCount > 0 ? totalAvgReturn / avgCount : 0;
                        return (
                          <>
                            <td className="px-1 py-1 text-center bg-slate-50 border-l-2 border-slate-300">
                              <span className={`text-xs ${totalAvgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totalAvgReturn.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-1 py-1 text-center bg-slate-50">
                              <span className={`text-xs ${overallAvg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {avgCount > 0 ? `${overallAvg.toFixed(1)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Min Return Row */}
                    <tr className="bg-blue-50/30">
                      <td className="px-3 py-1 text-sm font-medium text-gray-600 cursor-help" title="Minimum Return: Worst total return across all years for this entry month - shows downside risk">Min</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        return (
                          <td key={month} className={`px-1 py-1 text-center transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            {agg ? (
                              <span className="text-xs text-red-600">{agg.min_return.toFixed(1)}%</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 py-1 text-center bg-slate-50 border-l-2 border-slate-300">
                        <span className="text-xs text-gray-400">-</span>
                      </td>
                      <td className="px-1 py-1 text-center bg-slate-50">
                        <span className="text-xs text-red-600">
                          {data?.aggregates?.length ? `${Math.min(...data.aggregates.map(a => a.min_return)).toFixed(1)}%` : '-'}
                        </span>
                      </td>
                    </tr>
                    {/* Max Return Row */}
                    <tr className="bg-blue-50/30 border-b-2 border-blue-200">
                      <td className="px-3 py-1 text-sm font-medium text-gray-600 cursor-help" title="Maximum Return: Best total return across all years for this entry month - shows upside potential">Max</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        return (
                          <td key={month} className={`px-1 py-1 text-center transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            {agg ? (
                              <span className="text-xs text-green-600">{agg.max_return.toFixed(1)}%</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1 py-1 text-center bg-slate-50 border-l-2 border-slate-300">
                        <span className="text-xs text-gray-400">-</span>
                      </td>
                      <td className="px-1 py-1 text-center bg-slate-50">
                        <span className="text-xs text-green-600">
                          {data?.aggregates?.length ? `${Math.max(...data.aggregates.map(a => a.max_return)).toFixed(1)}%` : '-'}
                        </span>
                      </td>
                    </tr>
                    {/* Year Header Row */}
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td className="px-3 py-2 text-sm font-medium text-gray-600">Year</td>
                      {MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isFromReport = isReportHighlight(monthNum);
                        const isDimmed = shouldDimColumn(monthNum);
                        return (
                          <td
                            key={month}
                            className={`px-1 py-2 text-center text-sm font-medium transition-opacity ${
                              isFromReport
                                ? 'bg-yellow-200 text-yellow-900'
                                : isDimmed
                                  ? 'text-gray-400 opacity-40'
                                  : 'text-gray-600'
                            }`}
                          >
                            {month}
                          </td>
                        );
                      })}
                      <td className="px-1 py-2 text-center text-sm font-medium text-gray-600 bg-slate-100 border-l-2 border-slate-300">
                        Total
                      </td>
                      <td className="px-1 py-2 text-center text-sm font-medium text-gray-600 bg-slate-100">
                        Avg
                      </td>
                    </tr>
                    {/* Yearly Data Rows */}
                    {years.map((year) => {
                      // Calculate year totals
                      const yearCells = Array.from({ length: 12 }, (_, i) => cellMap.get(`${year}-${i + 1}`))
                        .filter(c => c && c.return_pct !== null);
                      const yearTotal = yearCells.reduce((sum, c) => sum + (c?.return_pct || 0), 0);
                      const yearAvg = yearCells.length > 0 ? yearTotal / yearCells.length : null;

                      return (
                        <tr key={year} className="border-b border-gray-100">
                          <td className="px-3 py-1 text-sm font-medium text-gray-700">{year}</td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                            const cell = cellMap.get(`${year}-${month}`);
                            const isFromReport = isReportHighlight(month);
                            const isDimmed = shouldDimColumn(month);
                            return (
                              <td key={month} className={`px-1 py-1 transition-opacity ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                                {cell ? (
                                  <div
                                    onMouseMove={(e) => handleMouseMove(e, cell)}
                                    onMouseLeave={handleMouseLeave}
                                    className={`h-8 flex items-center justify-center text-xs font-medium cursor-pointer ${
                                      isFromReport
                                        ? 'ring-2 ring-yellow-500 ring-offset-1'
                                        : ''
                                    } ${getCellColor(cell.return_pct, holdingPeriod, calcMethod)}`}
                                  >
                                    {cell.return_pct !== null
                                      ? `${cell.return_pct.toFixed(1)}%`
                                      : '-'}
                                  </div>
                                ) : (
                                  <div className="h-8 bg-gray-100 flex items-center justify-center text-xs text-gray-400">-</div>
                                )}
                              </td>
                            );
                          })}
                          {/* Year Total */}
                          <td className="px-1 py-1 bg-slate-50 border-l-2 border-slate-300">
                            <div className={`h-8 flex items-center justify-center text-xs font-bold ${
                              yearTotal >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {yearCells.length > 0 ? `${yearTotal.toFixed(1)}%` : '-'}
                            </div>
                          </td>
                          {/* Year Avg */}
                          <td className="px-1 py-1 bg-slate-50">
                            <div className={`h-8 flex items-center justify-center text-xs font-bold ${
                              (yearAvg || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {yearAvg !== null ? `${yearAvg.toFixed(1)}%` : '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none"
          style={{
            left: Math.min(tooltip.x, (containerRef.current?.clientWidth || 500) - 250),
            top: tooltip.y,
            maxWidth: '240px',
          }}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="text-gray-400">Entry:</div>
            <div>{tooltip.cell.entry_date}</div>
            <div className="text-gray-400">
              {calcMethod === 'maxMax' ? 'Entry Max:' : 'Entry Open:'}
            </div>
            <div>${Number(tooltip.cell.entry_price).toFixed(2)}</div>
            <div className="text-gray-400">Exit:</div>
            <div>{tooltip.cell.exit_date}</div>
            <div className="text-gray-400">
              {calcMethod === 'maxMax' ? 'Exit Max:' : 'Exit Close:'}
            </div>
            <div>${Number(tooltip.cell.exit_price).toFixed(2)}</div>
            <div className="col-span-2 border-t border-gray-700 mt-1 pt-1">
              <span className="text-gray-400">Return: </span>
              <span className={`font-bold ${
                (tooltip.cell.return_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
{tooltip.cell.return_pct?.toFixed(2)}%
              </span>
              <span className="ml-2 text-gray-400">
                (${(Number(tooltip.cell.exit_price) - Number(tooltip.cell.entry_price)).toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Outlier Warning Tooltip */}
      {outlierTooltip && (
        <div
          className={`absolute z-50 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none ${
            outlierTooltip.outlier.severity === 'severe'
              ? 'bg-red-800'
              : outlierTooltip.outlier.severity === 'high'
                ? 'bg-orange-700'
                : 'bg-yellow-700'
          }`}
          style={{
            left: Math.min(outlierTooltip.x, (containerRef.current?.clientWidth || 500) - 280),
            top: outlierTooltip.y,
            maxWidth: '280px',
          }}
        >
          <div className="font-bold mb-1">
            {outlierTooltip.outlier.severity === 'severe'
              ? '⚠️ Severe Outlier Warning'
              : outlierTooltip.outlier.severity === 'high'
                ? '⚠️ High Outlier Warning'
                : '⚠️ Moderate Outlier Warning'}
          </div>
          <div className="text-gray-100">
            <p className="mb-1">
              {MONTHS[outlierTooltip.month - 1]} {outlierTooltip.outlierYear}: <span className="font-bold text-white">{outlierTooltip.outlier.topValue.toFixed(1)}%</span>
            </p>
            {outlierTooltip.outlier.avgOthers > 0 ? (
              <p className="mb-1">
                This is <span className="font-bold text-white">{outlierTooltip.outlier.multiplier.toFixed(1)}x</span> higher than average of other years
              </p>
            ) : (
              <p className="mb-1">
                This outlier is <span className="font-bold text-white">{outlierTooltip.outlier.multiplier.toFixed(1)} std devs</span> above the baseline
              </p>
            )}
            <p className="text-gray-200 text-[11px]">
              Avg excluding top 2: {outlierTooltip.outlier.avgOthers.toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic color scale based on per-month returns
 * - Muted colors (20% saturation feel) with dark text for readability
 * - 1.25% per month per step for better distribution across scale
 * - Neutral zone: 0% to 0.625% per month (half a step)
 */
function getCellColor(returnPct: number | null, holdingPeriod: number, calcMethod: CalculationMethod): string {
  if (returnPct === null) return 'bg-gray-100 text-gray-400';

  // For open-to-close, actual holding is period + 1 months (buy open month 1, sell close month N)
  const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;

  // Calculate monthly rate
  const monthlyRate = returnPct / actualHoldingMonths;

  // Step size: 1.25% per month per step (wider scale = better distribution)
  const stepSize = 1.25;
  let steps: number;

  if (monthlyRate < 0) {
    // Each 1.25% per month below 0 = 1 step toward red
    steps = Math.floor(monthlyRate / stepSize);
  } else if (monthlyRate <= stepSize / 2) {
    // Neutral zone: 0% to 0.625% per month
    steps = 0;
  } else {
    // Each 1.25% per month above neutral = 1 step toward green
    steps = Math.floor((monthlyRate - stepSize / 2) / stepSize) + 1;
  }

  // Clamp to -5 to +5
  steps = Math.max(-5, Math.min(5, steps));

  // Muted color mapping: lighter backgrounds with dark text for readability
  // Uses opacity-like feel with lighter Tailwind shades
  const colorMap: Record<number, string> = {
    [-5]: 'bg-red-300/80 text-red-900',    // Strongest red (muted)
    [-4]: 'bg-red-200/80 text-red-800',
    [-3]: 'bg-red-200/60 text-red-700',
    [-2]: 'bg-red-100/80 text-red-700',
    [-1]: 'bg-red-100/50 text-red-600',
    [0]: 'bg-gray-100 text-gray-600',       // Neutral
    [1]: 'bg-green-100/50 text-green-700',
    [2]: 'bg-green-100/80 text-green-700',
    [3]: 'bg-green-200/60 text-green-800',
    [4]: 'bg-green-200/80 text-green-800',
    [5]: 'bg-green-300/80 text-green-900',  // Strongest green (muted)
  };

  return colorMap[steps] || 'bg-gray-100 text-gray-400';
}
