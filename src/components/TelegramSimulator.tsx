import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles, Terminal, Copy, Check } from 'lucide-react';
import type { LookupType } from '../types';

interface Message {
  sender: 'bot' | 'user';
  text: string;
  time: string;
}

const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  // Check if text has ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\n([\s\S]*?)\n?```/i;
  const match = text.match(codeBlockRegex);

  if (match) {
    const beforeText = text.slice(0, match.index).trim();
    const codeContent = match[1];
    const afterText = text.slice((match.index || 0) + match[0].length).trim();

    const handleCopy = () => {
      navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="space-y-2">
        {beforeText && <div className="leading-relaxed whitespace-pre-wrap">{beforeText}</div>}
        <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950/95 shadow-inner my-1">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-[10px] text-slate-300 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              API RAW JSON
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/70 hover:bg-slate-600 text-slate-200 hover:text-white transition cursor-pointer text-[10px]"
              title="Copy Raw JSON"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 text-[11px] leading-relaxed font-mono overflow-x-auto text-emerald-300/90 selection:bg-emerald-900 selection:text-white scrollbar-thin">
            {codeContent}
          </pre>
        </div>
        {afterText && <div className="leading-relaxed whitespace-pre-wrap">{afterText}</div>}
      </div>
    );
  }

  return <div className="leading-relaxed whitespace-pre-wrap font-mono">{text}</div>;
};

