import { useState, useEffect } from 'react';
import { StockPicker } from './components/StockPicker';
import { Heatmap } from './components/Heatmap';
import { HeatmapV2 } from './components/HeatmapV2';
import { MaxCloseGrid } from './components/MaxCloseGrid';
import { BestMonthsDrawer } from './components/BestMonthsDrawer';
import { ScreenerPage } from './components/ScreenerPage';
import { FavoritesPage } from './components/FavoritesPage';
import { StockSummary, TickerSentiment } from './components/StockSummary';
import { SentimentPage } from './components/SentimentPage';

export type ViewMode = 'entry' | 'exit';
export type Timeframe = 1 | 3 | 6 | 12;
export type CalculationMethod = 'openClose' | 'maxMax';
export type Page = 'search' | 'favorites' | 'top-periods' | 'upcoming' | 'my-tickers';

export interface FilterCriteria {
  minWinRate: number;
  minAvgGain: number;
}

const TIMEFRAMES: Timeframe[] = [1, 3, 6, 12];
const RECENT_SEARCHES_KEY = 'stock-researcher-recent-searches';
const MAX_RECENT_SEARCHES = 10;

// Helper to parse favorite key into components for API calls
function parseFavoriteKey(key: string): { ticker: string; month: number; holdingPeriod: number } | null {
  const parts = key.split('-');
  if (parts.length < 3) return null;
  const holdingPeriod = parseInt(parts[parts.length - 1], 10);
  const month = parseInt(parts[parts.length - 2], 10);
  const ticker = parts.slice(0, -2).join('-');
  if (isNaN(month) || isNaN(holdingPeriod) || month < 1 || month > 12) return null;
  return { ticker, month, holdingPeriod };
}

