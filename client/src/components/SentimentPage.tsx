import { useState, useEffect, useMemo } from 'react';

export type TickerSentiment = 'up' | 'down' | null;

interface SentimentDetail {
  ticker: string;
  sentiment: 'up' | 'down';
  name: string | null;
  note: string | null;
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
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');

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

  // Format absolute date
  const formatAbsoluteDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Toggle ticker expansion
  const toggleExpand = (ticker: string) => {
    setExpandedTickers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticker)) {
        newSet.delete(ticker);
      } else {
        newSet.add(ticker);
      }
      return newSet;
    });
  };

  // Start editing a note
  const startEditingNote = (ticker: string, currentNote: string | null) => {
    setEditingNote(ticker);
    setNoteText(currentNote || '');
  };

  // Save note
  const saveNote = async (ticker: string) => {
    try {
      await fetch(`/api/ticker-sentiment/${ticker}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText || null }),
      });
      // Update local state
      setDetailedData(prev =>
        prev.map(item =>
          item.ticker === ticker ? { ...item, note: noteText || null } : item
        )
      );
      setEditingNote(null);
      setNoteText('');
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingNote(null);
    setNoteText('');
  };

  // Truncate note for preview
  const truncateNote = (note: string | null, maxLen = 50) => {
    if (!note) return null;
    if (note.length <= maxLen) return note;
    return note.slice(0, maxLen).trim() + '...';
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
    const bgColor = sentiment === 'up' ? 'bg-green-50' : 'bg-red-50';
    const hoverBgColor = sentiment === 'up' ? 'hover:bg-green-100' : 'hover:bg-red-100';
    const borderColor = sentiment === 'up' ? 'border-green-200' : 'border-red-200';
    const textColor = sentiment === 'up' ? 'text-green-700' : 'text-red-700';
    const icon = sentiment === 'up' ? '👍' : '👎';

    return tickers.map((item) => {
      const isExpanded = expandedTickers.has(item.ticker);
      const isEditing = editingNote === item.ticker;
      const notePreview = truncateNote(item.note);

      return (
        <div
          key={item.ticker}
          className={`${bgColor} rounded-lg border ${borderColor} overflow-hidden`}
        >
          {/* Main row */}
          <div
            className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${hoverBgColor} group`}
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
                {/* Note preview (when not expanded) */}
                {!isExpanded && notePreview && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate" data-testid="ticker-note-preview">
                    {notePreview}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Expand toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(item.ticker);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-gray-600 transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
                data-testid="ticker-expand-toggle"
              >
                <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Edit note button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEditingNote(item.ticker, item.note);
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  item.note ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-400 hover:bg-white hover:text-blue-500'
                }`}
                title={item.note ? 'Edit note' : 'Add note'}
                data-testid="ticker-note-button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
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

          {/* Expanded content */}
          {isExpanded && !isEditing && (
            <div className="px-4 pb-3 border-t border-gray-100">
              {item.note ? (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{item.note}</p>
              ) : (
                <p className="text-sm text-gray-400 mt-2 italic">No notes yet</p>
              )}
              <div className="text-xs text-gray-400 mt-2" data-testid="ticker-date">
                Added: {formatAbsoluteDate(item.created_at)}
              </div>
            </div>
          )}

          {/* Note editing */}
          {isEditing && (
            <div className="px-4 pb-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value.slice(0, 2000))}
                className="w-full mt-2 p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                placeholder="Add notes about this ticker..."
                data-testid="ticker-note-input"
                autoFocus
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{noteText.length}/2000</span>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveNote(item.ticker)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    });
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
