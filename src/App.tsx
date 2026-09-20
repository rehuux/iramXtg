import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LookupGrid, LOOKUP_OPTIONS } from './components/LookupGrid';
import { SearchInput } from './components/SearchInput';
import { ResultViewer } from './components/ResultViewer';
import { RedeemModal } from './components/RedeemModal';
import { AdminPanel } from './components/AdminPanel';
import { TelegramSimulator } from './components/TelegramSimulator';
import type { LookupType, SearchResult, StatsData, BotConfig, BotButton, LookupOption } from './types';
import { Terminal, Search, Shield, Sparkles, CheckCircle2, Send, Lock } from 'lucide-react';

export default function App() {
  const [selectedType, setSelectedType] = useState<LookupType>('vehicle');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lookup' | 'telegram' | 'admin'>('lookup');
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [buttons, setButtons] = useState<BotButton[]>([]);

  const [stats, setStats] = useState<StatsData>({
    totalUsers: 1,
    premiumUsers: 0,
    bannedUsers: 0,
    todaySearches: 0,
    allTimeSearches: 0,
    userRole: 'free',
    dailyRemaining: 20,
    dailyLimit: 20,
    channelVerified: false,
    channelId: '-1002085221963',
    channelLink: 'https://t.me/rehuszr',
  });

  const [config, setConfig] = useState<BotConfig>({
    botName: 'iramX',
    botVersion: '7.3',
    botUsername: 'irammbot',
    developer: '@gotweeds',
    developerLink: 'https://t.me/gotweeds',
    channelId: '-1002085221963',
    channelUsername: '@RehuSzr',
    channelLink: 'https://t.me/rehuszr',
    supportGroup: '@foreveriram',
    telegramActive: false,
  });

  const fetchButtons = async () => {
    try {
      const res = await fetch('/api/buttons');
      const data = await res.json();
      if (data.buttons) {
        setButtons(data.buttons);
      }
    } catch (e) {
      console.warn('Buttons fetch error:', e);
    }
  };

  const dynamicCurrentOption: LookupOption = (() => {
    const customMatch = buttons.find((b) => b.id === selectedType);
    if (customMatch) {
      const baseMatch = LOOKUP_OPTIONS.find((o) => o.id === selectedType);
      return {
        id: customMatch.id,
        title: customMatch.label,
        icon: baseMatch ? baseMatch.icon : 'BadgePercent',
        placeholder: customMatch.placeholder || (baseMatch ? baseMatch.placeholder : `Enter ${customMatch.label}`),
        example: customMatch.example || (baseMatch ? baseMatch.example : ''),
        description: customMatch.description || (baseMatch ? baseMatch.description : ''),
        category: (customMatch.category as any) || 'custom',
        enabled: customMatch.enabled,
        apiUrl: customMatch.apiUrl,
        isCustom: customMatch.isCustom,
      };
    }
    return LOOKUP_OPTIONS.find((o) => o.id === selectedType) || LOOKUP_OPTIONS[0];
  })();

  const currentOption = dynamicCurrentOption;

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data) setStats(data);
    } catch (e) {
      console.warn('Stats fetch error:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data) setConfig(data);
    } catch (e) {
      console.warn('Config fetch error:', e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchConfig();
    fetchButtons();
  }, []);

  const handleSearch = async (overrideType?: LookupType, overrideQuery?: string) => {
    const typeToUse = overrideType || selectedType;
    const queryToUse = overrideQuery || query;

    if (!queryToUse.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/lookup/${typeToUse}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToUse.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Lookup query failed.');
        setResult({
          success: false,
          type: typeToUse,
          query: queryToUse,
          timestamp: new Date().toISOString(),
          data: null,
          error: data.error,
        });
      } else {
        setResult({
          success: true,
          type: typeToUse,
          query: queryToUse,
          timestamp: new Date().toISOString(),
          data: data.data,
        });
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Network connection to lookup API failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerFromTelegram = (type: LookupType, q: string) => {
    setSelectedType(type);
    setQuery(q);
    setActiveTab('lookup');
    handleSearch(type, q);
  };

  const handleRedeemSuccess = (msg: string) => {
    setNotification(msg);
    fetchStats();
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium border border-emerald-400/40 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <Header
        stats={stats}
        config={config}
        onOpenRedeem={() => setIsRedeemOpen(true)}
        onToggleAdmin={() => setActiveTab(activeTab === 'admin' ? 'lookup' : 'admin')}
        isAdmin={activeTab === 'admin'}
      />

      {/* Navigation Sub-bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex space-x-1 sm:space-x-2 py-2">
            <button
              id="tab-btn-lookup"
              onClick={() => setActiveTab('lookup')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'lookup'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>OSINT Lookup Console</span>
            </button>

            <button
              id="tab-btn-telegram"
              onClick={() => setActiveTab('telegram')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'telegram'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Telegram Bot Shell</span>
            </button>

            <button
              id="tab-btn-admin"
              onClick={() => setActiveTab('admin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Center</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Quota:</span>
            <span className="text-slate-300">
              {stats.userRole === 'free' ? `${stats.dailyRemaining} remaining` : 'Unlimited'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Forced Channel Membership Banner */}
        {!stats.channelVerified && (
          <div className="bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 border border-sky-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center shrink-0 mt-0.5 text-sky-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-white">Channel Membership Required</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono border border-sky-500/30">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Bot aur search features use karne ke liye pehle official channel <span className="text-sky-300 font-medium">@RehuSzr</span> join karein aur verify karein.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <a
                href={config.channelLink || "https://t.me/rehuszr"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Join @RehuSzr</span>
              </a>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/verify-channel', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: 'web_client' }),
                    });
                    const d = await res.json();
                    if (d.success) {
                      setNotification("🎉 Channel membership verified! Bot is now unlocked.");
                      fetchStats();
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify Joined</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'lookup' && (
          <>
            {/* Category Selector Grid */}
            <LookupGrid
              selectedType={selectedType}
              buttons={buttons}
              onSelectType={(type) => {
                setSelectedType(type);
                setQuery('');
              }}
            />

            {/* Search Input Bar */}
            <SearchInput
              currentOption={currentOption}
              query={query}
              onChange={setQuery}
              onSearch={() => handleSearch()}
              isLoading={isLoading}
              error={error}
            />

            {/* Result Display */}
            <ResultViewer result={result} isLoading={isLoading} />
          </>
        )}

        {activeTab === 'telegram' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TelegramSimulator
                onTriggerLookup={handleTriggerFromTelegram}
                channelVerified={stats.channelVerified}
                onVerified={fetchStats}
                buttons={buttons}
              />
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Bot Architecture</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  This shell mirrors the native Telegram Bot API commands. Lookups executed here are routed to the same high-speed intelligence backends.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <code className="text-indigo-300">/vehicle HR26EV0001</code>
                    <p className="text-slate-400 text-[11px] mt-0.5">Vehicle RC & technical specifications</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <code className="text-cyan-300">/num2 6399964669</code>
                    <p className="text-slate-400 text-[11px] mt-0.5">Telecom operator & location record</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <code className="text-emerald-300">/redeem VIP2026XYZ</code>
                    <p className="text-slate-400 text-[11px] mt-0.5">Upgrade quota to unlimited</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            stats={stats}
            config={config}
            onRefreshStats={fetchStats}
            onButtonsUpdated={fetchButtons}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {config.botName} v{config.botVersion} • Developed by{' '}
            <a href={config.developerLink} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white underline">
              {config.developer}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href={config.channelLink} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">
              Telegram Channel
            </a>
            <span>•</span>
            <a href={`https://t.me/${config.supportGroup.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">
              Support
            </a>
          </div>
        </div>
      </footer>

      {/* Redeem Modal */}
      <RedeemModal
        isOpen={isRedeemOpen}
        onClose={() => setIsRedeemOpen(false)}
        onRedeemSuccess={handleRedeemSuccess}
      />
    </div>
  );
}
