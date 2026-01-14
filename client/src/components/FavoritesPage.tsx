import { useState, useEffect, useMemo } from 'react';
import type { CalculationMethod } from '../App';

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

interface FavoritePattern {
  key: string;
  ticker: string;
  month: number;
  monthName: string;
  holdingPeriod: number;
  winRate: number | null;
  avgReturn: number | null;
  avgPerMonth: number | null;
  isLoading: boolean;
}

interface FavoritesPageProps {
  favorites: Set<string>;
  onToggleFavorite: (key: string) => void;
  calcMethod: CalculationMethod;
  onSelectPattern: (ticker: string, month: number, holdingPeriod: number) => void;
  ratings?: Record<string, number>;
  onRatingChange?: (key: string, rating: number | null) => void;
  notes?: Record<string, string>;
  onNoteChange?: (key: string, note: string | null) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse favorite key into components
function parseFavoriteKey(key: string): { ticker: string; month: number; holdingPeriod: number } | null {
  const parts = key.split('-');
  if (parts.length < 3) return null;

  // Format: TICKER-MONTH-PERIOD (e.g., "AAPL-5-3" = AAPL, May, 3-month hold)
  const holdingPeriod = parseInt(parts[parts.length - 1], 10);
  const month = parseInt(parts[parts.length - 2], 10);
  const ticker = parts.slice(0, -2).join('-'); // Handle tickers with dashes

  if (isNaN(month) || isNaN(holdingPeriod) || month < 1 || month > 12) return null;

  return { ticker, month, holdingPeriod };
}

// Star Rating Component
function StarRating({
  rating,
  onRate,
  size = 'md'
}: {
  rating: number | null;
  onRate?: (rating: number | null) => void;
  size?: 'sm' | 'md';
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (hoverRating ?? rating ?? 0) >= star;
        return (
          <button
            key={star}
            onClick={(e) => {
              e.stopPropagation();
              if (onRate) {
                // If clicking the same star that's already selected, clear the rating
                onRate(rating === star ? null : star);
              }
            }}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            className={`${sizeClasses} transition-colors ${
              isFilled ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'
            }`}
            title={rating === star ? 'Clear rating' : `Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// Note Editor Component
function NoteEditor({
  note,
  onSave,
  onCancel,
}: {
  note: string;
  onSave: (note: string | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(note);
  const maxLength = 1000;

  return (
    <div className="mt-2 bg-yellow-50 rounded-lg p-3 border border-yellow-200" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, maxLength))}
        placeholder="Add your notes about this pattern..."
        className="w-full h-24 p-2 text-sm border border-yellow-300 rounded resize-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
        autoFocus
        data-testid="notes-input"
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${text.length >= maxLength ? 'text-red-500' : 'text-gray-500'}`} data-testid="char-counter">
          {text.length}/{maxLength}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(text.trim() || null)}
            className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function FavoritesPage({ favorites, onToggleFavorite, calcMethod, onSelectPattern, ratings = {}, onRatingChange, notes = {}, onNoteChange }: FavoritesPageProps) {
  const [patterns, setPatterns] = useState<FavoritePattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [sortBy, setSortBy] = useState<'month' | 'winRate' | 'avgReturn'>('month');
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);

  // Parse favorites and fetch data
  useEffect(() => {
    const fetchPatternData = async () => {
      setIsLoading(true);

      // Parse all favorites
      const parsedFavorites = Array.from(favorites)
        .map(key => {
          const parsed = parseFavoriteKey(key);
          if (!parsed) return null;
          return {
            key,
            ticker: parsed.ticker,
            month: parsed.month,
            monthName: MONTHS[parsed.month - 1],
            holdingPeriod: parsed.holdingPeriod,
            winRate: null as number | null,
            avgReturn: null as number | null,
            avgPerMonth: null as number | null,
            isLoading: true,
          };
        })
        .filter((p): p is FavoritePattern => p !== null);

      setPatterns(parsedFavorites);

      // Fetch data for each unique ticker-period combination
      const tickerPeriodMap = new Map<string, { ticker: string; period: number }>();
      for (const p of parsedFavorites) {
        const key = `${p.ticker}-${p.holdingPeriod}`;
        if (!tickerPeriodMap.has(key)) {
          tickerPeriodMap.set(key, { ticker: p.ticker, period: p.holdingPeriod });
        }
      }

      // Fetch in parallel
      const results = new Map<string, MonthAggregate[]>();
      await Promise.all(
        Array.from(tickerPeriodMap.values()).map(async ({ ticker, period }) => {
          try {
            const res = await fetch(
              `/api/prices/${ticker}/heatmap?period=${period}&view=entry&calcMethod=${calcMethod}&years=10`
            );
            if (res.ok) {
              const json: HeatmapResponse = await res.json();
              results.set(`${ticker}-${period}`, json.aggregates);
            }
          } catch {
            // Ignore fetch errors
          }
        })
      );

      // Update patterns with fetched data
      setPatterns(prev =>
        prev.map(p => {
          const aggregates = results.get(`${p.ticker}-${p.holdingPeriod}`);
          const monthData = aggregates?.find(a => a.month === p.month);
          const actualHoldingMonths = calcMethod === 'openClose' ? p.holdingPeriod + 1 : p.holdingPeriod;

          return {
            ...p,
            winRate: monthData?.win_rate ?? null,
            avgReturn: monthData?.avg_return ?? null,
            avgPerMonth: monthData ? monthData.avg_return / actualHoldingMonths : null,
            isLoading: false,
          };
        })
      );

      setIsLoading(false);
    };

    fetchPatternData();
  }, [favorites, calcMethod]);

  // Sort patterns
  const sortedPatterns = useMemo(() => {
    const sorted = [...patterns];
    switch (sortBy) {
      case 'month':
        return sorted.sort((a, b) => a.month - b.month);
      case 'winRate':
        return sorted.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
      case 'avgReturn':
        return sorted.sort((a, b) => (b.avgPerMonth ?? 0) - (a.avgPerMonth ?? 0));
      default:
        return sorted;
    }
  }, [patterns, sortBy]);

  // Group by month for calendar view
  const patternsByMonth = useMemo(() => {
    const grouped = new Map<number, FavoritePattern[]>();
    for (let i = 1; i <= 12; i++) {
      grouped.set(i, []);
    }
    for (const p of patterns) {
      grouped.get(p.month)?.push(p);
    }
    return grouped;
  }, [patterns]);

  if (favorites.size === 0) {
    return (
      <div className="flex-1 bg-pink-50">
        <header className="border-b sticky top-0 z-20 bg-pink-100/90 border-pink-200 backdrop-blur-sm">
          <div className="px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">Favorite Patterns</h2>
            <p className="text-sm text-pink-700">0 saved patterns</p>
          </div>
        </header>
        <div className="p-6">
          <div className="text-center py-20 text-gray-500">
            <div className="text-6xl mb-4">❤️</div>
            <p className="text-xl mb-2">No favorites yet</p>
            <p className="text-sm">Heart patterns from the Best Entry Months panel to save them here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-pink-50 flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 z-20 bg-pink-100/90 border-pink-200 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Favorite Patterns</h2>
              <p className="text-sm text-pink-700">{favorites.size} saved pattern{favorites.size !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-pink-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-pink-800 hover:bg-pink-100'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-pink-800 hover:bg-pink-100'
                  }`}
                >
                  Calendar
                </button>
              </div>
              {viewMode === 'list' && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-1.5 text-sm border border-pink-300 rounded-lg bg-white focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="month">Sort by Month</option>
                  <option value="winRate">Sort by Win %</option>
                  <option value="avgReturn">Sort by Avg/Mo</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600"></div>
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="bg-white rounded-lg border border-pink-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-pink-100 text-left text-sm text-gray-600">
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Entry Month</th>
                  <th className="px-4 py-3 font-semibold text-center">Hold Period</th>
                  <th className="px-4 py-3 font-semibold text-right">Win %</th>
                  <th className="px-4 py-3 font-semibold text-right">Avg/Mo</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Avg</th>
                  <th className="px-4 py-3 font-semibold text-center">Rating</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPatterns.map((p) => (
                  <tr
                    key={p.key}
                    className="border-t border-gray-100 hover:bg-pink-50 cursor-pointer"
                    onClick={() => onSelectPattern(p.ticker, p.month, p.holdingPeriod)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-blue-600">{p.ticker}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{p.monthName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.holdingPeriod}mo</td>
                    <td className="px-4 py-3 text-right">
                      {p.isLoading ? (
                        <span className="text-gray-400">...</span>
                      ) : p.winRate !== null ? (
                        <span className={`font-medium ${
                          p.winRate >= 70 ? 'text-green-600' :
                          p.winRate >= 60 ? 'text-green-500' : 'text-gray-600'
                        }`}>
                          {p.winRate}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.isLoading ? (
                        <span className="text-gray-400">...</span>
                      ) : p.avgPerMonth !== null ? (
                        <span className={`font-medium ${
                          p.avgPerMonth >= 2 ? 'text-green-600' :
                          p.avgPerMonth >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {p.avgPerMonth >= 0 ? '+' : ''}{p.avgPerMonth.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.isLoading ? (
                        <span className="text-gray-400">...</span>
                      ) : p.avgReturn !== null ? (
                        <span className={`font-medium ${
                          p.avgReturn >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {p.avgReturn >= 0 ? '+' : ''}{p.avgReturn.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <StarRating
                          rating={ratings[p.key] ?? null}
                          onRate={onRatingChange ? (rating) => onRatingChange(p.key, rating) : undefined}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingNoteKey === p.key ? (
                        <NoteEditor
                          note={notes[p.key] || ''}
                          onSave={(note) => {
                            if (onNoteChange) onNoteChange(p.key, note);
                            setEditingNoteKey(null);
                          }}
                          onCancel={() => setEditingNoteKey(null)}
                        />
                      ) : notes[p.key] ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteKey(p.key);
                          }}
                          className="text-sm text-gray-600 max-w-xs truncate cursor-pointer hover:text-gray-900"
                          title={notes[p.key]}
                          data-testid="notes-field"
                        >
                          📝 {notes[p.key]}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteKey(p.key);
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                          data-testid="edit-note-button"
                        >
                          Add note
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(p.key);
                        }}
                        className="text-pink-500 hover:text-pink-600 text-lg"
                        title="Remove from favorites"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Calendar View */
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const monthPatterns = patternsByMonth.get(month) || [];
              return (
                <div
                  key={month}
                  className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
                    monthPatterns.length > 0 ? 'border-pink-300' : 'border-gray-200'
                  }`}
                >
                  <div className={`px-4 py-2 font-bold text-sm ${
                    monthPatterns.length > 0 ? 'bg-pink-100 text-pink-900' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {MONTHS[month - 1]}
                    {monthPatterns.length > 0 && (
                      <span className="ml-2 text-xs font-normal">
                        ({monthPatterns.length} pattern{monthPatterns.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <div className="p-3 min-h-[80px]">
                    {monthPatterns.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No favorites</p>
                    ) : (
                      <div className="space-y-2">
                        {monthPatterns.map((p) => (
                          <div
                            key={p.key}
                            className="text-sm cursor-pointer hover:bg-pink-50 rounded px-2 py-1 -mx-2"
                            onClick={() => onSelectPattern(p.ticker, p.month, p.holdingPeriod)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-600">{p.ticker}</span>
                                <span className="text-gray-500 text-xs">{p.holdingPeriod}mo</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {p.winRate !== null && (
                                  <span className={`text-xs font-medium ${
                                    p.winRate >= 70 ? 'text-green-600' : 'text-gray-500'
                                  }`}>
                                    {p.winRate}%
                                  </span>
                                )}
                                <StarRating
                                  rating={ratings[p.key] ?? null}
                                  onRate={onRatingChange ? (rating) => onRatingChange(p.key, rating) : undefined}
                                  size="sm"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(p.key);
                                  }}
                                  className="text-pink-500 hover:text-pink-600"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {notes[p.key] && (
                              <div className="mt-1 text-xs text-gray-500 truncate" title={notes[p.key]}>
                                📝 {notes[p.key]}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
