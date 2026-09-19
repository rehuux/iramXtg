import React from 'react';
import { Search, Loader2, ArrowRight, CornerDownLeft, Sparkles, X } from 'lucide-react';
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch();
  };

  const handleUseExample = () => {
    onChange(currentOption.example);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <span>{currentOption.title} Lookup</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{currentOption.description}</p>
        </div>

        {/* Example Chip */}
        <button
          id="example-chip-btn"
          type="button"
          onClick={handleUseExample}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition cursor-pointer"
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
            placeholder={currentOption.placeholder}
            className="w-full bg-slate-950/90 text-white placeholder-slate-500 pl-11 pr-24 py-3.5 rounded-xl border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm transition"
            disabled={isLoading}
            autoFocus
          />

          {query && (
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
            disabled={!query.trim() || isLoading}
            className="absolute right-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching</span>
              </>
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
