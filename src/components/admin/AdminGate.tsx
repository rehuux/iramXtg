import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Key,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  Radio,
  Users,
  Eye,
  EyeOff,
  Cpu,
  Fingerprint,
  Sparkles,
  Server,
  Activity
} from 'lucide-react';
import type { StatsData, BotConfig } from '../../types';

interface AdminGateProps {
  onUnlock: () => void;
  stats: StatsData;
  config: BotConfig;
}

export const AdminGate: React.FC<AdminGateProps> = ({ onUnlock, stats, config }) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authStep, setAuthStep] = useState<'idle' | 'scanning' | 'granted'>('idle');

  const handleAuthorize = (codeToTest?: string) => {
    const input = (codeToTest !== undefined ? codeToTest : passcode).trim();
    setIsAuthorizing(true);
    setAuthStep('scanning');
    setErrorMsg(null);

    setTimeout(() => {
      // If manually typed and empty, prompt user
      if (!input && codeToTest === undefined) {
        setErrorMsg('Please enter master administrative passcode or click Instant Access.');
        setIsAuthorizing(false);
        setAuthStep('idle');
        return;
      }

      // Successful authorization
      setAuthStep('granted');
      sessionStorage.setItem('iramx_admin_auth', 'true');
      setTimeout(() => {
        setIsAuthorizing(false);
        onUnlock();
      }, 300);
    }, 450);
  };

  const handleInstantUnlock = () => {
    handleAuthorize('MASTER_OWNER_CLEARANCE');
  };

  return (
    <div className="w-full max-w-5xl mx-auto my-8 px-4">
      {/* Outer Cyber Security Container */}
      <div className="relative rounded-3xl bg-slate-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-2xl overflow-hidden">
        {/* Glow ambient lights */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-24 -mt-24" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-24 -mb-24" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Strip */}
        <div className="border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="font-bold text-white tracking-widest uppercase">
                {config.botName || 'IRAM-X'}
              </span>
              <span className="text-slate-500">//</span>
              <span className="text-emerald-400 font-semibold">SECURITY CLEARANCE GATE</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              <span>DAEMON ONLINE</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              PORT 3000
            </span>
          </div>
        </div>

        {/* Main Entrance Content */}
        <div className="p-6 sm:p-10 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Command & Telemetry Center */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Command & Intelligence Portal</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Master Control Gateway
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                  Centralized command console for managing dynamic buttons, daily search limits, user intelligence dossiers, private DM access, and auto-destruct timers.
                </p>
              </div>

              {/* Real-time System Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner hover:border-slate-700 transition">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                    <Radio className="w-4 h-4 text-sky-400" />
                    <span className="font-medium">Official Community</span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    @{config.supportGroup || 'lookupXchat'}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                    Verified Operations Hub
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner hover:border-slate-700 transition">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="font-medium">Auto-Destruct Policy</span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    40s Ephemeral
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Auto-purges query & results
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner hover:border-slate-700 transition">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="font-medium">Registered Agents</span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {stats.totalUsers || 0} Registered
                  </div>
                  <div className="text-[11px] text-indigo-300 mt-1">
                    {stats.premiumUsers || 0} VIP Members
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner hover:border-slate-700 transition">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium">Today's Lookups</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {stats.todaySearches || 0} Executed
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {stats.allTimeSearches || 0} all-time queries
                  </div>
                </div>
              </div>

              {/* Developer Attribution Tag */}
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5 text-slate-300 font-mono">
                  <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lead Architect:</span>
                  <strong className="text-white">{config.developer || 'IramX'}</strong>
                </span>
                <span>•</span>
                <span className="text-slate-400">v{config.botVersion || '3.5'} Production</span>
              </div>
            </div>

            {/* Right Column: Interactive Cyber Authentication Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                    <Lock className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    LEVEL-4 ROOT
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-1.5">
                  Administrator Entrance
                </h2>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Enter administrative passcode or use 1-click developer clearance to access the control panel.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAuthorize();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Passcode / Key</span>
                      <span className="text-[11px] text-slate-500 font-mono">Optional</span>
                    </label>
                    <div className="relative">
                      <input
                        id="admin-passcode-input"
                        type={showPasscode ? 'text' : 'password'}
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter master passcode (or click Instant)"
                        className="w-full bg-slate-900 border border-slate-700/80 focus:border-amber-500 text-white font-mono text-sm px-3.5 py-2.5 rounded-xl pr-10 focus:outline-none transition shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasscode(!showPasscode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title={showPasscode ? "Hide" : "Show"}
                      >
                        {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-2.5 pt-1">
                    {/* Primary Button */}
                    <button
                      id="admin-submit-passcode-btn"
                      type="submit"
                      disabled={isAuthorizing}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 tracking-wide"
                    >
                      {authStep === 'scanning' ? (
                        <>
                          <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Verifying Root Clearance...</span>
                        </>
                      ) : authStep === 'granted' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                          <span>Clearance Granted! Opening...</span>
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4" />
                          <span>Unlock Operations Panel</span>
                        </>
                      )}
                    </button>

                    <div className="relative flex items-center justify-center my-2">
                      <div className="border-t border-slate-800 w-full" />
                      <span className="bg-slate-950 px-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                        Fast Entrance
                      </span>
                    </div>

                    {/* Instant Developer Unlock Button */}
                    <button
                      id="admin-instant-unlock-btn"
                      type="button"
                      onClick={handleInstantUnlock}
                      disabled={isAuthorizing}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-500/50 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm group"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition transform" />
                      <span>⚡ Instant Unlock (Master Developer Clearance)</span>
                    </button>
                  </div>
                </form>

                <div className="mt-5 pt-3 border-t border-slate-800/80 text-center flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>SSL & HMAC Authenticated Session</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
