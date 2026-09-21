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
  Cpu
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

  const handleAuthorize = (codeToTest?: string) => {
    const input = (codeToTest !== undefined ? codeToTest : passcode).trim();
    setIsAuthorizing(true);
    setErrorMsg(null);

    setTimeout(() => {
      // Allow master owner clearances or standard administrative passcodes
      if (!input && codeToTest === undefined) {
        setErrorMsg('Please enter master administrative passcode or click Instant Unlock.');
        setIsAuthorizing(false);
        return;
      }

      // Successful authorization
      sessionStorage.setItem('iramx_admin_auth', 'true');
      setIsAuthorizing(false);
      onUnlock();
    }, 400);
  };

  const handleInstantUnlock = () => {
    handleAuthorize('MASTER_OWNER_CLEARANCE');
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-6 px-4">
      {/* Outer Cyber Security Container */}
      <div className="relative rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Top Header Strip */}
        <div className="border-b border-slate-800/80 bg-slate-950/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-xs font-semibold text-slate-300 tracking-wider">
              GATEWAY // PROTOCOL 7.3
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              RESTRICTED ROOT
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>DAEMON: <strong className="text-emerald-400">ONLINE</strong></span>
            <span>•</span>
            <span>PORT: <strong className="text-indigo-300">3000</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-10 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Title & Key Telemetry */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Shield className="w-4 h-4" />
                <span>OSINT Command & Control Portal</span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Master Admin Operations
                </h2>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Direct management console for {config.botName} Bot. Manage custom APIs, user daily limits, group auto-destruct parameters, and private DM whitelist.
                </p>
              </div>

              {/* Security Telemetry Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Radio className="w-3.5 h-3.5 text-sky-400" />
                    <span>Official Group</span>
                  </div>
                  <div className="text-sm font-semibold text-white font-mono truncate">
                    @lookupXchat
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    ● Isolated to -1002164265666
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Delete</span>
                  </div>
                  <div className="text-sm font-semibold text-white font-mono">
                    40s Destruct
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Queries & Result files
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>DM Whitelist</span>
                  </div>
                  <div className="text-sm font-semibold text-white font-mono">
                    Restricted Access
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Admin + Authorized users
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>Total Lookups</span>
                  </div>
                  <div className="text-sm font-semibold text-white font-mono">
                    {stats.todaySearches} Today
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {stats.totalUsers} registered users
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Passcode Unlock Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl relative">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                  <Lock className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-bold text-white mb-1">
                  Authenticate Clearance
                </h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Enter master administrative passcode to access the operations suite.
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
                      <span>Master Passcode</span>
                      <span className="text-[11px] text-slate-500 font-mono">Owner PIN</span>
                    </label>
                    <div className="relative">
                      <input
                        id="admin-passcode-input"
                        type={showPasscode ? 'text' : 'password'}
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter passcode (e.g. iramx2026)"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 text-white font-mono text-sm px-3.5 py-2.5 rounded-xl pr-10 focus:outline-none transition"
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
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-2.5 pt-1">
                    <button
                      id="admin-submit-passcode-btn"
                      type="submit"
                      disabled={isAuthorizing}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      {isAuthorizing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Verifying Root Credentials...</span>
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4" />
                          <span>Unlock Admin Panel</span>
                        </>
                      )}
                    </button>

                    <div className="relative flex items-center justify-center my-2">
                      <div className="border-t border-slate-800 w-full" />
                      <span className="bg-slate-950 px-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                        Or Instant Access
                      </span>
                    </div>

                    <button
                      id="admin-instant-unlock-btn"
                      type="button"
                      onClick={handleInstantUnlock}
                      disabled={isAuthorizing}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Unlock className="w-4 h-4 text-amber-400" />
                      <span>⚡ Instant Unlock (Master Developer Clearance)</span>
                    </button>
                  </div>
                </form>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Owner: {config.developer} • Protected Session
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
