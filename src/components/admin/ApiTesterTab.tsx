import React, { useState } from 'react';
import {
  TestTube,
  Play,
  Copy,
  Check,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import type { BotButton } from '../../types';

interface ApiTesterTabProps {
  buttons: BotButton[];
}

export const ApiTesterTab: React.FC<ApiTesterTabProps> = ({ buttons }) => {
  const [selectedButtonId, setSelectedButtonId] = useState<string>('custom');
  const [apiUrl, setApiUrl] = useState<string>('https://vehicle-num.vercel.app/info?reg=');
  const [query, setQuery] = useState<string>('HR26EV0001');
  const [loading, setLoading] = useState<boolean>(false);
  const [responseResult, setResponseResult] = useState<{
    success: boolean;
    fullUrl: string;
    durationMs: number;
    data?: any;
    sizeChars?: number;
    willSendAsTxt?: boolean;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectButton = (btnId: string) => {
    setSelectedButtonId(btnId);
    if (btnId === 'custom') {
      return;
    }
    const target = buttons.find((b) => b.id === btnId);
    if (target) {
      setApiUrl(target.apiUrl);
      if (target.example) {
        setQuery(target.example);
      }
    }
  };

  const handleRunTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiUrl.trim()) return;

    setLoading(true);
    setResponseResult(null);

    try {
      const res = await fetch('/api/admin/test-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: apiUrl.trim(), query: query.trim() }),
      });
      const data = await res.json();
      setResponseResult(data);
    } catch (err: any) {
      setResponseResult({
        success: false,
        fullUrl: apiUrl,
        durationMs: 0,
        error: err.message || 'Failed to connect to API tester service',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyJson = () => {
    if (!responseResult?.data) return;
    const text = typeof responseResult.data === 'string'
      ? responseResult.data
      : JSON.stringify(responseResult.data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (!responseResult?.data) return;
    const text = typeof responseResult.data === 'string'
      ? responseResult.data
      : JSON.stringify(responseResult.data, null, 2);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_result_${query || 'data'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <TestTube className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <span>Live API Debugger & Playground</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                Real-Time Sandbox
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Test any OSINT API endpoint, measure round-trip latency, inspect raw JSON, and verify automatic .txt file delivery logic.
            </p>
          </div>
        </div>
      </div>

      {/* Control Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <form onSubmit={handleRunTest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Quick Preset Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Target Service / Button
              </label>
              <select
                id="api-tester-button-select"
                value={selectedButtonId}
                onChange={(e) => handleSelectButton(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="custom">⚡ Custom API URL</option>
                {buttons.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Query Input */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center justify-between">
                <span>Sample Query / Parameter</span>
                <span className="text-[11px] text-slate-500 font-mono">Appended to API URL</span>
              </label>
              <input
                id="api-tester-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 9876543210, DL01AB1234, 3840393463961"
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Full API URL Input */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              API Base URL (ends with parameter like <code className="text-indigo-300">phone=</code> or <code className="text-indigo-300">reg=</code>)
            </label>
            <input
              id="api-tester-url-input"
              type="text"
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setSelectedButtonId('custom');
              }}
              placeholder="https://api.example.com/search?q="
              className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Test Submit Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500 font-mono truncate max-w-lg hidden sm:block">
              Request URL: <span className="text-slate-400">{apiUrl}{encodeURIComponent(query)}</span>
            </div>

            <button
              id="api-tester-run-btn"
              type="submit"
              disabled={loading || !apiUrl.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50 ml-auto"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Executing Request...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Test Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results View */}
      {responseResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              {responseResult.success ? (
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{responseResult.success ? 'API Response Received' : 'API Request Failed'}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    responseResult.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {responseResult.success ? 'HTTP 200 OK' : 'HTTP Error'}
                  </span>
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>{responseResult.durationMs} ms</span>
                  </span>
                  <span>•</span>
                  <span>Payload: {responseResult.sizeChars?.toLocaleString() || 0} characters</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyJson}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>

              <button
                type="button"
                onClick={downloadTxt}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>

          {/* Automatic .txt Delivery Evaluation Banner */}
          {responseResult.willSendAsTxt ? (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 text-amber-200 text-xs">
              <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300">📄 Automatic .txt Document Delivery Active!</strong>
                <p className="text-amber-200/90 text-[11px] mt-0.5 leading-relaxed">
                  Response length ({responseResult.sizeChars?.toLocaleString()} chars) exceeds the Telegram safe limit (3,400 chars).
                  The bot will automatically attach this full dataset as a clean <code className="bg-amber-950/50 px-1 py-0.5 rounded text-amber-200">.txt</code> file document so no data is truncated!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-slate-300 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Response is compact ({responseResult.sizeChars?.toLocaleString()} chars) — bot will display as an inline card in Telegram.</span>
            </div>
          )}

          {/* Raw JSON Preview Box */}
          <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-96">
            <pre className="whitespace-pre-wrap">
              {responseResult.data
                ? typeof responseResult.data === 'string'
                  ? responseResult.data
                  : JSON.stringify(responseResult.data, null, 2)
                : responseResult.error}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
