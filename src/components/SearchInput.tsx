import React from 'react';
import { Search, Loader2, ArrowRight, CornerDownLeft, Sparkles, X, AlertTriangle } from 'lucide-react';
import type { LookupOption } from '../types';

interface SearchInputProps {
  currentOption: LookupOption;
  query: string;
  onChange: (val: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  currentOption,
  query,
  onChange,
  onSearch,
  isLoading,
  error,
}) => {
  const isOptionDisabled = currentOption.enabled === false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOptionDisabled) return;
    if (!query.trim() || isLoading) return;
    onSearch();
  };

  const handleUseExample = () => {
    if (isOptionDisabled) return;
    onChange(currentOption.example);
  };

  return (
    <div className={`border rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden transition ${
      isOptionDisabled
        ? 'bg-slate-900/90 border-rose-900/50'
        : 'bg-slate-900 border-slate-800'
    }`}>
      {/* Disabled Notification Banner if button is OFF */}
      {isOptionDisabled && (
        <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-start sm:items-center gap-3 text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs">
            <span className="font-bold uppercase tracking-wide text-rose-300">Service Disabled by Admin: </span>
            <span>This button/service ({currentOption.title}) is currently turned OFF. Searches on this service are temporarily paused.</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <span>{currentOption.title} Lookup</span>
            {isOptionDisabled && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Disabled (OFF)
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{currentOption.description}</p>
        </div>

        {/* Example Chip */}
        <button
          id="example-chip-btn"
          type="button"
          onClick={handleUseExample}
          disabled={isOptionDisabled}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition ${
            isOptionDisabled
              ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 cursor-pointer'
          }`}
        >
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Example:</span>
          <code className="text-indigo-300 font-mono text-[11px]">{currentOption.example}</code>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-500 pointer-events-none">
            <Search className="w-5 h-5" />
          </div>

          <input
            id="lookup-query-input"
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isOptionDisabled ? `Service disabled: ${currentOption.title} is turned OFF` : currentOption.placeholder}
            className={`w-full text-white placeholder-slate-500 pl-11 pr-24 py-3.5 rounded-xl border text-sm transition ${
              isOptionDisabled
                ? 'bg-slate-950/50 border-rose-900/40 text-slate-400 cursor-not-allowed'
                : 'bg-slate-950/90 border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'
            }`}
            disabled={isLoading || isOptionDisabled}
            autoFocus
          />

          {query && !isOptionDisabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-20 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            id="submit-lookup-btn"
            type="submit"
            disabled={!query.trim() || isLoading || isOptionDisabled}
            className={`absolute right-2 px-4 py-2 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1.5 transition ${
              isOptionDisabled
                ? 'bg-rose-950/60 text-rose-400 border border-rose-900/50 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching</span>
              </>
            ) : isOptionDisabled ? (
              <span>Disabled</span>
            ) : (
              <>
                <span>Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-2.5 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-lg p-2.5 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
};
