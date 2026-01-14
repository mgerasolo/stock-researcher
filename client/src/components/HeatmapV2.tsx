import { useState, useEffect, useMemo, useRef } from 'react';
import type { ViewMode, Timeframe, FilterCriteria, CalculationMethod } from '../App';

interface BlackSwanMonth {
  year: number;
  month: number;
  events: {
    id: number;
    title: string;
    type: string;
    impact: number | null;
  }[];
}

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
  alpha: number;
  market_return: number;
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

interface HeatmapV2Props {
  ticker: string;
  viewMode: ViewMode;
  holdingPeriod: Timeframe;
  calcMethod: CalculationMethod;
  defaultExpanded?: boolean;
  filters?: FilterCriteria;
  highlightMonth?: number;
  yearsToShow?: number;
  favorites?: Set<string>;
  onToggleFavorite?: (key: string) => void;
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

  const sorted = [...values].sort((a, b) => b - a);
  const topValue = sorted[0];

  if (topValue <= 0) {
    return { hasOutlier: false, severity: null, icon: '', topValue: 0, avgOthers: 0, multiplier: 0 };
  }

  const remaining = sorted.slice(2);
  const avgOthers = remaining.reduce((sum, v) => sum + v, 0) / remaining.length;

  const variance = remaining.reduce((sum, v) => sum + Math.pow(v - avgOthers, 2), 0) / remaining.length;
  const stdDev = Math.sqrt(variance);

  const zScore = stdDev > 0 ? (topValue - avgOthers) / stdDev : 0;

  let severity: 'severe' | 'high' | 'moderate' | null = null;
  let multiplier = 0;

  if (avgOthers > 5) {
    multiplier = topValue / avgOthers;
    if (multiplier >= 10 && zScore >= 3) severity = 'severe';
    else if (multiplier >= 7 && zScore >= 2.5) severity = 'high';
    else if (multiplier >= 5 && zScore >= 2) severity = 'moderate';
  } else if (avgOthers > 0) {
    const absoluteDiff = topValue - avgOthers;
    if (absoluteDiff >= 80 && zScore >= 3.5) {
      severity = 'severe';
      multiplier = zScore;
    } else if (absoluteDiff >= 60 && zScore >= 3) {
      severity = 'high';
      multiplier = zScore;
    }
  } else {
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
    const icon = severity === 'severe' ? '!!' : severity === 'high' ? '!' : '*';
    return { hasOutlier: true, severity, icon, topValue, avgOthers, multiplier };
  }

  return { hasOutlier: false, severity: null, icon: '', topValue, avgOthers, multiplier };
}

