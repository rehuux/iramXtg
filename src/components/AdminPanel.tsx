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
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Edit3,
  Plus,
  Trash2,
  Sliders,
  CheckCircle,
  Database,
  Terminal,
  Code,
  MessageSquare,
  Lock,
  Unlock,
  UserCheck,
  UserPlus,
  Shield,
  TestTube,
  Settings2,
  Activity,
  Filter,
  Download,
  Layers,
  Zap,
  SlidersHorizontal,
  X,
  RotateCcw,
  Image as ImageIcon,
  UploadCloud,
  Link as LinkIcon
} from 'lucide-react';
import type { StatsData, BotConfig, RedeemCode, BotButton, BotUser } from '../types';
import { AdminGate } from './admin/AdminGate';
import { ApiTesterTab } from './admin/ApiTesterTab';
import { SystemSettingsTab } from './admin/SystemSettingsTab';
import { AuditLogsTab } from './admin/AuditLogsTab';

interface AdminPanelProps {
  stats: StatsData;
  config: BotConfig;
  onRefreshStats: () => void;
  onButtonsUpdated?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats, config, onRefreshStats, onButtonsUpdated }) => {
  // Master Entrance Gate Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('iramx_admin_auth') === 'true';
  });

  // Admin Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'buttons' | 'playground' | 'users' | 'settings' | 'codes' | 'logs' | 'database'>('buttons');

  // Confirmation Modal State (replaces blocked window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmStyle?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Custom user limit editor state
  const [editingCustomLimitUser, setEditingCustomLimitUser] = useState<BotUser | null>(null);
  const [customLimitInput, setCustomLimitInput] = useState<number>(0);

  // Button filtering & search state
  const [buttonCategoryFilter, setButtonCategoryFilter] = useState<string>('all');
  const [buttonSearchQuery, setButtonSearchQuery] = useState<string>('');

  // Code filtering & broadcast target & media
  const [codeFilter, setCodeFilter] = useState<'all' | 'active' | 'claimed'>('all');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'vip' | 'free' | 'dm'>('all');
  const [broadcastImageUrl, setBroadcastImageUrl] = useState<string>('');
  const [broadcastImagePreview, setBroadcastImagePreview] = useState<string | null>(null);
  const [broadcastImageMode, setBroadcastImageMode] = useState<'url' | 'upload'>('url');

  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dynamic Buttons Management State
  const [buttons, setButtons] = useState<BotButton[]>([]);
  const [loadingButtons, setLoadingButtons] = useState(false);
  const [editingButtonId, setEditingButtonId] = useState<string | null>(null);
  const [editApiUrl, setEditApiUrl] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editPlaceholder, setEditPlaceholder] = useState('');
  const [editDailyLimit, setEditDailyLimit] = useState<number>(0);
  const [savingButton, setSavingButton] = useState(false);
  const [buttonActionMsg, setButtonActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Button Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newApiUrl, setNewApiUrl] = useState('');
  const [newCategory, setNewCategory] = useState<'vehicles' | 'identity' | 'telecom' | 'business' | 'custom'>('custom');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newExample, setNewExample] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDailyLimit, setNewDailyLimit] = useState<number>(0);
  const [addingButton, setAddingButton] = useState(false);

  // User & DM Permission Management State
  const [users, setUsers] = useState<BotUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newUserId, setNewUserId] = useState('');
  const [newUserRole, setNewUserRole] = useState<'free' | 'premium' | 'admin'>('free');
  const [newUserAllowDm, setNewUserAllowDm] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'dm_allowed' | 'group_only' | 'vip'>('all');

  // SQL Modal / View State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  const fetchButtons = async () => {
    setLoadingButtons(true);
    try {
      const res = await fetch('/api/buttons');
      const data = await res.json();
      if (data.buttons) {
        setButtons(data.buttons);
      }
    } catch (err) {
      console.error('Failed to load buttons', err);
    } finally {
      setLoadingButtons(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleDm = async (userId: string, currentAllowDm: boolean) => {
    try {
      const res = await fetch('/api/admin/users/allow-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, allowDm: !currentAllowDm }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, allowDm: !currentAllowDm } : u))
        );
        setUserActionMsg({
          type: 'success',
          text: `User ${userId} DM access is now ${!currentAllowDm ? 'ALLOWED (Active in DM)' : 'DISABLED (Group only)'}.`,
        });
      } else {
        setUserActionMsg({ type: 'error', text: data.error || 'Failed to toggle DM.' });
      }
    } catch (e: any) {
      setUserActionMsg({ type: 'error', text: e.message || 'Error updating DM access.' });
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, role: newRole as any, allowDm: newRole === 'admin' ? true : u.allowDm } : u))
        );
        setUserActionMsg({
          type: 'success',
          text: `User ${userId} role changed to ${newRole.toUpperCase()}.`,
        });
      }
    } catch (e: any) {
      setUserActionMsg({ type: 'error', text: e.message || 'Error updating user role.' });
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;
    setAddingUser(true);
    setUserActionMsg(null);
    try {
      const res = await fetch('/api/admin/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUserId.trim(),
          role: newUserRole,
          allowDm: newUserAllowDm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUserActionMsg({
          type: 'success',
          text: `User ${newUserId.trim()} successfully configured with DM = ${newUserAllowDm ? 'ALLOWED' : 'DISABLED'}.`,
        });
        setNewUserId('');
        fetchUsers();
      } else {
        setUserActionMsg({ type: 'error', text: data.error || 'Failed to register user.' });
      }
    } catch (e: any) {
      setUserActionMsg({ type: 'error', text: e.message || 'Error registering user.' });
    } finally {
      setAddingUser(false);
    }
  };

  const handleResetUserSearches = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users/reset-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setUserActionMsg({ type: 'success', text: `Daily searches for user ${userId} reset to 0!` });
        fetchUsers();
      } else {
        setUserActionMsg({ type: 'error', text: data.error || 'Failed to reset searches.' });
      }
    } catch (e: any) {
      setUserActionMsg({ type: 'error', text: e.message || 'Error resetting searches.' });
    }
  };

  const handleAddBonusSearches = async (userId: string, amount: number = 10) => {
    try {
      const res = await fetch('/api/admin/users/add-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount }),
      });
      const data = await res.json();
      if (data.success) {
        setUserActionMsg({ type: 'success', text: `Added +${amount} searches to user ${userId}!` });
        fetchUsers();
      } else {
        setUserActionMsg({ type: 'error', text: data.error || 'Failed to add bonus searches.' });
      }
    } catch (e: any) {
      setUserActionMsg({ type: 'error', text: e.message || 'Error adding bonus.' });
    }
  };

  const handleDeleteUser = (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove User Record',
      message: `Are you sure you want to delete user ID ${userId}? Their daily quotas and settings will be permanently erased.`,
      confirmLabel: 'Delete User',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/admin/users/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          const data = await res.json();
          if (data.success) {
            setUserActionMsg({ type: 'success', text: `User ${userId} deleted.` });
            setUsers((prev) => prev.filter((u) => u.userId !== userId));
          } else {
            setUserActionMsg({ type: 'error', text: data.error || 'Failed to delete user.' });
          }
        } catch (e: any) {
          setUserActionMsg({ type: 'error', text: e.message || 'Error deleting user.' });
        }
      },
    });
  };

  const handleResetAllUsers = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset All Users Daily Searches',
      message: 'Are you sure you want to reset today\'s search counters to 0 for ALL users? This grants everyone a fresh daily quota immediately.',
      confirmLabel: 'Reset All Quotas',
      confirmStyle: 'warning',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/admin/users/reset-all-daily', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            setUserActionMsg({ type: 'success', text: data.message });
            fetchUsers();
          }
        } catch (e: any) {
          setUserActionMsg({ type: 'error', text: e.message || 'Error resetting users.' });
        }
      },
    });
  };

  const handleSaveCustomLimit = async () => {
    if (!editingCustomLimitUser) return;
    try {
      const res = await fetch('/api/admin/users/set-custom-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingCustomLimitUser.userId,
          customLimit: customLimitInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUserActionMsg({ type: 'success', text: data.message });
        setEditingCustomLimitUser(null);
        fetchUsers();
      } else {
        setUserActionMsg({ type: 'error', text: data.error || 'Failed to set limit' });
      }
    } catch (e: any) {
      setUserActionMsg({ type: 'error', text: e.message || 'Error setting custom limit.' });
    }
  };

  const handleToggleButton = async (btn: BotButton) => {
    try {
      const res = await fetch('/api/admin/buttons/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: btn.id, enabled: !btn.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setButtons((prev) =>
          prev.map((b) => (b.id === btn.id ? { ...b, enabled: !b.enabled } : b))
        );
        setButtonActionMsg({
          type: 'success',
          text: `"${btn.label}" button is now ${!btn.enabled ? 'ON (Active)' : 'OFF (Disabled)'}.`,
        });
        if (onButtonsUpdated) onButtonsUpdated();
      } else {
        setButtonActionMsg({ type: 'error', text: data.error || 'Failed to toggle button.' });
      }
    } catch (e: any) {
      setButtonActionMsg({ type: 'error', text: e.message || 'Error toggling button.' });
    }
  };

  const handleStartEdit = (btn: BotButton) => {
    setEditingButtonId(btn.id);
    setEditLabel(btn.label);
    setEditApiUrl(btn.apiUrl || '');
    setEditPlaceholder(btn.placeholder || '');
    setEditDailyLimit(btn.dailyLimit !== undefined ? btn.dailyLimit : 0);
  };

  const handleSaveEdit = async (btnId: string) => {
    setSavingButton(true);
    setButtonActionMsg(null);
    try {
      const res = await fetch('/api/admin/buttons/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: btnId,
          label: editLabel.trim(),
          apiUrl: editApiUrl.trim(),
          placeholder: editPlaceholder.trim(),
          dailyLimit: Number(editDailyLimit) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setButtons((prev) =>
          prev.map((b) =>
            b.id === btnId
              ? {
                  ...b,
                  label: editLabel.trim(),
                  apiUrl: editApiUrl.trim(),
                  placeholder: editPlaceholder.trim(),
                  dailyLimit: Number(editDailyLimit) || 0,
                }
              : b
          )
        );
        setEditingButtonId(null);
        setButtonActionMsg({
          type: 'success',
          text: `Button "${editLabel.trim()}" name, API details & daily limit (${editDailyLimit > 0 ? editDailyLimit : 'Unlimited'}) updated successfully!`,
        });
        if (onButtonsUpdated) onButtonsUpdated();
      } else {
        setButtonActionMsg({ type: 'error', text: data.error || 'Failed to update button.' });
      }
    } catch (e: any) {
      setButtonActionMsg({ type: 'error', text: e.message || 'Error updating button.' });
    } finally {
      setSavingButton(false);
    }
  };

  const handleAddNewButton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newApiUrl.trim()) return;

    setAddingButton(true);
    setButtonActionMsg(null);
    try {
      const res = await fetch('/api/admin/buttons/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          apiUrl: newApiUrl.trim(),
          category: newCategory,
          placeholder: newPlaceholder.trim() || `Enter ${newLabel.trim()} query`,
          example: newExample.trim(),
          description: newDescription.trim() || `Custom OSINT lookup module for ${newLabel.trim()}`,
          dailyLimit: Number(newDailyLimit) || 0,
        }),
      });
      const data = await res.json();
      if (data.success && data.button) {
        setButtons((prev) => [...prev, data.button]);
        setNewLabel('');
        setNewApiUrl('');
        setNewPlaceholder('');
        setNewExample('');
        setNewDescription('');
        setNewDailyLimit(0);
        setShowAddForm(false);
        setButtonActionMsg({
          type: 'success',
          text: `🎉 New Button "${data.button.label}" added with daily limit ${data.button.dailyLimit > 0 ? data.button.dailyLimit : 'Unlimited'} and active on Telegram & Web!`,
        });
        if (onButtonsUpdated) onButtonsUpdated();
      } else {
        setButtonActionMsg({ type: 'error', text: data.error || 'Failed to add new button.' });
      }
    } catch (e: any) {
      setButtonActionMsg({ type: 'error', text: e.message || 'Error adding button.' });
    } finally {
      setAddingButton(false);
    }
  };

  const handleDeleteButton = (btn: BotButton) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete "${btn.label}" Button`,
      message: `Are you sure you want to permanently delete "${btn.label}" (${btn.id})? This will remove it from both the Telegram bot keyboard and the Web UI.`,
      confirmLabel: 'Delete Button',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`/api/admin/buttons/${btn.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            setButtons((prev) => prev.filter((b) => b.id !== btn.id));
            setButtonActionMsg({ type: 'success', text: `Button "${btn.label}" permanently deleted from Bot & Web.` });
            if (onButtonsUpdated) onButtonsUpdated();
          } else {
            setButtonActionMsg({ type: 'error', text: data.error || 'Failed to delete button.' });
          }
        } catch (e: any) {
          setButtonActionMsg({ type: 'error', text: e.message || 'Error deleting button.' });
        }
      },
    });
  };

  const handleRestoreDefaults = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Default Service Buttons',
      message: 'Are you sure you want to restore all original built-in lookup buttons? Any deleted default modules will be recreated.',
      confirmLabel: 'Restore Defaults',
      confirmStyle: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/admin/buttons/restore-defaults', { method: 'POST' });
          const data = await res.json();
          if (data.success && data.buttons) {
            setButtons(data.buttons);
            setButtonActionMsg({ type: 'success', text: 'All default service buttons restored successfully!' });
            if (onButtonsUpdated) onButtonsUpdated();
          }
        } catch (e: any) {
          setButtonActionMsg({ type: 'error', text: e.message || 'Failed to restore default buttons.' });
        }
      },
    });
  };

  const handleDeleteCode = (code: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Redeem Voucher',
      message: `Are you sure you want to revoke and delete code "${code}"? Users will no longer be able to claim it.`,
      confirmLabel: 'Revoke Code',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`/api/admin/codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            setCodes((prev) => prev.filter((c) => c.code !== code));
          }
        } catch (e) {
          console.warn('Failed to delete code', e);
        }
      },
    });
  };

  const handlePurgeClaimedCodes = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Purge Exhausted Codes',
      message: 'Are you sure you want to remove all fully claimed or exhausted voucher codes?',
      confirmLabel: 'Purge Codes',
      confirmStyle: 'warning',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/admin/codes/purge-claimed', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            fetchCodes();
          }
        } catch (e) {
          console.warn('Failed to purge codes', e);
        }
      },
    });
  };

  const sqlCode = `-- =========================================================
-- COMPLETE SUPABASE SQL SCHEMA FOR IRAMX OSINT TELEGRAM BOT
-- Copy & Run this in your Supabase SQL Editor:
-- =========================================================

-- 1. Users, Credits & DM Access Table
CREATE TABLE IF NOT EXISTS bot_users (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  first_name TEXT,
  role TEXT DEFAULT 'free',
  daily_searches INT DEFAULT 0,
  total_searches INT DEFAULT 0,
  channel_verified BOOLEAN DEFAULT false,
  referred_by TEXT,
  allow_dm BOOLEAN DEFAULT false,
  last_search_date TEXT,
  last_active TEXT,
  referral_count INT DEFAULT 0,
  referral_bonus_daily INT DEFAULT 0,
  custom_daily_limit INT DEFAULT 0,
  daily_button_usage JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Dynamic Bot Buttons & Custom APIs Table
CREATE TABLE IF NOT EXISTS bot_buttons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  api_url TEXT NOT NULL,
  placeholder TEXT DEFAULT '',
  example TEXT DEFAULT '',
  description TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 99,
  daily_limit INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Deleted Buttons Tracking Table (Ensures deleted buttons stay deleted across restarts)
CREATE TABLE IF NOT EXISTS bot_deleted_buttons (
  id TEXT PRIMARY KEY,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Vouchers / VIP Redeem Codes Table
CREATE TABLE IF NOT EXISTS bot_vouchers (
  code TEXT PRIMARY KEY,
  days INT DEFAULT 7,
  role TEXT DEFAULT 'premium',
  uses_left INT DEFAULT 1,
  total_uses INT DEFAULT 1,
  created_by TEXT DEFAULT 'admin',
  used_by JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Search / Query Audit Logs Table (Live query history)
CREATE TABLE IF NOT EXISTS bot_search_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  service TEXT,
  query TEXT,
  source TEXT,
  status TEXT,
  duration_ms INT DEFAULT 0,
  details TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Announcements & Broadcast History Table
CREATE TABLE IF NOT EXISTS bot_broadcasts (
  id BIGSERIAL PRIMARY KEY,
  message TEXT,
  photo_url TEXT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Bot System Settings Table (Daily limit, auto-delete, maintenance)
CREATE TABLE IF NOT EXISTS bot_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Referrals Table
CREATE TABLE IF NOT EXISTS bot_referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id TEXT,
  referred_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bot_users_user_id ON bot_users (user_id);
CREATE INDEX IF NOT EXISTS idx_bot_buttons_enabled ON bot_buttons (enabled);
CREATE INDEX IF NOT EXISTS idx_bot_buttons_sort ON bot_buttons (sort_order);
CREATE INDEX IF NOT EXISTS idx_bot_search_logs_user_id ON bot_search_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_bot_search_logs_created_at ON bot_search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_vouchers_uses ON bot_vouchers (uses_left);

-- Enable Row Level Security (RLS)
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_deleted_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All bot_users" ON bot_users FOR ALL USING (true);
CREATE POLICY "Allow All bot_buttons" ON bot_buttons FOR ALL USING (true);
CREATE POLICY "Allow All bot_deleted_buttons" ON bot_deleted_buttons FOR ALL USING (true);
CREATE POLICY "Allow All bot_vouchers" ON bot_vouchers FOR ALL USING (true);
CREATE POLICY "Allow All bot_search_logs" ON bot_search_logs FOR ALL USING (true);
CREATE POLICY "Allow All bot_broadcasts" ON bot_broadcasts FOR ALL USING (true);
CREATE POLICY "Allow All bot_settings" ON bot_settings FOR ALL USING (true);
CREATE POLICY "Allow All bot_referrals" ON bot_referrals FOR ALL USING (true);
`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

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
    fetchButtons();
    fetchUsers();
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
    if (!announcementMsg.trim() && !broadcastImageUrl.trim()) return;

    setSendingAnnouncement(true);
    setAnnouncementSuccess(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: announcementMsg.trim(),
          target: broadcastTarget,
          imageUrl: broadcastImageUrl.trim() || undefined
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnnouncementSuccess(data.message || 'Announcement broadcasted successfully!');
        setAnnouncementMsg('');
        setBroadcastImageUrl('');
        setBroadcastImagePreview(null);
      } else {
        setAnnouncementSuccess(data.error || 'Failed to broadcast announcement.');
      }
    } catch (err: any) {
      console.error('Failed to broadcast announcement', err);
      setAnnouncementSuccess(err.message || 'Failed to broadcast announcement.');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Image exceeds 15MB limit. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBroadcastImageUrl(dataUrl);
      setBroadcastImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBroadcastImage = () => {
    setBroadcastImageUrl('');
    setBroadcastImagePreview(null);
  };

  const handleCopyAllActiveCodes = () => {
    const active = codes.filter(c => c.usesLeft > 0).map(c => c.code).join('\n');
    if (!active) return;
    navigator.clipboard.writeText(active);
    setCopiedCode('ALL_ACTIVE');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isAuthenticated) {
    return (
      <AdminGate
        stats={stats}
        config={config}
        onUnlock={() => setIsAuthenticated(true)}
      />
    );
  }

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

        <div className="flex items-center gap-2">
          <button
            id="admin-refresh-stats-btn"
            onClick={() => {
              onRefreshStats();
              fetchCodes();
              fetchButtons();
              fetchUsers();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh All</span>
          </button>

          <button
            id="admin-lock-session-btn"
            onClick={() => {
              sessionStorage.removeItem('iramx_admin_auth');
              setIsAuthenticated(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-medium transition cursor-pointer"
            title="Lock Admin Session"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
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

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('buttons')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'buttons'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Buttons & APIs ({buttons.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('playground')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'playground'
              ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <TestTube className="w-3.5 h-3.5" />
          <span>Live API Tester</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200">New</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & DM Whitelist ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'settings'
              ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Group & System Settings</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/30 text-sky-200">New</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('codes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'codes'
              ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Redeem Codes & Broadcast</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logs')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-rose-400" />
          <span>Live Logs & Queries</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('database')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            activeSubTab === 'database'
              ? 'bg-slate-700 text-white font-bold'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database & Daemon</span>
        </button>
      </div>

      {/* Codes Tab Content */}
      {activeSubTab === 'codes' && (
        <div className="space-y-6">
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

        {/* Codes Filter & Batch Actions Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCodeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                codeFilter === 'all'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Codes ({codes.length})
            </button>
            <button
              type="button"
              onClick={() => setCodeFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                codeFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🟢 Active ({codes.filter(c => c.usesLeft > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setCodeFilter('claimed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                codeFilter === 'claimed'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🔴 Claimed ({codes.filter(c => c.usesLeft === 0).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllActiveCodes}
              disabled={codes.filter(c => c.usesLeft > 0).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
            >
              {copiedCode === 'ALL_ACTIVE' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied All!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy All Active</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePurgeClaimedCodes}
              disabled={codes.filter(c => c.usesLeft === 0).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-300 border border-rose-500/30 text-xs font-medium transition cursor-pointer"
              title="Remove exhausted/claimed codes"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Claimed</span>
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
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(() => {
                const filteredCodes = codes.filter((c) => {
                  if (codeFilter === 'active') return c.usesLeft > 0;
                  if (codeFilter === 'claimed') return c.usesLeft === 0;
                  return true;
                });

                if (filteredCodes.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500">
                        {loadingCodes ? 'Loading vouchers...' : 'No codes matching the active filter. Generate one above.'}
                      </td>
                    </tr>
                  );
                }

                return filteredCodes.map((c) => (
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
                      <div className="flex items-center justify-end gap-1.5">
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
                        <button
                          onClick={() => handleDeleteCode(c.code)}
                          className="p-1 rounded bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 border border-rose-800/40 transition cursor-pointer"
                          title="Revoke / Delete Code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Targeted Broadcast Announcement */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Broadcast Official Announcement</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Send segmented announcements, updates, or maintenance notices directly to Telegram users.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Audience:</span>
            <select
              value={broadcastTarget}
              onChange={(e) => setBroadcastTarget(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-white text-xs px-3 py-1.5 rounded-xl focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">📢 All Registered Users ({users.length})</option>
              <option value="vip">💎 VIP Members Only ({users.filter(u => u.role === 'premium').length})</option>
              <option value="free">👤 Free Tier Only ({users.filter(u => u.role === 'free').length})</option>
              <option value="dm">💬 DM Whitelisted Users ({users.filter(u => u.allowDm || u.role === 'admin').length})</option>
            </select>
          </div>
        </div>

        {/* Quick Announcement Templates */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Templates:</span>
          {[
            {
              name: '🛠️ Maintenance',
              msg: '⚠️ SCHEDULED MAINTENANCE NOTICE\n\nBot services will undergo brief performance upgrades for approximately 15 minutes. Searches may be slightly delayed. Normal operations will resume shortly!',
            },
            {
              name: '🚀 New Services',
              msg: '🔥 EXCITING UPDATE!\n\nNew registry search APIs and lookup features are now live in the bot! You can now query faster and get instant results. Try them now!',
            },
            {
              name: '🎁 Bonus Quota',
              msg: '🎉 SPECIAL BONUS ACTIVE!\n\nAll active users have received +10 bonus lookup searches for today! Check your balance anytime with /stats.',
            },
            {
              name: '👥 Join Group',
              msg: `📢 JOIN OFFICIAL COMMUNITY\n\nGet fastest lookup results, 24/7 support, and daily VIP code drops in our official group:\n👉 ${config.channelLink || 'https://t.me/lookupXchat'}`,
            },
          ].map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => setAnnouncementMsg(tpl.msg)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] transition cursor-pointer"
            >
              {tpl.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleBroadcastAnnouncement} className="space-y-3.5">
          <textarea
            id="broadcast-message-textarea"
            rows={3}
            value={announcementMsg}
            onChange={(e) => setAnnouncementMsg(e.target.value)}
            placeholder="Type your official announcement here (supports markdown and emojis)..."
            className="w-full bg-slate-950 text-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
          />

          {/* Media / Image Attachment Card */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Attach Image to Broadcast (Optional)</span>
                {broadcastImagePreview && (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    Ready to send
                  </span>
                )}
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBroadcastImageMode('url')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                    broadcastImageMode === 'url'
                      ? 'bg-sky-600 text-white font-medium shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>Image URL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastImageMode('upload')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                    broadcastImageMode === 'upload'
                      ? 'bg-sky-600 text-white font-medium shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UploadCloud className="w-3 h-3" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            {/* Input by Mode */}
            {broadcastImageMode === 'url' ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={broadcastImageUrl.startsWith('data:') ? '' : broadcastImageUrl}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setBroadcastImageUrl(val);
                      setBroadcastImagePreview(val || null);
                    }}
                    placeholder="https://example.com/banner.jpg or https://i.imgur.com/..."
                    className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded-lg focus:border-sky-500 focus:outline-none font-mono"
                  />
                  {broadcastImageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveBroadcastImage}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs flex items-center gap-1 transition cursor-pointer"
                      title="Clear image"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Tip: Paste any direct image URL (JPEG, PNG, WEBP, etc.) from Imgur, Telegram CDN, or your host.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer transition">
                    <UploadCloud className="w-4 h-4 text-sky-400" />
                    <span>Choose Image from Device</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {broadcastImagePreview && (
                    <button
                      type="button"
                      onClick={handleRemoveBroadcastImage}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                  <span className="text-[11px] text-slate-500">
                    Supports JPG, PNG, WEBP, GIF up to 15MB.
                  </span>
                </div>
              </div>
            )}

            {/* Live Image Preview Banner */}
            {broadcastImagePreview && (
              <div className="mt-2 p-2 rounded-xl bg-slate-900/90 border border-sky-500/30 flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0 relative group">
                  <img
                    src={broadcastImagePreview}
                    alt="Broadcast attachment preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Image Attached</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Will be delivered with photo caption directly to recipient's Telegram chat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveBroadcastImage}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Remove image attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {announcementSuccess ? (
              <span className="text-xs text-emerald-400 font-medium">{announcementSuccess}</span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Target: <strong className="text-emerald-400 uppercase">{broadcastTarget}</strong> audience
                {broadcastImageUrl ? ' • 🖼️ with image' : ''}.
              </span>
            )}

            <button
              id="send-announcement-btn"
              type="submit"
              disabled={(!announcementMsg.trim() && !broadcastImageUrl.trim()) || sendingAnnouncement}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {sendingAnnouncement
                  ? 'Broadcasting...'
                  : broadcastImageUrl
                  ? `Broadcast Photo + Text (${broadcastTarget.toUpperCase()})`
                  : `Broadcast to ${broadcastTarget.toUpperCase()}`}
              </span>
            </button>
          </div>
        </form>
      </div>
        </div>
      )}

      {/* Buttons Tab Content */}
      {activeSubTab === 'buttons' && (
        <div className="space-y-6">
          {/* Section: Dynamic Button & API Management (Admin Control) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">Bot Buttons & Custom APIs Manager</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rename any button label, turn buttons ON/OFF (disabled buttons stay visible to users but show a disabled message), update API endpoints, or add custom OSINT buttons in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
              title="Restore all default built-in buttons if any were deleted"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
              <span>Restore Defaults</span>
            </button>
            <button
              onClick={() => setShowSqlModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>SQL Commands</span>
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Close Form' : 'Add New Button'}</span>
            </button>
          </div>
        </div>

        {/* Action message banner */}
        {buttonActionMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
              buttonActionMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{buttonActionMsg.text}</span>
            <button onClick={() => setButtonActionMsg(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Add New Button Form */}
        {showAddForm && (
          <form onSubmit={handleAddNewButton} className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Custom Button & API
              </span>
              <span className="text-[11px] text-slate-400">Instantly appears on Telegram Keyboard & Web</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Button Label (Text + Emoji):</label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. 🔍 IMEI Tracker or 💳 PAN Details"
                  className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Category:</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="custom">Custom / Other</option>
                  <option value="telecom">Telecom & Mobile</option>
                  <option value="identity">Identity & Citizen</option>
                  <option value="vehicles">Vehicles & Transport</option>
                  <option value="business">Business & GST</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  API Endpoint URL: <span className="text-slate-500 font-normal">(User input query will be appended at end)</span>
                </label>
                <input
                  type="url"
                  required
                  value={newApiUrl}
                  onChange={(e) => setNewApiUrl(e.target.value)}
                  placeholder="e.g. https://api.example.com/search?query="
                  className="w-full bg-slate-900 text-white font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Input Placeholder:</label>
                <input
                  type="text"
                  value={newPlaceholder}
                  onChange={(e) => setNewPlaceholder(e.target.value)}
                  placeholder="e.g. Enter 15-digit IMEI number"
                  className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Example Value:</label>
                <input
                  type="text"
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  placeholder="e.g. 864500000000000"
                  className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Daily Limit Per User: <span className="text-slate-500 font-normal">(0 = unlimited / global quota)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newDailyLimit}
                  onChange={(e) => setNewDailyLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="e.g. 3 for mobile, 4 for aadhar"
                  className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Short Description:</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Search device warranty, blacklisted status and TAC details."
                  className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingButton}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold transition"
              >
                {addingButton ? 'Adding Button...' : 'Save & Publish Button'}
              </button>
            </div>
          </form>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {['all', 'vehicles', 'identity', 'telecom', 'business', 'custom'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setButtonCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  buttonCategoryFilter === cat
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat === 'all' ? `All (${buttons.length})` : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={buttonSearchQuery}
              onChange={(e) => setButtonSearchQuery(e.target.value)}
              placeholder="Filter buttons or API..."
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs pl-8 pr-3 py-1.5 rounded-xl focus:border-indigo-500 focus:outline-none"
            />
            {buttonSearchQuery && (
              <button
                type="button"
                onClick={() => setButtonSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Buttons List Table */}
        <div className="overflow-x-auto">
          {loadingButtons ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading buttons registry...</div>
          ) : buttons.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No buttons found. Click "Refresh All".</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const filteredButtons = buttons.filter((b) => {
                  if (buttonCategoryFilter !== 'all' && (b.category || 'custom') !== buttonCategoryFilter) {
                    return false;
                  }
                  if (buttonSearchQuery.trim()) {
                    const q = buttonSearchQuery.toLowerCase();
                    const matchLabel = b.label.toLowerCase().includes(q);
                    const matchUrl = b.apiUrl ? b.apiUrl.toLowerCase().includes(q) : false;
                    const matchId = b.id.toLowerCase().includes(q);
                    return matchLabel || matchUrl || matchId;
                  }
                  return true;
                });

                if (filteredButtons.length === 0) {
                  return (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No buttons matched "{buttonSearchQuery}" in {buttonCategoryFilter}.
                    </div>
                  );
                }

                return filteredButtons.map((btn) => {
                  const isEditing = editingButtonId === btn.id;
                  return (
                    <div
                      key={btn.id}
                      className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                        btn.enabled
                          ? 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                          : 'bg-slate-950/30 border-rose-900/30 opacity-75'
                      }`}
                    >
                      <div className="flex-1 space-y-1 w-full md:w-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{btn.label}</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                            id: {btn.id}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-full font-semibold ${
                              btn.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {btn.enabled ? '● ACTIVE' : '○ DISABLED (OFF)'}
                          </span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                            🎯 Limit: {btn.dailyLimit && btn.dailyLimit > 0 ? `${btn.dailyLimit}/day` : 'No Limit'}
                          </span>
                          {btn.category && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700 capitalize font-mono">
                              {btn.category}
                            </span>
                          )}
                          {btn.isCustom && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Custom
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-2 bg-slate-900/80 p-3 rounded-xl border border-indigo-500/40">
                            <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Rename Button & Configure API</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-300 font-medium block">
                                  Button Name / Label:
                                </label>
                                <input
                                  type="text"
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  placeholder="e.g. 📱 Mobile Lookup 2.0"
                                  className="w-full bg-slate-950 text-white font-medium text-xs px-2.5 py-1.5 rounded border border-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-300 font-medium block">Search Input Placeholder:</label>
                                <input
                                  type="text"
                                  value={editPlaceholder}
                                  onChange={(e) => setEditPlaceholder(e.target.value)}
                                  placeholder="e.g. Enter 10-digit mobile number"
                                  className="w-full bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded border border-indigo-500/80 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-[10px] text-slate-300 font-medium block">API Endpoint URL:</label>
                                <input
                                  type="url"
                                  value={editApiUrl}
                                  onChange={(e) => setEditApiUrl(e.target.value)}
                                  placeholder="https://api.example.com/search?query="
                                  className="w-full bg-slate-950 text-white font-mono text-xs px-2.5 py-1.5 rounded border border-indigo-500/80 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-300 font-medium block">
                                  Daily Limit Per User: <span className="text-slate-500">(0 = unlimited)</span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={editDailyLimit}
                                  onChange={(e) => setEditDailyLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                  placeholder="e.g. 3"
                                  className="w-full bg-slate-950 text-white font-mono text-xs px-2.5 py-1.5 rounded border border-indigo-500/80 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => handleSaveEdit(btn.id)}
                                disabled={savingButton || !editLabel.trim()}
                                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition"
                              >
                                {savingButton ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button
                                onClick={() => setEditingButtonId(null)}
                                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white text-xs cursor-pointer transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 font-mono break-all line-clamp-1">
                            <span className="text-slate-500">API:</span> {btn.apiUrl || '(Built-in RTO scraper)'}
                          </div>
                        )}
                      </div>

                      {/* Controls for this button */}
                      {!isEditing && (
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => handleToggleButton(btn)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                              btn.enabled
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                            title={btn.enabled ? 'Turn button OFF' : 'Turn button ON'}
                          >
                            {btn.enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-rose-400" />}
                            <span>{btn.enabled ? 'Turn OFF' : 'Turn ON'}</span>
                          </button>

                          <button
                            onClick={() => handleStartEdit(btn)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition cursor-pointer"
                            title="Rename button or change API endpoint"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Rename / API</span>
                          </button>

                          <button
                            onClick={() => setActiveSubTab('playground')}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 hover:text-white border border-indigo-700/40 text-xs transition cursor-pointer"
                            title="Test this API in Live Playground"
                          >
                            <TestTube className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Test API</span>
                          </button>

                          <button
                            onClick={() => handleDeleteButton(btn)}
                            className="p-1.5 rounded-lg bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 border border-rose-800/40 text-xs transition cursor-pointer"
                            title={`Delete ${btn.label} button`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {/* Live API Tester Tab */}
      {activeSubTab === 'playground' && (
        <ApiTesterTab buttons={buttons} />
      )}

      {/* Group & System Settings Tab */}
      {activeSubTab === 'settings' && (
        <SystemSettingsTab config={config} onRefreshStats={onRefreshStats} />
      )}

      {/* Users Tab Content */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          {/* Section: Telegram User Management & DM Whitelist */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">Telegram Users Intelligence & DM Whitelist</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      Active Database
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bot lookups official community (<a href="https://t.me/lookupXchat" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">@lookupXchat</a>) me auto-destruct delay ke sath work karte hain. Private DM access ke liye yahan se user whitelist karein.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAllUsers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold shadow transition cursor-pointer"
                  title="Reset daily quota for all registered users"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset All Users Quota</span>
                </button>

                <a
                  href="/api/admin/users/export-text"
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Export Users (.txt)</span>
                </a>

                <button
                  onClick={fetchUsers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>Reload Users</span>
                </button>
              </div>
            </div>

        {/* User Action Message */}
        {userActionMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
              userActionMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{userActionMsg.text}</span>
            <button onClick={() => setUserActionMsg(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Add / Whitelist User Form */}
        <form onSubmit={handleAddUser} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Whitelist Telegram User ID for DM or Admin
            </span>
            <span className="text-[11px] text-slate-500">Admins always have full DM access</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Telegram User ID:</label>
              <input
                type="text"
                required
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="e.g. 123456789 or 6012345678"
                className="w-full bg-slate-900 text-white font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Role / Tier:</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as any)}
                className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                <option value="free">Free User (Standard Limit)</option>
                <option value="premium">VIP Premium (Unlimited searches)</option>
                <option value="admin">Admin (Full Control & DM)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-4 sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={newUserAllowDm || newUserRole === 'admin'}
                  disabled={newUserRole === 'admin'}
                  onChange={(e) => setNewUserAllowDm(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  Allow Bot Use in Private DM
                </span>
              </label>

              <button
                type="submit"
                disabled={addingUser || !newUserId.trim()}
                className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                {addingUser ? 'Saving...' : 'Whitelist User'}
              </button>
            </div>
          </div>
        </form>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative w-full">
              <input
                id="user-search-filter-input"
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by User ID, handle @username, or role..."
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-2 rounded-xl focus:border-emerald-500 focus:outline-none pl-8"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setUserFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                userFilter === 'all'
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setUserFilter('dm_allowed')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                userFilter === 'dm_allowed'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              DM Allowed ({users.filter(u => u.allowDm || u.role === 'admin').length})
            </button>
            <button
              type="button"
              onClick={() => setUserFilter('group_only')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                userFilter === 'group_only'
                  ? 'bg-rose-600/80 text-white font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Group Only ({users.filter(u => !u.allowDm && u.role !== 'admin').length})
            </button>
            <button
              type="button"
              onClick={() => setUserFilter('vip')}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                userFilter === 'vip'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              VIP / Admin ({users.filter(u => u.role === 'premium' || u.role === 'admin').length})
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Agent / User</th>
                <th className="py-3 px-3">Role Tier</th>
                <th className="py-3 px-3">Private DM Access</th>
                <th className="py-3 px-3">Today's Lookups</th>
                <th className="py-3 px-3">Invites</th>
                <th className="py-3 px-3 text-right">Actions & Quota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(() => {
                const filtered = users.filter((u) => {
                  const q = userSearchQuery.trim().toLowerCase();
                  const matchesSearch = !q ||
                    String(u.userId).toLowerCase().includes(q) ||
                    (u.username && u.username.toLowerCase().includes(q)) ||
                    (u.firstName && u.firstName.toLowerCase().includes(q)) ||
                    u.role.toLowerCase().includes(q);
                  if (!matchesSearch) return false;
                  if (userFilter === 'dm_allowed') return u.allowDm || u.role === 'admin';
                  if (userFilter === 'group_only') return !u.allowDm && u.role !== 'admin';
                  if (userFilter === 'vip') return u.role === 'premium' || u.role === 'admin';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500">
                        {userSearchQuery || userFilter !== 'all'
                          ? 'No users matching the active filter criteria.'
                          : (loadingUsers ? 'Loading registered users...' : 'No users registered yet. Add a user ID above.')}
                      </td>
                    </tr>
                  );
                }

                return filtered.map((u) => {
                  const isUserAdmin = u.role === 'admin';
                  const isVIP = u.role === 'premium';
                  const limitStr = isVIP || isUserAdmin ? '∞' : u.dailyLimit;
                  const isExhausted = !isVIP && !isUserAdmin && (u.dailySearches || 0) >= (u.dailyLimit || 20);

                  return (
                    <tr key={u.userId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono text-white">
                        <div className="flex items-center gap-2">
                          {isUserAdmin ? (
                            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : isVIP ? (
                            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                          ) : (
                            <Users className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-slate-200 flex items-center gap-1.5">
                              <span>{u.firstName || (u.username ? '@' + u.username : 'Agent')}</span>
                              {u.username && (
                                <span className="text-[10px] text-cyan-400 font-normal">@{u.username}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tracking-wider">
                              ID: {u.userId}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.userId, e.target.value)}
                          className="bg-slate-950 text-white text-[11px] px-2 py-1 rounded border border-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer"
                        >
                          <option value="free">Free</option>
                          <option value="premium">VIP</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      <td className="py-3 px-3">
                        {isUserAdmin || u.allowDm ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium flex items-center gap-1 w-max">
                            <Unlock className="w-3 h-3 text-emerald-400" />
                            <span>DM Allowed</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-medium flex items-center gap-1 w-max">
                            <Lock className="w-3 h-3 text-rose-400" />
                            <span>Group Only</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className={`font-mono font-bold ${isExhausted ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {u.dailySearches || 0}
                            </span>
                            <span className="text-slate-500 font-mono">/ {limitStr}</span>
                            <span className="text-[10px] text-slate-400">
                              (Tot: {u.totalSearches || 0})
                            </span>
                          </div>
                          {u.customLimit !== undefined && u.customLimit > 0 && (
                            <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                              Custom: {u.customLimit}/day
                            </span>
                          )}
                          {!isVIP && !isUserAdmin && (
                            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isExhausted ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, ((u.dailySearches || 0) / (u.dailyLimit || 20)) * 100)}%`
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        {u.referralCount ? (
                          <span className="text-cyan-400 font-semibold font-mono text-xs">
                            {u.referralCount} (+{u.referralBonusDaily || u.referralCount * 10}/d)
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">0</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Copy User ID */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.userId)}
                            title="Copy Telegram User ID"
                            className="p-1 rounded text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                          >
                            {copiedCode === u.userId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>

                          {/* Set Custom Limit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomLimitUser(u);
                              setCustomLimitInput(u.customLimit !== undefined ? u.customLimit : (u.dailyLimit || 20));
                            }}
                            title="Configure custom daily quota limit for this user"
                            className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition cursor-pointer flex items-center gap-1"
                          >
                            <SlidersHorizontal className="w-2.5 h-2.5" />
                            <span>Limit</span>
                          </button>

                          {/* Reset Daily Searches */}
                          <button
                            type="button"
                            onClick={() => handleResetUserSearches(u.userId)}
                            title="Reset daily searches to 0"
                            className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition cursor-pointer"
                          >
                            Reset
                          </button>

                          {/* +10 Bonus searches */}
                          <button
                            type="button"
                            onClick={() => handleAddBonusSearches(u.userId, 10)}
                            title="Grant +10 bonus searches today"
                            className="px-2 py-1 rounded text-[10px] font-medium bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-700/50 transition cursor-pointer"
                          >
                            +10 Q
                          </button>

                          {/* Toggle DM access */}
                          {!isUserAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleDm(u.userId, Boolean(u.allowDm))}
                              className={`px-2 py-1 rounded text-[10px] font-medium transition cursor-pointer border ${
                                u.allowDm
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                              }`}
                            >
                              {u.allowDm ? 'Block DM' : 'Allow DM'}
                            </button>
                          )}

                          {/* Delete user */}
                          {!isUserAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.userId)}
                              title="Delete user"
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      )}

      {/* Database & Daemon Tab Content */}
      {activeSubTab === 'database' && (
        <div className="space-y-6">
          {/* Supabase SQL Schema Commands */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Supabase SQL Schema Commands</h3>
              </div>
              <button
                onClick={copySqlToClipboard}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Buttons aur APIs ki persistent dynamic storage ke liye ye SQL commands <strong className="text-cyan-300">Supabase SQL Editor</strong> mein run karein:
            </p>

            <pre className="bg-slate-950 p-4 rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-72 border border-slate-800">
              {sqlCode}
            </pre>
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
      )}

      {/* Live Logs & Activity Tab */}
      {activeSubTab === 'logs' && (
        <AuditLogsTab />
      )}

      {/* Custom User Daily Limit Modal */}
      {editingCustomLimitUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Custom Daily Lookup Limit</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    User: {editingCustomLimitUser.firstName || editingCustomLimitUser.username || editingCustomLimitUser.userId} (ID: {editingCustomLimitUser.userId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomLimitUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Set a specific number of searches allowed per day for this user. Enter <strong className="text-sky-300">0</strong> to restore the standard tier default ({editingCustomLimitUser.role === 'premium' || editingCustomLimitUser.role === 'admin' ? 'Unlimited' : '20 searches/day'}).
              </p>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Daily Limit (Searches / Day):</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={customLimitInput}
                  onChange={(e) => setCustomLimitInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="e.g. 50"
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-sm px-3.5 py-2.5 rounded-xl focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[0, 10, 25, 50, 100, 250, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCustomLimitInput(preset)}
                    className={`px-2 py-1 rounded text-xs transition cursor-pointer font-mono ${
                      customLimitInput === preset
                        ? 'bg-sky-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset === 0 ? 'Default (0)' : `${preset}/d`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingCustomLimitUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomLimit}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer shadow-lg shadow-sky-600/20"
              >
                Save Limit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Safe Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                confirmModal.confirmStyle === 'danger'
                  ? 'bg-rose-500/20 text-rose-400'
                  : confirmModal.confirmStyle === 'warning'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg ${
                  confirmModal.confirmStyle === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : confirmModal.confirmStyle === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
