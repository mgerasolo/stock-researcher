import { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DataPoint {
  year: number;
  month: number;
  return_pct: number | null;
}

interface ScatterPlotProps {
  data: DataPoint[];
  selectedMonth?: number | null;
  onMonthSelect?: (month: number) => void;
  ticker?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Detect outliers using IQR method
function detectOutliers(values: number[]): { lower: number; upper: number } {
  if (values.length < 4) return { lower: -Infinity, upper: Infinity };

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  return {
    lower: q1 - 1.5 * iqr,
    upper: q3 + 1.5 * iqr,
  };
}

interface TooltipPayload {
  payload: {
    year: number;
    return_pct: number;
    month: number;
    isOutlier: boolean;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        data-testid="scatter-tooltip"
        className="bg-slate-800 text-white px-3 py-2 rounded shadow-lg text-sm"
      >
        <p className="font-medium">{data.year} - {MONTHS[data.month - 1]}</p>
        <p className={data.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
          Return: {data.return_pct.toFixed(2)}%
        </p>
        {data.isOutlier && (
          <p className="text-amber-400 text-xs mt-1">Outlier</p>
        )}
      </div>
    );
  }
  return null;
};

export function ScatterPlot({ data, selectedMonth, onMonthSelect, ticker }: ScatterPlotProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const displayMonth = selectedMonth ?? hoveredMonth;

  // Process data for the scatter plot
  const { chartData, avgReturn, displayData } = useMemo(() => {
    // Filter out null returns and prepare data
    const validData = data
      .filter((d): d is DataPoint & { return_pct: number } => d.return_pct !== null)
      .map(d => ({
        year: d.year,
        month: d.month,
        return_pct: d.return_pct,
        x: d.month, // X-axis is month (1-12)
        y: d.return_pct, // Y-axis is return percentage
      }));

    // Filter for selected/hovered month if applicable
    const filtered = displayMonth
      ? validData.filter(d => d.month === displayMonth)
      : validData;

    // Calculate outliers
    const returns = filtered.map(d => d.return_pct);
    const bounds = detectOutliers(returns);

    // Mark outliers
    const withOutliers = filtered.map(d => ({
      ...d,
      isOutlier: d.return_pct < bounds.lower || d.return_pct > bounds.upper,
    }));

    // Calculate average
    const avg = returns.length > 0
      ? returns.reduce((sum, r) => sum + r, 0) / returns.length
      : 0;

    return {
      chartData: validData,
      avgReturn: avg,
      displayData: withOutliers,
    };
  }, [data, displayMonth]);

  if (chartData.length === 0) {
    return null;
  }

  const title = displayMonth
    ? `${ticker ? ticker + ' - ' : ''}${MONTHS[displayMonth - 1]} Returns Distribution`
    : `${ticker ? ticker + ' - ' : ''}Monthly Returns Distribution`;

  return (
    <div data-testid="scatter-plot" className="bg-slate-900 rounded-lg p-4 mb-4">
      <h3 data-testid="scatter-plot-title" className="text-sm font-medium text-slate-300 mb-3">
        {title}
      </h3>

      {/* Month selector buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {MONTHS.map((month, idx) => (
          <button
            key={month}
            data-testid={`month-header-${month}`}
            onClick={() => onMonthSelect?.(idx + 1)}
            onMouseEnter={() => setHoveredMonth(idx + 1)}
            onMouseLeave={() => setHoveredMonth(null)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              displayMonth === idx + 1
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {month}
          </button>
        ))}
        {displayMonth && (
          <button
            onClick={() => {
              onMonthSelect?.(0);
              setHoveredMonth(null);
            }}
            className="px-2 py-1 text-xs rounded bg-slate-600 text-slate-300 hover:bg-slate-500 ml-2"
          >
            Show All
          </button>
        )}
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0.5, 12.5]}
              ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
              tickFormatter={(value) => MONTHS[value - 1] || ''}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
            />
            <YAxis
              dataKey="y"
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Average reference line */}
            <ReferenceLine
              y={avgReturn}
              stroke="#8B5CF6"
              strokeDasharray="5 5"
              data-testid="average-line"
            />

            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />

            <Scatter data={displayData} dataKey="y">
              {displayData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  data-testid={entry.isOutlier ? 'outlier-point' : 'data-point'}
                  data-outlier={entry.isOutlier ? 'true' : 'false'}
                  data-positive={entry.return_pct >= 0 ? 'true' : 'false'}
                  fill={
                    entry.isOutlier
                      ? '#F59E0B' // Amber for outliers
                      : entry.return_pct >= 0
                      ? '#10B981' // Green for positive
                      : '#EF4444' // Red for negative
                  }
                  r={entry.isOutlier ? 6 : 4}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span>Positive</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span>Negative</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span>Outlier</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-6 border-t-2 border-dashed border-purple-500"></span>
          <span>Avg: {avgReturn.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
