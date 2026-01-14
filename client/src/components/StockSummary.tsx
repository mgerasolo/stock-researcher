import { useState, useEffect } from 'react';

interface StockInfo {
  ticker: string;
  name: string;
  marketCap: number | null;
  marketCapFormatted: string;
  sector: string | null;
  industry: string | null;
  currentPrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  description: string | null;
  exchange: string | null;
  currency: string | null;
  fetchedAt: string;
}

export type TickerSentiment = 'up' | 'down' | null;

interface StockSummaryProps {
  ticker: string;
  sentiment?: TickerSentiment;
  onSentimentChange?: (ticker: string, sentiment: TickerSentiment) => void;
}

export function StockSummary({ ticker, sentiment, onSentimentChange }: StockSummaryProps) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (!ticker) return;

    setLoading(true);
    setError(null);

    fetch(`/api/stock-info/${ticker}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Stock info not available');
        }
        return res.json();
      })
      .then((data) => {
        setStockInfo(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-20 bg-gray-200 rounded"></div>
            <div className="h-6 w-48 bg-gray-200 rounded"></div>
          </div>
          <div className="h-8 w-32 bg-gray-200 rounded"></div>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="h-4 w-40 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stockInfo) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-900">{ticker}</span>
          <span className="text-sm text-gray-500">
            {error || 'Company details not available'}
          </span>
        </div>
      </div>
    );
  }

  const isPositive = (stockInfo.priceChange || 0) >= 0;
  const priceColor = isPositive ? 'text-green-600' : 'text-red-600';

  // Truncate description if too long
  const maxDescLength = 200;
  const description = stockInfo.description || '';
  const shouldTruncate = description.length > maxDescLength;
  const displayDescription =
    shouldTruncate && !isDescriptionExpanded
      ? description.slice(0, maxDescLength) + '...'
      : description;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm">
      {/* Row 1: Ticker, Name, Price */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-900">{stockInfo.ticker}</span>
          <span className="text-lg text-gray-700">{stockInfo.name}</span>
          {stockInfo.exchange && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {stockInfo.exchange}
            </span>
          )}
          <a
            href={`https://stockanalysis.com/stocks/${stockInfo.ticker.toLowerCase()}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
          >
            stockanalysis.com ↗
          </a>
          {/* Sentiment Buttons */}
          {onSentimentChange && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => onSentimentChange(ticker, sentiment === 'up' ? null : 'up')}
                className={`p-1.5 rounded-lg transition-colors ${
                  sentiment === 'up'
                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-green-500'
                }`}
                title={sentiment === 'up' ? 'Remove like' : 'Like this ticker'}
              >
                <svg className="w-5 h-5" fill={sentiment === 'up' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </button>
              <button
                onClick={() => onSentimentChange(ticker, sentiment === 'down' ? null : 'down')}
                className={`p-1.5 rounded-lg transition-colors ${
                  sentiment === 'down'
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-red-500'
                }`}
                title={sentiment === 'down' ? 'Remove avoid' : 'Avoid this ticker'}
              >
                <svg className="w-5 h-5" fill={sentiment === 'down' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold text-gray-900">
            ${stockInfo.currentPrice?.toFixed(2) || 'N/A'}
          </span>
          {stockInfo.priceChange !== null && stockInfo.priceChangePercent !== null && (
            <span className={`text-sm font-medium ${priceColor}`}>
              {isPositive ? '+' : ''}
              {stockInfo.priceChange.toFixed(2)} ({isPositive ? '+' : ''}
              {stockInfo.priceChangePercent.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Sector, Industry, Market Cap */}
      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
        {(stockInfo.sector || stockInfo.industry) && (
          <span>
            {stockInfo.sector}
            {stockInfo.sector && stockInfo.industry && ' • '}
            {stockInfo.industry}
          </span>
        )}
        {stockInfo.marketCapFormatted && stockInfo.marketCapFormatted !== 'N/A' && (
          <span className="font-medium">Market Cap: {stockInfo.marketCapFormatted}</span>
        )}
        {stockInfo.fiftyTwoWeekLow !== null && stockInfo.fiftyTwoWeekHigh !== null && (
          <span>
            52W: ${stockInfo.fiftyTwoWeekLow.toFixed(2)} - $
            {stockInfo.fiftyTwoWeekHigh.toFixed(2)}
          </span>
        )}
      </div>

      {/* Row 3: Description (collapsible) */}
      {description && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">
            {displayDescription}
            {shouldTruncate && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="ml-1 text-blue-600 hover:text-blue-800 font-medium"
              >
                {isDescriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
