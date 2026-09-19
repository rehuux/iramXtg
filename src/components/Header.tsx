import React from 'react';
import { Shield, Sparkles, Send, ExternalLink, KeyRound, Radio, CheckCircle2, Lock } from 'lucide-react';
import type { StatsData, BotConfig } from '../types';

interface HeaderProps {
  stats: StatsData;
  config: BotConfig;
  onOpenRedeem: () => void;
  onToggleAdmin: () => void;
  isAdmin: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  config,
  onOpenRedeem,
  onToggleAdmin,
  isAdmin,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg text-white tracking-wide">{config.botName}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                v{config.botVersion}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                <Radio className={`w-3 h-3 ${config.telegramActive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                {config.telegramActive ? 'TG Bot Polling' : 'Web Console'}
              </span>
            </div>
            <p className="text-xs text-slate-400">OSINT Intelligence & Record Lookup</p>
          </div>
        </div>

        {/* User Quota & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Channel Membership Status */}
          {stats.channelVerified ? (
            <a
              href={config.channelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition cursor-pointer"
              title={`Joined Channel: ${config.channelUsername} (${config.channelId})`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Channel Joined</span>
            </a>
          ) : (
            <a
              href={config.channelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-medium transition cursor-pointer animate-pulse"
              title={`Join channel ${config.channelUsername} to unlock searches`}
            >
              <Lock className="w-3.5 h-3.5 text-sky-400" />
              <span>Join Channel</span>
            </a>
          )}

          {/* User Role Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium">
            {stats.userRole === 'admin' ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">👑 ADMIN</span>
            ) : stats.userRole === 'premium' ? (
              <span className="text-cyan-400 font-semibold flex items-center gap-1">💎 PREMIUM</span>
            ) : (
              <span className="text-slate-300 flex items-center gap-1">🆓 FREE</span>
            )}
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              {stats.userRole === 'free' ? `${stats.dailyRemaining}/${stats.dailyLimit} left` : '♾️ Unlimited'}
            </span>
          </div>

          {/* Redeem button */}
          <button
            id="redeem-btn"
            onClick={onOpenRedeem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition cursor-pointer"
            title="Redeem Premium Code"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Redeem Code</span>
          </button>

          {/* Admin toggle */}
          <button
            id="admin-toggle-btn"
            onClick={onToggleAdmin}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isAdmin
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Admin View' : 'Admin'}</span>
          </button>

          {/* Links */}
          <a
            href={config.channelLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
          >
            <Send className="w-3 h-3 text-sky-400" />
            <span>Channel</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </a>
        </div>
      </div>
    </header>
  );
};
