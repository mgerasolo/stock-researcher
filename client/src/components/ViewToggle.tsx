import type { ViewMode } from '../App';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
      <button
        onClick={() => onChange('entry')}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
          mode === 'entry'
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }`}
      >
        Entry
        <span className="block text-[10px] font-normal text-slate-400">
          When to buy
        </span>
      </button>
      <button
        onClick={() => onChange('exit')}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
          mode === 'exit'
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }`}
      >
        Exit
        <span className="block text-[10px] font-normal text-slate-400">
          When to sell
        </span>
      </button>
    </div>
  );
}
