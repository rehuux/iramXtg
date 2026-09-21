import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Zap,
  Users,
  Radio,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import type { BotConfig } from '../../types';

interface SystemSettingsTabProps {
  config: BotConfig;
  onRefreshStats: () => void;
}

export const SystemSettingsTab: React.FC<SystemSettingsTabProps> = ({ config, onRefreshStats }) => {
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState<number>(40);
  const [freeDailyLimit, setFreeDailyLimit] = useState<number>(20);
  const [referralBonusPerUser, setReferralBonusPerUser] = useState<number>(10);
  const [officialGroupId, setOfficialGroupId] = useState<string>('-1002164265666');
  const [officialGroupUrl, setOfficialGroupUrl] = useState<string>('https://t.me/lookupXchat');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        if (data.settings.autoDeleteSeconds) setAutoDeleteSeconds(data.settings.autoDeleteSeconds);
        if (data.settings.freeDailyLimit) setFreeDailyLimit(data.settings.freeDailyLimit);
        if (data.settings.referralBonusPerUser) setReferralBonusPerUser(data.settings.referralBonusPerUser);
        if (data.settings.officialGroupId) setOfficialGroupId(data.settings.officialGroupId);
        if (data.settings.officialGroupUrl) setOfficialGroupUrl(data.settings.officialGroupUrl);
      }
    } catch (e) {
      console.warn('Failed to fetch settings', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoDeleteSeconds,
          freeDailyLimit,
          referralBonusPerUser,
          officialGroupId,
          officialGroupUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: data.message || 'System settings saved successfully!' });
        onRefreshStats();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Network error while saving settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <span>Group Parameters & Global Quotas</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                Live Configuration
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust group auto-delete destruct delay, daily free quotas, referral bonuses, and official group binding.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Parameters</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs ${
          feedback.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/15 border-red-500/30 text-red-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section: Auto-Delete Group Destruct Timer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Group Auto-Delete Destruct Delay (All Messages)</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Telegram group mein aane wala <strong className="text-amber-300">har ek message</strong> (user chat, images, stickers, search queries, aur bot ka diya hua result report) theek itne seconds ke baad group se automatically delete ho jayega:
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {[10, 20, 30, 40, 60, 120].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setAutoDeleteSeconds(sec)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  autoDeleteSeconds === sec
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span>{sec} Seconds</span>
                {sec === 40 && <span className="text-[10px] opacity-75">(Default)</span>}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">Custom (Seconds):</span>
              <input
                id="settings-autodelete-input"
                type="number"
                min="5"
                max="600"
                value={autoDeleteSeconds}
                onChange={(e) => setAutoDeleteSeconds(Math.max(5, Math.min(600, parseInt(e.target.value, 10) || 40)))}
                className="w-24 bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-2 rounded-xl focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section: Search Quotas & Referral Rewards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-slate-800 pb-3">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Daily Free Searches & Referral Rewards</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Default Free Searches Per Day (Per User)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="settings-daily-limit-input"
                  type="number"
                  min="1"
                  max="1000"
                  value={freeDailyLimit}
                  onChange={(e) => setFreeDailyLimit(Math.max(1, parseInt(e.target.value, 10) || 20))}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3.5 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400 whitespace-nowrap">lookups / day</span>
              </div>
              <p className="text-[11px] text-slate-500">Resets automatically every midnight at 12:00 AM.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Bonus Daily Searches Per Referral
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="settings-referral-bonus-input"
                  type="number"
                  min="0"
                  max="200"
                  value={referralBonusPerUser}
                  onChange={(e) => setReferralBonusPerUser(Math.max(0, parseInt(e.target.value, 10) || 10))}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3.5 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400 whitespace-nowrap">+credits / user</span>
              </div>
              <p className="text-[11px] text-slate-500">Jab koi user naye friend ko refer karega toh uski daily limit badh jayegi.</p>
            </div>
          </div>
        </div>

        {/* Section: Official Telegram Group Binding */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-slate-800 pb-3">
            <Radio className="w-4 h-4 text-sky-400" />
            <span>Official Group Isolation Protocol</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Authorized Telegram Group ID
              </label>
              <input
                id="settings-group-id-input"
                type="text"
                value={officialGroupId}
                onChange={(e) => setOfficialGroupId(e.target.value)}
                placeholder="-1002164265666"
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3.5 py-2.5 rounded-xl focus:border-sky-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">Bot is group ke bahar lookups block karta hai.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Official Group Invite Link
              </label>
              <input
                id="settings-group-url-input"
                type="text"
                value={officialGroupUrl}
                onChange={(e) => setOfficialGroupUrl(e.target.value)}
                placeholder="https://t.me/lookupXchat"
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3.5 py-2.5 rounded-xl focus:border-sky-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">DM blocked hone par bot user ko ye link deta hai.</p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            id="settings-save-btn"
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Applying Settings...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save System Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
