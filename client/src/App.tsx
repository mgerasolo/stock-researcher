import { useState, useEffect } from 'react';
import { StockSearch } from './components/StockSearch';
import { Heatmap } from './components/Heatmap';
import { MaxCloseGrid } from './components/MaxCloseGrid';
import { ViewToggle } from './components/ViewToggle';
import { BestMonthsDrawer } from './components/BestMonthsDrawer';
import { ScreenerPage } from './components/ScreenerPage';
import { FavoritesPage } from './components/FavoritesPage';

export type ViewMode = 'entry' | 'exit';
export type Timeframe = 1 | 3 | 6 | 12;
export type CalculationMethod = 'openClose' | 'maxMax';
export type Page = 'search' | 'favorites' | 'top-periods' | 'upcoming';

export interface FilterCriteria {
  minWinRate: number;
  minAvgGain: number;
}

const TIMEFRAMES: Timeframe[] = [1, 3, 6, 12];
const RECENT_SEARCHES_KEY = 'stock-researcher-recent-searches';
const FAVORITES_KEY = 'stock-researcher-favorites';
const MAX_RECENT_SEARCHES = 10;

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
  const [lastDataSync, setLastDataSync] = useState<string | null>(null);
  const [highlightCell, setHighlightCell] = useState<{ entryMonth: number; holdingPeriod: number } | null>(null);

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
      if (['search', 'favorites', 'top-periods', 'upcoming'].includes(page)) {
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

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)));
      } catch {
        // Invalid JSON, ignore
      }
    }
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

  // Toggle favorite
  const handleToggleFavorite = (key: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
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
          {/* Favorites - Top Level */}
          <a
            href="#favorites"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('favorites');
            }}
            className={`w-full text-left px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              currentPage === 'favorites'
                ? 'bg-yellow-600 text-white'
                : 'hover:bg-blue-600/50 text-blue-100'
            }`}
          >
            <span className="text-lg">⭐</span>
            <span>Favorites</span>
            {favorites.size > 0 && (
              <span className="ml-auto bg-yellow-500 text-gray-900 text-xs px-1.5 py-0.5 rounded-full font-medium">
                {favorites.size}
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
              <div className="ml-4 mt-1">
                {/* Quick Search Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input');
                    const ticker = input?.value.trim().toUpperCase();
                    if (ticker) {
                      handleSelectTicker(ticker);
                      navigateTo('search', ticker);
                      if (input) input.value = '';
                    }
                  }}
                  className="px-3 py-2"
                >
                  <input
                    type="text"
                    placeholder="Enter ticker..."
                    className="w-full px-3 py-2 text-sm bg-blue-900/50 border border-blue-500/50 rounded-lg text-white placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                </form>

                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs text-blue-200 uppercase tracking-wider">Recent</span>
                  {recentSearches.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearRecent();
                      }}
                      className="text-xs text-blue-200 hover:text-red-300 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {recentSearches.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-blue-300 italic">
                    No recent searches
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentSearches.map((ticker) => (
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
                    ))}
                  </div>
                )}
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
          />
        )}

        {/* Search Page */}
        {currentPage === 'search' && (
          <>
            {/* Header */}
            <header className={`border-b sticky top-0 z-20 ${
              viewMode === 'entry'
                ? 'bg-blue-100/90 border-blue-200'
                : 'bg-amber-100/90 border-amber-200'
            } backdrop-blur-sm`}>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Seasonality Search</h2>
                    <p className={`text-sm ${viewMode === 'entry' ? 'text-blue-600' : 'text-amber-600'}`}>
                      {viewMode === 'entry' ? 'Entry Month View - When to BUY' : 'Exit Month View - When to SELL'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <StockSearch onSelect={handleSelectTicker} selected={selectedTicker} />
                    {selectedTicker && (
                      <button
                        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium shadow-sm ${
                          isDrawerOpen
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <span>{isDrawerOpen ? '✕' : '★'}</span>
                        <span>{isDrawerOpen ? 'Hide Panel' : 'Best Months'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </header>

        {/* View Mode Toggle + Calculation Method + Filters */}
        <div className={`border-b ${
          viewMode === 'entry'
            ? 'bg-blue-100 border-blue-200'
            : 'bg-amber-100 border-amber-200'
        }`}>
          <div className="px-6 py-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <ViewToggle mode={viewMode} onChange={setViewMode} />

                {/* Calculation Method Toggle */}
                <div className="flex items-center bg-white/80 rounded-lg border border-gray-300 p-1">
                  <button
                    onClick={() => setCalcMethod('openClose')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      calcMethod === 'openClose'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Open→Close
                  </button>
                  <button
                    onClick={() => setCalcMethod('maxMax')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      calcMethod === 'maxMax'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Max→Max
                  </button>
                </div>
              </div>

              {/* Filter Controls */}
              {selectedTicker && (
                <div className="flex items-center gap-6 bg-white/50 rounded-lg px-4 py-2 border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Highlight Patterns:</span>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Win % &ge;</label>
                    <input
                      type="number"
                      value={filters.minWinRate}
                      onChange={(e) => setFilters(f => ({ ...f, minWinRate: Number(e.target.value) }))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={0}
                      max={100}
                      step={5}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Avg Gain &ge;</label>
                    <input
                      type="number"
                      value={filters.minAvgGain}
                      onChange={(e) => setFilters(f => ({ ...f, minAvgGain: Number(e.target.value) }))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={-50}
                      max={50}
                      step={0.5}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                    <span className="w-3 h-3 rounded ring-2 ring-purple-500 ring-offset-1 bg-purple-200"></span>
                    <span>= Matches</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Flex row for main + right panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <main className={`flex-1 overflow-y-auto min-h-[calc(100vh-140px)] ${
            viewMode === 'entry' ? 'bg-blue-50' : 'bg-amber-50'
          }`}>
            <div className="px-6 py-6">
              {selectedTicker ? (
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {selectedTicker} Seasonality Analysis
                  </h2>

                  {/* All Timeframes */}
                  {TIMEFRAMES.map((timeframe, index) => (
                    <Heatmap
                      key={`${timeframe}-${calcMethod}`}
                      ticker={selectedTicker}
                      viewMode={viewMode}
                      holdingPeriod={timeframe}
                      calcMethod={calcMethod}
                      defaultExpanded={index === 1 || (highlightCell?.holdingPeriod === timeframe)} // 3-month expanded by default, or if highlighted
                      filters={filters}
                      highlightMonth={highlightCell?.holdingPeriod === timeframe ? highlightCell.entryMonth : undefined}
                    />
                  ))}

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
                    <StockSearch
                      onSelect={handleSelectTicker}
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
