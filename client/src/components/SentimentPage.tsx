import { useState, useEffect, useMemo } from 'react';

export type TickerSentiment = 'up' | 'down' | null;

interface SentimentDetail {
  ticker: string;
  sentiment: 'up' | 'down';
  name: string | null;
  created_at: string;
  updated_at: string;
}

interface SentimentPageProps {
  tickerSentiments: Record<string, 'up' | 'down'>;
  onSentimentChange: (ticker: string, sentiment: TickerSentiment) => void;
  onSelectTicker: (ticker: string) => void;
}

export function SentimentPage({ tickerSentiments, onSentimentChange, onSelectTicker }: SentimentPageProps) {
  const [viewMode, setViewMode] = useState<'all' | 'liked' | 'avoided'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'ticker' | 'name'>('recent');
  const [detailedData, setDetailedData] = useState<SentimentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch detailed sentiment data
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/ticker-sentiment/detailed')
      .then((res) => res.json())
      .then((data) => {
        setDetailedData(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [tickerSentiments]); // Refetch when sentiments change

  // Filter and sort data
  const { likedTickers, avoidedTickers } = useMemo(() => {
    const liked = detailedData.filter((d) => d.sentiment === 'up');
    const avoided = detailedData.filter((d) => d.sentiment === 'down');

    const sortFn = (a: SentimentDetail, b: SentimentDetail) => {
      if (sortBy === 'ticker') {
        return a.ticker.localeCompare(b.ticker);
      } else if (sortBy === 'name') {
        return (a.name || a.ticker).localeCompare(b.name || b.ticker);
      }
      // 'recent' - sort by created_at descending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };

    return {
      likedTickers: [...liked].sort(sortFn),
      avoidedTickers: [...avoided].sort(sortFn),
    };
  }, [detailedData, sortBy]);

  const totalCount = detailedData.length;

  // Filter based on view mode
  const showLiked = viewMode === 'all' || viewMode === 'liked';
  const showAvoided = viewMode === 'all' || viewMode === 'avoided';

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-slate-50">
        <header className="border-b sticky top-0 z-20 bg-slate-100/90 border-slate-200 backdrop-blur-sm">
          <div className="px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">My Tickers</h2>
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        </header>
        <div className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg p-4 h-16"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex-1 bg-slate-50">
        <header className="border-b sticky top-0 z-20 bg-slate-100/90 border-slate-200 backdrop-blur-sm">
          <div className="px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">My Tickers</h2>
            <p className="text-sm text-slate-600">0 tickers tagged</p>
          </div>
        </header>
        <div className="p-6">
          <div className="text-center py-20 text-gray-500">
            <div className="text-6xl mb-4">
              <span className="inline-block">👍</span>
              <span className="inline-block ml-2">👎</span>
            </div>
            <p className="text-xl mb-2">No tickers tagged yet</p>
            <p className="text-sm">Use the thumbs up/down buttons on stocks to track your sentiment</p>
          </div>
        </div>
      </div>
    );
  }

  const renderTickerList = (tickers: SentimentDetail[], sentiment: 'up' | 'down') => {
    const bgColor = sentiment === 'up' ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100';
    const borderColor = sentiment === 'up' ? 'border-green-200' : 'border-red-200';
    const textColor = sentiment === 'up' ? 'text-green-700' : 'text-red-700';
    const icon = sentiment === 'up' ? '👍' : '👎';

    return tickers.map((item) => (
      <div
        key={item.ticker}
        className={`flex items-center justify-between px-4 py-3 ${bgColor} rounded-lg cursor-pointer transition-colors border ${borderColor} group`}
        onClick={() => onSelectTicker(item.ticker)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${textColor}`}>{item.ticker}</span>
              {item.name && (
                <span className="text-gray-600 truncate text-sm">{item.name}</span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Added {formatRelativeTime(item.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle sentiment button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSentimentChange(item.ticker, sentiment === 'up' ? 'down' : 'up');
            }}
            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
              sentiment === 'up'
                ? 'text-gray-400 hover:bg-red-100 hover:text-red-500'
                : 'text-gray-400 hover:bg-green-100 hover:text-green-500'
            }`}
            title={sentiment === 'up' ? 'Switch to avoid' : 'Switch to like'}
          >
            {sentiment === 'up' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            )}
          </button>
          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSentimentChange(item.ticker, null);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove from list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 z-20 bg-slate-100/90 border-slate-200 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Tickers</h2>
              <p className="text-sm text-slate-600">
                {totalCount} ticker{totalCount !== 1 ? 's' : ''} tagged
                {likedTickers.length > 0 && (
                  <span className="ml-2 text-green-600">{likedTickers.length} liked</span>
                )}
                {avoidedTickers.length > 0 && (
                  <span className="ml-2 text-red-500">{avoidedTickers.length} avoided</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* View Filter */}
              <div className="flex items-center gap-1 bg-slate-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setViewMode('liked')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                    viewMode === 'liked'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-green-500">👍</span> Liked
                </button>
                <button
                  onClick={() => setViewMode('avoided')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                    viewMode === 'avoided'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-red-500">👎</span> Avoided
                </button>
              </div>
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="recent">Sort by Recent</option>
                <option value="ticker">Sort by Ticker</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'all' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liked Tickers Section */}
            {showLiked && (
              <div className="bg-white rounded-lg border border-green-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-green-50 border-b border-green-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👍</span>
                    <h3 className="font-semibold text-green-800">Liked Tickers</h3>
                    <span className="ml-auto text-sm text-green-600 font-medium">
                      {likedTickers.length}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-2 max-h-[60vh] overflow-auto">
                  {likedTickers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-4">
                      No liked tickers yet
                    </p>
                  ) : (
                    renderTickerList(likedTickers, 'up')
                  )}
                </div>
              </div>
            )}

            {/* Avoided Tickers Section */}
            {showAvoided && (
              <div className="bg-white rounded-lg border border-red-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👎</span>
                    <h3 className="font-semibold text-red-800">Avoided Tickers</h3>
                    <span className="ml-auto text-sm text-red-600 font-medium">
                      {avoidedTickers.length}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-2 max-h-[60vh] overflow-auto">
                  {avoidedTickers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-4">
                      No avoided tickers yet
                    </p>
                  ) : (
                    renderTickerList(avoidedTickers, 'down')
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Single list view for filtered mode */
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden max-w-2xl mx-auto">
            <div className={`px-4 py-3 border-b ${viewMode === 'liked' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{viewMode === 'liked' ? '👍' : '👎'}</span>
                <h3 className={`font-semibold ${viewMode === 'liked' ? 'text-green-800' : 'text-red-800'}`}>
                  {viewMode === 'liked' ? 'Liked' : 'Avoided'} Tickers
                </h3>
                <span className={`ml-auto text-sm font-medium ${viewMode === 'liked' ? 'text-green-600' : 'text-red-600'}`}>
                  {viewMode === 'liked' ? likedTickers.length : avoidedTickers.length}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {viewMode === 'liked' ? (
                likedTickers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">No liked tickers yet</p>
                ) : (
                  renderTickerList(likedTickers, 'up')
                )
              ) : (
                avoidedTickers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">No avoided tickers yet</p>
                ) : (
                  renderTickerList(avoidedTickers, 'down')
                )
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 p-4 bg-slate-100 rounded-lg max-w-2xl mx-auto lg:max-w-none">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            {likedTickers.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Clear all ${likedTickers.length} liked tickers?`)) {
                    likedTickers.forEach(item => onSentimentChange(item.ticker, null));
                  }
                }}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear all liked
              </button>
            )}
            {avoidedTickers.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Clear all ${avoidedTickers.length} avoided tickers?`)) {
                    avoidedTickers.forEach(item => onSentimentChange(item.ticker, null));
                  }
                }}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear all avoided
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
