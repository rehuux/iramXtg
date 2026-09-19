import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Key,
  Users,
  Search,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Radio,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type { StatsData, BotConfig, RedeemCode } from '../types';

interface AdminPanelProps {
  stats: StatsData;
  config: BotConfig;
  onRefreshStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats, config, onRefreshStats }) => {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch('/api/admin/codes');
      const data = await res.json();
      if (data.codes) {
        setCodes(data.codes);
      }
    } catch (err) {
      console.error('Failed to load redeem codes', err);
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleGenerateCodes = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7, count: 5, uses: 1 }),
      });
      const data = await res.json();
      if (data.codes) {
        setCodes((prev) => [...data.codes, ...prev]);
      }
    } catch (err) {
      console.error('Failed to generate codes', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/20 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <span>Admin Operations Center</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                Master Privileges
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Manage Telegram bot daemon, token vouchers, and search registry usage logs.
            </p>
          </div>
        </div>

        <button
          id="admin-refresh-stats-btn"
          onClick={() => {
            onRefreshStats();
            fetchCodes();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Users</span>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>Premium Users</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">{stats.premiumUsers}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>Today's Lookups</span>
            <Search className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.todaySearches}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>All-time Lookups</span>
            <Search className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">{stats.allTimeSearches}</div>
        </div>
      </div>

      {/* Telegram Bot Integration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${config.telegramActive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <h4 className="text-sm font-semibold text-white">Telegram Daemon Status</h4>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
            config.telegramActive
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}>
            {config.telegramActive ? '🟢 Polling Active' : '🟡 Standby / Token Required'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Bot Handle:</span>
              <span className="text-indigo-300 font-mono">@{config.botUsername}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Version:</span>
              <span className="text-slate-200">v{config.botVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Primary Channel:</span>
              <a href={config.channelLink} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-1">
                {config.channelUsername}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Developer:</span>
              <a href={config.developerLink} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                {config.developer}
              </a>
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <p className="text-slate-400 leading-relaxed">
              To connect your real Telegram Bot, add <code className="text-indigo-300 font-mono">TELEGRAM_BOT_TOKEN</code> to your environment or Settings. The bot polling engine connects automatically.
            </p>
            <div className="text-slate-500 text-[11px] mt-2">
              Supported commands: /start, /help, /vehicle, /num2, /aadhar2info, /voter, /gst, /redeem
            </div>
          </div>
        </div>
      </div>

      {/* Redeem Code Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>Redeem Code Generator & Registry</span>
            </h4>
            <p className="text-xs text-slate-400">
              Generate 7-day premium access vouchers for distributing to users.
            </p>
          </div>

          <button
            id="generate-codes-btn"
            onClick={handleGenerateCodes}
            disabled={generating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-medium transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{generating ? 'Generating...' : '💎 Gen 5 Redeem Codes'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Remaining Uses</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500">
                    {loadingCodes ? 'Loading vouchers...' : 'No codes generated yet. Click "Gen 5 Redeem Codes" above.'}
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                      {c.code}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-medium">
                        {c.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{c.days} days</td>
                    <td className="py-2.5 px-3">
                      <span className={c.usesLeft > 0 ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                        {c.usesLeft} / {c.totalUses}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => copyToClipboard(c.code)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                        title="Copy code"
                      >
                        {copiedCode === c.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
