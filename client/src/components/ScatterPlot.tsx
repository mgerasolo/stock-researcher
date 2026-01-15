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
    const validData = data
      .filter((d): d is DataPoint & { return_pct: number } => d.return_pct !== null);

    const uniqueYears = [...new Set(validData.map(d => d.year))].sort((a, b) => a - b);
    const yearCount = uniqueYears.length;

    const filtered = displayMonth
      ? validData.filter(d => d.month === displayMonth)
      : validData;

    const returns = filtered.map(d => d.return_pct);
    const bounds = detectOutliers(returns);

    const barWidth = 0.8 / yearCount;

    const bars: BarDataPoint[] = filtered.map(d => {
      const yearIndex = uniqueYears.indexOf(d.year);
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

    bars.sort((a, b) => a.x - b.x);

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
    ? `${ticker ? ticker + ' - ' : ''}${MONTHS[displayMonth - 1]} Returns`
    : `${ticker ? ticker + ' - ' : ''}Monthly Returns Distribution`;

  const barSize = displayMonth ? Math.max(8, Math.min(20, 400 / years.length)) : Math.max(3, Math.min(8, 400 / barData.length));

  return (
    <div data-testid="scatter-plot" className="bg-slate-900 rounded-lg p-3 mb-4">
      {/* Header: Title + Legend inline */}
      <div className="flex items-center justify-between mb-2">
        <h3 data-testid="scatter-plot-title" className="text-sm font-medium text-slate-300">
          {title}
        </h3>
        {/* Inline Legend */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-green-500"></span>
            <span>+</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500"></span>
            <span>−</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-500"></span>
            <span>Outlier</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 border-t border-dashed border-purple-500"></span>
            <span>Avg: {avgReturn.toFixed(1)}%</span>
          </div>
          {years.length > 0 && (
            <span className="text-slate-500">
              {years[0]}→{years[years.length - 1]}
            </span>
          )}
        </div>
      </div>

      {/* Main content: Sidebar + Chart */}
      <div className="flex">
        {/* Left sidebar: Month toggles (vertical) */}
        <div className="w-10 flex flex-col gap-0.5 pr-2">
          {MONTHS.map((month, idx) => (
            <button
              key={month}
              data-testid={`month-header-${month}`}
              onClick={() => onMonthSelect?.(idx + 1)}
              onMouseEnter={() => setHoveredMonth(idx + 1)}
              onMouseLeave={() => setHoveredMonth(null)}
              className={`px-1 py-0.5 text-[10px] rounded transition-colors leading-tight ${
                displayMonth === idx + 1
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
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
              className="px-1 py-0.5 text-[10px] rounded bg-slate-600 text-slate-300 hover:bg-slate-500 mt-1 leading-tight"
            >
              All
            </button>
          )}
        </div>

        {/* Chart area - now taller */}
        <div className="flex-1 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 5, right: 10, bottom: 20, left: 35 }}
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

              <ReferenceLine
                y={avgReturn}
                stroke="#8B5CF6"
                strokeDasharray="5 5"
                data-testid="average-line"
              />

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
                        ? '#F59E0B'
                        : entry.return_pct >= 0
                        ? '#10B981'
                        : '#EF4444'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
