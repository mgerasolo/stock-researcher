import type { Timeframe } from '../App';

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
}

const timeframes: { value: Timeframe; label: string }[] = [
  { value: 1, label: 'MoM' },
  { value: 3, label: '3 Month' },
  { value: 6, label: '6 Month' },
  { value: 12, label: '12 Month' },
];

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 font-medium">Holding Period:</span>
      <div className="flex rounded-lg border border-gray-300 overflow-hidden">
        {timeframes.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onChange(tf.value)}
            className={`px-3 py-2 text-sm font-medium border-l border-gray-300 first:border-l-0 transition-colors ${
              value === tf.value
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>
    </div>
  );
}
