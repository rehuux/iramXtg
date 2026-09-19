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
  Send,
  RadioTower,
  Clock,
  Award,
  AlertCircle
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

  // Generator parameters
  const [customDays, setCustomDays] = useState<number>(30);
  const [codeCount, setCodeCount] = useState<number>(1);
  const [codeUses, setCodeUses] = useState<number>(1);

  // Broadcast code drop state
  const [broadcastDays, setBroadcastDays] = useState<number>(7);
  const [broadcastingCode, setBroadcastingCode] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  // General announcement broadcast state
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState<string | null>(null);

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
        body: JSON.stringify({
          days: Math.max(1, Number(customDays) || 7),
          count: Math.max(1, Number(codeCount) || 1),
          uses: Math.max(1, Number(codeUses) || 1),
          role: 'premium',
        }),
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

  const handleBroadcastCode = async () => {
    setBroadcastingCode(true);
    setBroadcastSuccess(null);
    setBroadcastError(null);
    try {
      const res = await fetch('/api/admin/broadcast-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: Math.max(1, Number(broadcastDays) || 7) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcastSuccess(`🚀 Single-Use Code ${data.code} (${data.days} Days) broadcasted to ${data.sentCount} users! First user to redeem will claim it.`);
        fetchCodes();
      } else {
        setBroadcastError(data.error || 'Failed to broadcast code.');
      }
    } catch (err: any) {
      setBroadcastError(err.message || 'Network error.');
    } finally {
      setBroadcastingCode(false);
    }
  };

  const handleBroadcastAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;

    setSendingAnnouncement(true);
    setAnnouncementSuccess(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: announcementMsg.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnnouncementSuccess(data.message || 'Announcement broadcasted successfully!');
        setAnnouncementMsg('');
      }
    } catch (err) {
      console.error('Failed to broadcast announcement', err);
    } finally {
      setSendingAnnouncement(false);
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
              Manage custom duration redeem codes, first-come first-served broadcast drops, and bot daemon.
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
            <span>Active Codes</span>
            <Key className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {codes.filter((c) => c.usesLeft > 0).length}
          </div>
        </div>
      </div>

      {/* Section 1: Broadcast Code Drop (First-Come, First-Served) */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/40 border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <RadioTower className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white">Broadcast Redeem Code Drop</h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
              First-Come, First-Served
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Admin yahan se jitne din ka chahe code drop kar sakta hai. Ye code sabhi bot users ko broadcast hoga aur <strong className="text-indigo-300">jo sabse pehle /redeem karega usse hi premium access milega</strong> (single-use).
        </p>

        <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <label className="text-xs font-medium text-slate-300">Duration (Days):</label>
            <input
              id="broadcast-days-input"
              type="number"
              min="1"
              max="3650"
              value={broadcastDays}
              onChange={(e) => setBroadcastDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 bg-slate-900 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 7, 15, 30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setBroadcastDays(d)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  broadcastDays === d
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>

          <button
            id="broadcast-code-btn"
            onClick={handleBroadcastCode}
            disabled={broadcastingCode}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:bg-slate-800 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            <RadioTower className="w-4 h-4" />
            <span>{broadcastingCode ? 'Broadcasting...' : `🚀 Drop ${broadcastDays}-Day Code to Users`}</span>
          </button>
        </div>

        {broadcastSuccess && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{broadcastSuccess}</span>
          </div>
        )}

        {broadcastError && (
          <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{broadcastError}</span>
          </div>
        )}
      </div>

      {/* Section 2: Flexible Duration Code Generator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>Custom Duration Redeem Code Generator</span>
            </h4>
            <p className="text-xs text-slate-400">
              Admin jitne din ka chahe (e.g. 1, 7, 30, 365 din) VIP code generate karke share kar sakta hai.
            </p>
          </div>
        </div>

        {/* Generator Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 mb-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Validity (Days):</label>
            <div className="flex items-center gap-1">
              <input
                id="custom-days-input"
                type="number"
                min="1"
                max="3650"
                value={customDays}
                onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-900 text-white font-mono px-3 py-2 rounded-lg border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-1 mt-1.5">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setCustomDays(d)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer ${
                    customDays === d ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Number of Codes:</label>
            <select
              id="code-count-select"
              value={codeCount}
              onChange={(e) => setCodeCount(Number(e.target.value))}
              className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-700 focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value="1">1 Code</option>
              <option value="3">3 Codes</option>
              <option value="5">5 Codes</option>
              <option value="10">10 Codes</option>
              <option value="25">25 Codes</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Max Uses Per Code:</label>
            <select
              id="code-uses-select"
              value={codeUses}
              onChange={(e) => setCodeUses(Number(e.target.value))}
              className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-700 focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value="1">1 Use (Single / First-Come)</option>
              <option value="5">5 Uses</option>
              <option value="10">10 Uses</option>
              <option value="50">50 Uses</option>
              <option value="100">100 Uses</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              id="generate-codes-btn"
              onClick={handleGenerateCodes}
              disabled={generating}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-semibold transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generating ? 'Generating...' : `💎 Generate (${customDays} Days)`}</span>
            </button>
          </div>
        </div>

        {/* Codes Registry Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Redeem Code</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3">Validity</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Claimed By</th>
                <th className="py-2.5 px-3 text-right">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500">
                    {loadingCodes ? 'Loading vouchers...' : 'No codes in database. Generate one using the form above.'}
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
                      {c.usesLeft > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium">
                          🟢 Active ({c.usesLeft}/{c.totalUses})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-medium">
                          🔴 Claimed (0/{c.totalUses})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {c.usedBy && c.usedBy.length > 0 ? c.usedBy.join(', ') : '—'}
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

      {/* Section 3: Broadcast Text Announcement */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
          <Send className="w-4 h-4 text-emerald-400" />
          <span>Broadcast Official Message to All Users</span>
        </h4>
        <p className="text-xs text-slate-400 mb-4">
          Send announcements, updates, or maintenance notices directly to all registered Telegram bot users.
        </p>

        <form onSubmit={handleBroadcastAnnouncement} className="space-y-3">
          <textarea
            id="broadcast-message-textarea"
            rows={3}
            value={announcementMsg}
            onChange={(e) => setAnnouncementMsg(e.target.value)}
            placeholder="Type your official announcement here..."
            className="w-full bg-slate-950 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
          />

          <div className="flex items-center justify-between">
            {announcementSuccess ? (
              <span className="text-xs text-emerald-400 font-medium">{announcementSuccess}</span>
            ) : (
              <span className="text-[11px] text-slate-500">Supports markdown and emoji.</span>
            )}

            <button
              id="send-announcement-btn"
              type="submit"
              disabled={!announcementMsg.trim() || sendingAnnouncement}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingAnnouncement ? 'Sending...' : 'Broadcast Message'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Telegram Bot Integration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${config.telegramActive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <h4 className="text-sm font-semibold text-white">Telegram Daemon & Commands</h4>
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
            <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
              👑 Admin Telegram Commands:
              <br />• <code className="text-cyan-300">/gen &lt;days&gt;</code> ➜ Gen code with custom days
              <br />• <code className="text-cyan-300">/dropcode &lt;days&gt;</code> ➜ Broadcast 1-use code (First-Come)
              <br />• <code className="text-cyan-300">/broadcast &lt;msg&gt;</code> ➜ Send announcement to all
              <br />• <code className="text-cyan-300">/admin</code> ➜ View live metrics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
