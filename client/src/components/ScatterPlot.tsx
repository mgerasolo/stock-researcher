import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
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

interface BarDataPoint {
  id: string;
  year: number;
  month: number;
  return_pct: number;
  isOutlier: boolean;
  // Position for grouped display: month + offset based on year index
  x: number;
}

interface TooltipPayload {
  payload: BarDataPoint;
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

  // Process data for the bar chart - group by month, order by year
  const { barData, avgReturn, years } = useMemo(() => {
    // Filter out null returns
    const validData = data
      .filter((d): d is DataPoint & { return_pct: number } => d.return_pct !== null);

    // Get unique years sorted
    const uniqueYears = [...new Set(validData.map(d => d.year))].sort((a, b) => a - b);
    const yearCount = uniqueYears.length;

    // Filter for selected/hovered month if applicable
    const filtered = displayMonth
      ? validData.filter(d => d.month === displayMonth)
      : validData;

    // Calculate outliers for the filtered data
    const returns = filtered.map(d => d.return_pct);
    const bounds = detectOutliers(returns);

    // Create bar data with x positions that group bars by month
    // Each month spans from (month - 0.4) to (month + 0.4), divided among years
    const barWidth = 0.8 / yearCount; // Width per bar within each month

    const bars: BarDataPoint[] = filtered.map(d => {
      const yearIndex = uniqueYears.indexOf(d.year);
      // Position within month: start at month - 0.4, add offset for each year
      const xOffset = -0.4 + (yearIndex + 0.5) * barWidth;

      return {
        id: `${d.year}-${d.month}`,
        year: d.year,
        month: d.month,
        return_pct: d.return_pct,
        isOutlier: d.return_pct < bounds.lower || d.return_pct > bounds.upper,
        x: d.month + xOffset,
      };
    });

    // Sort by x position for proper rendering
    bars.sort((a, b) => a.x - b.x);

    // Calculate average
    const avg = returns.length > 0
      ? returns.reduce((sum, r) => sum + r, 0) / returns.length
      : 0;

    return {
      barData: bars,
      avgReturn: avg,
      years: uniqueYears,
    };
  }, [data, displayMonth]);

  if (barData.length === 0) {
    return null;
  }

  const title = displayMonth
    ? `${ticker ? ticker + ' - ' : ''}${MONTHS[displayMonth - 1]} Returns Distribution`
    : `${ticker ? ticker + ' - ' : ''}Monthly Returns Distribution`;

  // Calculate bar width based on number of data points and months displayed
  const barSize = displayMonth ? Math.max(8, Math.min(20, 400 / years.length)) : Math.max(3, Math.min(8, 400 / barData.length));

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
          <BarChart
            data={barData}
            margin={{ top: 10, right: 20, bottom: 20, left: 40 }}
            barCategoryGap={0}
            barGap={0}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              type="number"
              domain={displayMonth ? [displayMonth - 0.5, displayMonth + 0.5] : [0.5, 12.5]}
              ticks={displayMonth ? [displayMonth] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
              tickFormatter={(value) => {
                const month = Math.round(value);
                return MONTHS[month - 1] || '';
              }}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
            />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107, 114, 128, 0.1)' }} />

            {/* Average reference line */}
            <ReferenceLine
              y={avgReturn}
              stroke="#8B5CF6"
              strokeDasharray="5 5"
              data-testid="average-line"
            />

            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />

            <Bar dataKey="return_pct" maxBarSize={barSize}>
              {barData.map((entry) => (
                <Cell
                  key={entry.id}
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
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-500"></span>
          <span>Positive</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-500"></span>
          <span>Negative</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
          <span>Outlier</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-6 border-t-2 border-dashed border-purple-500"></span>
          <span>Avg: {avgReturn.toFixed(1)}%</span>
        </div>
        {years.length > 0 && (
          <div className="text-slate-500 ml-auto">
            {years[0]}→{years[years.length - 1]} ({years.length} years)
          </div>
        )}
      </div>
    </div>
  );
}
