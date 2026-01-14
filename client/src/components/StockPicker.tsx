import { useState, useEffect, useRef } from 'react';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  tier: number;
}

interface QuoteData {
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface StockPickerProps {
  onSelect: (ticker: string) => void;
  selected?: string | null;
  size?: 'compact' | 'large';
  autoFocus?: boolean;
  variant?: 'default' | 'sidebar';
  showPrice?: boolean;
  placeholder?: string;
}

export function StockPicker({
  onSelect,
  selected = null,
  size = 'compact',
  autoFocus = false,
  variant = 'default',
  showPrice = true,
  placeholder,
}: StockPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Search stocks when query changes
  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setQuotes({});
      return;
    }

    const searchStocks = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchStocks, 150);
    return () => clearTimeout(debounce);
  }, [query]);

  // Fetch quotes for search results
  useEffect(() => {
    if (!showPrice || results.length === 0) {
      return;
    }

    const fetchQuotes = async () => {
      setIsLoadingQuotes(true);
      try {
        const tickers = results.map((s) => s.ticker);
        const res = await fetch('/api/stock-info/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers }),
        });
        if (res.ok) {
          const data = await res.json();
          setQuotes(data);
        }
      } catch (error) {
        console.error('Failed to fetch quotes:', error);
      } finally {
        setIsLoadingQuotes(false);
      }
    };

    fetchQuotes();
  }, [results, showPrice]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (stock: Stock) => {
    onSelect(stock.ticker);
    setQuery('');
    setIsOpen(false);
  };

  const isLarge = size === 'large';
  const isSidebar = variant === 'sidebar';

  // Style variants
  const inputStyles = isSidebar
    ? 'w-full px-3 py-2 text-sm bg-blue-900/50 border border-blue-500/50 rounded-lg text-white placeholder-blue-300/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent'
    : `border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
        isLarge ? 'w-full px-6 py-4 text-lg' : 'px-4 py-2 w-48'
      }`;

  const defaultPlaceholder = isSidebar
    ? 'Search ticker or name...'
    : isLarge
      ? 'Search by ticker or company name (e.g., AAPL, Apple, Tesla)...'
      : 'Search ticker or name...';

  const formatPrice = (quote: QuoteData | undefined) => {
    if (!quote || quote.price === null) return null;
    const isPositive = (quote.change || 0) >= 0;
    return {
      price: quote.price.toFixed(2),
      change: quote.change?.toFixed(2) || '0.00',
      changePercent: quote.changePercent?.toFixed(2) || '0.00',
      isPositive,
    };
  };

  return (
    <div className={`relative ${isLarge ? 'w-full max-w-md' : ''} ${isSidebar ? 'w-full' : ''}`}>
      <div className={`flex items-center gap-2 ${isSidebar ? 'w-full' : ''}`}>
        {selected && !isLarge && !isSidebar && (
          <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg font-medium">
            {selected}
          </span>
        )}
        <div className={`relative ${isLarge || isSidebar ? 'w-full' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder || defaultPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length > 0) {
                e.preventDefault();
                handleSelect(results[0]);
              }
            }}
            className={inputStyles}
          />
          {isLarge && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (query.length > 0 || results.length > 0) && (
        <div
          ref={dropdownRef}
          className={`absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto ${
            isLarge || isSidebar ? 'w-full left-0' : 'right-0 w-80'
          }`}
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results.length > 0 ? (
            results.map((stock) => {
              const priceData = formatPrice(quotes[stock.ticker]);
              return (
                <button
                  key={stock.id}
                  onClick={() => handleSelect(stock)}
                  className={`w-full text-left hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0 ${
                    isLarge ? 'px-6 py-4' : 'px-4 py-3'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-gray-900 ${isLarge ? 'text-lg' : ''}`}>
                        {stock.ticker}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          stock.tier === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        T{stock.tier}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 truncate">{stock.name}</div>
                  </div>
                  {showPrice && (
                    <div className="text-right ml-3 flex-shrink-0">
                      {isLoadingQuotes && !priceData ? (
                        <div className="text-xs text-gray-400 animate-pulse">Loading...</div>
                      ) : priceData ? (
                        <>
                          <div className="font-semibold text-gray-900">${priceData.price}</div>
                          <div
                            className={`text-xs ${priceData.isPositive ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {priceData.isPositive ? '+' : ''}
                            {priceData.change} ({priceData.isPositive ? '+' : ''}
                            {priceData.changePercent}%)
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">—</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          ) : query.length > 0 ? (
            <div className="p-4 text-center text-gray-500">No stocks found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