function App() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('entry');
  const [calcMethod, setCalcMethod] = useState<CalculationMethod>('maxMax');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterCriteria>({
    minWinRate: 60,
    minAvgGain: 2,
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(true); // Open by default
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<Page>('search');
  const [isReportsExpanded, setIsReportsExpanded] = useState(true);
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [lastDataSync, setLastDataSync] = useState<string | null>(null);
  const [highlightCell, setHighlightCell] = useState<{ entryMonth: number; holdingPeriod: number } | null>(null);
  const [yearsToShow, setYearsToShow] = useState(12);
  const [tickerSentiments, setTickerSentiments] = useState<Record<string, 'up' | 'down' | 'investigate'>>({});
  const [tickerNotes, setTickerNotes] = useState<Record<string, string>>({});
  const [patternRatings, setPatternRatings] = useState<Record<string, number>>({});
  const [patternNotes, setPatternNotes] = useState<Record<string, string>>({});
  const [useHeatmapV2, setUseHeatmapV2] = useState(false); // Toggle between V1 and V2 heatmap

  // Navigate to a page and push to browser history
  const navigateTo = (page: Page, ticker?: string | null, highlight?: { entryMonth: number; holdingPeriod: number } | null) => {
    const state = { page, ticker: ticker ?? selectedTicker };
    window.history.pushState(state, '', `#${page}${ticker ? `/${ticker}` : ''}`);
    setCurrentPage(page);
    // Set or clear highlight based on whether it's provided
    setHighlightCell(highlight ?? null);
    if (ticker !== undefined) {
      setSelectedTicker(ticker);
    }
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.page) {
        setCurrentPage(event.state.page);
        if (event.state.ticker !== undefined) {
          setSelectedTicker(event.state.ticker);
        }
      } else {
        // Default to search if no state
        setCurrentPage('search');
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Initialize history state on mount
    const hash = window.location.hash.slice(1); // Remove #
    if (hash) {
      const [page, ticker] = hash.split('/');
      if (['search', 'favorites', 'top-periods', 'upcoming', 'my-tickers'].includes(page)) {
        setCurrentPage(page as Page);
        if (ticker) {
          setSelectedTicker(ticker);
        }
        window.history.replaceState({ page, ticker }, '', `#${hash}`);
      }
    } else {
      window.history.replaceState({ page: 'search', ticker: null }, '', '#search');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch last data sync time on mount
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.data?.lastUpdate) {
          setLastDataSync(data.data.lastUpdate);
        }
      })
      .catch(() => {});
  }, []);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Load favorites from API on mount
  useEffect(() => {
    fetch('/api/pattern-favorites/keys')
      .then(res => res.json())
      .then((keys: string[]) => setFavorites(new Set(keys)))
      .catch(() => {});
  }, []);

  // Load pattern ratings from API on mount
  useEffect(() => {
    fetch('/api/pattern-favorites/ratings')
      .then(res => res.json())
      .then((ratings: Record<string, number>) => setPatternRatings(ratings))
      .catch(() => {});
  }, []);

  // Load pattern notes from API on mount
  useEffect(() => {
    fetch('/api/pattern-favorites/notes')
      .then(res => res.json())
      .then((notes: Record<string, string>) => setPatternNotes(notes))
      .catch(() => {});
  }, []);

  // Fetch ticker sentiments and notes from API on mount
  useEffect(() => {
    fetch('/api/ticker-sentiment/detailed')
      .then(res => res.json())
      .then((data: Array<{ ticker: string; sentiment: 'up' | 'down' | 'investigate'; note: string | null }>) => {
        const sentiments: Record<string, 'up' | 'down' | 'investigate'> = {};
        const notes: Record<string, string> = {};
        data.forEach(item => {
          sentiments[item.ticker] = item.sentiment;
          if (item.note) {
            notes[item.ticker] = item.note;
          }
        });
        setTickerSentiments(sentiments);
        setTickerNotes(notes);
      })
      .catch(() => {});
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearches = (searches: string[]) => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    setRecentSearches(searches);
  };

  // Handle ticker selection
  const handleSelectTicker = (ticker: string) => {
    setSelectedTicker(ticker);

    // Add to recent searches (move to front if exists, limit to max)
    const filtered = recentSearches.filter(t => t !== ticker);
    const updated = [ticker, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    saveRecentSearches(updated);
  };

  // Clear recent searches
  const handleClearRecent = () => {
    saveRecentSearches([]);
  };

  // Toggle favorite - persists to database via API
  const handleToggleFavorite = async (key: string) => {
    const parsed = parseFavoriteKey(key);
    if (!parsed) return;

    const isCurrentlyFavorite = favorites.has(key);

    // Optimistically update UI
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFavorite) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // Persist to API
    try {
      if (isCurrentlyFavorite) {
        // Remove favorite
        await fetch('/api/pattern-favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: parsed.ticker,
            entryMonth: parsed.month,
            holdingPeriod: parsed.holdingPeriod,
          }),
        });
      } else {
        // Add favorite
        await fetch('/api/pattern-favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: parsed.ticker,
            entryMonth: parsed.month,
            holdingPeriod: parsed.holdingPeriod,
          }),
        });
      }
    } catch {
      // Revert on error by re-fetching
      fetch('/api/pattern-favorites/keys')
        .then(res => res.json())
        .then((keys: string[]) => setFavorites(new Set(keys)))
        .catch(() => {});
    }
  };

  // Handle pattern rating change - persists to database via API
  const handleRatingChange = async (key: string, rating: number | null) => {
    // Optimistically update UI
    setPatternRatings((prev) => {
      const next = { ...prev };
      if (rating === null) {
        delete next[key];
      } else {
        next[key] = rating;
      }
      return next;
    });

    // Persist to API
    try {
      await fetch(`/api/pattern-favorites/key/${encodeURIComponent(key)}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // Revert on error by re-fetching
      fetch('/api/pattern-favorites/ratings')
        .then(res => res.json())
        .then((ratings: Record<string, number>) => setPatternRatings(ratings))
        .catch(() => {});
    }
  };

  // Handle pattern note change - persists to database via API
  const handleNoteChange = async (key: string, note: string | null) => {
    // Optimistically update UI
    setPatternNotes((prev) => {
      const next = { ...prev };
      if (note === null || note === '') {
        delete next[key];
      } else {
        next[key] = note;
      }
      return next;
    });

    // Persist to API
    try {
      await fetch(`/api/pattern-favorites/key/${encodeURIComponent(key)}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
    } catch {
      // Revert on error by re-fetching
      fetch('/api/pattern-favorites/notes')
        .then(res => res.json())
        .then((notes: Record<string, string>) => setPatternNotes(notes))
        .catch(() => {});
    }
  };

  // Handle ticker sentiment change
  const handleSentimentChange = async (ticker: string, sentiment: TickerSentiment) => {
    // Optimistically update UI
    setTickerSentiments((prev) => {
      if (sentiment === null) {
        const { [ticker]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [ticker]: sentiment };
    });

    // Persist to API
    try {
      if (sentiment === null) {
        await fetch(`/api/ticker-sentiment/${ticker}`, { method: 'DELETE' });
        // Also remove the note from local state
        setTickerNotes((prev) => {
          const { [ticker]: _, ...rest } = prev;
          return rest;
        });
      } else {
        await fetch(`/api/ticker-sentiment/${ticker}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sentiment }),
        });
      }
    } catch {
      // Revert on error by re-fetching
      fetch('/api/ticker-sentiment/detailed')
        .then(res => res.json())
        .then((data: Array<{ ticker: string; sentiment: 'up' | 'down' | 'investigate'; note: string | null }>) => {
          const sentiments: Record<string, 'up' | 'down' | 'investigate'> = {};
          const notes: Record<string, string> = {};
          data.forEach(item => {
            sentiments[item.ticker] = item.sentiment;
            if (item.note) {
              notes[item.ticker] = item.note;
            }
          });
          setTickerSentiments(sentiments);
          setTickerNotes(notes);
        })
        .catch(() => {});
    }
  };

  // Handle ticker note change
  const handleTickerNoteChange = async (ticker: string, note: string | null) => {
    // Optimistically update UI
    setTickerNotes((prev) => {
      if (note === null || note === '') {
        const { [ticker]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [ticker]: note };
    });

    // Persist to API
    try {
      await fetch(`/api/ticker-sentiment/${ticker}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
    } catch {
      // Revert on error by re-fetching
      fetch('/api/ticker-sentiment/detailed')
        .then(res => res.json())
        .then((data: Array<{ ticker: string; sentiment: 'up' | 'down'; note: string | null }>) => {
          const notes: Record<string, string> = {};
          data.forEach(item => {
            if (item.note) {
              notes[item.ticker] = item.note;
            }
          });
          setTickerNotes(notes);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Sidebar - Fixed, Far Left */}
      <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-900 text-white min-h-screen fixed left-0 top-0 bottom-0 overflow-y-auto shadow-xl">
        {/* App Logo/Title */}
        <div className="p-4 border-b border-blue-600/50">
          <h1 className="text-xl font-bold">Stock Researcher</h1>
          <p className="text-xs text-blue-200 mt-1">Seasonality Analysis</p>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {/* Favorite Patterns - Top Level */}
          <a
            href="#favorites"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('favorites');
            }}
            className={`w-full text-left px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              currentPage === 'favorites'
                ? 'bg-pink-600 text-white'
                : 'hover:bg-blue-600/50 text-blue-100'
            }`}
          >
            <span className="text-lg">❤️</span>
            <span>Favorite Patterns</span>
            {favorites.size > 0 && (
              <span className="ml-auto bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                {favorites.size}
              </span>
            )}
          </a>

          {/* My Tickers (Sentiment) */}
          <a
            href="#my-tickers"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('my-tickers');
            }}
            className={`w-full text-left px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              currentPage === 'my-tickers'
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-blue-600/50 text-blue-100'
            }`}
          >
            <span className="text-lg">👍</span>
            <span>My Tickers</span>
            {Object.keys(tickerSentiments).length > 0 && (
              <span className="ml-auto bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                {Object.keys(tickerSentiments).length}
              </span>
            )}
          </a>

          {/* Reports - Expandable */}
          <div>
            <button
              onClick={() => setIsReportsExpanded(!isReportsExpanded)}
              className={`w-full text-left px-3 py-2 rounded-lg font-medium flex items-center justify-between transition-colors ${
                currentPage === 'top-periods' || currentPage === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-blue-600/50 text-blue-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span>Reports</span>
              </div>
              <span className={`transform transition-transform text-sm ${isReportsExpanded ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </button>

            {isReportsExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                <a
                  href="#top-periods"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('top-periods');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    currentPage === 'top-periods'
                      ? 'bg-blue-500/30 text-blue-300'
                      : 'hover:bg-blue-600/40 text-blue-200'
                  }`}
                >
                  <span>🏆</span>
                  <span>Top Periods</span>
                </a>
                <a
                  href="#upcoming"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('upcoming');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    currentPage === 'upcoming'
                      ? 'bg-blue-500/30 text-blue-300'
                      : 'hover:bg-blue-600/40 text-blue-200'
                  }`}
                >
                  <span>📅</span>
                  <span>Upcoming Opportunities</span>
                </a>
              </div>
            )}
          </div>

          {/* Search - Expandable */}
          <div>
            <a
              href="#search"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('search');
                setIsSearchExpanded(!isSearchExpanded);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg font-medium flex items-center justify-between transition-colors ${
                currentPage === 'search'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-blue-600/50 text-blue-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🔍</span>
                <span>Search</span>
              </div>
              <span className={`transform transition-transform text-sm ${isSearchExpanded ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </a>

            {isSearchExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {/* Quick Search Input with Autocomplete */}
                <div className="px-3 py-2">
                  <StockPicker
                    onSelect={(ticker) => {
                      handleSelectTicker(ticker);
                      navigateTo('search', ticker);
                    }}
                    selected={null}
                    variant="sidebar"
                    showPrice={false}
                  />
                </div>

                {/* Recent - Expandable child entry */}
                <div>
                  <button
                    onClick={() => setIsRecentExpanded(!isRecentExpanded)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors hover:bg-blue-600/40 text-blue-200"
                  >
                    <div className="flex items-center gap-2">
                      <span>🕒</span>
                      <span>Recent</span>
                      {recentSearches.length > 0 && (
                        <span className="text-xs bg-blue-600/30 px-1.5 rounded">
                          {recentSearches.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {recentSearches.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearRecent();
                          }}
                          className="text-xs text-blue-300 hover:text-red-300 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      <span
                        className={`transform transition-transform text-xs ${isRecentExpanded ? 'rotate-90' : ''}`}
                      >
                        ▶
                      </span>
                    </div>
                  </button>

                  {isRecentExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {recentSearches.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-blue-300 italic">
                          No recent searches
                        </div>
                      ) : (
                        recentSearches.map((ticker) => (
                          <a
                            key={ticker}
                            href={`#search/${ticker}`}
                            onClick={(e) => {
                              e.preventDefault();
                              navigateTo('search', ticker);
                              handleSelectTicker(ticker);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                              selectedTicker === ticker && currentPage === 'search'
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'hover:bg-blue-600/40 text-blue-200'
                            }`}
                          >
                            <span className="font-medium">{ticker}</span>
                            {selectedTicker === ticker && currentPage === 'search' && (
                              <span className="text-xs text-blue-400">Active</span>
                            )}
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-blue-600/30 my-4"></div>

          {/* Coming Soon */}
          <div>
            <div className="px-3 py-2 text-xs text-blue-200 uppercase tracking-wider">
              Coming Soon
            </div>
            <button
              disabled
              className="w-full text-left px-3 py-2 rounded-lg text-blue-300/70 cursor-not-allowed flex items-center gap-2 opacity-60"
            >
              <span className="text-lg">📈</span>
              <span>Trend Analysis</span>
            </button>
          </div>
        </nav>

        {/* Footer in Sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-600/30 text-xs text-blue-300/70">
          <div className="flex justify-between">
            <span>Data Sync:</span>
            <span className="text-blue-200">
              {lastDataSync
                ? new Date(lastDataSync).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })
                : '—'}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Build:</span>
            <span className="text-blue-200">
              {new Date(__BUILD_TIMESTAMP__).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Full Width with Left Margin for Sidebar */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* Top Periods Report (Screener) */}
        {currentPage === 'top-periods' && (
          <ScreenerPage
            calcMethod={calcMethod}
            onSelectTicker={(ticker, entryMonth, holdingPeriod) => {
              handleSelectTicker(ticker);
              navigateTo('search', ticker, { entryMonth, holdingPeriod });
            }}
            tickerSentiments={tickerSentiments}
            onSentimentChange={handleSentimentChange}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Upcoming Opportunities Report */}
        {currentPage === 'upcoming' && (
          <ScreenerPage
            calcMethod={calcMethod}
            onSelectTicker={(ticker, entryMonth, holdingPeriod) => {
              handleSelectTicker(ticker);
              navigateTo('search', ticker, { entryMonth, holdingPeriod });
            }}
            upcomingOnly
            tickerSentiments={tickerSentiments}
            onSentimentChange={handleSentimentChange}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Favorites Page */}
        {currentPage === 'favorites' && (
          <FavoritesPage
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            calcMethod={calcMethod}
            onSelectPattern={(ticker, month, holdingPeriod) => {
              handleSelectTicker(ticker);
              navigateTo('search', ticker, { entryMonth: month, holdingPeriod });
            }}
            ratings={patternRatings}
            onRatingChange={handleRatingChange}
            notes={patternNotes}
            onNoteChange={handleNoteChange}
          />
        )}

        {/* My Tickers (Sentiment) Page */}
        {currentPage === 'my-tickers' && (
          <SentimentPage
            tickerSentiments={tickerSentiments}
            onSentimentChange={handleSentimentChange}
            onSelectTicker={(ticker) => {
              handleSelectTicker(ticker);
              navigateTo('search', ticker);
            }}
          />
        )}

        {/* Search Page */}
        {currentPage === 'search' && (
          <>
            {/* Minimal Header */}
            <header className="border-b sticky top-0 z-20 bg-white border-gray-200">
              <div className="px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-gray-900">Seasonality Search</h2>
                  {selectedTicker && (
                    <span className="text-sm text-gray-500">
                      {viewMode === 'entry' ? 'Entry view' : 'Exit view'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StockPicker onSelect={(ticker) => {
                    handleSelectTicker(ticker);
                    navigateTo('search', ticker);
                  }} selected={selectedTicker} />
                  {selectedTicker && (
                    <button
                      onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isDrawerOpen
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isDrawerOpen ? '× Hide Panel' : '❤️ Best Months'}
                    </button>
                  )}
                </div>
              </div>
            </header>

        {/* Content Area - Flex row for main + right panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto min-h-[calc(100vh-140px)] bg-gray-50">
            <div className="px-5 py-4">
              {selectedTicker ? (
                <div>
                  {/* Sticky Filter Bar */}
                  <div className="sticky top-0 z-10 bg-gray-50 -mx-5 px-5 py-3 mb-4 border-b border-gray-200 shadow-sm">
                    <div className="flex items-center gap-4">
                      {/* Years */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Years</span>
                        <select
                          value={yearsToShow}
                          onChange={(e) => setYearsToShow(Number(e.target.value))}
                          className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={8}>8</option>
                          <option value={10}>10</option>
                          <option value={12}>12</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                        </select>
                      </div>

                      {/* View Mode */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">View</span>
                        <select
                          value={viewMode}
                          onChange={(e) => setViewMode(e.target.value as ViewMode)}
                          className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="entry">Entry (Buy)</option>
                          <option value="exit">Exit (Sell)</option>
                        </select>
                      </div>

                      {/* Calculation Method */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Method</span>
                        <select
                          value={calcMethod}
                          onChange={(e) => setCalcMethod(e.target.value as CalculationMethod)}
                          className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="openClose">Open → Close</option>
                          <option value="maxMax">Max → Max</option>
                        </select>
                      </div>

                      <div className="w-px h-5 bg-gray-300" />

                      {/* Highlight Filters */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Highlight</span>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-gray-400">Win%≥</span>
                          <input
                            type="number"
                            value={filters.minWinRate}
                            onChange={(e) => setFilters(f => ({ ...f, minWinRate: Number(e.target.value) }))}
                            className="w-12 px-1.5 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min={0}
                            max={100}
                            step={5}
                          />
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-gray-400">Avg/Mo≥</span>
                          <input
                            type="number"
                            value={filters.minAvgGain}
                            onChange={(e) => setFilters(f => ({ ...f, minAvgGain: Number(e.target.value) }))}
                            className="w-12 px-1.5 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min={-50}
                            max={50}
                            step={0.5}
                          />
                          <span className="text-gray-400">%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
                        <span className="w-3 h-3 rounded-sm bg-purple-100 border border-purple-400"></span>
                        <span>matches</span>
                      </div>

                      <div className="w-px h-5 bg-gray-300" />

                      {/* V1/V2 Toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Layout</span>
                        <button
                          onClick={() => setUseHeatmapV2(!useHeatmapV2)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                            useHeatmapV2
                              ? 'bg-teal-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {useHeatmapV2 ? 'V2 (Split Cell)' : 'V1 (Classic)'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stock Summary Header */}
                  <StockSummary
                    ticker={selectedTicker}
                    sentiment={tickerSentiments[selectedTicker] || null}
                    onSentimentChange={handleSentimentChange}
                    note={tickerNotes[selectedTicker] || null}
                    onNoteChange={handleTickerNoteChange}
                  />

                  {/* All Timeframes */}
                  <div className="space-y-3">
                    {TIMEFRAMES.map((timeframe, index) => {
                      const HeatmapComponent = useHeatmapV2 ? HeatmapV2 : Heatmap;
                      return (
                        <HeatmapComponent
                          key={`${timeframe}-${calcMethod}-${yearsToShow}-${useHeatmapV2 ? 'v2' : 'v1'}`}
                          ticker={selectedTicker}
                          viewMode={viewMode}
                          holdingPeriod={timeframe}
                          calcMethod={calcMethod}
                          defaultExpanded={highlightCell ? highlightCell.holdingPeriod === timeframe : index === 1}
                          filters={filters}
                          highlightMonth={highlightCell?.holdingPeriod === timeframe ? highlightCell.entryMonth : undefined}
                          yearsToShow={yearsToShow}
                          favorites={favorites}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      );
                    })}
                  </div>

                  {/* Max Close Price Grid - Separate Section */}
                  <MaxCloseGrid
                    ticker={selectedTicker}
                    viewMode={viewMode}
                    defaultExpanded={false}
                  />

                  {/* Legend - Dynamic color scale based on per-month returns */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
                    <div className="text-xs text-gray-500 text-center mb-3">
                      Color scale based on return per month (neutral: 0-0.5%/mo)
                    </div>
                    <div className="flex items-center justify-center gap-1 mb-3">
                      {/* Full gradient scale */}
                      <span className="text-xs text-gray-500 mr-2">Poor</span>
                      <div className="w-6 h-6 rounded bg-red-600" title="≤-5%/mo"></div>
                      <div className="w-6 h-6 rounded bg-red-500" title="-4%/mo"></div>
                      <div className="w-6 h-6 rounded bg-red-400" title="-3%/mo"></div>
                      <div className="w-6 h-6 rounded bg-red-300" title="-2%/mo"></div>
                      <div className="w-6 h-6 rounded bg-red-200" title="-1%/mo"></div>
                      <div className="w-6 h-6 rounded bg-gray-200 border border-gray-300" title="0-0.5%/mo (Neutral)"></div>
                      <div className="w-6 h-6 rounded bg-green-200" title="+1%/mo"></div>
                      <div className="w-6 h-6 rounded bg-green-300" title="+2%/mo"></div>
                      <div className="w-6 h-6 rounded bg-green-400" title="+3%/mo"></div>
                      <div className="w-6 h-6 rounded bg-green-500" title="+4%/mo"></div>
                      <div className="w-6 h-6 rounded bg-green-600" title="≥+5%/mo"></div>
                      <span className="text-xs text-gray-500 ml-2">Good</span>
                    </div>
                    <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
                      <span>-5%/mo</span>
                      <span>-3%/mo</span>
                      <span>-1%/mo</span>
                      <span className="font-medium">Neutral</span>
                      <span>+1%/mo</span>
                      <span>+3%/mo</span>
                      <span>+5%/mo</span>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-4 h-4 rounded ring-2 ring-purple-500 ring-offset-1 bg-purple-200"></div>
                        <span>Meets Filter Criteria</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Centered Search Box on Start Page */
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <div className="text-6xl mb-6">📊</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Seasonality Analysis
                  </h2>
                  <p className="text-gray-500 mb-8 text-center max-w-lg">
                    Discover optimal entry and exit months based on historical price patterns.
                    Search for any stock to view 15 years of seasonality data.
                  </p>

                  {/* Large Centered Search Box */}
                  <div className="w-full max-w-lg">
                    <StockPicker
                      onSelect={(ticker) => {
                        handleSelectTicker(ticker);
                        navigateTo('search', ticker);
                      }}
                      selected={selectedTicker}
                      size="large"
                      autoFocus
                    />
                  </div>

                  <div className="mt-8 text-sm text-gray-400">
                    <p>Try: AAPL, NVDA, TSLA, MSFT, GOOGL, AMZN</p>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Best Months Panel - Side panel that pushes content */}
          {selectedTicker && isDrawerOpen && currentPage === 'search' && (
            <BestMonthsDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              ticker={selectedTicker}
              calcMethod={calcMethod}
              filters={filters}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
