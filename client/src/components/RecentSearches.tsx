interface RecentSearchesProps {
  searches: string[];
  onSelect: (ticker: string) => void;
  onClear: () => void;
  currentTicker: string | null;
}

export function RecentSearches({ searches, onSelect, onClear, currentTicker }: RecentSearchesProps) {
  if (searches.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Recent Searches
        </h3>
        <p className="text-sm text-gray-400 italic">No recent searches</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Recent Searches
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1">
        {searches.map((ticker) => (
          <button
            key={ticker}
            onClick={() => onSelect(ticker)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
              currentTicker === ticker
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span className="font-medium">{ticker}</span>
            {currentTicker === ticker && (
              <span className="text-xs text-blue-600">Active</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