function calculateTrimmedMean(values: number[]): number | null {
  if (values.length < 5) {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  const sorted = [...values].sort((a, b) => a - b);
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

/**
 * HeatmapV2 - Alternate version with split-cell design for better indicator visibility
 *
 * Key differences from original Heatmap:
 * - Split-cell layout: value left-aligned, indicators in fixed-width right section
 * - Colored indicator badges instead of corner badges
 * - Better number alignment across rows
 * - Colored icons instead of emojis for cross-platform consistency
 */
export function HeatmapV2({ ticker, viewMode, holdingPeriod, calcMethod, defaultExpanded = true, filters, highlightMonth, yearsToShow = 12, favorites, onToggleFavorite }: HeatmapV2Props) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [outlierTooltip, setOutlierTooltip] = useState<OutlierTooltipState | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [blackSwanMonths, setBlackSwanMonths] = useState<BlackSwanMonth[]>([]);
  const [blackSwanTooltip, setBlackSwanTooltip] = useState<{ event: BlackSwanMonth; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [ticker, highlightMonth, defaultExpanded]);

  useEffect(() => {
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
  }, [ticker, viewMode, holdingPeriod, calcMethod, yearsToShow]);

  useEffect(() => {
    const fetchBlackSwanMonths = async () => {
      try {
        const res = await fetch('/api/market-events/black-swan-months');
        if (res.ok) {
          const data = await res.json();
          setBlackSwanMonths(data);
        }
      } catch (err) {
        console.error('Failed to fetch black swan months:', err);
      }
    };
    fetchBlackSwanMonths();
  }, []);

  const blackSwanLookup = useMemo(() => {
    const map = new Map<string, BlackSwanMonth>();
    for (const month of blackSwanMonths) {
      map.set(`${month.year}-${month.month}`, month);
    }
    return map;
  }, [blackSwanMonths]);

  const getBlackSwanEvent = (year: number, month: number): BlackSwanMonth | undefined => {
    return blackSwanLookup.get(`${year}-${month}`);
  };

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

  const outliersByMonth = useMemo(() => {
    const outliers = new Map<number, { info: OutlierInfo; outlierYear: number }>();
    if (!data?.data) return outliers;

    const returnsByMonth = new Map<number, { value: number; year: number }[]>();
    for (const cell of data.data) {
      if (cell.return_pct !== null) {
        const existing = returnsByMonth.get(cell.month) || [];
        existing.push({ value: cell.return_pct, year: cell.year });
        returnsByMonth.set(cell.month, existing);
      }
    }

    for (const [month, returns] of returnsByMonth) {
      const values = returns.map(r => r.value);
      const info = calculateOutlier(values);

      let outlierYear = 0;
      if (info.hasOutlier) {
        const topReturn = returns.reduce((max, r) => r.value > max.value ? r : max);
        outlierYear = topReturn.year;
      }

      outliers.set(month, { info, outlierYear });
    }

    return outliers;
  }, [data?.data]);

  // Track which cells are the outlier cells (for inline indicators)
  const outlierCells = useMemo(() => {
    const cells = new Set<string>();
    for (const [month, outlierData] of outliersByMonth) {
      if (outlierData.info.hasOutlier && outlierData.outlierYear) {
        cells.add(`${outlierData.outlierYear}-${month}`);
      }
    }
    return cells;
  }, [outliersByMonth]);

  const trimmedAvgByMonth = useMemo(() => {
    const trimmed = new Map<number, number>();
    if (!data?.data) return trimmed;

    const returnsByMonth = new Map<number, number[]>();
    for (const cell of data.data) {
      if (cell.return_pct !== null) {
        const existing = returnsByMonth.get(cell.month) || [];
        existing.push(cell.return_pct);
        returnsByMonth.set(cell.month, existing);
      }
    }

    for (const [month, returns] of returnsByMonth) {
      const trimmedMean = calculateTrimmedMean(returns);
      if (trimmedMean !== null) {
        trimmed.set(month, trimmedMean);
      }
    }

    return trimmed;
  }, [data?.data]);

  const meetsFilterCriteria = (agg: MonthAggregate | undefined, month: number): boolean => {
    if (!agg || !filters) return false;

    if (agg.win_rate < filters.minWinRate) return false;

    const trimmedReturn = trimmedAvgByMonth.get(month);
    if (trimmedReturn === undefined) return false;

    const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;
    const avgPerMonth = trimmedReturn / actualHoldingMonths;

    return avgPerMonth >= filters.minAvgGain;
  };

  const highlightedMonths = useMemo(() => {
    if (!data?.aggregates || !filters) return new Set<number>();
    return new Set(
      data.aggregates
        .filter(agg => meetsFilterCriteria(agg, agg.month))
        .map(agg => agg.month)
    );
  }, [data?.aggregates, filters, trimmedAvgByMonth, calcMethod, holdingPeriod]);

  const isReportHighlight = (month: number) => highlightMonth === month;

  const isFilterActive = !!filters;

  const shouldDimColumn = (month: number) => {
    if (!isFilterActive) return false;
    if (isReportHighlight(month)) return false;
    return !highlightedMonths.has(month);
  };

  const getAggregate = (month: number) => data?.aggregates.find((a) => a.month === month);

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

  // Indicator badge component - uses colored text in styled spans for cross-platform consistency
  const IndicatorBadge = ({
    type,
    onMouseEnter,
    onMouseLeave
  }: {
    type: 'blackswan' | 'unicorn' | 'outlier-severe' | 'outlier-high' | 'outlier-moderate';
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
  }) => {
    const config = {
      'blackswan': {
        bg: 'bg-gray-700',
        text: 'text-white',
        label: 'S',
        title: 'Market Drawdown',
      },
      'unicorn': {
        bg: 'bg-amber-400',
        text: 'text-amber-900',
        label: 'U',
        title: 'Market Boom/Recovery',
      },
      'outlier-severe': {
        bg: 'bg-orange-600',
        text: 'text-white',
        label: '!!',
        title: 'Severe Outlier',
      },
      'outlier-high': {
        bg: 'bg-orange-500',
        text: 'text-white',
        label: '!',
        title: 'High Outlier',
      },
      'outlier-moderate': {
        bg: 'bg-orange-400',
        text: 'text-orange-900',
        label: '*',
        title: 'Moderate Outlier',
      },
    };

    const c = config[type];

    return (
      <span
        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ${c.bg} ${c.text} text-[7px] font-bold cursor-help leading-none`}
        title={c.title}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {c.label}
      </span>
    );
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
            V2
          </span>
          {highlightedMonths.size > 0 && (
            <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium">
              {highlightedMonths.size} match{highlightedMonths.size > 1 ? 'es' : ''}
            </span>
          )}
          {highlightMonth && (
            <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded text-xs font-medium">
              {MONTHS[highlightMonth - 1]}
            </span>
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

      {/* Content area */}
      <div className="px-4 pb-4">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-600 text-sm">
            <p>Error: {error}</p>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-[52px]" />
                    {/* Wider columns for split cell */}
                    {MONTHS.map((_, idx) => (
                      <col key={idx} className="w-[72px]" />
                    ))}
                    <col className="w-[58px]" />
                    <col className="w-[52px]" />
                  </colgroup>
                  <thead>
                    {isFilterActive && (
                      <tr className="bg-gray-100/50">
                        <td></td>
                        {MONTHS.map((_, idx) => {
                          const monthNum = idx + 1;
                          const isDimmed = shouldDimColumn(monthNum);
                          return (
                            <td key={idx} className="px-0 py-0.5 text-center">
                              {isDimmed && (
                                <span className="text-[9px] text-gray-400 uppercase tracking-tight">
                                  filtered
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td></td>
                        <td></td>
                      </tr>
                    )}
                    {/* Month Headers */}
                    <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                      <th className="px-2 py-1.5 text-left">
                        <span className="text-blue-800 uppercase text-[10px] font-semibold tracking-wide">Metric</span>
                      </th>
                      {MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isFromReport = isReportHighlight(monthNum);
                        const isDimmed = shouldDimColumn(monthNum);
                        const favoriteKey = `${ticker}-${monthNum}-${holdingPeriod}`;
                        const isFavorite = favorites?.has(favoriteKey);
                        return (
                          <th
                            key={month}
                            className={`px-0.5 py-1.5 text-center text-xs font-semibold transition-all ${
                              isFromReport
                                ? 'bg-yellow-200 text-yellow-900 ring-2 ring-yellow-400'
                                : isDimmed
                                  ? 'bg-gray-500/30 text-gray-500'
                                  : 'text-gray-700'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{month}</span>
                              {onToggleFavorite && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(favoriteKey);
                                  }}
                                  className={`text-[10px] leading-none p-0.5 rounded transition-colors ${
                                    isFavorite
                                      ? 'text-pink-500 hover:text-pink-600'
                                      : 'text-gray-300 hover:text-pink-400'
                                  }`}
                                  title={isFavorite ? `Remove from favorites` : `Add to favorites`}
                                >
                                  {isFavorite ? '♥' : '♡'}
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      <th className="px-0.5 py-1.5 text-center text-xs font-semibold text-gray-700 bg-slate-100 border-l-2 border-slate-300">
                        Total
                      </th>
                      <th className="px-0.5 py-1.5 text-center text-xs font-semibold text-gray-700 bg-slate-100">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Win Rate Row */}
                    <tr className="bg-gradient-to-r from-blue-100/70 to-indigo-100/70">
                      <td className="px-2 py-1.5 text-[11px] font-bold text-gray-800 cursor-help whitespace-nowrap" title="Win Rate: Percentage of years with positive returns">
                        Win %
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        return (
                          <td key={month} className={`px-0.5 py-1 text-center transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                            {agg ? (
                              <div className={`text-xs font-bold py-0.5 rounded ${
                                isFromReport ? 'ring-1 ring-yellow-500' : ''
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
                              <span className="text-gray-400 text-[10px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      {(() => {
                        const totalMonths = data?.aggregates?.length || 0;
                        const avgWinRate = totalMonths > 0 ? Math.round(data!.aggregates.reduce((sum, a) => sum + a.win_rate, 0) / totalMonths) : 0;
                        return (
                          <>
                            <td className="px-0.5 py-1 text-center bg-slate-100 border-l-2 border-slate-300">
                              <span className="text-[10px] text-gray-400">-</span>
                            </td>
                            <td className="px-0.5 py-1 text-center bg-slate-100">
                              <span className={`text-xs font-bold ${avgWinRate >= 50 ? 'text-green-700' : 'text-gray-500'}`}>
                                {totalMonths > 0 ? `${avgWinRate}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Average Per Month Row */}
                    <tr className="bg-gradient-to-r from-blue-100/70 to-indigo-100/70">
                      <td className="px-2 py-1.5 text-[11px] font-bold text-gray-800 cursor-help whitespace-nowrap" title="Average Return Per Month (Trimmed)">
                        Avg/Mo
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        const outlierData = outliersByMonth.get(month);
                        const outlierInfo = outlierData?.info;
                        const outlierYear = outlierData?.outlierYear || 0;
                        const trimmedReturn = trimmedAvgByMonth.get(month);
                        const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;
                        const avgPerMonth = trimmedReturn !== undefined ? trimmedReturn / actualHoldingMonths : null;
                        return (
                          <td key={month} className={`px-0.5 py-1 text-center transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                            {avgPerMonth !== null ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <span className={`text-xs font-bold ${
                                  avgPerMonth >= 0 ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {avgPerMonth.toFixed(1)}%
                                </span>
                                {outlierInfo?.hasOutlier && (
                                  <IndicatorBadge
                                    type={outlierInfo.severity === 'severe' ? 'outlier-severe' : outlierInfo.severity === 'high' ? 'outlier-high' : 'outlier-moderate'}
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
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      {(() => {
                        const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;
                        const trimmedValues = Array.from(trimmedAvgByMonth.values());
                        const overallTrimmedAvg = trimmedValues.length > 0
                          ? trimmedValues.reduce((sum, v) => sum + v, 0) / trimmedValues.length / actualHoldingMonths
                          : 0;
                        return (
                          <>
                            <td className="px-0.5 py-1 text-center bg-slate-100 border-l-2 border-slate-300">
                              <span className="text-[10px] text-gray-400">-</span>
                            </td>
                            <td className="px-0.5 py-1 text-center bg-slate-100">
                              <span className={`text-xs font-bold ${overallTrimmedAvg >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {trimmedValues.length > 0 ? `${overallTrimmedAvg.toFixed(1)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Alpha Row */}
                    <tr className="bg-gradient-to-r from-blue-100/70 to-indigo-100/70 border-b border-blue-200">
                      <td className="px-2 py-1 text-[11px] font-bold text-gray-700 cursor-help whitespace-nowrap" title="Alpha: Per-month return vs market benchmark">
                        Alpha
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        const alpha = agg?.alpha ?? null;
                        return (
                          <td key={month} className={`px-0.5 py-1 text-center transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                            {alpha !== null ? (
                              <span className={`text-[10px] font-semibold ${
                                alpha >= 0.5 ? 'text-green-700' : alpha <= -0.5 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      {(() => {
                        const alphaValues = data?.aggregates?.map(a => a.alpha).filter((a): a is number => a !== undefined && a !== null) || [];
                        const overallAlpha = alphaValues.length > 0
                          ? alphaValues.reduce((sum, a) => sum + a, 0) / alphaValues.length
                          : 0;
                        return (
                          <>
                            <td className="px-0.5 py-1 text-center bg-slate-100 border-l-2 border-slate-300">
                              <span className="text-[10px] text-gray-400">-</span>
                            </td>
                            <td className="px-0.5 py-1 text-center bg-slate-100">
                              <span className={`text-[10px] font-semibold ${
                                overallAlpha >= 0.5 ? 'text-green-700' : overallAlpha <= -0.5 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {alphaValues.length > 0 ? `${overallAlpha >= 0 ? '+' : ''}${overallAlpha.toFixed(2)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Detail Rows - only when expanded */}
                    {isExpanded && (
                    <>
                    {/* Average Return Row */}
                    <tr className="bg-blue-50/30">
                      <td className="px-2 py-0.5 text-[10px] font-medium text-gray-600 cursor-help whitespace-nowrap" title="Average Total Return">Avg</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        const avgReturn = agg?.avg_return ?? null;
                        return (
                          <td key={month} className={`px-0.5 py-0.5 text-center transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                            {avgReturn !== null ? (
                              <span className={`text-[10px] ${
                                avgReturn >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {avgReturn.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      {(() => {
                        const avgValues = data?.aggregates?.map(a => a.avg_return).filter((v): v is number => v !== undefined && v !== null) || [];
                        const totalAvgReturn = avgValues.reduce((sum, v) => sum + v, 0);
                        const overallAvg = avgValues.length > 0 ? totalAvgReturn / avgValues.length : 0;
                        return (
                          <>
                            <td className="px-0.5 py-0.5 text-center bg-slate-50 border-l-2 border-slate-300">
                              <span className={`text-[10px] ${totalAvgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {avgValues.length > 0 ? `${totalAvgReturn.toFixed(1)}%` : '-'}
                              </span>
                            </td>
                            <td className="px-0.5 py-0.5 text-center bg-slate-50">
                              <span className={`text-[10px] ${overallAvg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {avgValues.length > 0 ? `${overallAvg.toFixed(1)}%` : '-'}
                              </span>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                    {/* Min Return Row */}
                    <tr className="bg-blue-50/30">
                      <td className="px-2 py-0.5 text-[10px] font-medium text-gray-600 cursor-help whitespace-nowrap" title="Minimum Return">Min</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        const minReturn = agg?.min_return ?? null;
                        return (
                          <td key={month} className={`px-0.5 py-0.5 text-center transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                            {minReturn !== null ? (
                              <span className="text-[10px] text-red-600">{minReturn.toFixed(1)}%</span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-0.5 py-0.5 text-center bg-slate-50 border-l-2 border-slate-300">
                        <span className="text-[10px] text-gray-400">-</span>
                      </td>
                      <td className="px-0.5 py-0.5 text-center bg-slate-50">
                        <span className="text-[10px] text-red-600">
                          {(() => {
                            const minValues = data?.aggregates?.map(a => a.min_return).filter((v): v is number => v !== undefined && v !== null) || [];
                            return minValues.length > 0 ? `${Math.min(...minValues).toFixed(1)}%` : '-';
                          })()}
                        </span>
                      </td>
                    </tr>
                    {/* Max Return Row */}
                    <tr className="bg-blue-50/30 border-b border-blue-200">
                      <td className="px-2 py-0.5 text-[10px] font-medium text-gray-600 cursor-help whitespace-nowrap" title="Maximum Return">Max</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const agg = getAggregate(month);
                        const isFromReport = isReportHighlight(month);
                        const isDimmed = shouldDimColumn(month);
                        const maxReturn = agg?.max_return ?? null;
                        return (
                          <td key={month} className={`px-0.5 py-0.5 text-center transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                            {maxReturn !== null ? (
                              <span className="text-[10px] text-green-600">{maxReturn.toFixed(1)}%</span>
                            ) : (
                              <span className="text-gray-400 text-[9px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-0.5 py-0.5 text-center bg-slate-50 border-l-2 border-slate-300">
                        <span className="text-[10px] text-gray-400">-</span>
                      </td>
                      <td className="px-0.5 py-0.5 text-center bg-slate-50">
                        <span className="text-[10px] text-green-600">
                          {(() => {
                            const maxValues = data?.aggregates?.map(a => a.max_return).filter((v): v is number => v !== undefined && v !== null) || [];
                            return maxValues.length > 0 ? `${Math.max(...maxValues).toFixed(1)}%` : '-';
                          })()}
                        </span>
                      </td>
                    </tr>
                    {/* Year Header Row */}
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td className="px-2 py-1 text-[10px] font-medium text-gray-600">Year</td>
                      {MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isFromReport = isReportHighlight(monthNum);
                        const isDimmed = shouldDimColumn(monthNum);
                        return (
                          <td
                            key={month}
                            className={`px-0.5 py-1 text-center text-[10px] font-medium transition-all ${
                              isFromReport
                                ? 'bg-yellow-200 text-yellow-900'
                                : isDimmed
                                  ? 'bg-gray-500/30 text-gray-500'
                                  : 'text-gray-600'
                            }`}
                          >
                            {month}
                          </td>
                        );
                      })}
                      <td className="px-0.5 py-1 text-center text-[10px] font-medium text-gray-600 bg-slate-100 border-l-2 border-slate-300">
                        Total
                      </td>
                      <td className="px-0.5 py-1 text-center text-[10px] font-medium text-gray-600 bg-slate-100">
                        Avg
                      </td>
                    </tr>
                    {/* Yearly Data Rows - SPLIT CELL DESIGN */}
                    {years.map((year) => {
                      const yearCells = Array.from({ length: 12 }, (_, i) => cellMap.get(`${year}-${i + 1}`))
                        .filter(c => c && c.return_pct !== null);
                      const yearTotal = yearCells.reduce((sum, c) => sum + (c?.return_pct || 0), 0);
                      const yearAvg = yearCells.length > 0 ? yearTotal / yearCells.length : null;

                      return (
                        <tr key={year} className="border-b border-gray-100">
                          <td className="px-2 py-0.5 text-[10px] font-medium text-gray-700">{year}</td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                            const cell = cellMap.get(`${year}-${month}`);
                            const isFromReport = isReportHighlight(month);
                            const isDimmed = shouldDimColumn(month);
                            const blackSwanEvent = getBlackSwanEvent(year, month);
                            const isOutlierCell = outlierCells.has(`${year}-${month}`);
                            const outlierData = isOutlierCell ? outliersByMonth.get(month) : null;

                            return (
                              <td key={month} className={`px-0.5 py-0.5 transition-all ${isFromReport ? 'bg-yellow-100' : ''} ${isDimmed ? 'bg-gray-500/30' : ''}`}>
                                {cell ? (
                                  <div
                                    onMouseMove={(e) => handleMouseMove(e, cell)}
                                    onMouseLeave={() => {
                                      handleMouseLeave();
                                      setBlackSwanTooltip(null);
                                    }}
                                    className={`h-6 flex items-center rounded-sm ${
                                      isFromReport ? 'ring-1 ring-yellow-500' : ''
                                    } ${getCellColor(cell.return_pct, holdingPeriod, calcMethod)}`}
                                  >
                                    {/* Split cell: value on left, indicators on right */}
                                    <span className="flex-1 text-right pr-0.5 text-[10px] font-medium cursor-pointer">
                                      {cell.return_pct !== null ? `${cell.return_pct.toFixed(1)}%` : '-'}
                                    </span>
                                    {/* Indicator section - fixed width */}
                                    <span className="w-5 flex items-center justify-start gap-px pl-0.5">
                                      {blackSwanEvent && (
                                        <IndicatorBadge
                                          type="blackswan"
                                          onMouseEnter={(e) => {
                                            e.stopPropagation();
                                            setTooltip(null);
                                            const rect = containerRef.current?.getBoundingClientRect();
                                            if (rect) {
                                              setBlackSwanTooltip({
                                                event: blackSwanEvent,
                                                x: e.clientX - rect.left,
                                                y: e.clientY - rect.top - 10,
                                              });
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            e.stopPropagation();
                                            setBlackSwanTooltip(null);
                                          }}
                                        />
                                      )}
                                      {isOutlierCell && outlierData?.info && (
                                        <IndicatorBadge
                                          type={outlierData.info.severity === 'severe' ? 'outlier-severe' : outlierData.info.severity === 'high' ? 'outlier-high' : 'outlier-moderate'}
                                          onMouseEnter={(e) => {
                                            const rect = containerRef.current?.getBoundingClientRect();
                                            if (rect && outlierData.info) {
                                              setOutlierTooltip({
                                                outlier: outlierData.info,
                                                month,
                                                outlierYear: year,
                                                x: e.clientX - rect.left,
                                                y: e.clientY - rect.top - 10,
                                              });
                                            }
                                          }}
                                          onMouseLeave={() => setOutlierTooltip(null)}
                                        />
                                      )}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="h-6 bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 rounded-sm">-</div>
                                )}
                              </td>
                            );
                          })}
                          {/* Year Total */}
                          <td className="px-0.5 py-0.5 bg-slate-50 border-l-2 border-slate-300">
                            <div className={`h-6 flex items-center justify-center text-[10px] font-bold ${
                              yearTotal >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {yearCells.length > 0 ? `${yearTotal.toFixed(1)}%` : '-'}
                            </div>
                          </td>
                          {/* Year Avg */}
                          <td className="px-0.5 py-0.5 bg-slate-50">
                            <div className={`h-6 flex items-center justify-center text-[10px] font-bold ${
                              (yearAvg || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {yearAvg !== null ? `${yearAvg.toFixed(1)}%` : '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Legend - updated for new indicators */}
              {isExpanded && (
                <div className="flex items-center justify-end gap-4 px-4 py-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-700 text-white text-[7px] font-bold">S</span>
                    <span>Market Drawdown</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-amber-900 text-[7px] font-bold">U</span>
                    <span>Market Boom (Future)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[7px] font-bold">!</span>
                    <span>Outlier</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
              ? 'Severe Outlier Warning'
              : outlierTooltip.outlier.severity === 'high'
                ? 'High Outlier Warning'
                : 'Moderate Outlier Warning'}
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

      {/* Market Drawdown Tooltip */}
      {blackSwanTooltip && (
        <div
          className="absolute z-50 bg-gray-800 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none border border-gray-600"
          style={{
            left: Math.min(blackSwanTooltip.x, (containerRef.current?.clientWidth || 500) - 280),
            top: blackSwanTooltip.y,
            maxWidth: '280px',
          }}
        >
          <div className="font-bold mb-1 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-700 text-white text-[7px] font-bold">S</span>
            Market Drawdown
          </div>
          <div className="text-gray-200">
            {blackSwanTooltip.event.events.map((evt, idx) => (
              <div key={idx} className="mb-1">
                <p className="font-medium text-white">{evt.title}</p>
                {evt.impact && (
                  <p className="text-gray-300 text-[11px]">
                    SPY Impact: {evt.impact.toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
            <p className="text-gray-400 text-[10px] mt-1 border-t border-gray-600 pt-1">
              Returns during market-wide declines may not reflect normal seasonality patterns
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic color scale based on per-month returns
 */
function getCellColor(returnPct: number | null, holdingPeriod: number, calcMethod: CalculationMethod): string {
  if (returnPct === null) return 'bg-gray-100 text-gray-400';

  const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;
  const monthlyRate = returnPct / actualHoldingMonths;

  const stepSize = 1.25;
  let steps: number;

  if (monthlyRate < 0) {
    steps = Math.floor(monthlyRate / stepSize);
  } else if (monthlyRate <= stepSize / 2) {
    steps = 0;
  } else {
    steps = Math.floor((monthlyRate - stepSize / 2) / stepSize) + 1;
  }

  steps = Math.max(-5, Math.min(5, steps));

  const colorMap: Record<number, string> = {
    [-5]: 'bg-red-300/80 text-red-900',
    [-4]: 'bg-red-200/80 text-red-800',
    [-3]: 'bg-red-200/60 text-red-700',
    [-2]: 'bg-red-100/80 text-red-700',
    [-1]: 'bg-red-100/50 text-red-600',
    [0]: 'bg-gray-100 text-gray-600',
    [1]: 'bg-green-100/50 text-green-700',
    [2]: 'bg-green-100/80 text-green-700',
    [3]: 'bg-green-200/60 text-green-800',
    [4]: 'bg-green-200/80 text-green-800',
    [5]: 'bg-green-300/80 text-green-900',
  };

  return colorMap[steps] || 'bg-gray-100 text-gray-400';
}