interface TelegramSimulatorProps {
  onTriggerLookup: (type: LookupType, query: string) => void;
  channelVerified?: boolean;
  onVerified?: () => void;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  onTriggerLookup,
  channelVerified = false,
  onVerified,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: `🤖 *iramX v7.3* — OSINT Intelligence Bot\n══════════════════════════\n  Welcome to the Telegram Interactive Shell!\n  Tap "📱 Mobile Lookup" or any button below.\n· · · · · · · · · · · · · · · · · · · · · · · · ·\n  📢 Channel: @RehuSzr\n  💎 Unlimited queries for Premium users\n  💡 Free Limit: 20 searches/day`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isVerified, setIsVerified] = useState(channelVerified);
  const [awaitingInput, setAwaitingInput] = useState<string | null>(null);
  const [placeholderText, setPlaceholderText] = useState('Tap 📱 Num2 Lookup or send command...');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsVerified(channelVerified);
  }, [channelVerified]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput('');
    setIsBotTyping(true);

    try {
      const res = await fetch('/api/telegram-sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, verified: isVerified }),
      });
      const data = await res.json();

      setIsBotTyping(false);

      if (data.verified) {
        setIsVerified(true);
        if (onVerified) onVerified();
      }

      if (data.awaitingInput) {
        setAwaitingInput(data.pendingAction || 'input');
        if (data.placeholder) {
          setPlaceholderText(data.placeholder);
        } else if (data.pendingAction === 'num2') {
          setPlaceholderText('Enter 10-digit mobile number (e.g. 6399964669)...');
        } else {
          setPlaceholderText('Enter requested input or ❌ Cancel...');
        }
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setAwaitingInput(null);
        setPlaceholderText('Tap 📱 Num2 Lookup or send command...');
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: data.reply || 'Command processed.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (data.lookupType && data.lookupQuery) {
        onTriggerLookup(data.lookupType, data.lookupQuery);
      }
    } catch (err) {
      setIsBotTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '⚠️ Communication error with bot engine.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

interface SimButton {
  label: string;
  text: string;
  primary?: boolean;
  cancel?: boolean;
  admin?: boolean;
}

  const defaultButtons: SimButton[] = [
    { label: '📱 Mobile Lookup', text: '📱 Mobile Lookup', primary: true },
    { label: '🚗 Vehicle Lookup', text: '🚗 Vehicle Lookup', primary: false },
    { label: '🪪 Aadhaar Info', text: '🪪 Aadhaar Info', primary: false },
    { label: '👨‍👩‍👧 Family Tree', text: '👨‍👩‍👧 Family Tree', primary: false },
    { label: '🗳️ Voter Lookup', text: '🗳️ Voter Lookup', primary: false },
    { label: '🔥 LPG Gas Lookup', text: '🔥 LPG Gas Lookup', primary: false },
    { label: '💳 UPI Lookup', text: '💳 UPI Lookup', primary: false },
    { label: '🏢 GST by Name', text: '🏢 GST by Name', primary: false },
    { label: '🪪 GST by PAN', text: '🪪 GST by PAN', primary: false },
    { label: '📄 GST Details', text: '📄 GST Details', primary: false },
    { label: '👑 Admin Control Panel', text: '👑 Admin Control Panel', admin: true },
    { label: '👥 Refer & Earn', text: '👥 Refer & Earn', primary: false },
    { label: '💎 Redeem Code', text: '💎 Redeem Code', primary: false },
    { label: '📊 My Profile', text: '📊 My Profile', primary: false },
    { label: '❓ Help Guide', text: '❓ Help Guide', primary: false },
    { label: '✅ Verify Joined', text: '✅ Verify Joined', primary: false },
  ];

  const pendingButtons: Record<string, SimButton[]> = {
    num2: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '📱 6399964669 (Demo)', text: '6399964669', primary: true },
      { label: '📱 9876543210', text: '9876543210' },
      { label: '📱 8800123456', text: '8800123456' },
    ],
    vehicle: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '🚗 HR26EV0001 (Demo)', text: 'HR26EV0001', primary: true },
      { label: '🚗 DL01AB1234', text: 'DL01AB1234' },
      { label: '🚗 MH02CD5678', text: 'MH02CD5678' },
    ],
    voter: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '🗳️ ZNO1150077 (Demo)', text: 'ZNO1150077', primary: true },
      { label: '🗳️ ABC1234567', text: 'ABC1234567' },
    ],
    aadhar2info: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '🪪 123456789012 (Demo)', text: '123456789012', primary: true },
    ],
    aadhar2family: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '👪 123456789012 (Demo)', text: '123456789012', primary: true },
    ],
    lpg: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '🔥 9876543210 (Demo)', text: '9876543210', primary: true },
    ],
    upi2num: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '💳 test@okhdfcbank', text: 'test@okhdfcbank', primary: true },
    ],
    redeem: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
    ],
    gst2name: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '🏢 Reliance (Demo)', text: 'Reliance', primary: true },
      { label: '🏢 Tata Motors', text: 'Tata Motors' },
    ],
    gst2pan: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '🪪 AAACF5317Q (Demo)', text: 'AAACF5317Q', primary: true },
    ],
    gst: [
      { label: '❌ Cancel', text: '❌ Cancel', cancel: true },
      { label: '📄 27AAACF5317Q1ZA (Demo)', text: '27AAACF5317Q1ZA', primary: true },
    ],
  };

  const currentButtons = awaitingInput && pendingButtons[awaitingInput]
    ? [...pendingButtons[awaitingInput], ...defaultButtons]
    : defaultButtons;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            IX
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>iramX Bot</span>
              <span className="text-[10px] text-emerald-400 font-mono">bot</span>
            </div>
            <div className="text-[10px] text-slate-400">@rehuXosint_bot</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isVerified ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Channel Joined
            </span>
          ) : (
            <a
              href="https://t.me/rehuszr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1 font-mono hover:bg-sky-500/30 transition"
              title="Join Channel @RehuSzr"
            >
              <span>Join @RehuSzr</span>
            </a>
          )}

          <button
            onClick={() =>
              setMessages([
                {
                  sender: 'bot',
                  text: 'Bot session refreshed. Type /help or tap a button below.',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ])
            }
            className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
            title="Reset chat"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 max-w-[88%] ${
              m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                m.sender === 'user' ? 'bg-cyan-600 text-white' : 'bg-indigo-600 text-white'
              }`}
            >
              {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div
              className={`rounded-2xl p-3 shadow-md ${
                m.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none font-mono max-w-full overflow-hidden'
              }`}
            >
              <MessageContent text={m.text} />
              <div
                className={`text-[9px] mt-1 text-right ${
                  m.sender === 'user' ? 'text-cyan-200' : 'text-slate-500'
                }`}
              >
                {m.time}
              </div>
            </div>
          </div>
        ))}

        {isBotTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
            <span>iramX is typing...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Active Awaiting Input Banner */}
      {awaitingInput && (
        <div className="bg-amber-500/10 border-t border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Waiting for input: <strong className="uppercase">{awaitingInput}</strong></span>
          </div>
          <button
            onClick={() => handleSend("❌ Cancel")}
            className="text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 cursor-pointer transition font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Keyboard shortcuts */}
      <div className="bg-slate-950/80 px-3 py-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
        {currentButtons.map((btn, i) => (
          <button
            key={i}
            onClick={() => handleSend(btn.text)}
            className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition cursor-pointer font-medium flex items-center gap-1 ${
              btn.cancel
                ? 'bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300'
                : btn.admin
                ? 'bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-semibold shadow-sm'
                : btn.primary
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholderText}
          className={`flex-1 bg-slate-900 text-white placeholder-slate-500 px-3.5 py-2.5 rounded-xl border text-xs transition ${
            awaitingInput
              ? 'border-indigo-500 ring-1 ring-indigo-500/50'
              : 'border-slate-800 focus:outline-none focus:border-indigo-500'
          }`}
        />
        <button
          type="submit"
          disabled={!input.trim() || isBotTyping}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
