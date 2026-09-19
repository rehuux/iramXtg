import React, { useState } from 'react';
import { X, KeyRound, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';

interface RedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedeemSuccess: (message: string) => void;
}

export const RedeemModal: React.FC<RedeemModalProps> = ({ isOpen, onClose, onRedeemSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid or expired redeem code.');
      } else {
        setSuccessMsg(data.message || 'Code successfully redeemed! Premium unlocked.');
        onRedeemSuccess(data.message);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reach redeem server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
        <button
          id="close-redeem-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 border border-cyan-500/20">
          <KeyRound className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">Redeem Premium Code</h3>
        <p className="text-xs text-slate-400 mb-5">
          Enter your 12-character license key or promo voucher code to unlock unlimited searches and access priority nodes.
        </p>

        {successMsg ? (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 text-center">
            <Check className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-emerald-300">{successMsg}</div>
            <p className="text-xs text-emerald-400/80 mt-1">Unlimited searches are now active.</p>
          </div>
        ) : (
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Voucher Code
              </label>
              <input
                id="redeem-code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="IRAM-XXXX-XXXX"
                className="w-full bg-slate-950 text-white uppercase font-mono tracking-widest px-4 py-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-sm"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-lg p-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-redeem-btn"
                type="submit"
                disabled={!code.trim() || loading}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Activate</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
