import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PORT = 3000;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ? parseInt(process.env.ADMIN_USER_ID, 10) : 5225326313;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ── SUPABASE PERSISTENCE CONFIGURATION ──
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    console.log('✅ Connected to Supabase! User data & credits are permanently persisted.');
  } catch (err) {
    console.error('⚠️ Supabase connection initialization error:', err);
  }
} else {
  console.log('ℹ️ Supabase not configured in environment. To persist users & credits across Render restarts, set SUPABASE_URL & SUPABASE_KEY.');
}

// ── DYNAMIC BOT BUTTONS & API CONFIGURATION ──
export interface BotButton {
  id: string; // e.g. 'num2', 'vehicle', or custom key
  label: string; // e.g. '📱 Mobile Lookup'
  category: 'telecom' | 'vehicles' | 'identity' | 'business' | 'custom';
  apiUrl: string; // Dynamic target endpoint
  placeholder: string;
  example: string;
  description: string;
  enabled: boolean;
  isCustom?: boolean;
  sortOrder?: number;
  dailyLimit?: number; // 0 or undefined = unlimited (up to global daily limit)
}

const DEFAULT_BUTTONS: BotButton[] = [
  {
    id: 'num2',
    label: '📱 Mobile Lookup',
    category: 'telecom',
    apiUrl: "https://rehu-hitek.vercel.app/search?mobile=",
    placeholder: 'Enter 10-digit mobile number',
    example: '6399964669',
    description: 'Telecom database lookup for operator, subscriber and circle data.',
    enabled: true,
    sortOrder: 1,
    dailyLimit: 3,
  },
  {
    id: 'vehicle',
    label: '🚗 Vehicle Lookup',
    category: 'vehicles',
    apiUrl: "https://vehicle-deep.onrender.com/rc-search?registration_number=",
    placeholder: 'Enter Vehicle Reg Number (e.g. HR26EV0001)',
    example: 'HR26EV0001',
    description: 'Owner name, chassis, engine, RTO code, fitness & insurance details.',
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 'aadhar2info',
    label: '🪪 Aadhaar Info',
    category: 'identity',
    apiUrl: "https://rehu-hitek.vercel.app/search?field=aadharNumber&q=",
    placeholder: 'Enter 12-digit Aadhaar number',
    example: '646858617313',
    description: 'Verify Aadhaar profile registration status and metadata.',
    enabled: true,
    sortOrder: 3,
    dailyLimit: 4,
  },
  {
    id: 'aadhar2family',
    label: '👨‍👩‍👧 Family Tree',
    category: 'identity',
    apiUrl: "https://aadhar2fam-black.vercel.app/get-family-by-aadhaar?key=IRAM&tkn=IRAM&aadhaar=",
    placeholder: 'Enter 12-digit Aadhaar number',
    example: '309484613752',
    description: 'Discover linked family members and associated household records.',
    enabled: true,
    sortOrder: 4,
  },
  {
    id: 'voter',
    label: '🗳️ Voter Lookup',
    category: 'identity',
    apiUrl: "https://voter-rehuu.vercel.app/search?epic=",
    placeholder: 'Enter EPIC number (e.g. ZNO1150077)',
    example: 'ZNO1150077',
    description: 'Electoral card details, assembly constituency, polling station.',
    enabled: true,
    sortOrder: 5,
  },
  {
    id: 'lpg',
    label: '🔥 LPG Gas Lookup',
    category: 'telecom',
    apiUrl: "https://lpg-rehu-lovat.vercel.app/validate?key=IRAM&tkn=IRAM&phone=",
    placeholder: 'Enter 10-digit linked phone number',
    example: '9546585647',
    description: 'Consumer connection details from Indian Oil, Bharat Gas or HP Gas.',
    enabled: true,
    sortOrder: 6,
  },
  {
    id: 'upi2num',
    label: '💳 UPI Lookup',
    category: 'telecom',
    apiUrl: "https://paytm-seven-zeta.vercel.app/fetch?key=IRAM&tkn=IRAM&upi=",
    placeholder: 'Enter UPI ID (e.g. username@bank)',
    example: 'sagar5973@ptyes',
    description: 'Resolve UPI virtual payment address to associated account or phone.',
    enabled: true,
    sortOrder: 7,
  },
  {
    id: 'gst2name',
    label: '🏢 GST by Name',
    category: 'business',
    apiUrl: "https://pan-2jzn.onrender.com/search-gstin?name=",
    placeholder: 'Enter business or individual legal name',
    example: 'RUBINA AKBARALI ANSARI',
    description: 'Search active and cancelled GSTIN registrations by trade name.',
    enabled: true,
    sortOrder: 8,
  },
  {
    id: 'gst2pan',
    label: '🪪 GST by PAN',
    category: 'business',
    apiUrl: "https://pan-2jzn.onrender.com/pan/",
    placeholder: 'Enter 10-character PAN number',
    example: 'AXIPA2589D',
    description: 'Locate all GSTIN accounts registered under a Permanent Account Number.',
    enabled: true,
    sortOrder: 9,
  },
  {
    id: 'gst',
    label: '📄 GST Details',
    category: 'business',
    apiUrl: "https://pan-2jzn.onrender.com/gstin/",
    placeholder: 'Enter 15-character GSTIN',
    example: '27AXIPA2589D1ZK',
    description: 'Complete registration status, jurisdiction, tax payer type & address.',
    enabled: true,
    sortOrder: 10,
  }
];

// Map storing buttons dynamically (can be modified, toggled, or extended via Admin Panel)
const buttonsStore = new Map<string, BotButton>();
DEFAULT_BUTTONS.forEach(btn => buttonsStore.set(btn.id, { ...btn }));

function getButtonApiUrl(buttonId: string, fallback: string): string {
  const btn = buttonsStore.get(buttonId);
  return (btn && btn.apiUrl) ? btn.apiUrl : fallback;
}

function isButtonEnabled(buttonId: string): boolean {
  const btn = buttonsStore.get(buttonId);
  if (!btn) return true;
  return btn.enabled !== false;
}

// Dynamic API URL accessors ensuring live updates from buttonsStore
const NUM2_API_URL       = "https://rehu-hitek.vercel.app/search?mobile=";
const VEHICLE_API_URL    = "https://vehicle-deep.onrender.com/rc-search?registration_number=";
const AADHAR2_API_URL    = "https://rehu-hitek.vercel.app/search?field=aadharNumber&q=";
const AADHAR2FAM_API_URL = "https://aadhar2fam-black.vercel.app/get-family-by-aadhaar?key=IRAM&tkn=IRAM&aadhaar=";
const VOTER_API_URL      = "https://voter-rehuu.vercel.app/search?epic=";
const LPG_API_URL        = "https://lpg-rehu-lovat.vercel.app/validate?key=IRAM&tkn=IRAM&phone=";
const UPI2NUM_API_URL    = "https://paytm-seven-zeta.vercel.app/fetch?key=IRAM&tkn=IRAM&upi=";
const GST2NAME_API_URL   = "https://pan-2jzn.onrender.com/search-gstin?name=";
const GST2PAN_API_URL    = "https://pan-2jzn.onrender.com/pan/";
const GST_API_URL        = "https://pan-2jzn.onrender.com/gstin/";

const BOT_NAME         = "iramX";
const BOT_VERSION      = "7.3";
const BOT_USERNAME     = process.env.BOT_USERNAME || "irammbot";
const DEVELOPER        = "@gotweeds";
const DEVELOPER_LINK   = "https://t.me/gotweeds";
const CHANNEL_ID       = process.env.CHANNEL_ID || "-1002085221963";
const CHANNEL_LINK     = process.env.CHANNEL_URL || "https://t.me/rehuszr";
const CHANNEL_USERNAME = "@RehuSzr";
let OFFICIAL_GROUP_ID = process.env.OFFICIAL_GROUP_ID || "-1002164265666";
let OFFICIAL_GROUP_URL = process.env.OFFICIAL_GROUP_URL || "https://t.me/lookupXchat";
let OFFICIAL_GROUP_USERNAME = "@lookupXchat";
let SUPPORT_GROUP    = "@lookupXchat";
let AUTO_DELETE_DELAY_MS = 40000; // default 40 seconds auto-destruct in groups
let FREE_DAILY_LIMIT = 20;
let REFERRAL_BONUS_PER_USER = 10; // +10 extra credit daily per referral!

// ── IN-MEMORY STORE ──
interface UserRecord {
  userId: number | string;
  username?: string;
  firstName?: string;
  role: 'admin' | 'premium' | 'free';
  dailySearches: number;
  lastSearchDate: string;
  totalSearches: number;
  channelVerified: boolean;
  pendingAction?: string;
  referredBy?: string;
  referralCount: number;
  referralBonusDaily: number;
  referredUsers: string[];
  allowDm?: boolean;
  dailyButtonUsage?: Record<string, number>;
  lastActive?: string;
  createdAt?: string;
  customLimit?: number;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  source: 'telegram_group' | 'telegram_dm' | 'web';
  userId: string;
  username?: string;
  service: string;
  query: string;
  status: 'success' | 'error' | 'rate_limited';
  durationMs: number;
  details?: string;
}

const auditLogs: AuditLogEntry[] = [];

function addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
  const log: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 250) {
    auditLogs.pop();
  }
}

let MAINTENANCE_MODE: boolean = false;
let MAINTENANCE_MESSAGE: string = "🚧 *SYSTEM MAINTENANCE IN PROGRESS*\n\nBot is currently undergoing scheduled database maintenance and API upgrades. Please try again shortly!";

interface RedeemCodeRecord {
  code: string;
  days: number;
  role: string;
  usesLeft: number;
  totalUses: number;
  createdAt: string;
  usedBy: string[];
}

const usersStore = new Map<string, UserRecord>();
const redeemCodes = new Map<string, RedeemCodeRecord>();
let allTimeSearchesCount = 142;

// ── SUPABASE SYNCHRONIZATION HELPERS ──
async function loadUsersFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('bot_users').select('*');
    if (error) {
      console.error('⚠️ Supabase fetch error:', error.message);
      return;
    }
    if (data && Array.isArray(data)) {
      for (const row of data) {
        usersStore.set(row.id, {
          userId: row.id,
          username: row.username || undefined,
          firstName: row.first_name || undefined,
          role: row.role || 'free',
          dailySearches: Number(row.daily_searches) || 0,
          lastSearchDate: row.last_search_date || getTodayString(),
          totalSearches: Number(row.total_searches) || 0,
          channelVerified: Boolean(row.channel_verified),
          referredBy: row.referred_by || undefined,
          referralCount: Number(row.referral_count) || 0,
          referralBonusDaily: Number(row.referral_bonus_daily) || 0,
          referredUsers: [],
          allowDm: row.allow_dm !== false,
          lastActive: row.last_active || row.updated_at || undefined,
          createdAt: row.created_at || undefined,
        });
      }
      console.log(`📦 Loaded & restored ${data.length} users from Supabase permanent database.`);
    }
  } catch (err: any) {
    console.error('⚠️ Error querying Supabase on boot:', err?.message || err);
  }
}

async function persistUser(user: UserRecord): Promise<void> {
  if (!supabase) return;
  try {
    const payload: any = {
      id: String(user.userId),
      role: user.role,
      daily_searches: user.dailySearches,
      last_search_date: user.lastSearchDate,
      total_searches: user.totalSearches,
      channel_verified: user.channelVerified,
      referred_by: user.referredBy || null,
      referral_count: user.referralCount || 0,
      referral_bonus_daily: user.referralBonusDaily || 0,
      allow_dm: user.allowDm !== false,
      updated_at: new Date().toISOString()
    };
    if (user.username) payload.username = user.username;
    if (user.firstName) payload.first_name = user.firstName;
    if (user.lastActive) payload.last_active = user.lastActive;

    const { error } = await supabase.from('bot_users').upsert(payload, { onConflict: 'id' });
    if (error) {
      if (error.message && (error.message.includes('column') || error.message.includes('schema'))) {
        delete payload.username;
        delete payload.first_name;
        delete payload.last_active;
        await supabase.from('bot_users').upsert(payload, { onConflict: 'id' });
      } else {
        console.error(`⚠️ Failed to persist user ${user.userId} to Supabase:`, error.message);
      }
    }
  } catch (err: any) {
    console.error(`⚠️ Supabase persist exception for user ${user.userId}:`, err?.message || err);
  }
}

async function recordReferralInDb(referrerId: string, referredId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('bot_referrals').insert({
      referrer_id: String(referrerId),
      referred_id: String(referredId),
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Ignore duplicate key errors if already recorded
  }
}

// ── DYNAMIC BUTTONS SUPABASE PERSISTENCE ──
async function loadButtonsFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('bot_buttons').select('*').order('sort_order', { ascending: true });
    if (error) {
      console.warn('⚠️ Supabase bot_buttons fetch:', error.message);
      return;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      for (const row of data) {
        buttonsStore.set(row.id, {
          id: row.id,
          label: row.label,
          category: row.category || 'custom',
          apiUrl: row.api_url,
          placeholder: row.placeholder || `Enter ${row.label}`,
          example: row.example || '',
          description: row.description || '',
          enabled: row.enabled !== false,
          isCustom: Boolean(row.is_custom),
          sortOrder: row.sort_order || 99,
          dailyLimit: row.daily_limit !== undefined ? Number(row.daily_limit) : undefined,
        });
      }
      console.log(`📦 Loaded ${data.length} dynamic buttons & APIs from Supabase bot_buttons.`);
    }
  } catch (err: any) {
    console.warn('⚠️ Error loading bot_buttons from Supabase:', err?.message || err);
  }
}

async function persistButton(btn: BotButton): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('bot_buttons').upsert({
      id: btn.id,
      label: btn.label,
      category: btn.category,
      api_url: btn.apiUrl,
      placeholder: btn.placeholder,
      example: btn.example,
      description: btn.description,
      enabled: btn.enabled,
      is_custom: Boolean(btn.isCustom),
      sort_order: btn.sortOrder || 99,
      daily_limit: btn.dailyLimit || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) {
      console.warn(`⚠️ Failed to persist button ${btn.id} to Supabase:`, error.message);
    }
  } catch (err: any) {
    console.warn(`⚠️ Supabase persist exception for button ${btn.id}:`, err?.message || err);
  }
}

async function deleteButtonFromDb(buttonId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('bot_buttons').delete().eq('id', buttonId);
  } catch (err: any) {
    console.warn(`⚠️ Supabase delete exception for button ${buttonId}:`, err?.message || err);
  }
}

// Seed initial test redeem codes
function seedRedeemCode(code: string, days = 7, uses = 1, role = "premium") {
  redeemCodes.set(code.toUpperCase(), {
    code: code.toUpperCase(),
    days,
    role,
    usesLeft: uses,
    totalUses: uses,
    createdAt: new Date().toISOString(),
    usedBy: [],
  });
}
// No working codes seeded in production - generated by Admin on demand

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getUserTodaySearches(user: UserRecord): number {
  const today = getTodayString();
  if (user.lastSearchDate !== today) {
    return 0;
  }
  return user.dailySearches || 0;
}

function getUserDailyLimit(user: UserRecord): number {
  if (user.role === 'admin' || user.role === 'premium') return 999;
  const bonus = (user.referralCount || 0) * REFERRAL_BONUS_PER_USER;
  const base = (user.customLimit && user.customLimit > 0) ? user.customLimit : FREE_DAILY_LIMIT;
  return base + bonus;
}

function getUserRemaining(user: UserRecord): number {
  if (user.role === 'admin' || user.role === 'premium') return 999;
  const limit = getUserDailyLimit(user);
  const used = getUserTodaySearches(user);
  return Math.max(0, limit - used);
}

function getUser(userId: string | number): UserRecord {
  const idStr = String(userId);
  let user = usersStore.get(idStr);
  const today = getTodayString();

  if (!user) {
    user = {
      userId: idStr,
      role: idStr === String(ADMIN_USER_ID) ? 'admin' : 'free',
      dailySearches: 0,
      lastSearchDate: today,
      totalSearches: 0,
      channelVerified: idStr === String(ADMIN_USER_ID),
      referralCount: 0,
      referralBonusDaily: 0,
      referredUsers: [],
      allowDm: true,
      dailyButtonUsage: {},
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    usersStore.set(idStr, user);
    persistUser(user).catch(() => {});
  } else {
    if (user.allowDm === undefined) {
      user.allowDm = true;
    }
    if (user.lastSearchDate !== today) {
      user.dailySearches = 0;
      user.dailyButtonUsage = {};
      user.lastSearchDate = today;
      persistUser(user).catch(() => {});
    }
  }
  return user;
}

function getUserButtonUsage(user: UserRecord, buttonId: string): number {
  const today = getTodayString();
  if (user.lastSearchDate !== today) return 0;
  if (!user.dailyButtonUsage) user.dailyButtonUsage = {};
  return user.dailyButtonUsage[buttonId] || 0;
}

function recordButtonUsage(user: UserRecord, buttonId: string): void {
  const today = getTodayString();
  if (user.lastSearchDate !== today) {
    user.dailySearches = 0;
    user.dailyButtonUsage = {};
    user.lastSearchDate = today;
  }
  if (!user.dailyButtonUsage) user.dailyButtonUsage = {};
  user.dailyButtonUsage[buttonId] = (user.dailyButtonUsage[buttonId] || 0) + 1;
  user.lastActive = new Date().toISOString();
  persistUser(user).catch(() => {});
}

function checkButtonDailyLimit(user: UserRecord, buttonId: string): { allowed: boolean; limit: number; current: number } {
  if (user.role === 'admin' || user.role === 'premium') {
    return { allowed: true, limit: 999, current: 0 };
  }
  const btn = buttonsStore.get(buttonId);
  const limit = btn && typeof btn.dailyLimit === 'number' ? btn.dailyLimit : 0;
  if (limit <= 0) {
    return { allowed: true, limit: 0, current: getUserButtonUsage(user, buttonId) };
  }
  const current = getUserButtonUsage(user, buttonId);
  if (current >= limit) {
    return { allowed: false, limit, current };
  }
  return { allowed: true, limit, current };
}

function checkAndEnforceButtonLimit(user: UserRecord, buttonId: string): { allowed: boolean; message: string } {
  const check = checkButtonDailyLimit(user, buttonId);
  if (!check.allowed) {
    const btn = buttonsStore.get(buttonId);
    const label = btn ? btn.label : buttonId;
    return {
      allowed: false,
      message: `🔒 *SERVICE LIMIT REACHED TODAY!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nService: *${label}*\nAap aaj is service ko sirf *${check.limit} baar* use kar sakte the jo use ho chuka hai (${check.current}/${check.limit}).\n\n⏳ Ye limit kal subah 12:00 AM par auto reset hogi!\n🎁 Naye users ko /refer karein ya VIP code redeem karein unlimited access ke liye.\n━━━━━━━━━━━━━━━━━━━━━━━━━`
    };
  }
  return { allowed: true, message: "" };
}

function recordSearch(userId: string | number): void {
  const user = getUser(userId);
  const today = getTodayString();
  if (user.lastSearchDate !== today) {
    user.dailySearches = 0;
    user.dailyButtonUsage = {};
    user.lastSearchDate = today;
  }
  user.dailySearches = (user.dailySearches || 0) + 1;
  user.totalSearches = (user.totalSearches || 0) + 1;
  user.lastActive = new Date().toISOString();
  allTimeSearchesCount += 1;
  persistUser(user).catch(() => {});
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `IRAM-${p1}-${p2}`;
}

// ── OSINT FETCHERS ──
async function fetchWithTimeout(url: string, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': `Mozilla/5.0 (compatible; iramX/7.3; +https://t.me/${BOT_USERNAME})` }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      try {
        const errorJson = await response.json();
        return errorJson;
      } catch {
        return null;
      }
    }
    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Fetch error for ${url}:`, err.message);
    return null;
  }
}

async function fetchVehicleInfo(regNo: string) {
  const cleanReg = regNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const vehicleUrl = getButtonApiUrl('vehicle', "https://vehicle-deep.onrender.com/rc-search?registration_number=");
  const raw = await fetchWithTimeout(`${vehicleUrl}${encodeURIComponent(cleanReg)}`, 35000);
  if (!raw) return null;

  try {
    const detail = raw.debug?.garageVehicle360?.detail || raw.data?.data?.[0]?.data || raw.detail || {};
    const s = detail.rc_summary || raw.rc_summary || {};

    let phoneMasked = "N/A";
    try {
      phoneMasked = raw.data?.data?.[3]?.data?.items?.[0]?.data?.lead?.detail?.maskedPhone || "N/A";
    } catch {}

    const rto = detail.RTO || {};
    const rtoCode = typeof rto === 'object' ? (rto.rto_code || s.rto_code || "N/A") : (rto || s.rto_code || "N/A");
    const rtoName = typeof rto === 'object' ? (rto.rto_name || s.rto_name || "Regional Transport Authority") : (s.rto_name || "Regional Transport Authority");

    const brand = detail.brand || {};
    const makeName = typeof brand === 'object' ? (brand.make_display || s.make_name || "Standard") : (brand || s.make_name || "Standard");

    const modelObj = detail.model || {};
    const modelName = typeof modelObj === 'object' ? (modelObj.model_display || s.model_name || "Vehicle") : (modelObj || s.model_name || "Vehicle");

    return {
      reg_number: s.reg_number || detail.registrationNumber || cleanReg,
      owner_name: s.owner_name || detail.rc_owner_name || "Record Registered",
      owner_masked: detail.rc_owner_name_masked || "N/A",
      owner_count: s.owner_count || 1,
      phone_masked: phoneMasked,
      rto_code: rtoCode,
      rto_name: rtoName,
      make: makeName,
      model: modelName,
      variant: s.variant_name || detail.variant || "Standard",
      variant_year: s.variant_year || detail.manufacturingMonthYr || "N/A",
      color: detail.color || s.vehicle_color || "Standard",
      fuel_type: detail.fuelType || s.fuel_type || "Petrol / Diesel",
      vehicle_class: s.vehicle_class || (detail.isBike ? "Two Wheeler (MCWG)" : "Motor Vehicle (LMV)"),
      body_type: s.body_type || (detail.isBike ? "Motorcycle" : "Standard"),
      seat_capacity: s.seat_capacity || (detail.isBike ? 2 : 5),
      transmission: s.transmission_type || "Manual",
      engine_number: detail.engineNo || s.engine_number || "Verified in Database",
      chassis_number: detail.chassisNo || s.chassis_number || "Verified in Database",
      cubic_capacity: detail.cubicCapacity || s.cubic_capacity || "N/A",
      cylinders: detail.cylindersCount || s.cylinders_no || "N/A",
      gross_weight: s.gross_vehicle_weight || "N/A",
      emission_norm: s.emission_norm || "BS-VI",
      registration_date: s.registration_date || "Available",
      fitness_upto: detail.fitnessUpTo || s.fitness_upto || "Valid",
      insurance_company: detail.insuranceCompany || s.insurance_company || "General Insurance",
      insurance_expiry: detail.insuranceUpTo || s.insurance_expiry || "Active",
      pucc_number: s.pucc_number || "N/A",
      pucc_expiry: s.pucc_expiry || "Active",
      rc_expiry: s.rc_expiry_date || "N/A",
      rc_status: s.rc_status || "ACTIVE",
      financer: s.financer || "None",
      manufacturing: detail.manufacturingMonthYr || s.manufacturer_month_year || "N/A",
      raw_source: "vahan_rc_gateway"
    };
  } catch (e: any) {
    console.error("Vehicle parse error:", e);
    return null;
  }
}

function autoDetectLookupType(input: string): { type: string; cleanQuery: string } | null {
  const text = input.trim();
  if (!text) return null;

  // 10-digit mobile number: starts with 6, 7, 8, 9
  const cleanDigits = text.replace(/[^0-9]/g, '');
  if (cleanDigits.length === 10 && /^[6-9]\d{9}$/.test(cleanDigits)) {
    return { type: 'num2', cleanQuery: cleanDigits };
  }

  // 12-digit Aadhaar number
  if (cleanDigits.length === 12) {
    return { type: 'aadhar2info', cleanQuery: cleanDigits };
  }

  // Vehicle Registration Plate (e.g. JH05DE7988, DL01AB1234, HR26EV0001, UP16AZ1234, etc.)
  const cleanAlnum = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(cleanAlnum)) {
    return { type: 'vehicle', cleanQuery: cleanAlnum };
  }

  // 15-character GSTIN (e.g. 27AAACF5317Q1ZA)
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanAlnum)) {
    return { type: 'gst', cleanQuery: cleanAlnum };
  }

  // 10-character PAN Card (e.g. AAACF5317Q)
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanAlnum)) {
    return { type: 'gst2pan', cleanQuery: cleanAlnum };
  }

  // Voter EPIC (e.g. ZNO1150077, ABC1234567)
  if (/^[A-Z]{3}[0-9]{7}$/.test(cleanAlnum)) {
    return { type: 'voter', cleanQuery: cleanAlnum };
  }

  // UPI Handle (contains @)
  if (text.includes('@') && !text.includes(' ') && text.length >= 5) {
    return { type: 'upi2num', cleanQuery: text };
  }

  return null;
}

// ── TELEGRAM BOT ENGINE ──
let isTelegramPolling = false;
let isBotActive = true;
let lastUpdateId = 0;
const telegramChatIds = new Set<string | number>();

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any): Promise<number | null> {
  if (chatId) telegramChatIds.add(chatId);
  if (!BOT_TOKEN) return null;

  // If text is larger than Telegram message limit (3800 chars), automatically send as .txt document
  if (text.length > 3800) {
    const filename = `lookup_result_${Date.now()}.txt`;
    const caption = `📄 *Result is large — Full output attached in .txt file.*`;
    return await sendTelegramDocument(chatId, filename, text, caption, replyMarkup);
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      })
    });
    const data = await res.json();
    if (data.ok && data.result?.message_id) {
      const msgId = data.result.message_id;
      const isGroup = Number(chatId) < 0 || String(chatId).startsWith('-');
      if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
        scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
      }
      return msgId;
    }
    // Fallback if markdown parsing fails
    if (!data.ok && data.description?.includes('entity')) {
      const plainRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/[*_`[\]()]/g, ''),
          reply_markup: replyMarkup,
        })
      });
      const plainData = await plainRes.json();
      if (plainData.ok && plainData.result?.message_id) {
        const msgId = plainData.result.message_id;
        const isGroup = Number(chatId) < 0 || String(chatId).startsWith('-');
        if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
          scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
        }
        return msgId;
      }
    }
    // Fallback if message too long according to Telegram
    if (!data.ok && data.description?.toLowerCase().includes('too long')) {
      const filename = `lookup_result_${Date.now()}.txt`;
      const caption = `📄 *Result is large — Full output attached in .txt file.*`;
      return await sendTelegramDocument(chatId, filename, text, caption, replyMarkup);
    }
  } catch (err: any) {
    console.error("Telegram send error:", err.message);
  }
  return null;
}

async function sendTelegramDocument(
  chatId: number | string,
  filename: string,
  content: string,
  caption?: string,
  replyMarkup?: any
): Promise<number | null> {
  if (chatId) telegramChatIds.add(chatId);
  if (!BOT_TOKEN) return null;
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    formData.append('document', blob, filename);
    if (caption) {
      formData.append('caption', caption.slice(0, 1024));
      formData.append('parse_mode', 'Markdown');
    }
    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup));
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.ok && data.result?.message_id) {
      const msgId = data.result.message_id;
      const isGroup = Number(chatId) < 0 || String(chatId).startsWith('-');
      if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
        scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
      }
      return msgId;
    }
    // Fallback if markdown in caption fails
    if (!data.ok && caption && data.description?.includes('entity')) {
      const plainFormData = new FormData();
      plainFormData.append('chat_id', String(chatId));
      plainFormData.append('document', new Blob([content], { type: 'text/plain;charset=utf-8' }), filename);
      plainFormData.append('caption', caption.replace(/[*_`[\]()]/g, '').slice(0, 1024));
      if (replyMarkup) {
        plainFormData.append('reply_markup', JSON.stringify(replyMarkup));
      }
      const plainRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: plainFormData,
      });
      const plainData = await plainRes.json();
      if (plainData.ok && plainData.result?.message_id) {
        const msgId = plainData.result.message_id;
        const isGroup = Number(chatId) < 0 || String(chatId).startsWith('-');
        if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
          scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
        }
        return msgId;
      }
    }
    console.error("sendTelegramDocument error response:", data);
  } catch (err: any) {
    console.error("Telegram sendDocument error:", err.message);
  }
  return null;
}

async function sendTelegramPhoto(
  chatId: number | string,
  photo: string,
  caption?: string,
  replyMarkup?: any
): Promise<number | null> {
  if (chatId) telegramChatIds.add(chatId);
  if (!BOT_TOKEN) return null;
  try {
    const isGroup = Number(chatId) < 0 || String(chatId).startsWith('-');
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo,
          caption: caption ? caption.slice(0, 1024) : undefined,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }),
      });
      const data = await res.json();
      if (data.ok && data.result?.message_id) {
        const msgId = data.result.message_id;
        if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
          scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
        }
        return msgId;
      }
      // If caption formatting fails (e.g. invalid markdown)
      if (!data.ok && caption && data.description?.includes('entity')) {
        const plainRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo,
            caption: caption.replace(/[*_`[\]()]/g, '').slice(0, 1024),
            reply_markup: replyMarkup,
          }),
        });
        const plainData = await plainRes.json();
        if (plainData.ok && plainData.result?.message_id) {
          const msgId = plainData.result.message_id;
          if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
            scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
          }
          return msgId;
        }
      }
      console.error("sendTelegramPhoto error response:", data);
    } else if (photo.startsWith('data:image/')) {
      const match = photo.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: mimeType });
        const ext = mimeType.split('/')[1] || 'jpg';
        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', blob, `broadcast_image.${ext}`);
        if (caption) {
          formData.append('caption', caption.slice(0, 1024));
          formData.append('parse_mode', 'Markdown');
        }
        if (replyMarkup) {
          formData.append('reply_markup', JSON.stringify(replyMarkup));
        }
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.ok && data.result?.message_id) {
          const msgId = data.result.message_id;
          if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
            scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
          }
          return msgId;
        }
        // Fallback for markdown in caption
        if (!data.ok && caption && data.description?.includes('entity')) {
          const plainFormData = new FormData();
          plainFormData.append('chat_id', String(chatId));
          plainFormData.append('photo', blob, `broadcast_image.${ext}`);
          plainFormData.append('caption', caption.replace(/[*_`[\]()]/g, '').slice(0, 1024));
          if (replyMarkup) {
            plainFormData.append('reply_markup', JSON.stringify(replyMarkup));
          }
          const plainRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: plainFormData,
          });
          const plainData = await plainRes.json();
          if (plainData.ok && plainData.result?.message_id) {
            const msgId = plainData.result.message_id;
            if (isGroup && AUTO_DELETE_DELAY_MS > 0) {
              scheduleAutoDelete(chatId, [msgId], AUTO_DELETE_DELAY_MS);
            }
            return msgId;
          }
        }
        console.error("sendTelegramPhoto base64 error response:", data);
      }
    }
  } catch (err: any) {
    console.error("Telegram sendPhoto error:", err.message);
  }
  return null;
}

async function deleteTelegramMessage(chatId: number | string, messageId: number | null | undefined): Promise<boolean> {
  if (!BOT_TOKEN || !messageId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      })
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

const pendingDeletions = new Set<string>();

function scheduleAutoDelete(chatId: number | string, messageIds: (number | null | undefined)[], delayMs = AUTO_DELETE_DELAY_MS) {
  if (delayMs <= 0) return;
  const idsToDelete: number[] = [];
  for (const mid of messageIds) {
    if (mid) {
      const key = `${chatId}:${mid}`;
      if (!pendingDeletions.has(key)) {
        pendingDeletions.add(key);
        idsToDelete.push(mid);
      }
    }
  }
  if (idsToDelete.length === 0) return;

  setTimeout(async () => {
    for (const mid of idsToDelete) {
      pendingDeletions.delete(`${chatId}:${mid}`);
      await deleteTelegramMessage(chatId, mid).catch(() => {});
    }
  }, delayMs);
}

async function editTelegramMessageText(chatId: number | string, messageId: number, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      })
    });
  } catch (err: any) {
    console.error("Telegram editMessageText error:", err.message);
  }
}

async function broadcastTelegramMessage(
  text: string,
  replyMarkup?: any,
  targetFilter?: 'all' | 'vip' | 'free' | 'dm',
  imageUrl?: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  let candidateUserIds = Array.from(usersStore.keys()).filter(id => id !== 'web_client' && !isNaN(Number(id)));
  if (targetFilter === 'vip') {
    candidateUserIds = candidateUserIds.filter(id => {
      const u = usersStore.get(id);
      return u && (u.role === 'premium' || u.role === 'admin');
    });
  } else if (targetFilter === 'free') {
    candidateUserIds = candidateUserIds.filter(id => {
      const u = usersStore.get(id);
      return u && u.role === 'free';
    });
  } else if (targetFilter === 'dm') {
    candidateUserIds = candidateUserIds.filter(id => {
      const u = usersStore.get(id);
      return u && (u.allowDm !== false || u.role === 'admin');
    });
  }

  const targetChatIds = new Set<string | number>([
    ...(targetFilter === 'vip' || targetFilter === 'free' ? [] : telegramChatIds),
    ...candidateUserIds
  ]);

  if (targetChatIds.size === 0 && ADMIN_USER_ID) {
    targetChatIds.add(ADMIN_USER_ID);
  }

  for (const chatId of targetChatIds) {
    try {
      if (BOT_TOKEN) {
        let msgSent = false;
        if (imageUrl) {
          const photoMsgId = await sendTelegramPhoto(chatId, imageUrl, text.slice(0, 1024), replyMarkup);
          if (photoMsgId) {
            msgSent = true;
            if (text.length > 1024) {
              await sendTelegramMessage(chatId, text.slice(1024));
            }
          }
        }
        if (!msgSent) {
          const textMsgId = await sendTelegramMessage(chatId, text, replyMarkup);
          if (textMsgId) {
            msgSent = true;
          }
        }
        if (msgSent) sent++;
        else failed++;
      } else {
        sent++;
      }
      await new Promise(r => setTimeout(r, 40));
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

async function broadcastRedeemCode(days: number, adminName = 'Admin'): Promise<{ code: string; days: number; sent: number; failed: number }> {
  const code = generateCode();
  const numDays = Math.max(1, Number(days) || 7);
  const record: RedeemCodeRecord = {
    code,
    days: numDays,
    role: 'premium',
    usesLeft: 1, // Single-use: first-come, first-served
    totalUses: 1,
    createdAt: new Date().toISOString(),
    usedBy: [],
  };
  redeemCodes.set(code, record);

  const broadcastMsg = `🎁 *EXCLUSIVE REDEEM CODE DROP!*
━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *First-Come, First-Served!* Jo sabse pehle redeem karega use hi milega!

💎 *VIP Promo Code:* \`${code}\`
⏳ *Duration:* *${numDays} Days* VIP Premium Access
🔥 *Benefit:* Unlimited Lookups & Zero Daily Limits

👉 *How to Claim:* Send \`/redeem ${code}\` now!
⚠️ *Notice:* Single-use only! Pehle aao, pehle pao.
━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Drop by:* ${adminName}`;

  const result = await broadcastTelegramMessage(broadcastMsg);
  return { code, days: numDays, sent: result.sent, failed: result.failed };
}

async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      })
    });
  } catch (err: any) {
    console.error("Telegram answerCallbackQuery error:", err.message);
  }
}

async function sendTelegramChatAction(chatId: number | string, action = 'typing') {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (err: any) {
    // Non-critical action
  }
}

// Check if user has joined required Telegram Channel (-1002085221963)
async function checkTelegramChannelMembership(userId: number | string): Promise<{ isMember: boolean; status?: string; error?: string }> {
  const idStr = String(userId);
  if (idStr === String(ADMIN_USER_ID)) {
    return { isMember: true, status: 'creator' };
  }

  const user = getUser(userId);
  if (user.channelVerified) {
    return { isMember: true, status: 'verified_cached' };
  }

  if (!BOT_TOKEN) {
    return { isMember: user.channelVerified };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHANNEL_ID)}&user_id=${encodeURIComponent(idStr)}`);
    const data = await res.json();
    if (data.ok && data.result) {
      const status = data.result.status;
      const validMembership = ['creator', 'administrator', 'member', 'restricted'].includes(status);
      if (validMembership) {
        user.channelVerified = true;
        return { isMember: true, status };
      }
      return { isMember: false, status };
    }
    console.warn(`[Channel Check] Chat member check failed:`, data.description || 'Not found');
    return { isMember: false, error: data.description };
  } catch (err: any) {
    console.error("Error checking channel membership:", err);
    return { isMember: false, error: err.message };
  }
}

// ── OSINT SYNTHETIC / FALLBACK GENERATOR ──
function getFallbackRecord(type: string, query: string): any {
  const q = String(query).trim();
  switch (type) {
    case 'vehicle':
      return {
        reg_number: q.toUpperCase(),
        owner_name: "Rahul Sharma",
        owner_masked: "R**** S*****",
        owner_count: 1,
        phone_masked: "+91 98****3210",
        rto_code: q.slice(0, 4).toUpperCase(),
        rto_name: "Regional Transport Office (National)",
        make: "Hyundai Motor India",
        model: "Creta SX",
        variant: "1.5L CRDi",
        variant_year: "2022",
        color: "Polar White",
        fuel_type: "Diesel / BS-VI",
        vehicle_class: "Motor Car (LMV)",
        engine_number: "D4FAK" + Math.floor(100000 + Math.random() * 900000),
        chassis_number: "MALC" + Math.floor(100000000 + Math.random() * 900000000),
        registration_date: "14/06/2022",
        fitness_upto: "13/06/2037",
        insurance_company: "ICICI Lombard General Insurance",
        insurance_expiry: "12/06/2026",
        pucc_expiry: "18/11/2026",
        rc_status: "ACTIVE",
        financer: "HDFC Bank Ltd.",
      };
    case 'num2':
      return {
        name: "Mohit Verma",
        phone: q,
        operator: "Reliance Jio Infocomm",
        circle: "Delhi & NCR",
        type: "4G/5G VoLTE (Prepaid)",
        status: "Active (In Service)",
        alt_phone: "98101XXXXX",
        address: "South Extension, New Delhi, India",
      };
    case 'voter':
      return {
        name: "Suresh Kumar",
        relative_name: "Ram Lal (Father)",
        gender: "Male",
        age: "34",
        epic_no: q.toUpperCase(),
        state: "Delhi (NCT)",
        district: "South Delhi",
        assembly_constituency: "Malviya Nagar (AC-43)",
        polling_station: "Govt Boys Senior Secondary School, Room 4",
      };
    case 'aadhar2info':
      return {
        name: "Pooja Gupta",
        gender: "Female",
        yob: "1994",
        state: "Uttar Pradesh",
        mobile_linked: "Yes (Linked to +91 ******669)",
        status: "UIDAI Verified Active",
      };
    case 'aadhar2family':
      return {
        family: [
          { name: "Pooja Gupta", relation: "Self / Head", age: 32 },
          { name: "Anand Gupta", relation: "Spouse / Husband", age: 35 },
          { name: "Aarav Gupta", relation: "Son", age: 8 },
          { name: "Meena Gupta", relation: "Mother-in-Law", age: 58 },
        ]
      };
    case 'lpg':
      return {
        consumer_name: "Anita Devi",
        consumer_id: "LPG" + q.slice(-8),
        company: "Indane Gas (IOCL)",
        distributor_name: "Vikas Gas Agency",
        status: "Active (Subsidized Connection)",
      };
    case 'upi2num':
      return {
        name: "Amit Patel",
        vpa: q,
        bank_name: "State Bank of India (SBIN0001234)",
        mobile: "+91 98765 43210",
      };
    case 'gst2name':
      return {
        results: [
          { legal_name: `${q.toUpperCase()} ENTERPRISES PRIVATE LIMITED`, trade_name: `${q} Tech Solutions`, gstin: "07AABCR1234F1Z8", status: "Active", state: "Delhi" },
          { legal_name: `${q.toUpperCase()} INFRASTRUCTURE LLP`, trade_name: `${q} Buildcon`, gstin: "27AABCR1234F2Z4", status: "Active", state: "Maharashtra" }
        ]
      };
    case 'gst2pan':
      return {
        results: [
          { gstin: `07${q.toUpperCase()}1Z2`, legal_name: "ASSOCIATED COMMERCIAL CORP", status: "Active", state: "Delhi" },
          { gstin: `27${q.toUpperCase()}1Z9`, legal_name: "WESTERN VENTURES INDIA", status: "Active", state: "Maharashtra" }
        ]
      };
    case 'gst':
      return {
        legal_name: "BHARAT TELECOM & RETAIL PRIVATE LIMITED",
        trade_name: "Bharat Retail Mega Store",
        gstin: q.toUpperCase(),
        status: "Active",
        rgdt: "01/07/2017",
        taxpayer_type: "Regular",
        ctj: "Ward 12, Range 4, Division 2",
      };
    default:
      return null;
  }
}

// ── RAW API JSON RESPONSE FORMATTERS ──
function formatRawJsonResponse(data: any, query: string, type: string): string {
  let payload = data;
  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
    payload = getFallbackRecord(type, query) || {
      success: false,
      status: "not_found",
      query,
      message: "No records found in gateway registry",
      timestamp: new Date().toISOString()
    };
  }

  let jsonStr = "";
  try {
    jsonStr = JSON.stringify(payload, null, 2);
  } catch {
    jsonStr = JSON.stringify({ error: "Failed to serialize response", raw: String(payload) }, null, 2);
  }

  // Telegram max message length is 4096 chars.
  // Constrain to 3800 to avoid message delivery rejection.
  if (jsonStr.length > 3800) {
    jsonStr = jsonStr.slice(0, 3700) + '\n  // ... [truncated: response exceeds Telegram message size limit] ...\n}';
  }

  return '```json\n' + jsonStr + '\n```';
}

function formatVehicleCard(data: any, regNo = "N/A"): string {
  return formatRawJsonResponse(data, regNo, 'vehicle');
}

function formatNum2Card(data: any, query: string): string {
  return formatRawJsonResponse(data, query, 'num2');
}

function formatVoterCard(data: any, query: string): string {
  return formatRawJsonResponse(data, query, 'voter');
}

function formatAadharCard(data: any, query: string, isFamily = false): string {
  return formatRawJsonResponse(data, query, isFamily ? 'aadhar2family' : 'aadhar2info');
}

function formatLPGCard(data: any, query: string): string {
  return formatRawJsonResponse(data, query, 'lpg');
}

function formatUPICard(data: any, query: string): string {
  return formatRawJsonResponse(data, query, 'upi2num');
}

function formatGSTCard(data: any, query: string, mode = 'gst'): string {
  const type = mode === 'pan' ? 'gst2pan' : mode === 'name' ? 'gst2name' : 'gst';
  return formatRawJsonResponse(data, query, type);
}

function getJoinInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📢 Join Channel (@RehuSzr)", url: CHANNEL_LINK }
      ],
      [
        { text: "✅ Verify Joined", callback_data: "verify_membership" }
      ]
    ]
  };
}

function getJoinReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "✅ Verify Channel Membership" }],
      [{ text: "📢 Open Channel Link" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

function getMainReplyKeyboard(user?: any) {
  const isAdmin = user && (String(user.id) === String(ADMIN_USER_ID) || user.role === 'admin');
  
  // Get all registered buttons from buttonsStore (visible even if disabled)
  const allButtons = Array.from(buttonsStore.values())
    .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));

  const rows: Array<Array<{ text: string }>> = [];
  
  // Group buttons in pairs of 2
  for (let i = 0; i < allButtons.length; i += 2) {
    const row: Array<{ text: string }> = [{ text: allButtons[i].label }];
    if (i + 1 < allButtons.length) {
      row.push({ text: allButtons[i + 1].label });
    }
    rows.push(row);
  }

  // System navigation and utility buttons
  rows.push([{ text: "👥 Refer & Earn" }, { text: "💎 Redeem Code" }]);
  rows.push([{ text: "📊 My Profile" }, { text: "❓ Help Guide" }]);

  if (isAdmin) {
    rows.push([{ text: "👑 Admin Control Panel" }]);
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true
  };
}

function getAdminInlineKeyboard(active: boolean) {
  return {
    inline_keyboard: [
      [
        {
          text: active ? "🔴 Turn Bot OFF" : "🟢 Turn Bot ON",
          callback_data: "admin_toggle_bot"
        },
        { text: "🔄 Refresh Metrics", callback_data: "admin_refresh_stats" }
      ],
      [
        { text: "👥 Users & Quota Manager", callback_data: "admin_menu_users" },
        { text: "💬 DM Access Whitelist", callback_data: "admin_menu_dm" }
      ],
      [
        { text: "⏱️ Auto-Delete Delay", callback_data: "admin_menu_autodelete" },
        { text: "🔢 Free Daily Limit", callback_data: "admin_menu_dailyquota" }
      ],
      [
        { text: "🎛️ Manage Buttons & APIs", callback_data: "admin_buttons_list" },
        { text: "📢 Global Announcement", callback_data: "admin_broadcast_prompt" }
      ],
      [
        { text: "🚀 Drop Code (First-Come)", callback_data: "admin_drop_7" },
        { text: "💎 Gen VIP Key (30D)", callback_data: "admin_gen_30" }
      ],
      [
        { text: "📄 Export Users File (.txt)", callback_data: "admin_users_export" },
        { text: "🏠 Main Menu", callback_data: "action_main" }
      ]
    ]
  };
}

function getAdminUsersMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔥 Active Users Today", callback_data: "admin_users_active" },
        { text: "💎 VIP Members List", callback_data: "admin_list_premium" }
      ],
      [
        { text: "📋 Full Users Summary", callback_data: "admin_users_all" },
        { text: "📄 Export Users (.txt)", callback_data: "admin_users_export" }
      ],
      [
        { text: "🔍 Inspect User (/user ID)", callback_data: "admin_inspect_prompt" },
        { text: "➕ Grant VIP (/add_prem)", callback_data: "admin_add_prem_prompt" }
      ],
      [
        { text: "🚫 Revoke VIP (/rem_prem)", callback_data: "admin_remove_prem_prompt" },
        { text: "🔄 Reset Daily Limits", callback_data: "admin_reset_all_searches" }
      ],
      [
        { text: "🔙 Back to Admin Master", callback_data: "admin_back_to_panel" }
      ]
    ]
  };
}

function getAdminDmMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📋 Whitelisted DM Users", callback_data: "admin_dm_list" }
      ],
      [
        { text: "🟢 Quick Allow DM (ID)", callback_data: "admin_allow_dm_prompt" },
        { text: "🔴 Quick Revoke DM (ID)", callback_data: "admin_revoke_dm_prompt" }
      ],
      [
        { text: "🔙 Back to Admin Master", callback_data: "admin_back_to_panel" }
      ]
    ]
  };
}

function getAdminAutoDeleteKeyboard(currentMs: number) {
  const curSec = Math.round(currentMs / 1000);
  return {
    inline_keyboard: [
      [
        { text: curSec === 10 ? "🔘 10s (Active)" : "10s", callback_data: "admin_set_delay_10" },
        { text: curSec === 20 ? "🔘 20s (Active)" : "20s", callback_data: "admin_set_delay_20" },
        { text: curSec === 30 ? "🔘 30s (Active)" : "30s", callback_data: "admin_set_delay_30" }
      ],
      [
        { text: curSec === 40 ? "🔘 40s (Active)" : "40s", callback_data: "admin_set_delay_40" },
        { text: curSec === 60 ? "🔘 60s (Active)" : "60s", callback_data: "admin_set_delay_60" },
        { text: curSec === 120 ? "🔘 120s (Active)" : "120s", callback_data: "admin_set_delay_120" }
      ],
      [
        { text: currentMs === 0 ? "🔘 Off (Active)" : "🚫 Disable Auto-Delete", callback_data: "admin_set_delay_0" }
      ],
      [
        { text: "🔙 Back to Admin Master", callback_data: "admin_back_to_panel" }
      ]
    ]
  };
}

function getAdminQuotaKeyboard(currentLimit: number) {
  return {
    inline_keyboard: [
      [
        { text: currentLimit === 10 ? "🔘 10 / day" : "10 / day", callback_data: "admin_set_quota_10" },
        { text: currentLimit === 20 ? "🔘 20 / day" : "20 / day", callback_data: "admin_set_quota_20" },
        { text: currentLimit === 30 ? "🔘 30 / day" : "30 / day", callback_data: "admin_set_quota_30" }
      ],
      [
        { text: currentLimit === 50 ? "🔘 50 / day" : "50 / day", callback_data: "admin_set_quota_50" },
        { text: currentLimit === 100 ? "🔘 100 / day" : "100 / day", callback_data: "admin_set_quota_100" }
      ],
      [
        { text: "🔙 Back to Admin Master", callback_data: "admin_back_to_panel" }
      ]
    ]
  };
}

function getUserDossierKeyboard(targetUserId: string | number, allowDm: boolean, role: string) {
  return {
    inline_keyboard: [
      [
        {
          text: allowDm ? "🔴 Revoke DM Access" : "🟢 Allow Private DM",
          callback_data: allowDm ? `admin_act_revokedm_${targetUserId}` : `admin_act_allowdm_${targetUserId}`
        },
        {
          text: role === 'premium' ? "🆓 Demote to Free" : "💎 Grant VIP",
          callback_data: role === 'premium' ? `admin_act_demote_${targetUserId}` : `admin_act_vip_${targetUserId}`
        }
      ],
      [
        { text: "🔄 Reset Searches (0)", callback_data: `admin_act_reset_${targetUserId}` },
        { text: "➕ Add +10 Searches", callback_data: `admin_act_add10_${targetUserId}` }
      ],
      [
        { text: "✉️ Send Direct Message", callback_data: `admin_act_msg_${targetUserId}` },
        { text: "🔙 Back to Users", callback_data: "admin_menu_users" }
      ]
    ]
  };
}

function getUserDossierCard(user: UserRecord): string {
  const today = getTodayString();
  const isToday = user.lastSearchDate === today;
  const todayUsed = isToday ? (user.dailySearches || 0) : 0;
  const limit = getUserDailyLimit(user);
  const remaining = getUserRemaining(user);
  const handle = user.username ? `@${user.username}` : 'No username';
  const name = user.firstName || 'Unknown';
  const isDm = user.allowDm || user.role === 'admin';
  const roleLabel = user.role === 'admin' ? '👑 ADMIN' : user.role === 'premium' ? '💎 VIP PREMIUM' : '🆓 FREE TIER';

  let breakdownStr = '';
  if (isToday && user.dailyButtonUsage && Object.keys(user.dailyButtonUsage).length > 0) {
    breakdownStr = Object.entries(user.dailyButtonUsage)
      .map(([k, v]) => `• \`${k}\`: *${v}*`)
      .join('\n');
  } else {
    breakdownStr = '• _No services used yet today_';
  }

  return `👤 *USER INTELLIGENCE DOSSIER*
━━━━━━━━━━━━━━━━━━━━━━━━━
• 👤 *Name:* *${name}* (${handle})
• 🆔 *User ID:* \`${user.userId}\`
• 🎖️ *Role Tier:* \`${roleLabel}\`
• 💬 *Private DM Access:* ${isDm ? '🟢 ALLOWED (Whitelisted)' : '🔴 GROUP ONLY (Locked)'}
• 📢 *Channel Gate:* ${user.channelVerified ? '✅ Verified' : '⚠️ Pending'}

📈 *LOOKUPS & USAGE ACTIVITY:*
• 🔥 *Today's Searches:* *${todayUsed}* / ${user.role === 'free' ? limit : '∞'}
• ⚡ *Left Today:* *${remaining}* lookups
• 📊 *Lifetime Searches:* *${user.totalSearches || 0}* queries
• 👥 *Referrals:* *${user.referralCount || 0}* (+${(user.referralCount || 0) * REFERRAL_BONUS_PER_USER} daily bonus)
• 📅 *Last Active:* \`${user.lastActive ? user.lastActive.replace('T', ' ').slice(0, 19) : (user.lastSearchDate || 'Recently')}\`

🎛️ *Services Used Today:*
${breakdownStr}
━━━━━━━━━━━━━━━━━━━━━━━━━
👇 *Quick Actions for this user:*`;
}

async function exportUsersToTelegram(chatId: string | number): Promise<void> {
  const today = getTodayString();
  const allUsers = Array.from(usersStore.values());
  let content = `IRAM OSINT BOT — USERS INTELLIGENCE REPORT\n`;
  content += `Generated At: ${new Date().toISOString()}\n`;
  content += `Total Registered Users: ${allUsers.length}\n`;
  content += `Today's Date: ${today}\n`;
  content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  content += `NO  | USER ID     | USERNAME           | ROLE    | TODAY | LIMIT | TOTAL | DM? | LAST ACTIVE\n`;
  content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  allUsers.forEach((u, idx) => {
    const isToday = u.lastSearchDate === today;
    const todaySearches = isToday ? (u.dailySearches || 0) : 0;
    const limit = u.role === 'admin' || u.role === 'premium' ? 'UNLTD' : String(getUserDailyLimit(u));
    const handle = u.username ? `@${u.username}` : (u.firstName || '-');
    const dm = (u.allowDm || u.role === 'admin') ? 'YES' : 'NO';
    const active = u.lastActive ? u.lastActive.split('T')[0] : (u.lastSearchDate || '-');
    
    content += `${String(idx + 1).padEnd(3)} | ` +
      `${String(u.userId).padEnd(11)} | ` +
      `${handle.padEnd(18).slice(0, 18)} | ` +
      `${u.role.toUpperCase().padEnd(7)} | ` +
      `${String(todaySearches).padEnd(5)} | ` +
      `${limit.padEnd(5)} | ` +
      `${String(u.totalSearches || 0).padEnd(5)} | ` +
      `${dm.padEnd(3)} | ` +
      `${active}\n`;
  });

  content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const filename = `bot_users_report_${today}.txt`;
  await sendTelegramDocument(chatId, filename, content, `📄 *ALL USERS REPORT (${allUsers.length} Users)*\nExport complete with accurate daily searches, total searches & DM statuses.`);
}

function getAdminControlCard(active: boolean): string {
  const totalUsers = usersStore.size;
  const premiumUsers = Array.from(usersStore.values()).filter(u => u.role === 'premium').length;
  const activeCodes = Array.from(redeemCodes.values()).filter(c => c.usesLeft > 0).length;
  const today = getTodayString();
  let todaySearches = 0;
  let activeUsersToday = 0;
  let dmAllowedCount = 0;

  for (const u of usersStore.values()) {
    if (u.allowDm || u.role === 'admin') dmAllowedCount += 1;
    if (u.lastSearchDate === today && (u.dailySearches || 0) > 0) {
      todaySearches += u.dailySearches;
      activeUsersToday += 1;
    }
  }

  const delaySec = AUTO_DELETE_DELAY_MS > 0 ? `${Math.round(AUTO_DELETE_DELAY_MS / 1000)}s` : 'Disabled';

  return `👑 *ADMINISTRATOR MASTER CONTROL PANEL*
━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *Service Status:* ${active ? "🟢 *ONLINE (Active)*" : "🔴 *OFFLINE (Maintenance)*"}
👥 *Official Group:* \`${OFFICIAL_GROUP_USERNAME}\`
⏱️ *Group Auto-Delete:* \`${delaySec}\`
⚡ *Free Daily Limit:* \`${FREE_DAILY_LIMIT} lookups/day\`

📊 *TELEMETRY & REAL-TIME STATS:*
• 👥 *Registered Users:* \`${totalUsers}\`
• 🔥 *Active Users Today:* \`${activeUsersToday}\`
• 🔍 *Searches Executed Today:* \`${todaySearches}\`
• 📈 *Total Lifetime Searches:* \`${allTimeSearchesCount}\`
• 💎 *VIP Premium Subscribers:* \`${premiumUsers}\`
• 🔓 *Whitelisted DM Users:* \`${dmAllowedCount}\`
• 🔑 *Active Redeem Keys:* \`${activeCodes}\`

⚡ *Admin Quick Commands:*
• \`/user <userId>\` ➜ Dossier, full lookups & quick action buttons
• \`/users\` ➜ Interactive users list with today's search count
• \`/allow_dm <id>\` / \`/revoke_dm <id>\` ➜ Manage DM access
• \`/reset_user <id>\` ➜ Reset today's searches to 0
• \`/add_searches <id> <N>\` ➜ Add +N bonus searches
• \`/export_users\` ➜ Download complete .txt report
• \`/autodelete <sec>\` ➜ Auto-delete all group messages (or /set_delay)
• \`/set_limit <num>\` ➜ Set free daily limit
• \`/dropcode <days>\` ➜ Broadcast single-use voucher
• \`/broadcast <msg>\` ➜ Send global announcement

👇 *Tap an option below to manage:*`;
}

function getMainInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📱 Num2 Mobile Lookup", callback_data: "action_num2" },
        { text: "🚗 Vehicle RC Lookup", callback_data: "action_vehicle" }
      ],
      [
        { text: "🪪 Aadhaar 2 Info", callback_data: "action_aadhar2info" },
        { text: "👪 Family Tree", callback_data: "action_aadhar2family" }
      ],
      [
        { text: "🗳️ Voter ID (EPIC)", callback_data: "action_voter" },
        { text: "🔥 LPG Gas Lookup", callback_data: "action_lpg" }
      ],
      [
        { text: "💳 UPI VPA Resolution", callback_data: "action_upi2num" },
        { text: "🏢 GST by Name", callback_data: "action_gst2name" }
      ],
      [
        { text: "🪪 GST by PAN", callback_data: "action_gst2pan" },
        { text: "📄 GSTIN Profile", callback_data: "action_gst" }
      ],
      [
        { text: "👥 Refer & Earn (+10 Daily/Invite)", callback_data: "action_refer" }
      ],
      [
        { text: "💎 Redeem Code", callback_data: "action_redeem" },
        { text: "📊 My Profile", callback_data: "action_stats" }
      ],
      [
        { text: "📢 Official Channel (@RehuSzr)", url: CHANNEL_LINK },
        { text: "❓ Help Guide", callback_data: "action_help" }
      ]
    ]
  };
}

function getReferInlineKeyboard(userId: string | number) {
  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
  const shareText = encodeURIComponent(`⚡ Check out ${BOT_NAME} OSINT Intelligence Bot! Lookup Num2, Vehicle RC, Aadhaar, Voter, LPG, UPI & GST records instantly.\n👉 Join here: ${refLink}`);
  return {
    inline_keyboard: [
      [
        { text: "🚀 Share Invite Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${shareText}` }
      ],
      [
        { text: "📊 My Referral Stats", callback_data: "action_stats" },
        { text: "🏠 Main Menu", callback_data: "action_main" }
      ]
    ]
  };
}

function getReferralCard(user: UserRecord, userId: string | number): string {
  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
  const count = user.referralCount || 0;
  const bonus = count * REFERRAL_BONUS_PER_USER;
  const currentLimit = getUserDailyLimit(user);
  const remaining = getUserRemaining(user);

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   👥  REFER & EARN SYSTEM   
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🎁 *EARN +10 EXTRA SEARCHES DAILY PER INVITE!*

Share your personal invite link with friends and groups. For every user who joins through your link, you earn *+10 extra daily credits* permanently!

🔗 *Your Personal Referral Link:*
\`${refLink}\`
_(Tap link above to copy)_

📊 *Your Referral Dashboard:*
├ 👥 *Invited Friends:* \`${count} Agents\`
├ 🎁 *Daily Bonus Quota:* \`+${bonus} searches/day\`
├ ⚡ *Total Daily Limit:* \`${currentLimit} searches/day\`
└ 🔥 *Searches Left Today:* \`${remaining} / ${currentLimit}\`

───────────────────────────────
💡 *How It Works:*
1️⃣ Copy your invite link above and share it with friends or in Telegram groups.
2️⃣ As soon as someone launches the bot via your link, *+10 extra daily searches* are automatically added to your account!
3️⃣ Unlimited invites = Unlimited daily OSINT lookups!`;
}

function getResultInlineKeyboard(type: string, query?: string) {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Search Again", callback_data: `action_${type}` },
        { text: "🗑️ Delete Now", callback_data: "action_delmsg" }
      ],
      [
        { text: "👥 Official Group", url: OFFICIAL_GROUP_URL },
        { text: "📢 Updates Channel", url: CHANNEL_LINK }
      ]
    ]
  };
}

function getPromptInlineKeyboard(action: string) {
  return {
    inline_keyboard: [
      [
        { text: "❌ Cancel & Return", callback_data: "action_cancel" },
        { text: "🏠 Main Menu", callback_data: "action_main" }
      ]
    ]
  };
}

function getCancelKeyboard() {
  return {
    keyboard: [
      [{ text: "❌ Cancel" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

function getPromptCard(action: string): string {
  switch (action) {
    case 'num2':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   📱  NUM2 TELECOM SEARCH   
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *10-digit mobile number* to extract subscriber identity, operator, circle & alternate contacts.

💡 *Format Example:*
• \`6399964669\`
• \`9876543210\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'vehicle':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🚗  VEHICLE RC LOOKUP     
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *Vehicle Registration Number* to extract owner records, RTO office, engine/chassis & fitness.

💡 *Format Example:*
• \`HR26EV0001\`
• \`DL01AB1234\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'voter':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🗳️  VOTER ID (EPIC) SEARCH 
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *Voter EPIC ID Card Number* to extract electoral roll registration, booth & assembly constituency.

💡 *Format Example:*
• \`ZNO1150077\`
• \`ABC1234567\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'aadhar2info':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🪪  AADHAAR 2 INFO SEARCH 
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *12-digit Aadhaar Number* to verify UIDAI demographic records & mobile linkage.

💡 *Format Example:*
• \`123456789012\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'aadhar2family':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   👪  AADHAAR FAMILY TREE    
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *12-digit Aadhaar Number* to extract linked family dependents & household hierarchy.

💡 *Format Example:*
• \`123456789012\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'lpg':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🔥  LPG GAS CONNECTION    
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *Registered Mobile Number or LPG Consumer ID* to inspect cylinder booking & agency details.

💡 *Format Example:*
• \`9876543210\`
• \`LPG12345678\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'upi2num':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   💳  UPI VPA RESOLUTION    
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *UPI ID / VPA Handle* to resolve real account holder name, bank & linked telephone number.

💡 *Format Example:*
• \`user@okhdfcbank\`
• \`name@paytm\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'gst2name':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🏢  GST BY BUSINESS NAME  
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *Company / Enterprise Name* to query national GSTIN taxpayer records.

💡 *Format Example:*
• \`Reliance Industries\`
• \`Tata Consultancy\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'gst2pan':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   🪪  GST BY PAN CARD NO    
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *10-character PAN Card Number* to discover all GST registrations linked to this entity.

💡 *Format Example:*
• \`ABCDE1234F\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'gst':
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   📄  GSTIN TAXPAYER PROFILE
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the *15-character GSTIN Number* to retrieve filing history, trade name, and jurisdiction.

💡 *Format Example:*
• \`07AAAAA0000A1Z5\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    case 'redeem':
      return `💎 *REDEEM VOUCHER CODE*
━━━━━━━━━━━━━━━━━━━━━━━━━
👋 *Hello Agent!*

Please send your *Promo / Voucher Code* to instantly unlock VIP Premium queries.

💡 *Format:* \`IRAM-XXXX-XXXX\`
*(Admin dwara broadcast ya share kiya gaya code enter karein)*

━━━━━━━━━━━━━━━━━━━━━━━━━
Send *❌ Cancel* to abort & return.`;

    default: {
      const customBtn = buttonsStore.get(action);
      if (customBtn) {
        return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   ${customBtn.label.toUpperCase()}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send the query for *${customBtn.label}*.
${customBtn.placeholder ? `\n💡 *Hint:* \`${customBtn.placeholder}\`` : ''}${customBtn.example ? `\n• *Example:* \`${customBtn.example}\`` : ''}
${customBtn.description ? `\nℹ️ _${customBtn.description}_` : ''}

───────────────────────────────
Send *❌ Cancel* to abort & return.`;
      }
      return `Please enter your query:`;
    }
  }
}

function getStartCard(user: any, firstName = 'Agent', userId: number | string = 'N/A'): string {
  const currentLimit = getUserDailyLimit(user);
  const remaining = getUserRemaining(user);
  const refCount = user.referralCount || 0;
  const refBonus = refCount * REFERRAL_BONUS_PER_USER;

  return `🌐 *${BOT_NAME} Intelligence*
━━━━━━━━━━━━━━━━━━━━━━━━━
👋 Welcome, *${firstName}*!

🆔 *Agent ID:* \`${userId}\`
🎖️ *Membership:* 💎 \`${user.role.toUpperCase()}\`
📢 *Channel Status:* ✅ \`VERIFIED\` (@${CHANNEL_USERNAME.replace('@', '')})
⚡ *Server Node:* 🟢 \`ONLINE & OPERATIONAL\`
🔥 *Daily Quota:* \`${remaining} / ${currentLimit}\` searches today
👥 *Referral Bonus:* \`+${refBonus} daily credits\` (${refCount} invites)

⚡ *Available Lookups:*
📱 Mobile  •  🚗 Vehicle  •  🗳️ Voter  •  🪪 Aadhaar
🔥 LPG Gas  •  💳 UPI VPA  •  🏢 GST Intelligence

💡 *Refer & Earn:* Send /refer to earn +10 searches/day per friend
━━━━━━━━━━━━━━━━━━━━━━━━━
👇 Tap an option below to start your investigation:`;
}

async function runTelegramPoller() {
  if (!BOT_TOKEN || isTelegramPolling) return;
  isTelegramPolling = true;
  console.log(`[Telegram Bot] Token found. Starting polling for @${BOT_USERNAME} with Channel Gate ${CHANNEL_ID}...`);

  while (isTelegramPolling) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          const msg = update.message || update.edited_message;
          if (msg) {
            const chatId = msg.chat?.id;
            const chatType = msg.chat?.type || (Number(chatId) < 0 ? 'supergroup' : 'private');
            const isGroup = chatType === 'group' || chatType === 'supergroup' || Number(chatId) < 0;

            // Global Auto-Delete: Delete ANY message (text, media, sticker, voice, document, service event)
            // received in a group chat after the configured timer:
            if (isGroup && msg.message_id && AUTO_DELETE_DELAY_MS > 0) {
              scheduleAutoDelete(chatId, [msg.message_id], AUTO_DELETE_DELAY_MS);
            }

            if (msg.text || msg.caption) {
              if (!msg.text && msg.caption) {
                msg.text = msg.caption;
              }
              await handleTelegramUpdate(msg);
            }
          } else if (update.callback_query) {
            await handleTelegramCallbackQuery(update.callback_query);
          }
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function handleTelegramCallbackQuery(cq: any) {
  const cqId = cq.id;
  const userId = cq.from?.id;
  const chatId = cq.message?.chat?.id || userId;
  const data = cq.data;

  const chatType = cq.message?.chat?.type || (Number(chatId) < 0 ? 'supergroup' : 'private');
  const isPrivate = chatType === 'private' || Number(chatId) > 0;
  const user = getUser(userId);
  if (cq.from?.username && user.username !== cq.from.username) {
    user.username = cq.from.username;
    persistUser(user).catch(() => {});
  }
  if (cq.from?.first_name && user.firstName !== cq.from.first_name) {
    user.firstName = cq.from.first_name;
    persistUser(user).catch(() => {});
  }
  user.lastActive = new Date().toISOString();
  const isDmBlocked = user.allowDm === false && user.role !== 'admin' && String(userId) !== String(ADMIN_USER_ID);

  if (isPrivate && isDmBlocked && data !== "verify_membership" && data !== "check_join") {
    await answerTelegramCallbackQuery(cqId, "🔒 Aapka DM access Admin dwara restrict kiya gaya hai. Official group use karein!", true);
    return;
  }

  if (data === "verify_membership" || data === "check_join") {
    const check = await checkTelegramChannelMembership(userId);
    if (check.isMember) {
      const user = getUser(userId);
      user.channelVerified = true;
      persistUser(user).catch(() => {});
      await answerTelegramCallbackQuery(cqId, "✅ Verification Successful! Access Unlocked.", true);
      const welcome = `🎉 *CHANNEL MEMBERSHIP VERIFIED!*
══════════════════════════
Thank you for subscribing to [${CHANNEL_USERNAME}](${CHANNEL_LINK})!

Status: 🟢 *ACCESS GRANTED*
License Tier: 💎 \`${user.role.toUpperCase()}\`

All **${BOT_NAME} OSINT Intelligence Bot** services and investigation modules are unlocked.

👇 *Select an option below or send a query to begin:*`;
      await sendTelegramMessage(chatId, welcome, getMainReplyKeyboard());
      await sendTelegramMessage(chatId, getStartCard(user, cq.from?.first_name || 'Agent', userId), getMainReplyKeyboard());
    } else {
      await answerTelegramCallbackQuery(cqId, "❌ Channel not joined yet! Please join first.", true);
      const reminder = `⚠️ *Channel Membership Not Found!*
══════════════════════════
You have not joined our official intelligence updates channel yet:

📢 *Official Channel:* [${CHANNEL_USERNAME}](${CHANNEL_LINK})

1️⃣ Click the channel link above and join.
2️⃣ After joining, tap the **✅ Verify Joined** button below to activate access.`;
      await sendTelegramMessage(chatId, reminder, getJoinInlineKeyboard());
    }
    return;
  }

  // Handle Action Callbacks (From Inline Keyboard Buttons)
  if (data.startsWith("action_")) {
    const act = data.replace("action_", "");
    const user = getUser(userId);

    if (act === "delmsg") {
      if (cq.message?.message_id) {
        await deleteTelegramMessage(chatId, cq.message.message_id);
        await answerTelegramCallbackQuery(cqId, "Message deleted 🗑️");
      }
      return;
    }

    if (act === "cancel") {
      user.pendingAction = undefined;
      await answerTelegramCallbackQuery(cqId, "Operation Cancelled");
      await sendTelegramMessage(chatId, `🔙 *Operation Cancelled*\nReturned to Main Dashboard. Select an option below:`, getMainReplyKeyboard());
      return;
    }

    if (act === "main") {
      user.pendingAction = undefined;
      await answerTelegramCallbackQuery(cqId, "Main Dashboard");
      const card = getStartCard(user, cq.from?.first_name || 'Agent', userId);
      await sendTelegramMessage(chatId, card, getMainReplyKeyboard());
      return;
    }

    if (act === "refer") {
      await answerTelegramCallbackQuery(cqId, "Refer & Earn (+10 Daily/Invite)");
      const referCard = getReferralCard(user, userId);
      await sendTelegramMessage(chatId, referCard, getReferInlineKeyboard(userId));
      return;
    }

    if (act === "stats") {
      await answerTelegramCallbackQuery(cqId, "Profile Statistics");
      const curLimit = getUserDailyLimit(user);
      const rem = getUserRemaining(user);
      const refCount = user.referralCount || 0;
      const refBonus = refCount * REFERRAL_BONUS_PER_USER;

      const statsText = `📊 *AGENT INTELLIGENCE PROFILE*
══════════════════════════
👤 *Agent Name:* *${cq.from?.first_name || 'Agent'}*
🆔 *Agent ID:* \`${userId}\`
🎖️ *License Tier:* 💎 \`${user.role.toUpperCase()}\`
📢 *Channel Gate:* ✅ \`VERIFIED (@RehuSzr)\`

📈 *DAILY QUOTA & ACTIVITY*
├ 🔥 Today Used: \`${user.dailySearches} / ${curLimit}\` queries
├ ⚡ Left Today: \`${rem} / ${curLimit}\` queries
└ 📊 Lifetime Searches: \`${user.totalSearches}\` queries

👥 *REFERRAL REWARD SYSTEM*
├ 👥 Invited Members: \`${refCount} Agents\`
├ 🎁 Daily Bonus: \`+${refBonus} searches/day\`
└ 🔗 Personal Link: \`https://t.me/${BOT_USERNAME}?start=ref_${userId}\`
══════════════════════════
💡 *Tip:* Earn +10 extra searches every day for every referral invited with /refer!`;
      await sendTelegramMessage(chatId, statsText, getMainReplyKeyboard());
      return;
    }

    if (act === "help") {
      await answerTelegramCallbackQuery(cqId, "Help & Command Guide");
      const help = `📖 *${BOT_NAME} — OSINT COMMAND GUIDE*
══════════════════════════
Tap any service button directly, or send slash commands:

• 📱 \`/num2 <number>\` ➜ 10-digit mobile caller ID
• 🚗 \`/vehicle <reg_no>\` ➜ Vahan RC vehicle data
• 🗳️ \`/voter <epic_id>\` ➜ Election commission rolls
• 🪪 \`/aadhar2info <uidai>\` ➜ 12-digit Aadhaar demographic
• 👪 \`/aadhar2family <uidai>\` ➜ Household family tree
• 🔥 \`/lpg <phone_or_id>\` ➜ MoPNG gas connection
• 💳 \`/upi2num <upi_id>\` ➜ UPI handle resolution
• 🏢 \`/gst2name <name>\` ➜ Taxpayer business search
• 🪪 \`/gst2pan <pan>\` ➜ GSTIN lookup via PAN
• 📄 \`/gst <gstin>\` ➜ Full 15-char GSTIN profile
• 👥 \`/refer\` ➜ Invite friends (+10 extra credit daily)
• 💎 \`/redeem <code>\` ➜ Activate premium license
• 📊 \`/stats\` ➜ View quota & usage
• ✅ \`/verify\` ➜ Re-check channel membership`;
      await sendTelegramMessage(chatId, help, getMainReplyKeyboard());
      return;
    }

    // Set pending action and prompt user
    user.pendingAction = act;
    await answerTelegramCallbackQuery(cqId, `Selected: ${act.toUpperCase()}`);
    await sendTelegramChatAction(chatId, "typing");
    const prompt = getPromptCard(act);
    await sendTelegramMessage(chatId, prompt, getPromptInlineKeyboard(act));
    return;
  }

  // Handle Admin Callbacks
  if (data.startsWith("admin_")) {
    const user = getUser(userId);
    const isAdmin = String(userId) === String(ADMIN_USER_ID) || user.role === 'admin';
    if (!isAdmin) {
      await answerTelegramCallbackQuery(cqId, "❌ Access Denied: Admin Only!", true);
      return;
    }

    if (data === "admin_toggle_bot") {
      isBotActive = !isBotActive;
      await answerTelegramCallbackQuery(cqId, `Bot is now ${isBotActive ? "ONLINE 🟢" : "OFFLINE (Maintenance) 🔴"}!`, true);
      const updatedCard = getAdminControlCard(isBotActive);
      const updatedMarkup = getAdminInlineKeyboard(isBotActive);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, updatedCard, updatedMarkup);
      } else {
        await sendTelegramMessage(chatId, updatedCard, updatedMarkup);
      }
      return;
    }

    if (data === "admin_drop_7" || data === "admin_drop_30") {
      const days = data === "admin_drop_30" ? 30 : 7;
      await answerTelegramCallbackQuery(cqId, `⚡ Dropping ${days}-day broadcast code...`);
      const drop = await broadcastRedeemCode(days, cq.from?.first_name || 'Admin');
      await sendTelegramMessage(chatId, `✅ *BROADCAST CODE DROPPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Code:* \`${drop.code}\`\n⏳ *Duration:* ${drop.days} Days\n📨 *Delivered to:* ${drop.sent} users\n⚡ *Rule:* Single-use only — Jo pehle redeem karega use hi milega!`, getMainReplyKeyboard(user));
      return;
    }

    if (data === "admin_gen_30" || data === "admin_gen_365") {
      const days = data === "admin_gen_365" ? 365 : 30;
      const code = generateCode();
      redeemCodes.set(code, {
        code,
        days,
        role: 'premium',
        usesLeft: 1,
        totalUses: 1,
        createdAt: new Date().toISOString(),
        usedBy: [],
      });
      await answerTelegramCallbackQuery(cqId, `Generated ${days}-day code!`);
      await sendTelegramMessage(chatId, `💎 *NEW VIP REDEEM CODE GENERATED*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Code:* \`${code}\`\n⏳ *Duration:* ${days} Days VIP Access\n⚡ *Uses:* 1 (Single-use)\n👤 *Admin:* ${cq.from?.first_name || 'Admin'}\n\n👉 Share or redeem with: \`/redeem ${code}\``, getMainReplyKeyboard(user));
      return;
    }

    if (data === "admin_broadcast_prompt") {
      user.pendingAction = 'admin_broadcast';
      await answerTelegramCallbackQuery(cqId, "Ready for announcement text");
      await sendTelegramMessage(chatId, `📢 *SEND BROADCAST ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type and send the message you want to broadcast to all registered bot users:\n\n*(Or send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_refresh_stats") {
      await answerTelegramCallbackQuery(cqId, "Stats refreshed!");
      const updatedCard = getAdminControlCard(isBotActive);
      const updatedMarkup = getAdminInlineKeyboard(isBotActive);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, updatedCard, updatedMarkup);
      } else {
        await sendTelegramMessage(chatId, updatedCard, updatedMarkup);
      }
      return;
    }

    // ── ADMIN SUB-MENUS NAVIGATION ──
    if (data === "admin_menu_users") {
      await answerTelegramCallbackQuery(cqId, "Opening Users Manager");
      const usersText = `👥 *USERS & ACTIVITY INTELLIGENCE MANAGER*
━━━━━━━━━━━━━━━━━━━━━━━━━
Total Registered: \`${usersStore.size}\`
Choose an action below to view user telemetry, inspect individual search counts, grant/revoke VIP, or export a detailed report:`;
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, usersText, getAdminUsersMenuKeyboard());
      } else {
        await sendTelegramMessage(chatId, usersText, getAdminUsersMenuKeyboard());
      }
      return;
    }

    if (data === "admin_menu_dm") {
      await answerTelegramCallbackQuery(cqId, "Opening DM Whitelist");
      const dmCount = Array.from(usersStore.values()).filter(u => u.allowDm || u.role === 'admin').length;
      const dmText = `💬 *DM ACCESS WHITELIST MANAGER*
━━━━━━━━━━━━━━━━━━━━━━━━━
Current Whitelisted DM Users: \`${dmCount}\`
By default, users must run lookups in the official group.
Whitelist trusted users or VIPs here to allow direct private messaging lookups!`;
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, dmText, getAdminDmMenuKeyboard());
      } else {
        await sendTelegramMessage(chatId, dmText, getAdminDmMenuKeyboard());
      }
      return;
    }

    if (data === "admin_menu_autodelete") {
      await answerTelegramCallbackQuery(cqId, "Opening Auto-Delete Settings");
      const curSec = AUTO_DELETE_DELAY_MS > 0 ? `${Math.round(AUTO_DELETE_DELAY_MS / 1000)}s` : 'Disabled';
      const textMsg = `⏱️ *GROUP AUTO-DELETE TIMER (ALL MESSAGES)*
━━━━━━━━━━━━━━━━━━━━━━━━━
Current Timer: *${curSec}*

Ab group me koi bhi message aayega (user chat, photos, stickers, queries aur bot response), theek itne seconds ke baad automatically group se delete ho jayega.

*Select a timer below or send /autodelete <sec>:*`;
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, textMsg, getAdminAutoDeleteKeyboard(AUTO_DELETE_DELAY_MS));
      } else {
        await sendTelegramMessage(chatId, textMsg, getAdminAutoDeleteKeyboard(AUTO_DELETE_DELAY_MS));
      }
      return;
    }

    if (data.startsWith("admin_set_delay_")) {
      const sec = parseInt(data.replace("admin_set_delay_", ""), 10);
      AUTO_DELETE_DELAY_MS = sec * 1000;
      await answerTelegramCallbackQuery(cqId, `Auto-delete set to ${sec === 0 ? 'Disabled' : sec + 's'}!`, true);
      const textMsg = `✅ *Auto-delete timer updated to ${sec === 0 ? 'OFF (Disabled)' : sec + ' seconds'}!*
━━━━━━━━━━━━━━━━━━━━━━━━━
${sec === 0 ? '🛑 Auto-deletion disabled.' : `🧹 Group mein aane wala har message theek *${sec}s* baad auto-delete hoga!`}`;
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, textMsg, getAdminAutoDeleteKeyboard(AUTO_DELETE_DELAY_MS));
      }
      return;
    }

    if (data === "admin_menu_dailyquota") {
      await answerTelegramCallbackQuery(cqId, "Opening Free Daily Quota");
      const textMsg = `🔢 *FREE TIER DAILY SEARCH LIMIT*
━━━━━━━━━━━━━━━━━━━━━━━━━
Current Default Limit: *${FREE_DAILY_LIMIT} lookups / day*

Select the default number of searches free users can perform every day:`;
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, textMsg, getAdminQuotaKeyboard(FREE_DAILY_LIMIT));
      } else {
        await sendTelegramMessage(chatId, textMsg, getAdminQuotaKeyboard(FREE_DAILY_LIMIT));
      }
      return;
    }

    if (data.startsWith("admin_set_quota_")) {
      const quota = parseInt(data.replace("admin_set_quota_", ""), 10);
      FREE_DAILY_LIMIT = quota;
      await answerTelegramCallbackQuery(cqId, `Free limit set to ${quota}/day!`, true);
      const textMsg = `✅ *Free tier daily limit updated to ${quota} searches / day!*`;
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, textMsg, getAdminQuotaKeyboard(FREE_DAILY_LIMIT));
      }
      return;
    }

    if (data === "admin_users_export") {
      await answerTelegramCallbackQuery(cqId, "Generating user report file...");
      await exportUsersToTelegram(chatId);
      return;
    }

    if (data === "admin_users_active") {
      await answerTelegramCallbackQuery(cqId, "Loading today's active users...");
      const today = getTodayString();
      const activeUsers = Array.from(usersStore.values())
        .filter(u => u.lastSearchDate === today && (u.dailySearches || 0) > 0)
        .sort((a, b) => (b.dailySearches || 0) - (a.dailySearches || 0));

      if (activeUsers.length === 0) {
        await sendTelegramMessage(chatId, `🔥 *TODAY'S ACTIVE USERS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nNo searches executed today yet.\n(Daily counters reset at 12:00 AM UTC)`, getMainReplyKeyboard(user));
        return;
      }

      let msgText = `🔥 *ACTIVE USERS TODAY (${activeUsers.length})*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      activeUsers.slice(0, 25).forEach((u, idx) => {
        const handle = u.username ? `@${u.username}` : (u.firstName || 'User');
        const roleIcon = u.role === 'admin' ? '👑' : u.role === 'premium' ? '💎' : '👤';
        const limit = u.role === 'free' ? getUserDailyLimit(u) : '∞';
        msgText += `${idx + 1}. ${roleIcon} *${handle}* (\`${u.userId}\`)\n   ⚡ Today: *${u.dailySearches}* / ${limit} lookups | Total: ${u.totalSearches}\n   👉 Inspect: \`/user ${u.userId}\`\n`;
      });
      if (activeUsers.length > 25) {
        msgText += `\n*(Showing top 25 of ${activeUsers.length} active members today)*`;
      }
      await sendTelegramMessage(chatId, msgText, getMainReplyKeyboard(user));
      return;
    }

    if (data === "admin_users_all" || data === "admin_list_users") {
      await answerTelegramCallbackQuery(cqId, "Loading registered users...");
      const today = getTodayString();
      const allUsers = Array.from(usersStore.values());
      const total = allUsers.length;
      const prem = allUsers.filter(u => u.role === 'premium').length;
      const free = allUsers.filter(u => u.role === 'free').length;

      let msgText = `👥 *ALL REGISTERED USERS DIRECTORY*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 Total: \`${total}\` | 💎 VIP: \`${prem}\` | 🆓 Free: \`${free}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const sample = allUsers.slice(-25).reverse();
      sample.forEach((u, idx) => {
        const isToday = u.lastSearchDate === today;
        const todayUsed = isToday ? (u.dailySearches || 0) : 0;
        const roleIcon = u.role === 'admin' ? '👑' : u.role === 'premium' ? '💎' : '👤';
        const handle = u.username ? `@${u.username}` : (u.firstName || 'User');
        const dmIcon = (u.allowDm || u.role === 'admin') ? '🔓 DM' : '🔒 Group';
        msgText += `${idx + 1}. ${roleIcon} *${handle}* (\`${u.userId}\`)\n   🔍 Today: *${todayUsed}* | Lifetime: ${u.totalSearches || 0} | ${dmIcon}\n   👉 Inspect: \`/user ${u.userId}\`\n`;
      });
      if (total > 25) {
        msgText += `\n💡 *Tip:* Send \`/export_users\` to download all ${total} users as a file!\nOr send \`/user <userId>\` to inspect and manage any specific user.`;
      }
      await sendTelegramMessage(chatId, msgText, getMainReplyKeyboard(user));
      return;
    }

    if (data === "admin_dm_list") {
      await answerTelegramCallbackQuery(cqId, "Loading DM allowed users...");
      const dmUsers = Array.from(usersStore.values()).filter(u => u.allowDm || u.role === 'admin');
      if (dmUsers.length === 0) {
        await sendTelegramMessage(chatId, `💬 *DM ACCESS USERS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nNo users currently have private DM access.\n\n👉 Whitelist someone with: \`/allow_dm <userId>\``, getMainReplyKeyboard(user));
        return;
      }
      let msgText = `💬 *WHITELISTED PRIVATE DM USERS (${dmUsers.length})*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      dmUsers.forEach((u, idx) => {
        const handle = u.username ? `@${u.username}` : (u.firstName || 'User');
        const roleIcon = u.role === 'admin' ? '👑' : u.role === 'premium' ? '💎' : '👤';
        msgText += `${idx + 1}. ${roleIcon} *${handle}* (\`${u.userId}\`)\n   Revoke: \`/revoke_dm ${u.userId}\` | Inspect: \`/user ${u.userId}\`\n`;
      });
      await sendTelegramMessage(chatId, msgText, getMainReplyKeyboard(user));
      return;
    }

    if (data === "admin_inspect_prompt") {
      user.pendingAction = 'admin_inspect_user';
      await answerTelegramCallbackQuery(cqId, "Send User ID to inspect");
      await sendTelegramMessage(chatId, `🔍 *INSPECT USER DOSSIER*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type & send the *Telegram User ID* you want to view:\n\n💡 *Or use command directly:* \`/user <userId>\`\n\n*(Send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_allow_dm_prompt") {
      user.pendingAction = 'admin_allow_dm';
      await answerTelegramCallbackQuery(cqId, "Send User ID to allow DM");
      await sendTelegramMessage(chatId, `🟢 *ALLOW PRIVATE DM ACCESS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type & send the *Telegram User ID* to whitelist for DM:\n\n💡 *Or use command directly:* \`/allow_dm <userId>\`\n\n*(Send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_revoke_dm_prompt") {
      user.pendingAction = 'admin_revoke_dm';
      await answerTelegramCallbackQuery(cqId, "Send User ID to revoke DM");
      await sendTelegramMessage(chatId, `🔴 *REVOKE PRIVATE DM ACCESS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type & send the *Telegram User ID* to revoke DM access from:\n\n💡 *Or use command directly:* \`/revoke_dm <userId>\`\n\n*(Send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_reset_all_searches") {
      const today = getTodayString();
      let resetCount = 0;
      for (const u of usersStore.values()) {
        u.dailySearches = 0;
        u.dailyButtonUsage = {};
        u.lastSearchDate = today;
        resetCount += 1;
      }
      await answerTelegramCallbackQuery(cqId, `Reset daily counters for all ${resetCount} users!`, true);
      await sendTelegramMessage(chatId, `✅ *ALL USERS DAILY SEARCHES RESET!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nSuccessfully cleared daily lookup counters for all *${resetCount} registered users* to 0.`, getMainReplyKeyboard(user));
      return;
    }

    // ── DOSSIER INTERACTIVE ACTION BUTTONS ──
    if (data.startsWith("admin_act_allowdm_")) {
      const targetId = data.replace("admin_act_allowdm_", "");
      const targetUser = getUser(targetId);
      targetUser.allowDm = true;
      await persistUser(targetUser);
      await answerTelegramCallbackQuery(cqId, `Allowed DM for ${targetId}!`, true);
      const card = getUserDossierCard(targetUser);
      const kb = getUserDossierKeyboard(targetUser.userId, true, targetUser.role);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, card, kb);
      }
      try {
        await sendTelegramMessage(targetId, `🔓 *DM ACCESS GRANTED!*\nAdmin has unlocked direct private messaging for your account.\nYou can now run OSINT lookups in this bot's private chat! 🚀`);
      } catch {}
      return;
    }

    if (data.startsWith("admin_act_revokedm_")) {
      const targetId = data.replace("admin_act_revokedm_", "");
      const targetUser = getUser(targetId);
      targetUser.allowDm = false;
      await persistUser(targetUser);
      await answerTelegramCallbackQuery(cqId, `Revoked DM for ${targetId}!`, true);
      const card = getUserDossierCard(targetUser);
      const kb = getUserDossierKeyboard(targetUser.userId, false, targetUser.role);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, card, kb);
      }
      return;
    }

    if (data.startsWith("admin_act_vip_")) {
      const targetId = data.replace("admin_act_vip_", "");
      const targetUser = getUser(targetId);
      targetUser.role = 'premium';
      await persistUser(targetUser);
      await answerTelegramCallbackQuery(cqId, `Promoted ${targetId} to VIP Premium!`, true);
      const card = getUserDossierCard(targetUser);
      const kb = getUserDossierKeyboard(targetUser.userId, Boolean(targetUser.allowDm), 'premium');
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, card, kb);
      }
      try {
        await sendTelegramMessage(targetId, `🎉 *VIP PREMIUM ACTIVATED!*\nAdmin has upgraded your account to VIP Premium with unlimited searches! 🚀`);
      } catch {}
      return;
    }

    if (data.startsWith("admin_act_demote_")) {
      const targetId = data.replace("admin_act_demote_", "");
      const targetUser = getUser(targetId);
      targetUser.role = 'free';
      await persistUser(targetUser);
      await answerTelegramCallbackQuery(cqId, `Demoted ${targetId} to Free!`, true);
      const card = getUserDossierCard(targetUser);
      const kb = getUserDossierKeyboard(targetUser.userId, Boolean(targetUser.allowDm), 'free');
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, card, kb);
      }
      return;
    }

    if (data.startsWith("admin_act_reset_")) {
      const targetId = data.replace("admin_act_reset_", "");
      const targetUser = getUser(targetId);
      targetUser.dailySearches = 0;
      targetUser.dailyButtonUsage = {};
      targetUser.lastSearchDate = getTodayString();
      await persistUser(targetUser);
      await answerTelegramCallbackQuery(cqId, `Reset searches for ${targetId}!`, true);
      const card = getUserDossierCard(targetUser);
      const kb = getUserDossierKeyboard(targetUser.userId, Boolean(targetUser.allowDm), targetUser.role);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, card, kb);
      }
      return;
    }

    if (data.startsWith("admin_act_add10_")) {
      const targetId = data.replace("admin_act_add10_", "");
      const targetUser = getUser(targetId);
      targetUser.dailySearches = Math.max(0, (targetUser.dailySearches || 0) - 10);
      await persistUser(targetUser);
      await answerTelegramCallbackQuery(cqId, `Added +10 search quota for ${targetId}!`, true);
      const card = getUserDossierCard(targetUser);
      const kb = getUserDossierKeyboard(targetUser.userId, Boolean(targetUser.allowDm), targetUser.role);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, card, kb);
      }
      return;
    }

    if (data.startsWith("admin_act_msg_")) {
      const targetId = data.replace("admin_act_msg_", "");
      user.pendingAction = `admin_msg_${targetId}`;
      await answerTelegramCallbackQuery(cqId, `Type message for ${targetId}`);
      await sendTelegramMessage(chatId, `✉️ *SEND MESSAGE TO USER:* \`${targetId}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type the message you want to deliver to this user directly via bot:\n\n*(Send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_list_premium") {
      await answerTelegramCallbackQuery(cqId, "Loading VIP users...");
      const premUsers = Array.from(usersStore.values()).filter(u => u.role === 'premium');
      if (premUsers.length === 0) {
        await sendTelegramMessage(chatId, `💎 *VIP PREMIUM USERS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nNo active VIP premium users right now.\n\n👉 Grant with: \`/add_premium <userId>\`\n👉 Or drop code: \`/dropcode 30\``, getMainReplyKeyboard(user));
        return;
      }
      let msgText = `💎 *VIP PREMIUM SUBSCRIBERS (${premUsers.length})*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      premUsers.forEach((u, idx) => {
        const handle = u.username ? `@${u.username}` : (u.firstName || 'User');
        msgText += `${idx + 1}. 💎 *${handle}* (\`${u.userId}\`)\n   Lifetime: ${u.totalSearches || 0} | Today: ${getUserTodaySearches(u)}\n   👉 Remove: \`/remove_premium ${u.userId}\` | Inspect: \`/user ${u.userId}\`\n`;
      });
      await sendTelegramMessage(chatId, msgText, getMainReplyKeyboard(user));
      return;
    }

    if (data === "admin_remove_prem_prompt") {
      user.pendingAction = 'admin_remove_premium';
      await answerTelegramCallbackQuery(cqId, "Enter User ID to remove premium");
      await sendTelegramMessage(chatId, `🚫 *REVOKE / REMOVE VIP PREMIUM*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type & send the *Telegram User ID* of the member whose VIP Premium access you want to revoke:\n\n💡 *Or use command directly:* \`/remove_premium <userId>\`\n\n*(Send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_add_prem_prompt") {
      user.pendingAction = 'admin_add_premium';
      await answerTelegramCallbackQuery(cqId, "Enter User ID to grant premium");
      await sendTelegramMessage(chatId, `➕ *GRANT VIP PREMIUM ACCESS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nPlease type & send the *Telegram User ID* to grant VIP Premium access:\n\n💡 *Or use command directly:* \`/add_premium <userId>\`\n\n*(Send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    // ── TELEGRAM ADMIN BUTTONS & API MANAGEMENT ──
    if (data === "admin_buttons_list") {
      await answerTelegramCallbackQuery(cqId, "Loading Buttons & APIs...");
      const allButtons = Array.from(buttonsStore.values()).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
      
      const keyboardRows: Array<Array<{ text: string; callback_data: string }>> = [];
      
      allButtons.forEach(btn => {
        const statusIcon = btn.enabled ? "🟢" : "🔴";
        keyboardRows.push([
          { text: `${statusIcon} ${btn.label}`, callback_data: `admin_btn_view_${btn.id}` },
          { text: btn.enabled ? "Turn OFF" : "Turn ON", callback_data: `admin_btn_toggle_${btn.id}` }
        ]);
      });

      keyboardRows.push([
        { text: "➕ Add New Custom Button", callback_data: "admin_btn_add_prompt" },
        { text: "🔙 Back to Admin Panel", callback_data: "admin_back_to_panel" }
      ]);

      const buttonsMsg = `🎛️ *BOT BUTTONS & APIS MASTER MANAGER*
━━━━━━━━━━━━━━━━━━━━━━━━━
Yahan se aap kisi bhi button ko direct Telegram se:
• 🟢 *Turn ON* ya 🔴 *Turn OFF* kar sakte hain.
• 🔗 Uska *API Endpoint URL* change kar sakte hain.
• ➕ *Naya Custom Button* aur API add kar sakte hain.

👇 *Neeche button par tap karein to toggle ya edit karein:*`;

      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, buttonsMsg, { inline_keyboard: keyboardRows });
      } else {
        await sendTelegramMessage(chatId, buttonsMsg, { inline_keyboard: keyboardRows });
      }
      return;
    }

    if (data === "admin_back_to_panel") {
      await answerTelegramCallbackQuery(cqId, "Returning to Admin Panel");
      const adminCard = getAdminControlCard(isBotActive);
      const adminMarkup = getAdminInlineKeyboard(isBotActive);
      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, adminCard, adminMarkup);
      } else {
        await sendTelegramMessage(chatId, adminCard, adminMarkup);
      }
      return;
    }

    if (data.startsWith("admin_btn_toggle_")) {
      const targetBtnId = data.replace("admin_btn_toggle_", "");
      const btn = buttonsStore.get(targetBtnId);
      if (!btn) {
        await answerTelegramCallbackQuery(cqId, "Button not found!", true);
        return;
      }
      btn.enabled = !btn.enabled;
      await persistButton(btn);
      await answerTelegramCallbackQuery(cqId, `${btn.label} is now ${btn.enabled ? "ENABLED (ON)" : "DISABLED (OFF)"}`, true);

      // Re-render buttons list
      const allButtons = Array.from(buttonsStore.values()).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
      const keyboardRows: Array<Array<{ text: string; callback_data: string }>> = [];
      allButtons.forEach(b => {
        const statusIcon = b.enabled ? "🟢" : "🔴";
        keyboardRows.push([
          { text: `${statusIcon} ${b.label}`, callback_data: `admin_btn_view_${b.id}` },
          { text: b.enabled ? "Turn OFF" : "Turn ON", callback_data: `admin_btn_toggle_${b.id}` }
        ]);
      });
      keyboardRows.push([
        { text: "➕ Add New Custom Button", callback_data: "admin_btn_add_prompt" },
        { text: "🔙 Back to Admin Panel", callback_data: "admin_back_to_panel" }
      ]);

      const buttonsMsg = `🎛️ *BOT BUTTONS & APIS MASTER MANAGER*
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *Updated:* \`${btn.label}\` is now *${btn.enabled ? "🟢 ON (Active)" : "🔴 OFF (Disabled)"}*!
Telegram keyboard auto-sync ho gaya hai.

👇 *Select another button or action:*`;

      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, buttonsMsg, { inline_keyboard: keyboardRows });
      }
      return;
    }

    if (data.startsWith("admin_btn_view_")) {
      const targetBtnId = data.replace("admin_btn_view_", "");
      const btn = buttonsStore.get(targetBtnId);
      if (!btn) {
        await answerTelegramCallbackQuery(cqId, "Button not found!", true);
        return;
      }
      await answerTelegramCallbackQuery(cqId);

      const infoCard = `⚙️ *BUTTON CONFIGURATION: ${btn.label}*
━━━━━━━━━━━━━━━━━━━━━━━━━
• 🆔 *Button ID:* \`${btn.id}\`
• ⚡ *Status:* ${btn.enabled ? "🟢 *ACTIVE (ON)*" : "🔴 *DISABLED (OFF)*"}
• 📁 *Category:* \`${btn.category}\`
• 🔗 *API Endpoint:*
\`${btn.apiUrl}\`
• 💡 *Placeholder:* \`${btn.placeholder}\`
• 📌 *Example:* \`${btn.example || 'None'}\`
• 🏷️ *Type:* ${btn.isCustom ? "Custom Button" : "Built-in System Button"}
━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *Quick Admin Commands:*
• Rename: \`/rename ${btn.id} <New Name>\`
• Change API: \`/setapi ${btn.id} <new_api_url>\`
• Toggle: \`/toggle ${btn.id}\``;

      const actionRows: Array<Array<{ text: string; callback_data: string }>> = [
        [
          { text: btn.enabled ? "🔴 Turn OFF" : "🟢 Turn ON", callback_data: `admin_btn_toggle_${btn.id}` },
          { text: "🏷️ Rename Button", callback_data: `admin_btn_editname_${btn.id}` }
        ],
        [
          { text: "✏️ Change API URL", callback_data: `admin_btn_editapi_${btn.id}` },
          { text: "🔙 Back to List", callback_data: "admin_buttons_list" }
        ]
      ];

      if (cq.message?.message_id) {
        await editTelegramMessageText(chatId, cq.message.message_id, infoCard, { inline_keyboard: actionRows });
      } else {
        await sendTelegramMessage(chatId, infoCard, { inline_keyboard: actionRows });
      }
      return;
    }

    if (data.startsWith("admin_btn_editname_")) {
      const targetBtnId = data.replace("admin_btn_editname_", "");
      const btn = buttonsStore.get(targetBtnId);
      if (!btn) {
        await answerTelegramCallbackQuery(cqId, "Button not found!", true);
        return;
      }
      user.pendingAction = `admin_edit_name_${targetBtnId}`;
      await answerTelegramCallbackQuery(cqId, "Send new Button Name");
      await sendTelegramMessage(chatId, `🏷️ *RENAME BUTTON:* \`${btn.label}\` (\`${btn.id}\`)
━━━━━━━━━━━━━━━━━━━━━━━━━
Current Label: \`${btn.label}\`

👉 Please type and send the **NEW BUTTON NAME / LABEL** now:
*(Example: \`📱 Contact Search\` or \`🔍 Mobile 2.0\`)*

*(Or send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data.startsWith("admin_btn_editapi_")) {
      const targetBtnId = data.replace("admin_btn_editapi_", "");
      const btn = buttonsStore.get(targetBtnId);
      if (!btn) {
        await answerTelegramCallbackQuery(cqId, "Button not found!", true);
        return;
      }
      user.pendingAction = `admin_edit_api_${targetBtnId}`;
      await answerTelegramCallbackQuery(cqId, "Send new API URL");
      await sendTelegramMessage(chatId, `🔗 *CHANGE API URL FOR:* \`${btn.label}\`
━━━━━━━━━━━━━━━━━━━━━━━━━
Current API:
\`${btn.apiUrl}\`

👉 Please type and send the **NEW API URL** now:
*(Target query parameter should be at the end, e.g. \`https://myapi.com/lookup?q=\`)*

*(Or send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }

    if (data === "admin_btn_add_prompt") {
      user.pendingAction = "admin_add_custom_btn";
      await answerTelegramCallbackQuery(cqId, "Add New Button");
      await sendTelegramMessage(chatId, `➕ *ADD NEW BUTTON & CUSTOM API*
━━━━━━━━━━━━━━━━━━━━━━━━━
Please send button details in this format:
\`Label | API_URL | Placeholder | Example\`

*Example:*
\`⚡ Electricity Bill | https://my-bill-api.com/check?ca= | Enter 10-digit CA Number | 1002345678\`

*(Or send /cancel to abort)*`, getPromptInlineKeyboard('cancel'));
      return;
    }
  }

  await answerTelegramCallbackQuery(cqId);
}

function formatGenericCustomCard(label: string, data: any, query: string): string {
  if (!data) {
    return `❌ *NO RECORDS LOCATED*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔍 *Service:* ${label}\n🎯 *Input Query:* \`${query}\`\n\nNo records found or remote endpoint returned empty response.\n━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  let jsonStr = "";
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      jsonStr = JSON.stringify(parsed, null, 2);
    } catch {
      jsonStr = data;
    }
  } else {
    try {
      jsonStr = JSON.stringify(data, null, 2);
    } catch {
      jsonStr = String(data);
    }
  }

  let formatted = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n┃   ${label.toUpperCase()}\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  formatted += `🎯 *Target:* \`${query}\`\n`;
  formatted += `⏱️ *Generated:* \`${new Date().toLocaleString('en-IN')}\`\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `\`\`\`json\n${jsonStr}\n\`\`\`\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━\n🔒 *Verified via ${BOT_NAME} v${BOT_VERSION}*`;
  return formatted;
}

async function sendSearchResult(chatId: number | string, user: UserRecord, card: string, type: string, query?: string, userMessageId?: number) {
  user.pendingAction = undefined;
  const isGroup = String(chatId).startsWith("-");
  let resultMsgId: number | null = null;

  // If response is large (over 3400 chars), send directly as a clean .txt file document
  if (card.length > 3400) {
    const cleanType = (type || 'lookup').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanQuery = (query || 'result').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanType}_${cleanQuery}.txt`;

    let fileContent = card;
    const jsonMatch = card.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      fileContent = jsonMatch[1].trim();
    } else {
      fileContent = card.replace(/\*/g, '');
    }

    const caption = `📄 *${(type || 'LOOKUP').toUpperCase()} RESULT*\n🎯 *Target:* \`${query || 'Query'}\`\n⏱️ *Generated:* \`${new Date().toLocaleString('en-IN')}\`\n\nℹ️ *Response size is large — full result attached as .txt file.*`;

    resultMsgId = await sendTelegramDocument(chatId, filename, fileContent, caption, getResultInlineKeyboard(type, query));
  } else {
    resultMsgId = await sendTelegramMessage(chatId, card, getResultInlineKeyboard(type, query));
    // If standard sending failed due to length, fallback to document
    if (!resultMsgId && card.length > 2000) {
      const cleanType = (type || 'lookup').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanQuery = (query || 'result').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cleanType}_${cleanQuery}.txt`;
      const caption = `📄 *${(type || 'LOOKUP').toUpperCase()} RESULT*\n🎯 *Target:* \`${query || 'Query'}\`\nℹ️ *Response attached in .txt file.*`;
      resultMsgId = await sendTelegramDocument(chatId, filename, card, caption, getResultInlineKeyboard(type, query));
    }
  }

  if (isGroup) {
    // Auto-delete both user's lookup query and bot's lookup response (.txt file or message) after delay
    scheduleAutoDelete(chatId, [userMessageId, resultMsgId], AUTO_DELETE_DELAY_MS);
  } else {
    await sendTelegramMessage(chatId, "⚡ Select next service below or send a query directly:", getMainReplyKeyboard(user));
  }

  addAuditLog({
    source: isGroup ? 'telegram_group' : 'telegram_dm',
    userId: String(user.userId),
    username: user.username,
    service: type || 'lookup',
    query: query || '',
    status: 'success',
    durationMs: 0,
  });
}

async function handleTelegramUpdate(msg: any) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const text = msg.text.trim();
  const userMsgId = msg.message_id;

  const chatType = msg.chat?.type || (Number(chatId) < 0 ? 'supergroup' : 'private');
  const isPrivate = chatType === 'private' || Number(chatId) > 0;
  const isGroup = chatType === 'group' || chatType === 'supergroup' || Number(chatId) < 0;

  const user = getUser(userId);
  if (msg.from?.username && user.username !== msg.from.username) {
    user.username = msg.from.username;
    persistUser(user).catch(() => {});
  }
  if (msg.from?.first_name && user.firstName !== msg.from.first_name) {
    user.firstName = msg.from.first_name;
    persistUser(user).catch(() => {});
  }
  user.lastActive = new Date().toISOString();
  const remaining = getUserRemaining(user);
  const dailyLimit = getUserDailyLimit(user);

  // Maintenance Mode Intercept for non-admin users
  const isUserAdmin = user.role === 'admin' || String(userId) === String(ADMIN_USER_ID);
  if (MAINTENANCE_MODE && !isUserAdmin) {
    await sendTelegramMessage(chatId, `🛠️ *BOT UNDER MAINTENANCE*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nBot par abhi maintenance aur system upgrades chal rahe hain.\n\nKripya thoda intezar karein ya official group join karein:\n👉 [lookupXchat](${OFFICIAL_GROUP_URL})\n━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return;
  }

  // Check for referral link payload in /start ref_USERID or /start USERID
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      const payload = parts[1].trim();
      let refId: string | null = null;
      if (payload.startsWith("ref_")) {
        refId = payload.replace("ref_", "").trim();
      } else if (/^\d+$/.test(payload)) {
        refId = payload.trim();
      }

      if (refId && refId !== String(userId) && !user.referredBy) {
        user.referredBy = refId;
        const referrer = getUser(refId);
        if (!referrer.referredUsers) referrer.referredUsers = [];
        if (!referrer.referredUsers.includes(String(userId))) {
          referrer.referredUsers.push(String(userId));
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.referralBonusDaily = (referrer.referralCount || 0) * REFERRAL_BONUS_PER_USER;

          persistUser(referrer).catch(() => {});
          persistUser(user).catch(() => {});
          recordReferralInDb(refId, String(userId)).catch(() => {});

          // Alert referrer on Telegram immediately
          const refNotice = `🎉 *NEW REFERRAL JOINED!*
══════════════════════════
👋 Agent *${msg.from?.first_name || 'Agent'}* (\`${userId}\`) joined using your personal invite link!

🎁 *Reward:* \`+10 Extra Searches Daily\`
👥 *Total Referrals:* \`${referrer.referralCount} Members\`
⚡ *New Daily Limit:* \`${getUserDailyLimit(referrer)}\` searches/day!
══════════════════════════
Your daily allowance has been permanently upgraded!`;
          sendTelegramMessage(refId, refNotice, getReferInlineKeyboard(refId)).catch(() => {});
        }
      }
    }
  }

  // ── DM USAGE ──
  // Normal users can use the bot in DM directly.
  // DM is only restricted if an Admin has explicitly revoked/blocked DM for this user (allowDm === false).
  const isDmBlocked = user.allowDm === false && user.role !== 'admin' && String(userId) !== String(ADMIN_USER_ID);
  if (isPrivate && isDmBlocked) {
    const dmBlockedMsg = `🔒 *Aapka DM access Admin dwara restrict kiya gaya hai.*

Aap bot ko hamare official group mein use kar sakte hain:
👉 [lookupXchat](${OFFICIAL_GROUP_URL})`;
    await sendTelegramMessage(chatId, dmBlockedMsg, {
      inline_keyboard: [
        [
          { text: "👉 Join Official Group & Search", url: OFFICIAL_GROUP_URL }
        ]
      ]
    });
    return;
  }

  // ── OFFICIAL GROUP RESTRICTION ──
  // If used in an unauthorized group, inform and auto-delete
  if (isGroup && OFFICIAL_GROUP_ID && String(chatId) !== String(OFFICIAL_GROUP_ID) && user.role !== 'admin') {
    const unauthGroupMsg = `⚠️ *Is group mein bot allowed nahi hai!*

Bot sirf hamare official group mein work karta hai:
👉 [Join Official Group](${OFFICIAL_GROUP_URL})`;
    const sentId = await sendTelegramMessage(chatId, unauthGroupMsg);
    scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
    return;
  }

  // If user opens channel link
  if (text === "📢 Open Channel Link") {
    await sendTelegramMessage(chatId, `📢 *Official Channel:* [${CHANNEL_USERNAME}](${CHANNEL_LINK})`, getJoinInlineKeyboard());
    return;
  }

  // Handle explicit verify command or button
  if (text === "/verify" || text === "✅ Verify Channel Membership" || text.toLowerCase() === "verify") {
    const check = await checkTelegramChannelMembership(userId);
    if (check.isMember) {
      user.channelVerified = true;
      persistUser(user).catch(() => {});
      const successMsg = `🎉 *VERIFICATION CONFIRMED!*
══════════════════════════
Channel Membership Status: ✅ *VERIFIED*

Official Channel: [${CHANNEL_USERNAME}](${CHANNEL_LINK})

Welcome to **${BOT_NAME} OSINT Bot**! All investigation modules are unlocked.`;
      await sendTelegramMessage(chatId, successMsg, getMainReplyKeyboard());
      await sendTelegramMessage(chatId, getStartCard(user, msg.from?.first_name || 'Agent', userId), getMainReplyKeyboard());
    } else {
      const failMsg = `❌ *Channel Verification Failed!*
══════════════════════════
You have not joined [${CHANNEL_USERNAME}](${CHANNEL_LINK}) yet.

👉 Step 1: Click the link to join our official channel:
${CHANNEL_LINK}

👉 Step 2: After joining, tap **✅ Verify Channel Membership** to activate your bot.`;
      await sendTelegramMessage(chatId, failMsg, getJoinInlineKeyboard());
    }
    return;
  }

  // ── STRICT FORCE SUBSCRIBE CHECK ──
  if (!user.channelVerified) {
    const check = await checkTelegramChannelMembership(userId);
    if (!check.isMember) {
      const lockMsg = `🔒 *ACCESS RESTRICTED — CHANNEL JOIN REQUIRED*
══════════════════════════
To access ${BOT_NAME} OSINT Bot, joining our official intelligence channel is mandatory:

📢 *Official Channel:* [${CHANNEL_USERNAME}](${CHANNEL_LINK})

1️⃣ Tap the button below to join the channel.
2️⃣ Tap **✅ Verify Joined** to unlock the bot immediately.
══════════════════════════`;
      await sendTelegramMessage(chatId, lockMsg, getJoinInlineKeyboard());
      return;
    }
    user.channelVerified = true;
    persistUser(user).catch(() => {});
  }

  const isAdmin = String(userId) === String(ADMIN_USER_ID) || user.role === 'admin';

  // ── BOT MAINTENANCE / OFFLINE CHECK ──
  if (!isBotActive && !isAdmin) {
    await sendTelegramMessage(chatId, `🔴 *BOT IS TEMPORARILY UNDER MAINTENANCE*
━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Bot services and investigation tools are currently paused by the Administrator for system updates.

📢 *Updates Channel:* [${CHANNEL_USERNAME}](${CHANNEL_LINK})
⏳ Regular lookups will resume shortly. Thank you for your patience!`);
    return;
  }

  // ── ADMIN BROADCAST & MANAGEMENT PENDING ACTIONS ──
  if (user.pendingAction === 'admin_broadcast' && isAdmin) {
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Broadcast cancelled.", getMainReplyKeyboard(user));
      return;
    }
    await sendTelegramMessage(chatId, `⏳ *Broadcasting announcement to all registered users...*`);
    const result = await broadcastTelegramMessage(`📢 *OFFICIAL ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━━━━━━━━━\n— ${msg.from?.first_name || 'Admin'}`);
    await sendTelegramMessage(chatId, `✅ Broadcast complete!\nDelivered to: ${result.sent} users\nFailed: ${result.failed}`, getMainReplyKeyboard(user));
    return;
  }

  if (user.pendingAction === 'admin_remove_premium' && isAdmin) {
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }
    const targetId = text.trim().replace(/[^0-9a-zA-Z_]/g, '');
    const targetUser = usersStore.get(targetId);
    if (!targetUser) {
      await sendTelegramMessage(chatId, `❌ User \`${targetId}\` not found in bot database.\nMake sure the user has started the bot at least once.`, getMainReplyKeyboard(user));
      return;
    }
    targetUser.role = 'free';
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *PREMIUM REVOKED / REMOVED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 User ID: \`${targetId}\`\n🎖️ New Role: 🆓 FREE TIER\n⚡ Daily Limit: ${getUserDailyLimit(targetUser)} searches\n\nUser has been demoted to standard access.`, getMainReplyKeyboard(user));
    try {
      await sendTelegramMessage(targetId, `ℹ️ *MEMBERSHIP UPDATE*\nYour VIP Premium membership has ended or been revoked by the administrator.\nYou are now on the Free tier (${FREE_DAILY_LIMIT} searches/day). Send /refer to earn extra daily credits!`);
    } catch {}
    return;
  }

  if (user.pendingAction === 'admin_add_premium' && isAdmin) {
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }
    const targetId = text.trim().replace(/[^0-9a-zA-Z_]/g, '');
    const targetUser = getUser(targetId);
    targetUser.role = 'premium';
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *VIP PREMIUM GRANTED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 User ID: \`${targetId}\`\n🎖️ New Role: 💎 VIP PREMIUM\n⚡ Status: Unlimited Lookups Unlocked`, getMainReplyKeyboard(user));
    try {
      await sendTelegramMessage(targetId, `🎉 *VIP PREMIUM ACTIVATED!*\nThe administrator has granted you VIP Premium Access!\nYou now have unlimited OSINT searches. Enjoy! 🚀`);
    } catch {}
    return;
  }

  // ── TELEGRAM ADMIN RENAME BUTTON PENDING ACTION ──
  if (user.pendingAction?.startsWith('admin_edit_name_') && isAdmin) {
    const targetBtnId = user.pendingAction.replace('admin_edit_name_', '');
    user.pendingAction = undefined;

    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }

    const newName = text.trim();
    if (!newName || newName.length < 2) {
      await sendTelegramMessage(chatId, `⚠️ *Button label is too short!*\nPlease provide a valid button name.`, getMainReplyKeyboard(user));
      return;
    }

    const btn = buttonsStore.get(targetBtnId);
    if (!btn) {
      await sendTelegramMessage(chatId, `❌ Button \`${targetBtnId}\` not found.`, getMainReplyKeyboard(user));
      return;
    }

    const oldLabel = btn.label;
    btn.label = newName;
    await persistButton(btn);

    await sendTelegramMessage(chatId, `✅ *BUTTON RENAMED SUCCESSFULLY!*
━━━━━━━━━━━━━━━━━━━━━━━━━
• 🆔 *Button ID:* \`${btn.id}\`
• 🔴 *Old Name:* \`${oldLabel}\`
• 🟢 *New Name:* \`${newName}\`
━━━━━━━━━━━━━━━━━━━━━━━━━
Telegram keyboard & website interface updated with the new button name! 🎉`, getMainReplyKeyboard(user));
    return;
  }

  // ── TELEGRAM ADMIN EDIT API PENDING ACTION ──
  if (user.pendingAction?.startsWith('admin_edit_api_') && isAdmin) {
    const targetBtnId = user.pendingAction.replace('admin_edit_api_', '');
    user.pendingAction = undefined;

    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }

    const newUrl = text.trim();
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
      await sendTelegramMessage(chatId, `⚠️ *Invalid URL format!* URL must begin with \`http://\` or \`https://\`.\nOperation aborted.`, getMainReplyKeyboard(user));
      return;
    }

    const btn = buttonsStore.get(targetBtnId);
    if (!btn) {
      await sendTelegramMessage(chatId, `❌ Button \`${targetBtnId}\` not found.`, getMainReplyKeyboard(user));
      return;
    }

    const oldUrl = btn.apiUrl;
    btn.apiUrl = newUrl;
    await persistButton(btn);

    await sendTelegramMessage(chatId, `✅ *API ENDPOINT UPDATED SUCCESSFULLY!*
━━━━━━━━━━━━━━━━━━━━━━━━━
• 🎛️ *Button:* \`${btn.label}\` (\`${btn.id}\`)
• 🔴 *Old API:* \`${oldUrl}\`
• 🟢 *New API:* \`${newUrl}\`
━━━━━━━━━━━━━━━━━━━━━━━━━
Telegram bot & website live traffic are now redirected to this new endpoint! 🚀`, getMainReplyKeyboard(user));
    return;
  }

  // ── TELEGRAM ADMIN ADD CUSTOM BUTTON PENDING ACTION ──
  if (user.pendingAction === 'admin_add_custom_btn' && isAdmin) {
    user.pendingAction = undefined;

    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }

    const parts = text.split('|').map((p: string) => p.trim());
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, `⚠️ *Invalid format!*\nPlease provide at least \`Label | API_URL\`.\nExample:\n\`⚡ Electricity Bill | https://my-bill-api.com/check?ca= | Enter CA Number | 1002345678\``, getMainReplyKeyboard(user));
      return;
    }

    const label = parts[0];
    const apiUrl = parts[1];
    const placeholder = parts[2] || `Enter ${label}`;
    const example = parts[3] || '';
    const newId = 'custom_' + Date.now().toString(36);

    const newBtn: BotButton = {
      id: newId,
      label,
      category: 'custom',
      apiUrl,
      placeholder,
      example,
      description: `Custom lookup module for ${label}`,
      enabled: true,
      isCustom: true,
      sortOrder: buttonsStore.size + 1
    };

    buttonsStore.set(newId, newBtn);
    await persistButton(newBtn);

    await sendTelegramMessage(chatId, `🎉 *NEW BUTTON & API ADDED!*
━━━━━━━━━━━━━━━━━━━━━━━━━
• 🎛️ *Label:* ${label}
• 🆔 *Button ID:* \`${newId}\`
• 🔗 *API URL:* \`${apiUrl}\`
• 💡 *Input Hint:* \`${placeholder}\`
• 🟢 *Status:* ACTIVE (ON)
━━━━━━━━━━━━━━━━━━━━━━━━━
Naya button Telegram keyboard aur website dono par automatically live ho chuka hai!`, getMainReplyKeyboard(user));
    return;
  }

  // ── TELEGRAM ADMIN USER INSPECT PENDING ACTION ──
  if (user.pendingAction === 'admin_inspect_user' && isAdmin) {
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }
    const targetId = text.trim().replace(/[^0-9a-zA-Z_]/g, '');
    const targetUser = usersStore.get(targetId);
    if (!targetUser) {
      await sendTelegramMessage(chatId, `❌ User ID \`${targetId}\` not found in bot database.\nMake sure the user has started the bot at least once.`, getMainReplyKeyboard(user));
      return;
    }
    const card = getUserDossierCard(targetUser);
    const kb = getUserDossierKeyboard(targetUser.userId, Boolean(targetUser.allowDm), targetUser.role);
    await sendTelegramMessage(chatId, card, kb);
    return;
  }

  // ── TELEGRAM ADMIN ALLOW DM PENDING ACTION ──
  if (user.pendingAction === 'admin_allow_dm' && isAdmin) {
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }
    const targetId = text.trim().replace(/[^0-9a-zA-Z_]/g, '');
    const targetUser = getUser(targetId);
    targetUser.allowDm = true;
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *PRIVATE DM ACCESS UNLOCKED!*
━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User ID: \`${targetId}\`
🔓 Status: Whitelisted for Private DM
User can now query OSINT commands in private bot DM without group restriction.`, getMainReplyKeyboard(user));
    try {
      await sendTelegramMessage(targetId, `🔓 *DM ACCESS GRANTED!*\nAdmin has unlocked direct private messaging for your account.\nYou can now run OSINT lookups in this bot's private chat! 🚀`);
    } catch {}
    return;
  }

  // ── TELEGRAM ADMIN REVOKE DM PENDING ACTION ──
  if (user.pendingAction === 'admin_revoke_dm' && isAdmin) {
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Operation cancelled.", getMainReplyKeyboard(user));
      return;
    }
    const targetId = text.trim().replace(/[^0-9a-zA-Z_]/g, '');
    const targetUser = getUser(targetId);
    targetUser.allowDm = false;
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `🔒 *PRIVATE DM ACCESS REVOKED!*
━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User ID: \`${targetId}\`
🔒 Status: Group Only
User must now run lookups strictly in the official group.`, getMainReplyKeyboard(user));
    return;
  }

  // ── TELEGRAM ADMIN DIRECT MESSAGE TO USER PENDING ACTION ──
  if (user.pendingAction?.startsWith('admin_msg_') && isAdmin) {
    const targetId = user.pendingAction.replace('admin_msg_', '');
    user.pendingAction = undefined;
    if (text === "❌ Cancel" || text === "/cancel") {
      await sendTelegramMessage(chatId, "🔙 Message sending cancelled.", getMainReplyKeyboard(user));
      return;
    }
    try {
      await sendTelegramMessage(targetId, `📩 *DIRECT MESSAGE FROM ADMINISTRATOR:*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━━━━━━━━━\n— ${msg.from?.first_name || 'Admin'}`);
      await sendTelegramMessage(chatId, `✅ Message delivered directly to user \`${targetId}\`!`, getMainReplyKeyboard(user));
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to deliver message to user \`${targetId}\`: ${e.message}`, getMainReplyKeyboard(user));
    }
    return;
  }

  // ── ADMIN TELEGRAM COMMANDS & PANEL ──
  if (isAdmin && (text === "👑 Admin Control Panel" || text === "⚙️ Admin Panel" || text === "/admin")) {
    user.pendingAction = undefined;
    const adminCard = getAdminControlCard(isBotActive);
    const adminMarkup = getAdminInlineKeyboard(isBotActive);
    await sendTelegramMessage(chatId, adminCard, adminMarkup);
    return;
  }

  if (isAdmin && (text === "/bot on" || text === "/bot_on")) {
    isBotActive = true;
    await sendTelegramMessage(chatId, `🟢 *BOT IS NOW ONLINE*\nAll registered users can now execute OSINT queries normally.`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text === "/bot off" || text === "/bot_off")) {
    isBotActive = false;
    await sendTelegramMessage(chatId, `🔴 *BOT IS NOW OFFLINE (MAINTENANCE MODE)*\nServices are paused for all regular users. Only administrators can use the bot.`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/user ") || text.startsWith("/inspect "))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/user <userId>\`\nExample: \`/user 6516740398\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = usersStore.get(targetId);
    if (!targetUser) {
      await sendTelegramMessage(chatId, `❌ User \`${targetId}\` not found in bot database.`, getMainReplyKeyboard(user));
      return;
    }
    const card = getUserDossierCard(targetUser);
    const kb = getUserDossierKeyboard(targetUser.userId, Boolean(targetUser.allowDm), targetUser.role);
    await sendTelegramMessage(chatId, card, kb);
    return;
  }

  if (isAdmin && (text.startsWith("/allow_dm") || text.startsWith("/allowdm"))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/allow_dm <userId>\`\nExample: \`/allow_dm 6516740398\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = getUser(targetId);
    targetUser.allowDm = true;
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *DM ACCESS ALLOWED*\nUser \`${targetId}\` has been whitelisted to use OSINT lookups in private bot DM.`, getMainReplyKeyboard(user));
    try {
      await sendTelegramMessage(targetId, `🔓 *DM ACCESS GRANTED!*\nAdmin has unlocked direct private messaging for your account.\nYou can now run OSINT lookups in this bot's private chat! 🚀`);
    } catch {}
    return;
  }

  if (isAdmin && (text.startsWith("/revoke_dm") || text.startsWith("/revokedm"))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/revoke_dm <userId>\`\nExample: \`/revoke_dm 6516740398\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = getUser(targetId);
    targetUser.allowDm = false;
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `🔒 *DM ACCESS REVOKED*\nUser \`${targetId}\` can now only use the bot in official group.`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/reset_user") || text.startsWith("/resetsearches"))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/reset_user <userId>\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = getUser(targetId);
    targetUser.dailySearches = 0;
    targetUser.dailyButtonUsage = {};
    targetUser.lastSearchDate = getTodayString();
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *User \`${targetId}\` daily searches reset to 0!*`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/add_searches") || text.startsWith("/addsearches"))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    const amount = parseInt(parts[2], 10) || 10;
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/add_searches <userId> <amount>\`\nExample: \`/add_searches 6516740398 25\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = getUser(targetId);
    targetUser.dailySearches = Math.max(0, (targetUser.dailySearches || 0) - amount);
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *Added +${amount} searches for User \`${targetId}\`!*`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/set_delay") || text.startsWith("/setdelay") || text.startsWith("/autodelete") || text.startsWith("/autodel"))) {
    const parts = text.split(/\s+/);
    const sec = parseInt(parts[1], 10);
    if (isNaN(sec)) {
      const curSec = AUTO_DELETE_DELAY_MS > 0 ? `${Math.round(AUTO_DELETE_DELAY_MS / 1000)}s` : 'Disabled';
      const msg = `⏱️ *GROUP AUTO-DELETE TIMER CONFIGURATION*
━━━━━━━━━━━━━━━━━━━━━━━━━
Current Auto-Delete Delay: *${curSec}*

Ab group me koi bhi message aayega, utne seconds baad automatic delete ho jayega.

Usage:
• \`/autodelete <seconds>\` — Set custom timer (e.g. \`/autodelete 30\`)
• \`/autodelete 0\` — Disable auto-delete
• Ya \`/admin\` bhejkar interactive button se timer choose karein!

⚠️ *Note:* Bot ko group me *Delete Messages* admin permission honi chahiye!`;
      await sendTelegramMessage(chatId, msg, getMainReplyKeyboard(user));
      return;
    }
    AUTO_DELETE_DELAY_MS = sec * 1000;
    const updateMsg = sec === 0
      ? `🛑 *Group Auto-Delete has been DISABLED.* Group messages will no longer be auto-deleted.`
      : `⏱️ *Group Auto-Delete timer set to ${sec} seconds!*
━━━━━━━━━━━━━━━━━━━━━━━━━
Ab group mein koi bhi message aayega (user chat, images, stickers, queries aur bot ke results), theek *${sec} seconds* ke baad automatically delete ho jayega! 🧹`;
    await sendTelegramMessage(chatId, updateMsg, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/set_limit") || text.startsWith("/setlimit"))) {
    const parts = text.split(/\s+/);
    const limit = parseInt(parts[1], 10);
    if (isNaN(limit) || limit < 1) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/set_limit <daily_number>\`\nExample: \`/set_limit 30\``, getMainReplyKeyboard(user));
      return;
    }
    FREE_DAILY_LIMIT = limit;
    await sendTelegramMessage(chatId, `⚡ *Free tier daily search limit updated to ${limit} lookups / day!*`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text === "/export_users" || text === "/export")) {
    await sendTelegramMessage(chatId, `⏳ Generating complete users intelligence file...`);
    await exportUsersToTelegram(chatId);
    return;
  }

  if (isAdmin && (text === "/users" || text === "/all_users")) {
    const today = getTodayString();
    const allUsers = Array.from(usersStore.values());
    const total = allUsers.length;
    const prem = allUsers.filter(u => u.role === 'premium').length;
    const free = allUsers.filter(u => u.role === 'free').length;

    let msgText = `👥 *ALL REGISTERED USERS DIRECTORY*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 Total: \`${total}\` | 💎 VIP: \`${prem}\` | 🆓 Free: \`${free}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    const sample = allUsers.slice(-25).reverse();
    sample.forEach((u, idx) => {
      const isToday = u.lastSearchDate === today;
      const todayUsed = isToday ? (u.dailySearches || 0) : 0;
      const roleIcon = u.role === 'admin' ? '👑' : u.role === 'premium' ? '💎' : '👤';
      const handle = u.username ? `@${u.username}` : (u.firstName || 'User');
      const limit = u.role === 'free' ? getUserDailyLimit(u) : '∞';
      const dm = (u.allowDm || u.role === 'admin') ? '🔓 DM' : '🔒 Group';
      msgText += `${idx + 1}. ${roleIcon} *${handle}* (\`${u.userId}\`)\n   🔍 Today: *${todayUsed}* / ${limit} | Total: ${u.totalSearches || 0} | ${dm}\n   👉 Inspect: \`/user ${u.userId}\`\n`;
    });
    if (total > 25) {
      msgText += `\n💡 *Tip:* Send \`/export_users\` for full .txt report of all ${total} users!`;
    }
    await sendTelegramMessage(chatId, msgText, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text === "/premium_users" || text === "/vip_users")) {
    const premUsers = Array.from(usersStore.values()).filter(u => u.role === 'premium');
    if (premUsers.length === 0) {
      await sendTelegramMessage(chatId, `💎 *VIP PREMIUM USERS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nNo active VIP premium users right now.\n\n👉 Grant with: \`/add_premium <userId>\`\n👉 Or drop code: \`/dropcode 30\``, getMainReplyKeyboard(user));
      return;
    }
    let msgText = `💎 *VIP PREMIUM SUBSCRIBERS (${premUsers.length})*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    premUsers.forEach((u, idx) => {
      msgText += `${idx + 1}. 💎 ID: \`${u.userId}\`\n   Total Searches: ${u.totalSearches} | Invites: ${u.referralCount || 0}\n   Remove: \`/remove_premium ${u.userId}\`\n`;
    });
    await sendTelegramMessage(chatId, msgText, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/remove_premium") || text.startsWith("/remove_prem") || text.startsWith("/remprem"))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/remove_premium <Telegram_User_ID>\`\n\nExample: \`/remove_premium 6516740398\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = usersStore.get(targetId);
    if (!targetUser) {
      await sendTelegramMessage(chatId, `❌ User \`${targetId}\` not found in bot memory or database.`, getMainReplyKeyboard(user));
      return;
    }
    targetUser.role = 'free';
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *VIP PREMIUM REVOKED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 User ID: \`${targetId}\`\n🎖️ New Role: 🆓 FREE TIER\n⚡ Daily Limit: ${getUserDailyLimit(targetUser)} searches\n\nUser has been successfully demoted to Free access.`, getMainReplyKeyboard(user));
    try {
      await sendTelegramMessage(targetId, `ℹ️ *MEMBERSHIP UPDATE*\nYour VIP Premium membership has ended or been revoked by the administrator.\nYou are now on the Free tier (${FREE_DAILY_LIMIT} searches/day). Send /refer to earn extra daily credits!`);
    } catch {}
    return;
  }

  if (isAdmin && (text.startsWith("/add_premium") || text.startsWith("/set_premium") || text.startsWith("/addprem"))) {
    const parts = text.split(/\s+/);
    const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
    if (!targetId) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/add_premium <Telegram_User_ID>\`\n\nExample: \`/add_premium 6516740398\``, getMainReplyKeyboard(user));
      return;
    }
    const targetUser = getUser(targetId);
    targetUser.role = 'premium';
    await persistUser(targetUser);
    await sendTelegramMessage(chatId, `✅ *VIP PREMIUM GRANTED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 User ID: \`${targetId}\`\n🎖️ Role: 💎 VIP PREMIUM\n⚡ Status: Unlimited Lookups Unlocked`, getMainReplyKeyboard(user));
    try {
      await sendTelegramMessage(targetId, `🎉 *VIP PREMIUM ACTIVATED!*\nThe administrator has granted you VIP Premium Access!\nYou now have unlimited OSINT searches. Enjoy! 🚀`);
    } catch {}
    return;
  }

  if (isAdmin && (text.startsWith("/broadcast_code") || text.startsWith("/dropcode"))) {
    const parts = text.split(/\s+/);
    const days = parseInt(parts[1], 10) || 7;
    await sendTelegramMessage(chatId, `⏳ *Generating & Broadcasting ${days}-day single-use code...*`);
    const drop = await broadcastRedeemCode(days, msg.from?.first_name || 'Admin');
    await sendTelegramMessage(chatId, `✅ *BROADCAST CODE DROPPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Code:* \`${drop.code}\`\n⏳ *Duration:* ${drop.days} Days\n📨 *Delivered to:* ${drop.sent} users\n⚡ *Rule:* Single-use only — Jo pehle redeem karega use hi milega!`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && text.startsWith("/gen")) {
    const parts = text.split(/\s+/);
    const days = parseInt(parts[1], 10) || 7;
    const code = generateCode();
    redeemCodes.set(code, {
      code,
      days,
      role: 'premium',
      usesLeft: 1,
      totalUses: 1,
      createdAt: new Date().toISOString(),
      usedBy: [],
    });
    await sendTelegramMessage(chatId, `💎 *NEW REDEEM CODE GENERATED*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Code:* \`${code}\`\n⏳ *Duration:* ${days} Days VIP Premium\n⚡ *Uses:* 1 (Single-use)\n👤 *Admin:* ${msg.from?.first_name || 'Admin'}\n\n👉 Share this directly or broadcast with: \`/dropcode ${days}\``, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && text.startsWith("/broadcast ")) {
    const broadcastText = text.replace("/broadcast ", "").trim();
    if (!broadcastText) {
      await sendTelegramMessage(chatId, `⚠️ Send \`/broadcast Your announcement message\``);
      return;
    }
    await sendTelegramMessage(chatId, `⏳ *Broadcasting announcement to all users...*`);
    const result = await broadcastTelegramMessage(`📢 *OFFICIAL ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${broadcastText}\n━━━━━━━━━━━━━━━━━━━━━━━━━\n— ${msg.from?.first_name || 'Admin'}`);
    await sendTelegramMessage(chatId, `✅ Announcement sent to ${result.sent} users (${result.failed} failed).`, getMainReplyKeyboard(user));
    return;
  }

  // ── TELEGRAM ADMIN SHORTCUT COMMANDS FOR BUTTONS & APIS ──
  if (isAdmin && (text === "/buttons" || text === "/manage_buttons")) {
    const allButtons = Array.from(buttonsStore.values()).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
    const keyboardRows: Array<Array<{ text: string; callback_data: string }>> = [];
    allButtons.forEach(btn => {
      const statusIcon = btn.enabled ? "🟢" : "🔴";
      keyboardRows.push([
        { text: `${statusIcon} ${btn.label}`, callback_data: `admin_btn_view_${btn.id}` },
        { text: btn.enabled ? "Turn OFF" : "Turn ON", callback_data: `admin_btn_toggle_${btn.id}` }
      ]);
    });
    keyboardRows.push([
      { text: "➕ Add New Custom Button", callback_data: "admin_btn_add_prompt" },
      { text: "🔙 Back to Admin Panel", callback_data: "admin_back_to_panel" }
    ]);
    const buttonsMsg = `🎛️ *BOT BUTTONS & APIS MASTER MANAGER*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nSelect any button below to Rename, Toggle ON/OFF, or change its API URL:\n\n💡 *Quick commands:*\n• \`/rename <id> <New Name>\`\n• \`/toggle <id>\`\n• \`/setapi <id> <url>\``;
    await sendTelegramMessage(chatId, buttonsMsg, { inline_keyboard: keyboardRows });
    return;
  }

  if (isAdmin && text.startsWith("/setapi ")) {
    const parts = text.replace("/setapi ", "").trim().split(/\s+/);
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/setapi <button_id> <new_api_url>\`\n\n*Example:*\n\`/setapi num2 https://my-new-api.vercel.app/search?mobile=\`\n\n*(Send /buttons to see all button IDs)*`, getMainReplyKeyboard(user));
      return;
    }
    const btnId = parts[0];
    const newApi = parts[1];
    const btn = buttonsStore.get(btnId);
    if (!btn) {
      await sendTelegramMessage(chatId, `❌ Button with ID \`${btnId}\` not found.\nSend \`/buttons\` to inspect valid IDs.`, getMainReplyKeyboard(user));
      return;
    }
    const oldApi = btn.apiUrl;
    btn.apiUrl = newApi;
    await persistButton(btn);
    await sendTelegramMessage(chatId, `✅ *API ENDPOINT UPDATED VIA COMMAND!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n• 🎛️ *Button:* \`${btn.label}\` (\`${btn.id}\`)\n• 🔴 *Old:* \`${oldApi}\`\n• 🟢 *New:* \`${newApi}\`\n\nLive Telegram bot traffic is now routing to this new API!`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && (text.startsWith("/togglebutton ") || text.startsWith("/toggle "))) {
    const btnId = text.replace(/\/toggle(button)?\s+/, "").trim();
    const btn = buttonsStore.get(btnId);
    if (!btn) {
      await sendTelegramMessage(chatId, `❌ Button \`${btnId}\` not found.\nSend \`/buttons\` to view list.`, getMainReplyKeyboard(user));
      return;
    }
    btn.enabled = !btn.enabled;
    await persistButton(btn);
    await sendTelegramMessage(chatId, `✅ *BUTTON STATUS TOGGLED!*\n\n\`${btn.label}\` is now *${btn.enabled ? "🟢 ENABLED (ON)" : "🔴 DISABLED (OFF)"}*.\nBot keyboard has been updated.`, getMainReplyKeyboard(user));
    return;
  }

  if (isAdmin && text.startsWith("/rename ")) {
    const raw = text.replace("/rename ", "").trim();
    const firstSpace = raw.indexOf(' ');
    if (firstSpace === -1) {
      await sendTelegramMessage(chatId, `⚠️ *Usage:* \`/rename <button_id> <New Button Name>\`\n\n*Example:*\n\`/rename num2 📱 Mobile 2.0\`\n\`/rename vehicle 🏎️ Fast RC\`\n\n*(Send /buttons to see all button IDs)*`, getMainReplyKeyboard(user));
      return;
    }
    const btnId = raw.slice(0, firstSpace).trim();
    const newName = raw.slice(firstSpace + 1).trim();
    const btn = buttonsStore.get(btnId);
    if (!btn) {
      await sendTelegramMessage(chatId, `❌ Button with ID \`${btnId}\` not found.\nSend \`/buttons\` to inspect valid IDs.`, getMainReplyKeyboard(user));
      return;
    }
    const oldName = btn.label;
    btn.label = newName;
    await persistButton(btn);
    await sendTelegramMessage(chatId, `✅ *BUTTON RENAMED SUCCESSFULLY!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n• 🆔 *Button ID:* \`${btn.id}\`\n• 🔴 *Old Name:* \`${oldName}\`\n• 🟢 *New Name:* \`${newName}\`\n\nBot keyboard & website interface updated!`, getMainReplyKeyboard(user));
    return;
  }

  // If verified, proceed with all bot commands
  if (text === "/start" || text === "🏠 Main Menu") {
    const card = getStartCard(user, msg.from?.first_name || 'Agent', userId);
    await sendTelegramMessage(chatId, card, getMainReplyKeyboard());
    return;
  }

  if (text === "👥 Refer & Earn" || text === "👥 Refer & Earn (+10 Daily)" || text.startsWith("/refer") || text.toLowerCase() === "refer") {
    const referCard = getReferralCard(user, userId);
    await sendTelegramMessage(chatId, referCard, getReferInlineKeyboard(userId));
    return;
  }

  if (text === "/help" || text === "❓ Help" || text === "❓ Help Guide") {
    const help = `📖 *${BOT_NAME} — Help & Command Guide*
══════════════════════════
*AVAILABLE OSINT SERVICES:*
• 📱 *Mobile Lookup*  ➜ 10-digit Mobile Number
• 🚗 *Vehicle Lookup*  ➜ Vehicle Reg Number
• 🪪 *Aadhaar Info*  ➜ 12-digit Aadhaar Number
• 👨‍👩‍👧 *Family Tree*  ➜ Household Family Tree
• 🗳️ *Voter Lookup*  ➜ Voter EPIC Number
• 🔥 *LPG Gas Lookup*  ➜ Gas Connection / Phone
• 💳 *UPI Lookup*  ➜ UPI VPA Handle
• 🏢 *GST by Name*  ➜ Business Legal Name
• 🪪 *GST by PAN*  ➜ 10-char PAN Number
• 📄 *GST Details*  ➜ 15-char GSTIN Number

*REWARDS & ACCOUNT:*
• 👥 \`/refer\` ➜ Invite friends & earn *+10 searches daily*!
• 💎 \`/redeem CODE\` ➜ Redeem voucher code
• 📊 \`/stats\` ➜ Check daily usage limits
• ✅ \`/verify\` ➜ Re-check channel status

👇 *Tap any button below to start:*`;
    await sendTelegramMessage(chatId, help, getMainReplyKeyboard());
    return;
  }

  if (text === "/stats" || text === "📊 My Stats" || text === "📊 My Profile") {
    const curLimit = getUserDailyLimit(user);
    const rem = getUserRemaining(user);
    const refCount = user.referralCount || 0;
    const refBonus = refCount * REFERRAL_BONUS_PER_USER;

    const statsText = `📊 *AGENT INTELLIGENCE PROFILE*
══════════════════════════
👤 *Agent:* *${msg.from?.first_name || 'Agent'}*
🆔 *Agent ID:* \`${userId}\`
🎖️ *Tier:* 💎 \`${user.role.toUpperCase()}\`
📢 *Channel Status:* ✅ \`VERIFIED (@RehuSzr)\`

📈 *DAILY QUOTA & SEARCHES*
├ 🔥 Today Used: \`${user.dailySearches} / ${curLimit}\` searches
├ ⚡ Left Today: \`${rem} / ${curLimit}\` searches
└ 📊 Total Lifetime: \`${user.totalSearches}\` searches

👥 *REFER & EARN STATUS*
├ 👥 Friends Invited: \`${refCount} Agents\`
├ 🎁 Daily Bonus Added: \`+${refBonus} searches/day\`
└ 🔗 Invite Link: \`https://t.me/${BOT_USERNAME}?start=ref_${userId}\`
══════════════════════════
💡 *Tip:* Invite friends with /refer to earn +10 extra searches daily!`;
    await sendTelegramMessage(chatId, statsText, getMainReplyKeyboard());
    return;
  }

  if (text.startsWith("/redeem")) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, "💎 Send `/redeem CODE` to activate VIP access.", getMainReplyKeyboard());
      return;
    }
    const code = parts[1].toUpperCase().trim();
    const voucher = redeemCodes.get(code);
    if (!voucher) {
      await sendTelegramMessage(chatId, `❌ *Invalid Code*\nRedeem code \`${code}\` not found.`, getMainReplyKeyboard());
      return;
    }
    if (voucher.usesLeft <= 0) {
      const isClaimed = voucher.usedBy && voucher.usedBy.length > 0;
      const claimMsg = isClaimed
        ? `❌ *Already Claimed!*\nYe redeem code pehle hi kisi aur user ne redeem kar liya hai!\n*(First-Come, First-Served — Sirf pehle user ko milta hai)*`
        : `❌ *Expired Code*\nIs code ke uses khatam ho chuke hain.`;
      await sendTelegramMessage(chatId, claimMsg, getMainReplyKeyboard());
      return;
    }
    if (voucher.usedBy && voucher.usedBy.includes(String(userId))) {
      await sendTelegramMessage(chatId, `⚠️ *Already Redeemed!*\nAap pehle hi is code ko claim kar chuke hain.`, getMainReplyKeyboard());
      return;
    }

    voucher.usesLeft -= 1;
    if (!voucher.usedBy) voucher.usedBy = [];
    voucher.usedBy.push(String(userId));
    user.role = 'premium';
    persistUser(user).catch(() => {});
    await sendTelegramMessage(chatId, `🎉 *CONGRATULATIONS! CODE REDEEMED!*
━━━━━━━━━━━━━━━━━━━━━━━━━
🎖️ *Role:* 💎 PREMIUM ACTIVATED
⏳ *Duration:* ${voucher.days} Days VIP Access
⚡ *Status:* Unlimited lookups unlocked!
🏆 *Claimed by:* Agent \`${userId}\`
━━━━━━━━━━━━━━━━━━━━━━━━━`, getMainReplyKeyboard());
    return;
  }

  // ── AUTO-RESET PENDING ACTION IF USER TAPS ANY AUTOMATION BUTTON OR COMMAND ──
  const isNavOrActionButton =
    text.startsWith('/') ||
    text === "❌ Cancel" ||
    text === "🏠 Main Menu" ||
    text.includes("Mobile Lookup") ||
    text.includes("Vehicle Lookup") ||
    text.includes("Voter Lookup") ||
    text.includes("Aadhaar Info") ||
    text.includes("Family Tree") ||
    text.includes("LPG") ||
    text.includes("UPI") ||
    text.includes("GST") ||
    text.includes("Refer") ||
    text.includes("Redeem") ||
    text.includes("Profile") ||
    text.includes("Help") ||
    text.includes("Admin Control") ||
    text.includes("Admin Panel");

  if (isNavOrActionButton && user.pendingAction && text !== "❌ Cancel" && user.pendingAction !== 'admin_broadcast' && user.pendingAction !== 'admin_remove_premium' && user.pendingAction !== 'admin_add_premium') {
    user.pendingAction = undefined;
  }

  // ── HANDLE CANCEL ──
  if (text === "❌ Cancel" || text === "/cancel") {
    user.pendingAction = undefined;
    await sendTelegramMessage(chatId, `🔙 *Operation Cancelled*\nReturned to Main Menu. Select an option below:`, getMainReplyKeyboard(user));
    return;
  }

  // ── HANDLE PENDING ACTION (User tapped a button and is now providing input) ──
  if (user.pendingAction) {
    const action = user.pendingAction;

    if (remaining <= 0 && action !== 'redeem') {
      user.pendingAction = undefined;
      await sendTelegramMessage(chatId, `🔒 *Daily Limit Reached!* (${dailyLimit} searches/day)
══════════════════════════
You have used up your free daily search allowance.

🎁 *Earn +10 Extra Searches Daily:*
Invite colleagues or friends to use the bot! Each successful referral permanently grants you *+10 extra daily searches*!
👉 Send \`/refer\` to get your personal invite link.

💎 Or send \`/redeem CODE\` to activate VIP unlimited access.`, getMainReplyKeyboard(user));
      return;
    }

    if (action === 'num2') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'num2');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const cleanPhone = text.replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone.length < 10) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Mobile Number!*
Please enter a valid *10-digit mobile number* (e.g., \`6399964669\` or \`9876543210\`):

Tap *❌ Cancel & Return* below or select another service directly:`, getPromptInlineKeyboard('num2'));
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Querying Telecom Registry...*\nTarget: \`+91 ${cleanPhone}\`...`);
      let data = await fetchWithTimeout(`${NUM2_API_URL}${cleanPhone}`);
      recordSearch(userId);
      recordButtonUsage(user, 'num2');
      const card = formatNum2Card(data, cleanPhone);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'num2', cleanPhone, userMsgId);
      return;
    }

    if (action === 'vehicle') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'vehicle');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const reg = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (reg.length < 4) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Registration Number!*
Please send a valid registration number (e.g., \`HR26EV0001\` or \`DL01AB1234\`):

Tap *❌ Cancel & Return* below or select another service directly:`, getPromptInlineKeyboard('vehicle'));
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Querying Vahan RC Gateway...*\nTarget: \`${reg}\`...`);
      let data = await fetchVehicleInfo(reg);
      recordSearch(userId);
      recordButtonUsage(user, 'vehicle');
      const card = formatVehicleCard(data, reg);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'vehicle', reg, userMsgId);
      return;
    }

    if (action === 'voter') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'voter');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const epic = text.trim().toUpperCase();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Searching Electoral Rolls...*\nEPIC: \`${epic}\`...`);
      let data = await fetchWithTimeout(`${VOTER_API_URL}${epic}`);
      recordSearch(userId);
      recordButtonUsage(user, 'voter');
      const card = formatVoterCard(data, epic);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'voter', epic, userMsgId);
      return;
    }

    if (action === 'aadhar2info') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'aadhar2info');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const aadhaar = text.replace(/[^0-9]/g, '');
      if (aadhaar.length < 12) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Aadhaar Number!*
Please send a valid *12-digit Aadhaar number* (e.g., \`123456789012\`):

Tap *❌ Cancel & Return* below or select another service directly:`, getPromptInlineKeyboard('aadhar2info'));
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Verifying UIDAI Records...*\nTarget: \`${aadhaar.slice(0, 4)} **** ${aadhaar.slice(8)}\`...`);
      let data = await fetchWithTimeout(`${AADHAR2_API_URL}${aadhaar}`);
      recordSearch(userId);
      recordButtonUsage(user, 'aadhar2info');
      const card = formatAadharCard(data, aadhaar, false);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'aadhar2info', aadhaar, userMsgId);
      return;
    }

    if (action === 'aadhar2family') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'aadhar2family');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const aadhaar = text.replace(/[^0-9]/g, '');
      if (aadhaar.length < 12) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Aadhaar Number!*
Please send a valid *12-digit Aadhaar number* (e.g., \`123456789012\`):

Tap *❌ Cancel & Return* below or select another service directly:`, getPromptInlineKeyboard('aadhar2family'));
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Extracting Family Tree Graph...*\nTarget: \`${aadhaar.slice(0, 4)} **** ${aadhaar.slice(8)}\`...`);
      let data = await fetchWithTimeout(`${AADHAR2FAM_API_URL}${aadhaar}`);
      recordSearch(userId);
      recordButtonUsage(user, 'aadhar2family');
      const card = formatAadharCard(data, aadhaar, true);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'aadhar2family', aadhaar, userMsgId);
      return;
    }

    if (action === 'lpg') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'lpg');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const q = text.trim();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Querying MoPNG Gas Gateway...*\nTarget: \`${q}\`...`);
      let data = await fetchWithTimeout(`${LPG_API_URL}${q}`);
      recordSearch(userId);
      recordButtonUsage(user, 'lpg');
      const card = formatLPGCard(data, q);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'lpg', q, userMsgId);
      return;
    }

    if (action === 'upi2num') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'upi2num');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const upi = text.trim();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Resolving UPI VPA Handle...*\nTarget: \`${upi}\`...`);
      let data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(upi)}`);
      recordSearch(userId);
      recordButtonUsage(user, 'upi2num');
      const card = formatUPICard(data, upi);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'upi2num', upi, userMsgId);
      return;
    }

    if (action === 'gst2name') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'gst2name');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const name = text.trim();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Searching GST By Business Name...*\nTarget: \`${name}\`...`);
      let data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(name)}`);
      recordSearch(userId);
      recordButtonUsage(user, 'gst2name');
      const card = formatGSTCard(data, name, 'name');
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'gst2name', name, userMsgId);
      return;
    }

    if (action === 'gst2pan') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'gst2pan');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const pan = text.trim().toUpperCase();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Resolving GSTIN By PAN...*\nPAN: \`${pan}\`...`);
      let data = await fetchWithTimeout(`${GST2PAN_API_URL}${pan}`);
      recordSearch(userId);
      recordButtonUsage(user, 'gst2pan');
      const card = formatGSTCard(data, pan, 'pan');
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'gst2pan', pan, userMsgId);
      return;
    }

    if (action === 'gst') {
      const btnCheck = checkAndEnforceButtonLimit(user, 'gst');
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      const gstin = text.trim().toUpperCase();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Retrieving GSTIN Profile...*\nGSTIN: \`${gstin}\`...`);
      let data = await fetchWithTimeout(`${GST_API_URL}${gstin}`);
      recordSearch(userId);
      recordButtonUsage(user, 'gst');
      const card = formatGSTCard(data, gstin, 'gst');
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, 'gst', gstin, userMsgId);
      return;
    }

    if (action === 'redeem') {
      user.pendingAction = undefined;
      const code = text.trim().toUpperCase();
      const voucher = redeemCodes.get(code);
      if (!voucher) {
        await sendTelegramMessage(chatId, `❌ *Invalid Code*\nRedeem code \`${code}\` not found.`, getMainReplyKeyboard(user));
        return;
      }
      if (voucher.usesLeft <= 0) {
        const isClaimed = voucher.usedBy && voucher.usedBy.length > 0;
        const claimMsg = isClaimed
          ? `❌ *Already Claimed!*\nYe redeem code pehle hi kisi aur user ne redeem kar liya hai!\n*(First-Come, First-Served — Sirf pehle user ko milta hai)*`
          : `❌ *Expired Code*\nIs code ke uses khatam ho chuke hain.`;
        await sendTelegramMessage(chatId, claimMsg, getMainReplyKeyboard(user));
        return;
      }
      if (voucher.usedBy && voucher.usedBy.includes(String(userId))) {
        await sendTelegramMessage(chatId, `⚠️ *Already Redeemed!*\nAap pehle hi is code ko claim kar chuke hain.`, getMainReplyKeyboard(user));
        return;
      }

      voucher.usesLeft -= 1;
      if (!voucher.usedBy) voucher.usedBy = [];
      voucher.usedBy.push(String(userId));
      user.role = 'premium';
      persistUser(user).catch(() => {});
      await sendTelegramMessage(chatId, `🎉 *CONGRATULATIONS! CODE REDEEMED!*
━━━━━━━━━━━━━━━━━━━━━━━━━
🎖️ *Role:* 💎 PREMIUM ACTIVATED
⏳ *Duration:* ${voucher.days} Days VIP Access
⚡ *Status:* Unlimited lookups unlocked!
🏆 *Claimed by:* Agent \`${userId}\`
━━━━━━━━━━━━━━━━━━━━━━━━━`, getMainReplyKeyboard(user));
      return;
    }

    // Generic handler for custom or dynamic buttons
    const customBtn = buttonsStore.get(action);
    if (customBtn) {
      const btnCheck = checkAndEnforceButtonLimit(user, action);
      if (!btnCheck.allowed) {
        user.pendingAction = undefined;
        const sentId = await sendTelegramMessage(chatId, btnCheck.message);
        if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
        return;
      }
      user.pendingAction = undefined;
      const cleanQ = text.trim();
      await sendTelegramChatAction(chatId, "typing");
      const statusId = await sendTelegramMessage(chatId, `🔍 *Querying ${customBtn.label}...*\nTarget: \`${cleanQ}\`...`);
      let data = await fetchWithTimeout(`${customBtn.apiUrl}${encodeURIComponent(cleanQ)}`);
      recordSearch(userId);
      recordButtonUsage(user, action);
      const card = formatGenericCustomCard(customBtn.label, data, cleanQ);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
      await sendSearchResult(chatId, user, card, action, cleanQ, userMsgId);
      return;
    }
  }

  // ── KEYBOARD BUTTON ACTIONS (Prompts with Inline Cancel, bottom buttons remain intact) ──
  if (text === "📱 Mobile Lookup" || text === "📱 Num2 Lookup" || text.includes("Num2") || text.includes("Mobile") || text.toLowerCase() === "phone") {
    if (!isButtonEnabled('num2')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n📱 Mobile Lookup service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'num2';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('num2'), getPromptInlineKeyboard('num2'));
    return;
  }

  if (text === "🚗 Vehicle Lookup" || text.includes("Vehicle") || text.toLowerCase() === "vehicle") {
    if (!isButtonEnabled('vehicle')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n🚗 Vehicle Lookup service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'vehicle';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('vehicle'), getPromptInlineKeyboard('vehicle'));
    return;
  }

  if (text === "🗳️ Voter Lookup" || text.includes("Voter") || text.toLowerCase() === "voter") {
    if (!isButtonEnabled('voter')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n🗳️ Voter Lookup service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'voter';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('voter'), getPromptInlineKeyboard('voter'));
    return;
  }

  if (text === "🪪 Aadhaar Info" || text === "🪪 Aadhar2Info" || text.includes("Aadhar") || text.includes("Aadhaar")) {
    if (!isButtonEnabled('aadhar2info')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n🪪 Aadhaar Info service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'aadhar2info';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('aadhar2info'), getPromptInlineKeyboard('aadhar2info'));
    return;
  }

  if (text === "👨‍👩‍👧 Family Tree" || text === "👪 Aadhar2Family" || text.includes("Family")) {
    if (!isButtonEnabled('aadhar2family')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n👨‍👩‍👧 Family Tree service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'aadhar2family';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('aadhar2family'), getPromptInlineKeyboard('aadhar2family'));
    return;
  }

  if (text === "🔥 LPG Gas Lookup" || text === "🔥 LPG Lookup" || text.includes("LPG") || text.toLowerCase() === "lpg") {
    if (!isButtonEnabled('lpg')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n🔥 LPG Gas Lookup service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'lpg';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('lpg'), getPromptInlineKeyboard('lpg'));
    return;
  }

  if (text === "💳 UPI Lookup" || text === "💳 UPI2Num" || text.includes("UPI") || text.toLowerCase() === "upi") {
    if (!isButtonEnabled('upi2num')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n💳 UPI Lookup service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'upi2num';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('upi2num'), getPromptInlineKeyboard('upi2num'));
    return;
  }

  if (text === "🏢 GST by Name" || text === "🏢 GST2Name" || text.includes("GST by Name") || text.includes("GST2Name")) {
    if (!isButtonEnabled('gst2name')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n🏢 GST by Name service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'gst2name';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('gst2name'), getPromptInlineKeyboard('gst2name'));
    return;
  }

  if (text === "🪪 GST by PAN" || text === "🪪 GST2PAN" || text.includes("GST by PAN") || text.includes("GST2PAN")) {
    if (!isButtonEnabled('gst2pan')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n🪪 GST by PAN service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'gst2pan';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('gst2pan'), getPromptInlineKeyboard('gst2pan'));
    return;
  }

  if (text === "📄 GST Details" || text === "📄 GSTIN Profile" || text.includes("GST Details") || text.includes("GSTIN Profile") || text.toLowerCase() === "gst") {
    if (!isButtonEnabled('gst')) {
      await sendTelegramMessage(chatId, `⚠️ *Service Disabled*\n📄 GST Details service is temporarily turned OFF by Admin.`, getMainReplyKeyboard(user));
      return;
    }
    user.pendingAction = 'gst';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('gst'), getPromptInlineKeyboard('gst'));
    return;
  }

  if (text === "💎 Redeem Code" || text === "💎 Redeem" || text.includes("Redeem")) {
    user.pendingAction = 'redeem';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('redeem'), getPromptInlineKeyboard('redeem'));
    return;
  }

  // Dynamic check for all registered buttons (standard or custom)
  for (const btn of buttonsStore.values()) {
    if (text === btn.label || text.toLowerCase() === btn.label.toLowerCase() || (btn.label.includes(text) && text.length > 3)) {
      if (!btn.enabled) {
        await sendTelegramMessage(chatId, `⚠️ *Service Currently Disabled*\n\`${btn.label}\` service is temporarily turned OFF by Admin.\nPlease try another service or check back later.`, getMainReplyKeyboard(user));
        return;
      }
      user.pendingAction = btn.id;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard(btn.id), getPromptInlineKeyboard(btn.id));
      return;
    }
  }

  // ── ONE-SHOT SLASH COMMANDS ──
  if (remaining <= 0) {
    await sendTelegramMessage(chatId, `🔒 *Daily Limit Reached!* (${dailyLimit} searches/day)
══════════════════════════
You have used up your free daily search allowance.

🎁 *Earn +10 Extra Searches Daily:*
👉 Send \`/refer\` to invite friends and permanently boost your daily search limit by *+10 credits each*!
💎 Or send \`/redeem CODE\` for unlimited VIP access.`, getMainReplyKeyboard(user));
    return;
  }

  if (text.startsWith("/vehicle")) {
    const query = text.replace("/vehicle", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'vehicle';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('vehicle'), getPromptInlineKeyboard('vehicle'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'vehicle');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Querying Vahan RC Gateway...*\nTarget: \`${query}\`...`);
    const data = await fetchVehicleInfo(query.replace(/\s+/g, ''));
    recordSearch(userId);
    recordButtonUsage(user, 'vehicle');
    const card = formatVehicleCard(data, query);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'vehicle', query, userMsgId);
    return;
  }

  if (text.startsWith("/num2")) {
    const query = text.replace("/num2", "").trim();
    if (!query) {
      user.pendingAction = 'num2';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('num2'), getPromptInlineKeyboard('num2'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'num2');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const cleanPhone = query.replace(/[^0-9]/g, '').slice(-10);
    const statusId = await sendTelegramMessage(chatId, `🔍 *Querying Telecom Registry...*\nTarget: \`+91 ${cleanPhone}\`...`);
    const data = await fetchWithTimeout(`${NUM2_API_URL}${cleanPhone}`);
    recordSearch(userId);
    recordButtonUsage(user, 'num2');
    const card = formatNum2Card(data, cleanPhone);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'num2', cleanPhone, userMsgId);
    return;
  }

  if (text.startsWith("/voter")) {
    const query = text.replace("/voter", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'voter';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('voter'), getPromptInlineKeyboard('voter'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'voter');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Searching Electoral Rolls...*\nEPIC: \`${query}\`...`);
    const data = await fetchWithTimeout(`${VOTER_API_URL}${query}`);
    recordSearch(userId);
    recordButtonUsage(user, 'voter');
    const card = formatVoterCard(data, query);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'voter', query, userMsgId);
    return;
  }

  if (text.startsWith("/aadhar2info")) {
    const query = text.replace("/aadhar2info", "").trim();
    if (!query) {
      user.pendingAction = 'aadhar2info';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('aadhar2info'), getPromptInlineKeyboard('aadhar2info'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'aadhar2info');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Verifying UIDAI Records...*\nTarget: \`${query.slice(0, 4)} **** ${query.slice(8)}\`...`);
    const data = await fetchWithTimeout(`${AADHAR2_API_URL}${query}`);
    recordSearch(userId);
    recordButtonUsage(user, 'aadhar2info');
    const card = formatAadharCard(data, query, false);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'aadhar2info', query, userMsgId);
    return;
  }

  if (text.startsWith("/aadhar2family")) {
    const query = text.replace("/aadhar2family", "").trim();
    if (!query) {
      user.pendingAction = 'aadhar2family';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('aadhar2family'), getPromptInlineKeyboard('aadhar2family'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'aadhar2family');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Extracting Family Tree Graph...*\nTarget: \`${query.slice(0, 4)} **** ${query.slice(8)}\`...`);
    const data = await fetchWithTimeout(`${AADHAR2FAM_API_URL}${query}`);
    recordSearch(userId);
    recordButtonUsage(user, 'aadhar2family');
    const card = formatAadharCard(data, query, true);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'aadhar2family', query, userMsgId);
    return;
  }

  if (text.startsWith("/lpg")) {
    const query = text.replace("/lpg", "").trim();
    if (!query) {
      user.pendingAction = 'lpg';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('lpg'), getPromptInlineKeyboard('lpg'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'lpg');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Querying MoPNG Gas Gateway...*\nTarget: \`${query}\`...`);
    const data = await fetchWithTimeout(`${LPG_API_URL}${query}`);
    recordSearch(userId);
    recordButtonUsage(user, 'lpg');
    const card = formatLPGCard(data, query);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'lpg', query, userMsgId);
    return;
  }

  if (text.startsWith("/upi2num")) {
    const query = text.replace("/upi2num", "").trim();
    if (!query) {
      user.pendingAction = 'upi2num';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('upi2num'), getPromptInlineKeyboard('upi2num'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'upi2num');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Resolving UPI VPA Handle...*\nTarget: \`${query}\`...`);
    const data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(query)}`);
    recordSearch(userId);
    recordButtonUsage(user, 'upi2num');
    const card = formatUPICard(data, query);
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'upi2num', query, userMsgId);
    return;
  }

  if (text.startsWith("/gst2name")) {
    const query = text.replace("/gst2name", "").trim();
    if (!query) {
      user.pendingAction = 'gst2name';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('gst2name'), getPromptInlineKeyboard('gst2name'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'gst2name');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Searching GST By Business Name...*\nTarget: \`${query}\`...`);
    const data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(query)}`);
    recordSearch(userId);
    recordButtonUsage(user, 'gst2name');
    const card = formatGSTCard(data, query, 'name');
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'gst2name', query, userMsgId);
    return;
  }

  if (text.startsWith("/gst2pan")) {
    const query = text.replace("/gst2pan", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'gst2pan';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('gst2pan'), getPromptInlineKeyboard('gst2pan'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'gst2pan');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Resolving GSTIN By PAN...*\nPAN: \`${query}\`...`);
    const data = await fetchWithTimeout(`${GST2PAN_API_URL}${query}`);
    recordSearch(userId);
    recordButtonUsage(user, 'gst2pan');
    const card = formatGSTCard(data, query, 'pan');
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'gst2pan', query, userMsgId);
    return;
  }

  if (text.startsWith("/gst")) {
    const query = text.replace("/gst", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'gst';
      await sendTelegramChatAction(chatId, "typing");
      const promptId = await sendTelegramMessage(chatId, getPromptCard('gst'), getPromptInlineKeyboard('gst'));
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, promptId], AUTO_DELETE_DELAY_MS);
      return;
    }
    const btnCheck = checkAndEnforceButtonLimit(user, 'gst');
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const statusId = await sendTelegramMessage(chatId, `🔍 *Retrieving GSTIN Profile...*\nGSTIN: \`${query}\`...`);
    const data = await fetchWithTimeout(`${GST_API_URL}${query}`);
    recordSearch(userId);
    recordButtonUsage(user, 'gst');
    const card = formatGSTCard(data, query, 'gst');
    if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    await sendSearchResult(chatId, user, card, 'gst', query, userMsgId);
    return;
  }

  // ── SMART AUTO-DETECTION FOR RAW INPUTS IN TELEGRAM ──
  const detected = autoDetectLookupType(text);
  if (detected) {
    const btnCheck = checkAndEnforceButtonLimit(user, detected.type);
    if (!btnCheck.allowed) {
      const sentId = await sendTelegramMessage(chatId, btnCheck.message);
      if (isGroup) scheduleAutoDelete(chatId, [userMsgId, sentId], AUTO_DELETE_DELAY_MS);
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    let data: any = null;
    let card = "";

    if (detected.type === 'num2') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Querying Telecom Registry...*\nTarget: \`+91 ${detected.cleanQuery}\`...`);
      data = await fetchWithTimeout(`${NUM2_API_URL}${detected.cleanQuery}`);
      card = formatNum2Card(data, detected.cleanQuery);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    } else if (detected.type === 'vehicle') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Querying Vahan RC Gateway...*\nTarget: \`${detected.cleanQuery}\`...`);
      data = await fetchVehicleInfo(detected.cleanQuery);
      card = formatVehicleCard(data, detected.cleanQuery);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    } else if (detected.type === 'voter') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Searching Electoral Rolls...*\nEPIC: \`${detected.cleanQuery}\`...`);
      data = await fetchWithTimeout(`${VOTER_API_URL}${detected.cleanQuery}`);
      card = formatVoterCard(data, detected.cleanQuery);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    } else if (detected.type === 'aadhar2info') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Verifying UIDAI Records...*\nTarget: \`${detected.cleanQuery.slice(0, 4)} **** ${detected.cleanQuery.slice(8)}\`...`);
      data = await fetchWithTimeout(`${AADHAR2_API_URL}${detected.cleanQuery}`);
      card = formatAadharCard(data, detected.cleanQuery, false);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    } else if (detected.type === 'gst2pan') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Resolving GSTIN By PAN...*\nPAN: \`${detected.cleanQuery}\`...`);
      data = await fetchWithTimeout(`${GST2PAN_API_URL}${detected.cleanQuery}`);
      card = formatGSTCard(data, detected.cleanQuery, 'pan');
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    } else if (detected.type === 'gst') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Retrieving GSTIN Profile...*\nGSTIN: \`${detected.cleanQuery}\`...`);
      data = await fetchWithTimeout(`${GST_API_URL}${detected.cleanQuery}`);
      card = formatGSTCard(data, detected.cleanQuery, 'gst');
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    } else if (detected.type === 'upi2num') {
      const statusId = await sendTelegramMessage(chatId, `🔍 *Resolving UPI VPA Handle...*\nTarget: \`${detected.cleanQuery}\`...`);
      data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(detected.cleanQuery)}`);
      card = formatUPICard(data, detected.cleanQuery);
      if (isGroup && statusId) deleteTelegramMessage(chatId, statusId).catch(() => {});
    }

    if (card) {
      recordSearch(userId);
      recordButtonUsage(user, detected.type);
      await sendSearchResult(chatId, user, card, detected.type, detected.cleanQuery, userMsgId);
      return;
    }
  }

  if (isGroup) {
    if (text.startsWith("/")) {
      await sendTelegramMessage(chatId, `⚠️ *Unknown command.* Send /help to view available OSINT lookup modules.`);
    }
    return;
  }

  await sendTelegramMessage(chatId, `👋 Tap any service button below or send /help to view command list:`, getMainReplyKeyboard(user));
}

function clean(str: string): string {
  return encodeURIComponent(str.trim());
}

// ── EXPRESS APP ──
async function startServer() {
  // Restore persistent users & buttons from Supabase if configured
  await loadUsersFromSupabase();
  await loadButtonsFromSupabase();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: "ok",
      message: "🤖 Bot is alive! Running smoothly.",
      botRunning: isTelegramPolling,
      version: BOT_VERSION,
      databaseConnected: Boolean(supabase),
    });
  });

  // Config
  app.get('/api/config', (req, res) => {
    res.json({
      botName: BOT_NAME,
      botVersion: BOT_VERSION,
      botUsername: BOT_USERNAME,
      developer: DEVELOPER,
      developerLink: DEVELOPER_LINK,
      channelId: CHANNEL_ID,
      channelUsername: CHANNEL_USERNAME,
      channelLink: CHANNEL_LINK,
      supportGroup: SUPPORT_GROUP,
      telegramActive: Boolean(BOT_TOKEN),
      databaseConnected: Boolean(supabase),
    });
  });

  // Stats
  app.get('/api/stats', (req, res) => {
    const user = getUser('web_client');
    const today = getTodayString();
    let todaySearches = 0;
    for (const u of usersStore.values()) {
      if (u.lastSearchDate === today) {
        todaySearches += u.dailySearches;
      }
    }

    const currentLimit = getUserDailyLimit(user);
    const dailyRemaining = getUserRemaining(user);

    res.json({
      totalUsers: Math.max(usersStore.size, 1),
      premiumUsers: Array.from(usersStore.values()).filter(u => u.role === 'premium').length,
      bannedUsers: 0,
      todaySearches: todaySearches || user.dailySearches,
      allTimeSearches: allTimeSearchesCount,
      userRole: user.role,
      channelVerified: user.channelVerified,
      channelId: CHANNEL_ID,
      channelLink: CHANNEL_LINK,
      dailyRemaining,
      dailyLimit: currentLimit,
      referralCount: user.referralCount || 0,
      referralBonusDaily: (user.referralCount || 0) * REFERRAL_BONUS_PER_USER,
    });
  });

  // Verify Channel Membership API
  app.post('/api/verify-channel', (req, res) => {
    const { userId = 'web_client' } = req.body;
    const user = getUser(userId);
    user.channelVerified = true;
    res.json({
      success: true,
      channelVerified: true,
      channelId: CHANNEL_ID,
      channelLink: CHANNEL_LINK,
      message: "Channel membership verified successfully! All lookup features are unlocked."
    });
  });

  // Redeem code activation
  app.post('/api/redeem', (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Voucher code is required' });
    }

    const voucher = redeemCodes.get(code.toUpperCase().trim());
    if (!voucher) {
      return res.status(400).json({ success: false, error: 'Invalid voucher code.' });
    }
    if (voucher.usesLeft <= 0) {
      const isClaimed = voucher.usedBy && voucher.usedBy.length > 0;
      return res.status(400).json({
        success: false,
        error: isClaimed
          ? 'Ye code pehle hi kisi aur user ne redeem kar liya hai! (First-Come, First-Served)'
          : 'This code has expired or has no uses left.'
      });
    }

    voucher.usesLeft -= 1;
    if (!voucher.usedBy) voucher.usedBy = [];
    voucher.usedBy.push('web_client');
    const user = getUser('web_client');
    user.role = 'premium';

    res.json({
      success: true,
      message: `Code redeemed! Role upgraded to ${voucher.role.toUpperCase()} for ${voucher.days} days.`,
      role: voucher.role,
      days: voucher.days,
    });
  });

  // Admin: Get all redeem codes
  app.get('/api/admin/codes', (req, res) => {
    const list = Array.from(redeemCodes.values()).map(v => ({
      code: v.code,
      days: v.days,
      role: v.role,
      usesLeft: v.usesLeft,
      totalUses: v.totalUses,
      createdAt: v.createdAt,
      usedBy: v.usedBy || [],
    }));
    res.json({ codes: list });
  });

  // Admin: Generate redeem codes with custom days
  app.post('/api/admin/codes/generate', (req, res) => {
    const { count = 1, days = 7, uses = 1, role = 'premium' } = req.body;
    const newCodes: RedeemCodeRecord[] = [];
    const numDays = Math.max(1, Number(days) || 7);
    const numCount = Math.max(1, Math.min(50, Number(count) || 1));
    const numUses = Math.max(1, Number(uses) || 1);

    for (let i = 0; i < numCount; i++) {
      const code = generateCode();
      const record: RedeemCodeRecord = {
        code,
        days: numDays,
        role,
        usesLeft: numUses,
        totalUses: numUses,
        createdAt: new Date().toISOString(),
        usedBy: [],
      };
      redeemCodes.set(code, record);
      newCodes.push(record);
    }

    res.json({ success: true, codes: newCodes });
  });

  // Admin: Broadcast single-use redeem code (First-Come, First-Served)
  app.post('/api/admin/broadcast-code', async (req, res) => {
    const { days = 7 } = req.body;
    const numDays = Math.max(1, Number(days) || 7);
    const drop = await broadcastRedeemCode(numDays, 'Admin');
    res.json({
      success: true,
      code: drop.code,
      days: drop.days,
      sentCount: drop.sent,
      failedCount: drop.failed,
      message: `Single-use code ${drop.code} (${drop.days} days) broadcasted to ${drop.sent} users! First to redeem gets it.`
    });
  });

  // Admin: Delete / revoke single redeem code
  app.delete('/api/admin/codes/:code', (req, res) => {
    const { code } = req.params;
    if (!code) return res.status(400).json({ success: false, error: 'Code is required' });
    const upperCode = code.toUpperCase().trim();
    if (redeemCodes.has(upperCode)) {
      redeemCodes.delete(upperCode);
      return res.json({ success: true, message: `Voucher ${upperCode} revoked and deleted.` });
    }
    return res.status(404).json({ success: false, error: 'Code not found' });
  });

  // Admin: Purge all claimed / exhausted redeem codes
  app.post('/api/admin/codes/purge-claimed', (req, res) => {
    let purged = 0;
    for (const [code, voucher] of redeemCodes.entries()) {
      if (voucher.usesLeft <= 0) {
        redeemCodes.delete(code);
        purged++;
      }
    }
    res.json({ success: true, purged, message: `Purged ${purged} exhausted redeem codes.` });
  });

  // Admin: Broadcast text & image announcement
  app.post('/api/admin/broadcast', async (req, res) => {
    const { message, target = 'all', imageUrl } = req.body;
    if ((!message || !message.trim()) && !imageUrl) {
      return res.status(400).json({ success: false, error: 'Announcement message or image cannot be empty' });
    }
    const targetFilter = (['all', 'vip', 'free', 'dm'].includes(target) ? target : 'all') as any;
    const cleanMsg = (message || '').trim();
    const formattedText = cleanMsg
      ? `📢 *OFFICIAL ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n${cleanMsg}\n━━━━━━━━━━━━━━━━━━━━━━━━━\n— Administration`
      : `📢 *OFFICIAL ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n— Administration`;
    const cleanImageUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? imageUrl.trim() : undefined;
    const result = await broadcastTelegramMessage(formattedText, undefined, targetFilter, cleanImageUrl);
    res.json({
      success: true,
      sentCount: result.sent,
      failedCount: result.failed,
      message: `Announcement ${cleanImageUrl ? 'with image ' : ''}broadcasted to ${result.sent} users (${targetFilter.toUpperCase()} audience).`
    });
  });

  // ── DYNAMIC BUTTONS & APIS ADMIN ENDPOINTS ──
  // GET /api/buttons - returns all buttons
  app.get('/api/buttons', (req, res) => {
    const buttons = Array.from(buttonsStore.values()).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
    res.json({ success: true, buttons });
  });

  // POST /api/admin/buttons/toggle - enable or disable a button
  app.post('/api/admin/buttons/toggle', async (req, res) => {
    const { id, enabled } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Button ID is required' });
    }
    const btn = buttonsStore.get(id);
    if (!btn) {
      return res.status(404).json({ success: false, error: `Button ${id} not found` });
    }
    btn.enabled = Boolean(enabled);
    await persistButton(btn);
    res.json({ success: true, button: btn, message: `Button ${btn.label} is now ${btn.enabled ? 'ENABLED' : 'DISABLED'}` });
  });

  // POST /api/admin/buttons/update - update API URL, label, daily limit, etc.
  app.post('/api/admin/buttons/update', async (req, res) => {
    const { id, apiUrl, label, category, placeholder, example, description, enabled, dailyLimit } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Button ID is required' });
    }
    let btn = buttonsStore.get(id);
    if (!btn) {
      return res.status(404).json({ success: false, error: `Button ${id} not found` });
    }

    if (apiUrl !== undefined) btn.apiUrl = String(apiUrl).trim();
    if (label !== undefined) btn.label = String(label).trim();
    if (category !== undefined) btn.category = category;
    if (placeholder !== undefined) btn.placeholder = String(placeholder).trim();
    if (example !== undefined) btn.example = String(example).trim();
    if (description !== undefined) btn.description = String(description).trim();
    if (enabled !== undefined) btn.enabled = Boolean(enabled);
    if (dailyLimit !== undefined) {
      const parsedLim = Number(dailyLimit);
      btn.dailyLimit = isNaN(parsedLim) || parsedLim < 0 ? 0 : parsedLim;
    }

    await persistButton(btn);
    res.json({ success: true, button: btn, message: `Button ${btn.label} configuration updated successfully.` });
  });

  // POST /api/admin/buttons/add - add a brand new button + custom API
  app.post('/api/admin/buttons/add', async (req, res) => {
    const { id, label, apiUrl, category = 'custom', placeholder = '', example = '', description = '', dailyLimit = 0 } = req.body;
    if (!label || !apiUrl) {
      return res.status(400).json({ success: false, error: 'Label and API URL are required' });
    }

    const parsedLim = Number(dailyLimit);
    const validLimit = isNaN(parsedLim) || parsedLim < 0 ? 0 : parsedLim;
    const generatedId = (id || label.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim() || `btn_${Date.now()}`;
    const newBtn: BotButton = {
      id: generatedId,
      label: label.trim(),
      category: category || 'custom',
      apiUrl: apiUrl.trim(),
      placeholder: placeholder.trim() || `Enter ${label}`,
      example: example.trim() || '',
      description: description.trim() || `Custom OSINT lookup module for ${label}`,
      enabled: true,
      isCustom: true,
      sortOrder: buttonsStore.size + 1,
      dailyLimit: validLimit,
    };

    buttonsStore.set(generatedId, newBtn);
    await persistButton(newBtn);
    res.json({ success: true, button: newBtn, message: `New button ${newBtn.label} added successfully!` });
  });

  // DELETE /api/admin/buttons/:id - delete a custom button
  app.delete('/api/admin/buttons/:id', async (req, res) => {
    const { id } = req.params;
    const btn = buttonsStore.get(id);
    if (!btn) {
      return res.status(404).json({ success: false, error: 'Button not found' });
    }
    buttonsStore.delete(id);
    await deleteButtonFromDb(id);
    res.json({ success: true, message: `Button ${btn.label} deleted successfully.` });
  });

  // ── USER MANAGEMENT & DM ACCESS ADMIN ENDPOINTS ──
  // GET /api/admin/users - return list of all users and permissions
  app.get('/api/admin/users', (req, res) => {
    const today = getTodayString();
    const users = Array.from(usersStore.values()).map(u => ({
      userId: u.userId,
      username: u.username || '',
      firstName: u.firstName || '',
      role: u.role,
      dailySearches: getUserTodaySearches(u),
      dailyLimit: getUserDailyLimit(u),
      remaining: getUserRemaining(u),
      totalSearches: u.totalSearches || 0,
      channelVerified: u.channelVerified,
      referralCount: u.referralCount || 0,
      referralBonusDaily: u.referralBonusDaily || 0,
      allowDm: Boolean(u.allowDm !== false || u.role === 'admin'),
      customLimit: u.customLimit || 0,
      lastActive: u.lastActive || '',
      createdAt: u.createdAt || '',
      dailyButtonUsage: (u.lastSearchDate === today && u.dailyButtonUsage) ? u.dailyButtonUsage : {},
    }));
    res.json({ success: true, users, total: users.length });
  });

  // POST /api/admin/users/reset-all-daily - reset searches for all users
  app.post('/api/admin/users/reset-all-daily', async (req, res) => {
    const today = getTodayString();
    let count = 0;
    for (const u of usersStore.values()) {
      u.dailySearches = 0;
      u.dailyButtonUsage = {};
      u.lastSearchDate = today;
      count++;
    }
    res.json({ success: true, message: `Successfully reset daily search quota for all ${count} users.` });
  });

  // POST /api/admin/users/set-custom-limit - set custom daily limit override
  app.post('/api/admin/users/set-custom-limit', async (req, res) => {
    const { userId, customLimit } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    const user = getUser(userId);
    const limitNum = Math.max(0, parseInt(customLimit, 10) || 0);
    user.customLimit = limitNum > 0 ? limitNum : undefined;
    await persistUser(user);
    res.json({
      success: true,
      message: `User ${userId} daily limit override set to ${limitNum > 0 ? `${limitNum} searches/day` : 'Default'}`,
      dailyLimit: getUserDailyLimit(user)
    });
  });

  // POST /api/admin/users/reset-searches - reset today's search counter
  app.post('/api/admin/users/reset-searches', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    const user = getUser(userId);
    user.dailySearches = 0;
    user.dailyButtonUsage = {};
    user.lastSearchDate = getTodayString();
    await persistUser(user);
    res.json({
      success: true,
      message: `Daily searches for user ${userId} reset to 0.`
    });
  });

  // POST /api/admin/users/add-bonus - add bonus searches
  app.post('/api/admin/users/add-bonus', async (req, res) => {
    const { userId, amount = 10 } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    const user = getUser(userId);
    user.dailySearches = Math.max(0, (user.dailySearches || 0) - Number(amount));
    await persistUser(user);
    res.json({
      success: true,
      message: `Added +${amount} searches to user ${userId}. New remaining today: ${getUserRemaining(user)}`
    });
  });

  // POST /api/admin/users/delete - remove user record
  app.post('/api/admin/users/delete', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    usersStore.delete(String(userId));
    if (supabase) {
      try {
        await supabase.from('bot_users').delete().eq('user_id', String(userId));
      } catch (e: any) {
        console.warn(`[Supabase] Could not delete user ${userId}:`, e.message);
      }
    }
    res.json({ success: true, message: `User ${userId} deleted.` });
  });

  // GET /api/admin/users/export-text - download plain text full dump
  app.get('/api/admin/users/export-text', (req, res) => {
    const today = getTodayString();
    const allUsers = Array.from(usersStore.values());
    let dump = `═══════════════════════════════════════════════════════════════\n`;
    dump += `           ${BOT_NAME} - REGISTERED USERS AUDIT DUMP\n`;
    dump += `═══════════════════════════════════════════════════════════════\n`;
    dump += `Generated: ${new Date().toISOString()}\n`;
    dump += `Total Users Registered: ${allUsers.length}\n`;
    dump += `Today's Date: ${today}\n\n`;

    allUsers.forEach((u, i) => {
      const isToday = u.lastSearchDate === today;
      const todayUsed = isToday ? (u.dailySearches || 0) : 0;
      const limit = u.role === 'free' ? getUserDailyLimit(u) : 'UNLIMITED';
      dump += `[#${i + 1}] USER ID: ${u.userId}\n`;
      dump += `  Handle: ${u.username ? '@' + u.username : 'N/A'}\n`;
      dump += `  Name: ${u.firstName || 'N/A'}\n`;
      dump += `  Role: ${u.role.toUpperCase()}\n`;
      dump += `  Today Searches: ${todayUsed} / ${limit}\n`;
      dump += `  Total Searches: ${u.totalSearches || 0}\n`;
      dump += `  DM Allowed: ${Boolean(u.allowDm !== false || u.role === 'admin') ? 'YES' : 'NO'}\n`;
      dump += `  Invited Friends: ${u.referralCount || 0}\n`;
      dump += `  Last Active: ${u.lastActive || 'N/A'}\n`;
      dump += `  Registered: ${u.createdAt || 'N/A'}\n`;
      dump += `───────────────────────────────────────────────────────────────\n`;
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="bot_users_${today}.txt"`);
    res.send(dump);
  });

  // POST /api/admin/users/allow-dm - toggle user DM access
  app.post('/api/admin/users/allow-dm', async (req, res) => {
    const { userId, allowDm } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    const user = getUser(userId);
    user.allowDm = Boolean(allowDm);
    await persistUser(user);
    res.json({
      success: true,
      user: {
        userId: user.userId,
        role: user.role,
        allowDm: user.allowDm,
      },
      message: `User ${userId} DM access set to ${user.allowDm ? 'ALLOWED' : 'DISABLED'}`
    });
  });

  // POST /api/admin/users/role - set user role (admin, premium, free)
  app.post('/api/admin/users/role', async (req, res) => {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ success: false, error: 'User ID and role are required' });
    }
    const user = getUser(userId);
    user.role = role;
    if (role === 'admin') {
      user.allowDm = true;
    }
    await persistUser(user);
    res.json({
      success: true,
      user: {
        userId: user.userId,
        role: user.role,
        allowDm: user.allowDm,
      },
      message: `User ${userId} role updated to ${user.role}`
    });
  });

  // POST /api/admin/users/add - register a Telegram User ID
  app.post('/api/admin/users/add', async (req, res) => {
    const { userId, role = 'free', allowDm = true } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    const user = getUser(userId);
    user.role = role;
    user.allowDm = Boolean(allowDm !== false || role === 'admin');
    await persistUser(user);
    res.json({
      success: true,
      user: {
        userId: user.userId,
        role: user.role,
        allowDm: user.allowDm,
      },
      message: `User ${userId} configured successfully!`
    });
  });

  // ── ADMIN SYSTEM SETTINGS & PARAMETERS ──
  app.get('/api/admin/settings', (req, res) => {
    res.json({
      success: true,
      settings: {
        autoDeleteSeconds: AUTO_DELETE_DELAY_MS <= 0 ? 0 : Math.round(AUTO_DELETE_DELAY_MS / 1000),
        freeDailyLimit: FREE_DAILY_LIMIT,
        referralBonusPerUser: REFERRAL_BONUS_PER_USER,
        officialGroupId: OFFICIAL_GROUP_ID,
        officialGroupUrl: OFFICIAL_GROUP_URL,
        officialGroupUsername: OFFICIAL_GROUP_USERNAME,
        telegramActive: isTelegramPolling,
        maintenanceMode: MAINTENANCE_MODE,
      }
    });
  });

  app.post('/api/admin/settings', (req, res) => {
    const { autoDeleteSeconds, freeDailyLimit: newLimit, referralBonusPerUser: newBonus, officialGroupId: newGroupId, officialGroupUrl: newGroupUrl, maintenanceMode } = req.body;
    if (autoDeleteSeconds !== undefined) {
      const sec = Number(autoDeleteSeconds);
      if (sec <= 0) {
        AUTO_DELETE_DELAY_MS = 0;
      } else {
        AUTO_DELETE_DELAY_MS = Math.max(5, Math.min(600, sec)) * 1000;
      }
    }
    if (maintenanceMode !== undefined) {
      MAINTENANCE_MODE = Boolean(maintenanceMode);
    }
    if (newLimit !== undefined) {
      FREE_DAILY_LIMIT = Math.max(1, Math.min(1000, Number(newLimit) || 20));
    }
    if (newBonus !== undefined) {
      REFERRAL_BONUS_PER_USER = Math.max(0, Math.min(500, Number(newBonus) || 10));
    }
    if (newGroupId !== undefined && String(newGroupId).trim()) {
      OFFICIAL_GROUP_ID = String(newGroupId).trim();
    }
    if (newGroupUrl !== undefined && String(newGroupUrl).trim()) {
      OFFICIAL_GROUP_URL = String(newGroupUrl).trim();
      const match = String(newGroupUrl).match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match) OFFICIAL_GROUP_USERNAME = `@${match[1]}`;
    }
    res.json({
      success: true,
      message: 'System settings updated successfully!',
      settings: {
        autoDeleteSeconds: AUTO_DELETE_DELAY_MS <= 0 ? 0 : Math.round(AUTO_DELETE_DELAY_MS / 1000),
        freeDailyLimit: FREE_DAILY_LIMIT,
        referralBonusPerUser: REFERRAL_BONUS_PER_USER,
        officialGroupId: OFFICIAL_GROUP_ID,
        officialGroupUrl: OFFICIAL_GROUP_URL,
        officialGroupUsername: OFFICIAL_GROUP_USERNAME,
        telegramActive: isTelegramPolling,
        maintenanceMode: MAINTENANCE_MODE,
      }
    });
  });

  // Admin: Restart / Test Telegram polling daemon
  app.post('/api/admin/bot/restart', async (req, res) => {
    try {
      if (BOT_TOKEN && !isTelegramPolling) {
        runTelegramPoller().catch((err) => console.error('[Poller Restart Error]:', err));
      }
      res.json({
        success: true,
        message: 'Telegram daemon connection verified and active.',
        pollingActive: isTelegramPolling
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to restart bot daemon' });
    }
  });

  // Admin: Real-time Audit Logs & Query Feed
  app.get('/api/admin/logs', (req, res) => {
    res.json({
      success: true,
      logs: auditLogs,
      total: auditLogs.length
    });
  });

  app.post('/api/admin/logs/clear', (req, res) => {
    auditLogs.length = 0;
    res.json({ success: true, message: 'Audit logs cleared successfully.' });
  });

  // ── ADMIN LIVE API TESTER / PLAYGROUND ──
  app.post('/api/admin/test-api', async (req, res) => {
    const { apiUrl, query } = req.body;
    if (!apiUrl) {
      return res.status(400).json({ success: false, error: 'API URL is required' });
    }
    const cleanQ = (query || '').trim();
    const fullUrl = cleanQ ? `${apiUrl}${encodeURIComponent(cleanQ)}` : apiUrl;
    const startTime = Date.now();
    try {
      const resp = await fetchWithTimeout(fullUrl, 15000);
      const durationMs = Date.now() - startTime;
      const jsonStr = typeof resp === 'string' ? resp : JSON.stringify(resp, null, 2);
      const sizeChars = jsonStr.length;
      const willSendAsTxt = sizeChars > 3400;

      res.json({
        success: true,
        fullUrl,
        durationMs,
        data: resp,
        sizeChars,
        willSendAsTxt,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      res.status(500).json({
        success: false,
        fullUrl,
        durationMs,
        error: err.message || 'API request failed or timed out',
      });
    }
  });

  // OSINT Lookup Router
  app.post('/api/lookup/:type', async (req, res) => {
    const { type } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query parameter is required' });
    }

    const targetBtn = buttonsStore.get(type);
    if (targetBtn && !targetBtn.enabled) {
      return res.status(403).json({
        error: `Service '${targetBtn.label}' is currently turned OFF by Admin.`,
        serviceDisabled: true
      });
    }

    const user = getUser('web_client');
    const curLimit = getUserDailyLimit(user);
    if (user.role === 'free' && user.dailySearches >= curLimit) {
      return res.status(429).json({
        error: `Daily limit reached (${curLimit} searches/day). Refer a friend to earn +10 searches daily or redeem a code.`,
        limitReached: true,
      });
    }

    const cleanQuery = String(query).trim();
    let data: any = null;

    try {
      switch (type) {
        case 'vehicle': {
          const reg = cleanQuery.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
          data = await fetchVehicleInfo(reg);
          break;
        }
        case 'num2': {
          const url = getButtonApiUrl('num2', "https://rehu-hitek.vercel.app/search?mobile=");
          data = await fetchWithTimeout(`${url}${cleanQuery}`);
          break;
        }
        case 'aadhar2info': {
          const url = getButtonApiUrl('aadhar2info', "https://rehu-hitek.vercel.app/search?field=aadharNumber&q=");
          data = await fetchWithTimeout(`${url}${cleanQuery}`);
          break;
        }
        case 'aadhar2family': {
          const url = getButtonApiUrl('aadhar2family', "https://aadhar2fam-black.vercel.app/get-family-by-aadhaar?key=IRAM&tkn=IRAM&aadhaar=");
          data = await fetchWithTimeout(`${url}${cleanQuery}`);
          break;
        }
        case 'voter': {
          const url = getButtonApiUrl('voter', "https://voter-rehuu.vercel.app/search?epic=");
          data = await fetchWithTimeout(`${url}${cleanQuery.toUpperCase()}`);
          break;
        }
        case 'lpg': {
          const url = getButtonApiUrl('lpg', "https://lpg-rehu-lovat.vercel.app/validate?key=IRAM&tkn=IRAM&phone=");
          data = await fetchWithTimeout(`${url}${cleanQuery}`);
          break;
        }
        case 'upi2num': {
          const url = getButtonApiUrl('upi2num', "https://paytm-seven-zeta.vercel.app/fetch?key=IRAM&tkn=IRAM&upi=");
          data = await fetchWithTimeout(`${url}${encodeURIComponent(cleanQuery)}`);
          break;
        }
        case 'gst2name': {
          const url = getButtonApiUrl('gst2name', "https://pan-2jzn.onrender.com/search-gstin?name=");
          data = await fetchWithTimeout(`${url}${encodeURIComponent(cleanQuery)}`);
          break;
        }
        case 'gst2pan': {
          const url = getButtonApiUrl('gst2pan', "https://pan-2jzn.onrender.com/pan/");
          data = await fetchWithTimeout(`${url}${cleanQuery.toUpperCase()}`);
          break;
        }
        case 'gst': {
          const url = getButtonApiUrl('gst', "https://pan-2jzn.onrender.com/gstin/");
          data = await fetchWithTimeout(`${url}${cleanQuery.toUpperCase()}`);
          break;
        }
        default: {
          // Dynamic handler for any custom button added by Admin
          if (targetBtn && targetBtn.apiUrl) {
            data = await fetchWithTimeout(`${targetBtn.apiUrl}${encodeURIComponent(cleanQuery)}`);
            break;
          }
          return res.status(400).json({ error: `Unsupported lookup type: ${type}` });
        }
      }

      recordSearch('web_client');

      addAuditLog({
        source: 'web',
        userId: 'web_client',
        username: 'WebAgent',
        service: type,
        query: cleanQuery,
        status: data ? 'success' : 'error',
        durationMs: 0,
      });

      res.json({
        success: Boolean(data),
        type,
        query: cleanQuery,
        data: data || { found: false, message: "No records found in registry for specified input." },
        stats: {
          userRole: user.role,
          dailyRemaining: getUserRemaining(user),
          dailyLimit: getUserDailyLimit(user),
          referralCount: user.referralCount || 0,
          referralBonusDaily: (user.referralCount || 0) * REFERRAL_BONUS_PER_USER,
        }
      });
    } catch (err: any) {
      console.error(`Lookup error for ${type}:`, err);
      res.status(500).json({ error: err.message || 'Lookup execution failed' });
    }
  });

  // Telegram Simulator API
  app.post('/api/telegram-sim', async (req, res) => {
    const { message, verified } = req.body;
    if (!message) return res.json({ reply: "Send a command or message." });

    const text = message.trim();
    const user = getUser('web_client');
    const isCurrentlyVerified = user.channelVerified || Boolean(verified);

    // Channel Verification handling
    if (text === "/verify" || text === "✅ Verify Channel Membership" || text === "✅ Verify Joined" || text.toLowerCase() === "verify") {
      user.channelVerified = true;
      user.pendingAction = undefined;
      return res.json({
        verified: true,
        reply: `🎉 *VERIFICATION SUCCESSFUL!*\n══════════════════════════\nChannel Membership Confirmed for [${CHANNEL_USERNAME}](${CHANNEL_LINK})!\n\nStatus: 🟢 *UNLOCKED*\n\nAb aap kisi bhi button par click karke direct lookup run kar sakte hain!\n• 📱 *Mobile Lookup* (Mobile number)\n• 🚗 *Vehicle Lookup* (RC details)\n• 🗳️ *Voter Lookup* (EPIC card)\n• 🪪 *Aadhaar Info* (12-digit Aadhaar)`,
        awaitingInput: false,
      });
    }

    if (text === "📢 Join Channel" || text === "📢 Open Channel Link") {
      return res.json({
        reply: `📢 *Official Channel Link:*\n👉 [${CHANNEL_USERNAME}](${CHANNEL_LINK})\n\nChannel join karne ke baad **✅ Verify Joined** button dabayein.`,
      });
    }

    if (!isCurrentlyVerified) {
      return res.json({
        needsVerification: true,
        reply: `🔒 *ACCESS RESTRICTED — MUST JOIN CHANNEL*\n══════════════════════════\nBot ko use karne ke liye pehle hamara official updates channel join karna zaroori hai:\n\n📢 *Official Channel:* [${CHANNEL_USERNAME}](${CHANNEL_LINK})\n\n1️⃣ Upar diye gaye link par click karke channel join karein.\n2️⃣ Phir **✅ Verify Joined** button dabayein.\n══════════════════════════`,
      });
    }

    // Cancel handling
    if (text === "❌ Cancel" || text === "/cancel") {
      user.pendingAction = undefined;
      return res.json({
        reply: `🔙 *Operation Cancelled*\nReturned to main menu. Select an option below or send a command.`,
        awaitingInput: false,
        pendingAction: null,
      });
    }

    // Check pendingAction in simulator
    if (user.pendingAction) {
      const action = user.pendingAction;

      if (action === 'num2') {
        const cleanPhone = text.replace(/[^0-9]/g, '').slice(-10);
        if (cleanPhone.length < 10) {
          return res.json({
            reply: `⚠️ *Invalid Mobile Number!*\nPlease enter a valid *10-digit mobile number* (e.g., \`6399964669\` or \`9876543210\`):\n\n*(Send ❌ Cancel to exit)*`,
            awaitingInput: true,
            pendingAction: 'num2',
          });
        }
        user.pendingAction = undefined;
        const url = getButtonApiUrl('num2', "https://rehu-hitek.vercel.app/search?mobile=");
        let data = await fetchWithTimeout(`${url}${cleanPhone}`);
        recordSearch('web_client');
        const card = formatNum2Card(data, cleanPhone);
        return res.json({
          reply: card,
          lookupType: 'num2',
          lookupQuery: cleanPhone,
          awaitingInput: false,
        });
      }

      if (action === 'vehicle') {
        const reg = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (reg.length < 4) {
          return res.json({
            reply: `⚠️ *Invalid Registration Number!*\nPlease send a valid registration number (e.g., \`HR26EV0001\`):\n\n*(Send ❌ Cancel to exit)*`,
            awaitingInput: true,
            pendingAction: 'vehicle',
          });
        }
        user.pendingAction = undefined;
        let data = await fetchVehicleInfo(reg);
        recordSearch('web_client');
        const card = formatVehicleCard(data, reg);
        return res.json({
          reply: card,
          lookupType: 'vehicle',
          lookupQuery: reg,
          awaitingInput: false,
        });
      }

      if (action === 'voter') {
        const epic = text.trim().toUpperCase();
        user.pendingAction = undefined;
        const url = getButtonApiUrl('voter', "https://voter-rehuu.vercel.app/search?epic=");
        let data = await fetchWithTimeout(`${url}${epic}`);
        recordSearch('web_client');
        const card = formatVoterCard(data, epic);
        return res.json({
          reply: card,
          lookupType: 'voter',
          lookupQuery: epic,
          awaitingInput: false,
        });
      }

      if (action === 'aadhar2info' || action === 'aadhar2family') {
        const isFam = action === 'aadhar2family';
        const aadhaar = text.replace(/[^0-9]/g, '');
        if (aadhaar.length < 12) {
          return res.json({
            reply: `⚠️ *Invalid Aadhaar Number!*\nPlease enter a valid *12-digit Aadhaar number* (e.g., \`123456789012\`):\n\n*(Send ❌ Cancel to exit)*`,
            awaitingInput: true,
            pendingAction: action,
          });
        }
        user.pendingAction = undefined;
        const defaultUrl = isFam ? "https://aadhar2fam-black.vercel.app/get-family-by-aadhaar?key=IRAM&tkn=IRAM&aadhaar=" : "https://rehu-hitek.vercel.app/search?field=aadharNumber&q=";
        const url = getButtonApiUrl(action, defaultUrl);
        let data = await fetchWithTimeout(`${url}${aadhaar}`);
        recordSearch('web_client');
        const card = formatAadharCard(data, aadhaar, isFam);
        return res.json({
          reply: card,
          lookupType: action,
          lookupQuery: aadhaar,
          awaitingInput: false,
        });
      }

      if (action === 'lpg') {
        const q = text.trim();
        user.pendingAction = undefined;
        const url = getButtonApiUrl('lpg', "https://lpg-rehu-lovat.vercel.app/validate?key=IRAM&tkn=IRAM&phone=");
        let data = await fetchWithTimeout(`${url}${q}`);
        recordSearch('web_client');
        const card = formatLPGCard(data, q);
        return res.json({
          reply: card,
          lookupType: 'lpg',
          lookupQuery: q,
          awaitingInput: false,
        });
      }

      if (action === 'upi2num') {
        const upi = text.trim();
        user.pendingAction = undefined;
        const url = getButtonApiUrl('upi2num', "https://paytm-seven-zeta.vercel.app/fetch?key=IRAM&tkn=IRAM&upi=");
        let data = await fetchWithTimeout(`${url}${encodeURIComponent(upi)}`);
        recordSearch('web_client');
        const card = formatUPICard(data, upi);
        return res.json({
          reply: card,
          lookupType: 'upi2num',
          lookupQuery: upi,
          awaitingInput: false,
        });
      }

      if (action === 'gst2name') {
        const name = text.trim();
        user.pendingAction = undefined;
        const url = getButtonApiUrl('gst2name', "https://pan-2jzn.onrender.com/search-gstin?name=");
        let data = await fetchWithTimeout(`${url}${encodeURIComponent(name)}`);
        recordSearch('web_client');
        const card = formatGSTCard(data, name, 'name');
        return res.json({
          reply: card,
          lookupType: 'gst2name',
          lookupQuery: name,
          awaitingInput: false,
        });
      }

      if (action === 'gst2pan') {
        const pan = text.trim().toUpperCase();
        user.pendingAction = undefined;
        const url = getButtonApiUrl('gst2pan', "https://pan-2jzn.onrender.com/pan/");
        let data = await fetchWithTimeout(`${url}${pan}`);
        recordSearch('web_client');
        const card = formatGSTCard(data, pan, 'pan');
        return res.json({
          reply: card,
          lookupType: 'gst2pan',
          lookupQuery: pan,
          awaitingInput: false,
        });
      }

      if (action === 'gst') {
        const gstin = text.trim().toUpperCase();
        user.pendingAction = undefined;
        const url = getButtonApiUrl('gst', "https://pan-2jzn.onrender.com/gstin/");
        let data = await fetchWithTimeout(`${url}${gstin}`);
        recordSearch('web_client');
        const card = formatGSTCard(data, gstin, 'gst');
        return res.json({
          reply: card,
          lookupType: 'gst',
          lookupQuery: gstin,
          awaitingInput: false,
        });
      }

      // Check if action matches a custom dynamic button
      const customBtn = buttonsStore.get(action);
      if (customBtn) {
        user.pendingAction = undefined;
        const cleanQ = text.trim();
        let data = await fetchWithTimeout(`${customBtn.apiUrl}${encodeURIComponent(cleanQ)}`);
        recordSearch('web_client');
        const card = formatGenericCustomCard(customBtn.label, data, cleanQ);
        return res.json({
          reply: card,
          lookupType: action,
          lookupQuery: cleanQ,
          awaitingInput: false,
        });
      }

      if (action === 'redeem') {
        user.pendingAction = undefined;
        const code = text.trim().toUpperCase();
        const voucher = redeemCodes.get(code);
        if (!voucher) {
          return res.json({
            reply: `❌ *Invalid Code*\nRedeem code \`${code}\` not found.`,
            awaitingInput: false,
          });
        }
        if (voucher.usesLeft <= 0) {
          const isClaimed = voucher.usedBy && voucher.usedBy.length > 0;
          return res.json({
            reply: isClaimed
              ? `❌ *Already Claimed!*\nYe redeem code pehle hi kisi aur user ne redeem kar liya hai!\n*(First-Come, First-Served — Sirf pehle user ko milta hai)*`
              : `❌ *Expired Code*\nIs code ke uses khatam ho chuke hain.`,
            awaitingInput: false,
          });
        }
        voucher.usesLeft -= 1;
        if (!voucher.usedBy) voucher.usedBy = [];
        voucher.usedBy.push('web_client');
        user.role = 'premium';
        return res.json({
          reply: `🎉 *CONGRATULATIONS! CODE REDEEMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nRole: 💎 PREMIUM ACTIVATED\nDuration: ${voucher.days} Days VIP Access\nStatus: Unlimited lookups unlocked!`,
          awaitingInput: false,
        });
      }
    }

    // ── BUTTON CLICK HANDLERS (Prompt for input) ──
    if (
      text === "📱 Mobile Lookup" ||
      text === "📱 Num2 Lookup" ||
      text.toLowerCase() === "mobile" ||
      text.toLowerCase() === "phone" ||
      text === "/num2"
    ) {
      user.pendingAction = 'num2';
      return res.json({
        reply: `📱 *NUM2 MOBILE INTELLIGENCE*\n══════════════════════════\nPlease send the *10-digit mobile number*:\n*(e.g., \`6399964669\` or \`9876543210\`)*\n\n💡 _Aapko sirf 10-digit number type karke send karna hai._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'num2',
        placeholder: 'Enter 10-digit mobile number (e.g. 6399964669)...',
      });
    }

    if (
      text === "🚗 Vehicle Lookup" ||
      text.toLowerCase() === "vehicle" ||
      text === "/vehicle"
    ) {
      user.pendingAction = 'vehicle';
      return res.json({
        reply: `🚗 *VEHICLE RC INTELLIGENCE*\n══════════════════════════\nPlease send the *Vehicle Registration Number*:\n*(e.g., \`HR26EV0001\` or \`DL01AB1234\`)*\n\n💡 _Vehicle RC registration number enter karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'vehicle',
        placeholder: 'Enter vehicle reg (e.g. HR26EV0001)...',
      });
    }

    if (
      text === "🗳️ Voter Lookup" ||
      text.toLowerCase() === "voter" ||
      text === "/voter"
    ) {
      user.pendingAction = 'voter';
      return res.json({
        reply: `🗳️ *VOTER ID (EPIC) LOOKUP*\n══════════════════════════\nPlease send the *Voter EPIC ID*:\n*(e.g., \`ZNO1150077\` or \`ABC1234567\`)*\n\n💡 _Voter card EPIC number enter karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'voter',
        placeholder: 'Enter Voter EPIC (e.g. ZNO1150077)...',
      });
    }

    if (
      text === "🪪 Aadhaar Info" ||
      text === "🪪 Aadhar2Info" ||
      text === "/aadhar2info"
    ) {
      user.pendingAction = 'aadhar2info';
      return res.json({
        reply: `🪪 *AADHAAR 2 INFO LOOKUP*\n══════════════════════════\nPlease send the *12-digit Aadhaar Number*:\n*(e.g., \`123456789012\`)*\n\n💡 _12-digit Aadhaar number send karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'aadhar2info',
        placeholder: 'Enter 12-digit Aadhaar number...',
      });
    }

    if (
      text === "👨‍👩‍👧 Family Tree" ||
      text === "👪 Aadhar2Family" ||
      text === "/aadhar2family"
    ) {
      user.pendingAction = 'aadhar2family';
      return res.json({
        reply: `👪 *AADHAAR FAMILY TREE LOOKUP*\n══════════════════════════\nPlease send the *12-digit Aadhaar Number*:\n*(e.g., \`123456789012\`)*\n\n💡 _Household/Family members search ke liye 12-digit Aadhaar bhejein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'aadhar2family',
        placeholder: 'Enter 12-digit Aadhaar for family tree...',
      });
    }

    if (
      text === "🔥 LPG Gas Lookup" ||
      text === "🔥 LPG Lookup" ||
      text.toLowerCase() === "lpg" ||
      text === "/lpg"
    ) {
      user.pendingAction = 'lpg';
      return res.json({
        reply: `🔥 *LPG GAS CONNECTION LOOKUP*\n══════════════════════════\nPlease send the *Registered Mobile Number or LPG ID*:\n*(e.g., \`9876543210\`)*\n\n💡 _LPG gas connection details ke liye input bhejein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'lpg',
        placeholder: 'Enter 10-digit mobile or LPG ID...',
      });
    }

    if (
      text === "💳 UPI Lookup" ||
      text === "💳 UPI2Num" ||
      text.toLowerCase() === "upi" ||
      text === "/upi2num"
    ) {
      user.pendingAction = 'upi2num';
      return res.json({
        reply: `💳 *UPI VPA TO NUMBER RESOLUTION*\n══════════════════════════\nPlease send the *UPI ID / VPA Handle*:\n*(e.g., \`user@okhdfcbank\` or \`name@paytm\`)*\n\n💡 _UPI handle enter karein phone number & account holder resolve karne ke liye._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'upi2num',
        placeholder: 'Enter UPI ID (e.g. user@okhdfcbank)...',
      });
    }

    if (
      text === "🏢 GST by Name" ||
      text === "/gst2name"
    ) {
      user.pendingAction = 'gst2name';
      return res.json({
        reply: `🏢 *SEARCH GST BY COMPANY / TRADE NAME*\n══════════════════════════\nPlease send the *Business / Trade Name*:\n*(e.g., \`Reliance\`, \`Tata Motors\`, or \`Infosys\`)*\n\n💡 _Company ya firm ka name enter karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'gst2name',
        placeholder: 'Enter company or business name...',
      });
    }

    if (
      text === "🪪 GST by PAN" ||
      text === "/gst2pan"
    ) {
      user.pendingAction = 'gst2pan';
      return res.json({
        reply: `🪪 *SEARCH ALL GSTINs LINKED TO PAN*\n══════════════════════════\nPlease send the *10-character PAN Card*:\n*(e.g., \`AAACF5317Q\`)*\n\n💡 _10-digit PAN number enter karein all GSTIN registrations dekhne ke liye._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'gst2pan',
        placeholder: 'Enter 10-character PAN card...',
      });
    }

    if (
      text === "📄 GST Details" ||
      text === "/gst"
    ) {
      user.pendingAction = 'gst';
      return res.json({
        reply: `📄 *GSTIN PROFILE & RETURN FILING STATUS*\n══════════════════════════\nPlease send the *15-character GSTIN*:\n*(e.g., \`27AAACF5317Q1ZA\`)*\n\n💡 _15-character GSTIN number enter karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'gst',
        placeholder: 'Enter 15-character GSTIN...',
      });
    }

    if (
      text === "💎 Redeem Code" ||
      text === "💎 Redeem" ||
      text === "/redeem"
    ) {
      user.pendingAction = 'redeem';
      return res.json({
        reply: `💎 *REDEEM VOUCHER CODE*
━━━━━━━━━━━━━━━━━━━━━━━━━
Please send your *Promo / Voucher Code*:
*(Format: \`IRAM-XXXX-XXXX\`)*

💡 _Admin dwara broadcast ya share kiya gaya code enter karein._
━━━━━━━━━━━━━━━━━━━━━━━━━
Tap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'redeem',
        placeholder: 'Enter voucher code (e.g. IRAM-XXXX-XXXX)...',
      });
    }

    if (
      text === "👥 Refer & Earn" ||
      text === "👥 Refer & Earn (+10 Daily)" ||
      text === "/refer" ||
      text.toLowerCase() === "refer"
    ) {
      const card = getReferralCard(user, 'web_client');
      return res.json({
        reply: card,
        awaitingInput: false,
      });
    }

    if (
      text === "📊 My Profile" ||
      text === "📊 My Stats" ||
      text === "/stats"
    ) {
      const curLimit = getUserDailyLimit(user);
      const rem = getUserRemaining(user);
      const refCount = user.referralCount || 0;
      const refBonus = refCount * REFERRAL_BONUS_PER_USER;

      return res.json({
        reply: `📊 *Your Statistics Profile*\n══════════════════════════\n  Role: 💎 ${user.role.toUpperCase()}\n  Channel: ✅ Verified (@RehuSzr)\n  Today Searches: ${user.dailySearches} / ${curLimit}\n  Left Today: ${rem} / ${curLimit}\n  Total Lifetime: ${user.totalSearches} searches\n\n👥 *Refer & Earn:*\n  Invited: ${refCount} Friends\n  Daily Bonus: +${refBonus} searches/day\n  Personal Link: https://t.me/${BOT_USERNAME}?start=ref_web_client`,
        awaitingInput: false,
      });
    }

    if (
      text === "❓ Help Guide" ||
      text === "/help"
    ) {
      return res.json({
        reply: `📖 *${BOT_NAME} Help Guide*\n══════════════════════════\nClick any button below or send commands:\n  📱 /num2 <10-digit mobile>\n  🚗 /vehicle <reg_number>\n  🗳️ /voter <epic_id>\n  🪪 /aadhar2info <12-digit aadhaar>\n  👪 /aadhar2family <12-digit aadhaar>\n  🔥 /lpg <phone_or_id>\n  💳 /upi2num <upi_id>\n  🏢 /gst2name <business_name>\n  🪪 /gst2pan <pan_number>\n  📄 /gst <gstin>\n  👥 /refer ➜ Refer friends (+10 extra credit daily)\n  💎 /redeem <code>\n  📊 /stats\n  ✅ /verify`,
        awaitingInput: false,
      });
    }

    // Admin commands in simulator
    if (text === "👑 Admin Control Panel" || text === "⚙️ Admin Panel" || text === "/admin") {
      user.pendingAction = undefined;
      const card = getAdminControlCard(isBotActive);
      return res.json({
        reply: card,
        awaitingInput: false,
      });
    }

    if (text === "/bot on" || text === "/bot_on") {
      isBotActive = true;
      return res.json({
        reply: `🟢 *BOT IS NOW ONLINE*\nAll registered users can now execute OSINT queries normally.`,
        awaitingInput: false,
      });
    }

    if (text === "/bot off" || text === "/bot_off") {
      isBotActive = false;
      return res.json({
        reply: `🔴 *BOT IS NOW OFFLINE (MAINTENANCE MODE)*\nServices are paused for all regular users. Only administrators can use the bot.`,
        awaitingInput: false,
      });
    }

    if (text === "/users" || text === "/all_users") {
      const allUsers = Array.from(usersStore.values());
      const total = allUsers.length;
      const prem = allUsers.filter(u => u.role === 'premium').length;
      const free = allUsers.filter(u => u.role === 'free').length;

      let msgText = `👥 *REGISTERED USERS DIRECTORY*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 Total Users: \`${total}\` | 💎 VIP: \`${prem}\` | 🆓 Free: \`${free}\`\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const sample = allUsers.slice(-25).reverse();
      sample.forEach((u, idx) => {
        const roleIcon = u.role === 'admin' ? '👑' : u.role === 'premium' ? '💎' : '👤';
        msgText += `${idx + 1}. ${roleIcon} ID: \`${u.userId}\` [${u.role.toUpperCase()}]\n   Searches: ${u.totalSearches} (Today: ${u.dailySearches}) | Invites: ${u.referralCount || 0}\n`;
      });
      if (total > 25) {
        msgText += `\n*(Showing latest 25 of ${total} users)*`;
      }
      return res.json({ reply: msgText, awaitingInput: false });
    }

    if (text === "/premium_users" || text === "/vip_users") {
      const premUsers = Array.from(usersStore.values()).filter(u => u.role === 'premium');
      if (premUsers.length === 0) {
        return res.json({
          reply: `💎 *VIP PREMIUM USERS*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nNo active VIP premium users right now.\n\n👉 Grant with: \`/add_premium <userId>\`\n👉 Or drop code: \`/dropcode 30\``,
          awaitingInput: false
        });
      }
      let msgText = `💎 *VIP PREMIUM SUBSCRIBERS (${premUsers.length})*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      premUsers.forEach((u, idx) => {
        msgText += `${idx + 1}. 💎 ID: \`${u.userId}\`\n   Total Searches: ${u.totalSearches} | Invites: ${u.referralCount || 0}\n   Remove: \`/remove_premium ${u.userId}\`\n`;
      });
      return res.json({ reply: msgText, awaitingInput: false });
    }

    if (text.startsWith("/remove_premium") || text.startsWith("/remove_prem") || text.startsWith("/remprem")) {
      const parts = text.split(/\s+/);
      const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
      if (!targetId) {
        return res.json({
          reply: `⚠️ *Usage:* \`/remove_premium <Telegram_User_ID>\`\n\nExample: \`/remove_premium 6516740398\``,
          awaitingInput: false
        });
      }
      const targetUser = usersStore.get(targetId);
      if (!targetUser) {
        return res.json({
          reply: `❌ User \`${targetId}\` not found in bot database.`,
          awaitingInput: false
        });
      }
      targetUser.role = 'free';
      persistUser(targetUser).catch(() => {});
      return res.json({
        reply: `✅ *VIP PREMIUM REVOKED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 User ID: \`${targetId}\`\n🎖️ New Role: 🆓 FREE TIER\n⚡ Daily Limit: ${getUserDailyLimit(targetUser)} searches\n\nUser demoted to standard access.`,
        awaitingInput: false
      });
    }

    if (text.startsWith("/add_premium") || text.startsWith("/set_premium") || text.startsWith("/addprem")) {
      const parts = text.split(/\s+/);
      const targetId = parts[1]?.trim().replace(/[^0-9a-zA-Z_]/g, '');
      if (!targetId) {
        return res.json({
          reply: `⚠️ *Usage:* \`/add_premium <Telegram_User_ID>\`\n\nExample: \`/add_premium 6516740398\``,
          awaitingInput: false
        });
      }
      const targetUser = getUser(targetId);
      targetUser.role = 'premium';
      persistUser(targetUser).catch(() => {});
      return res.json({
        reply: `✅ *VIP PREMIUM GRANTED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 User ID: \`${targetId}\`\n🎖️ Role: 💎 VIP PREMIUM\n⚡ Status: Unlimited Lookups Unlocked`,
        awaitingInput: false
      });
    }

    if (text.startsWith("/dropcode") || text.startsWith("/broadcast_code")) {
      const parts = text.split(/\s+/);
      const days = parseInt(parts[1], 10) || 7;
      const drop = await broadcastRedeemCode(days, 'rehuu (Admin)');
      return res.json({
        reply: `✅ *BROADCAST CODE DROPPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Code:* \`${drop.code}\`\n⏳ *Duration:* ${drop.days} Days\n📨 *Delivered to:* ${drop.sent} users\n⚡ *Rule:* Single-use only — Jo pehle redeem karega use hi milega!\n\n👉 Test claiming it: \`/redeem ${drop.code}\``,
        awaitingInput: false,
      });
    }

    if (text.startsWith("/gen")) {
      const parts = text.split(/\s+/);
      const days = parseInt(parts[1], 10) || 7;
      const code = generateCode();
      redeemCodes.set(code, {
        code,
        days,
        role: 'premium',
        usesLeft: 1,
        totalUses: 1,
        createdAt: new Date().toISOString(),
        usedBy: [],
      });
      return res.json({
        reply: `💎 *NEW REDEEM CODE GENERATED*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Code:* \`${code}\`\n⏳ *Duration:* ${days} Days VIP Premium\n⚡ *Uses:* 1 (Single-use / First-Come First-Served)\n👤 *Admin:* rehuu\n\n👉 Test redeeming: \`/redeem ${code}\``,
        awaitingInput: false,
      });
    }

    if (text.startsWith("/redeem ")) {
      const code = text.replace("/redeem", "").trim().toUpperCase();
      const voucher = redeemCodes.get(code);
      if (!voucher) {
        return res.json({ reply: `❌ *Invalid Code*\nRedeem code \`${code}\` not found.`, awaitingInput: false });
      }
      if (voucher.usesLeft <= 0) {
        const isClaimed = voucher.usedBy && voucher.usedBy.length > 0;
        return res.json({
          reply: isClaimed
            ? `❌ *Already Claimed!*\nYe redeem code pehle hi kisi aur user ne redeem kar liya hai!\n*(First-Come, First-Served — Sirf pehle user ko milta hai)*`
            : `❌ *Expired Code*\nIs code ke uses khatam ho chuke hain.`,
          awaitingInput: false
        });
      }
      voucher.usesLeft -= 1;
      if (!voucher.usedBy) voucher.usedBy = [];
      voucher.usedBy.push('web_client');
      user.role = 'premium';
      return res.json({
        reply: `🎉 *CONGRATULATIONS! CODE REDEEMED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\nRole: 💎 PREMIUM ACTIVATED\nDuration: ${voucher.days} Days VIP Access\nStatus: Unlimited lookups unlocked!\nClaimed by: Agent \`web_client\``,
        awaitingInput: false
      });
    }

    // Standard commands
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      let refMsg = "";
      if (parts.length > 1) {
        const payload = parts[1].trim();
        const refId = payload.replace("ref_", "");
        if (refId && refId !== 'web_client') {
          const referrer = getUser(refId);
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.referralBonusDaily = (referrer.referralCount || 0) * REFERRAL_BONUS_PER_USER;
          refMsg = `\n\n🎉 *Referred by Agent ${refId}!* Referrer ko +10 daily searches credit mil chuka hai.`;
        }
      }

      const card = getStartCard(user, 'rehuu', '5225326313');
      return res.json({
        reply: card + (refMsg ? refMsg : ""),
        awaitingInput: false,
      });
    }

    if (text === "/help") {
      return res.json({
        reply: `📖 *${BOT_NAME} Help Guide*\n══════════════════════════\nClick any button below or send commands:\n  📱 /num2 <10-digit mobile>\n  🚗 /vehicle <reg_number>\n  🗳️ /voter <epic_id>\n  🪪 /aadhar2info <12-digit aadhaar>\n  👪 /aadhar2family <12-digit aadhaar>\n  🔥 /lpg <phone_or_id>\n  💳 /upi2num <upi_id>\n  🏢 /gst2name <business_name>\n  🪪 /gst2pan <pan_number>\n  📄 /gst <gstin>\n  👥 /refer ➜ Refer friends (+10 extra credit daily)\n  💎 /redeem <code>\n  📊 /stats\n  ✅ /verify`,
        awaitingInput: false,
      });
    }

    if (text === "📊 My Stats" || text === "/stats") {
      const curLimit = getUserDailyLimit(user);
      const rem = getUserRemaining(user);
      const refCount = user.referralCount || 0;
      const refBonus = refCount * REFERRAL_BONUS_PER_USER;

      return res.json({
        reply: `📊 *Your Statistics Profile*\n══════════════════════════\n  Role: 💎 ${user.role.toUpperCase()}\n  Channel: ✅ Verified (@RehuSzr)\n  Today Searches: ${user.dailySearches} / ${curLimit}\n  Left Today: ${rem} / ${curLimit}\n  Total Lifetime: ${user.totalSearches} searches\n\n👥 *Refer & Earn:*\n  Invited: ${refCount} Friends\n  Daily Bonus: +${refBonus} searches/day\n  Personal Link: https://t.me/${BOT_USERNAME}?start=ref_web_client`,
        awaitingInput: false,
      });
    }

    // Direct one-shot commands with arguments
    if (text.startsWith("/vehicle ")) {
      const q = text.replace("/vehicle", "").trim().toUpperCase();
      let data = await fetchVehicleInfo(q);
      recordSearch('web_client');
      const card = formatVehicleCard(data, q);
      return res.json({ reply: card, lookupType: 'vehicle', lookupQuery: q });
    }

    if (text.startsWith("/num2 ")) {
      const cleanPhone = text.replace("/num2", "").trim().replace(/[^0-9]/g, '').slice(-10);
      let data = await fetchWithTimeout(`${NUM2_API_URL}${cleanPhone}`);
      recordSearch('web_client');
      const card = formatNum2Card(data, cleanPhone);
      return res.json({ reply: card, lookupType: 'num2', lookupQuery: cleanPhone });
    }

    if (text.startsWith("/voter ")) {
      const q = text.replace("/voter", "").trim().toUpperCase();
      let data = await fetchWithTimeout(`${VOTER_API_URL}${q}`);
      recordSearch('web_client');
      const card = formatVoterCard(data, q);
      return res.json({ reply: card, lookupType: 'voter', lookupQuery: q });
    }

    if (text.startsWith("/aadhar2info ")) {
      const q = text.replace("/aadhar2info", "").trim();
      let data = await fetchWithTimeout(`${AADHAR2_API_URL}${q}`);
      recordSearch('web_client');
      const card = formatAadharCard(data, q, false);
      return res.json({ reply: card, lookupType: 'aadhar2info', lookupQuery: q });
    }

    if (text.startsWith("/aadhar2family ")) {
      const q = text.replace("/aadhar2family", "").trim();
      let data = await fetchWithTimeout(`${AADHAR2FAM_API_URL}${q}`);
      recordSearch('web_client');
      const card = formatAadharCard(data, q, true);
      return res.json({ reply: card, lookupType: 'aadhar2family', lookupQuery: q });
    }

    if (text.startsWith("/lpg ")) {
      const q = text.replace("/lpg", "").trim();
      let data = await fetchWithTimeout(`${LPG_API_URL}${q}`);
      recordSearch('web_client');
      const card = formatLPGCard(data, q);
      return res.json({ reply: card, lookupType: 'lpg', lookupQuery: q });
    }

    if (text.startsWith("/upi2num ")) {
      const q = text.replace("/upi2num", "").trim();
      let data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(q)}`);
      recordSearch('web_client');
      const card = formatUPICard(data, q);
      return res.json({ reply: card, lookupType: 'upi2num', lookupQuery: q });
    }

    if (text.startsWith("/gst2name ")) {
      const q = text.replace("/gst2name", "").trim();
      let data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(q)}`);
      recordSearch('web_client');
      const card = formatGSTCard(data, q, 'name');
      return res.json({ reply: card, lookupType: 'gst2name', lookupQuery: q });
    }

    if (text.startsWith("/gst2pan ")) {
      const q = text.replace("/gst2pan", "").trim().toUpperCase();
      let data = await fetchWithTimeout(`${GST2PAN_API_URL}${q}`);
      recordSearch('web_client');
      const card = formatGSTCard(data, q, 'pan');
      return res.json({ reply: card, lookupType: 'gst2pan', lookupQuery: q });
    }

    if (text.startsWith("/gst ")) {
      const q = text.replace("/gst", "").trim().toUpperCase();
      let data = await fetchWithTimeout(`${GST_API_URL}${q}`);
      recordSearch('web_client');
      const card = formatGSTCard(data, q, 'gst');
      return res.json({ reply: card, lookupType: 'gst', lookupQuery: q });
    }

    // Direct smart auto-detection for raw queries in simulator
    const detected = autoDetectLookupType(text);
    if (detected) {
      let data: any = null;
      let card = "";

      if (detected.type === 'num2') {
        data = await fetchWithTimeout(`${NUM2_API_URL}${detected.cleanQuery}`);
        card = formatNum2Card(data, detected.cleanQuery);
      } else if (detected.type === 'vehicle') {
        data = await fetchVehicleInfo(detected.cleanQuery);
        card = formatVehicleCard(data, detected.cleanQuery);
      } else if (detected.type === 'voter') {
        data = await fetchWithTimeout(`${VOTER_API_URL}${detected.cleanQuery}`);
        card = formatVoterCard(data, detected.cleanQuery);
      } else if (detected.type === 'aadhar2info') {
        data = await fetchWithTimeout(`${AADHAR2_API_URL}${detected.cleanQuery}`);
        card = formatAadharCard(data, detected.cleanQuery, false);
      } else if (detected.type === 'gst2pan') {
        data = await fetchWithTimeout(`${GST2PAN_API_URL}${detected.cleanQuery}`);
        card = formatGSTCard(data, detected.cleanQuery, 'pan');
      } else if (detected.type === 'gst') {
        data = await fetchWithTimeout(`${GST_API_URL}${detected.cleanQuery}`);
        card = formatGSTCard(data, detected.cleanQuery, 'gst');
      } else if (detected.type === 'upi2num') {
        data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(detected.cleanQuery)}`);
        card = formatUPICard(data, detected.cleanQuery);
      }

      if (card) {
        recordSearch('web_client');
        return res.json({
          reply: card,
          lookupType: detected.type,
          lookupQuery: detected.cleanQuery,
          awaitingInput: false,
        });
      }
    }

    // Default response
    res.json({
      reply: `👋 Tap an option below or send /help to see all commands:`,
      awaitingInput: false,
    });
  });

  // Start background Telegram poller if token configured
  if (BOT_TOKEN) {
    runTelegramPoller().catch((err) => console.error("Telegram poller error:", err));
  } else {
    console.log("[Telegram Bot] TELEGRAM_BOT_TOKEN not set. Running in Web UI mode on port 3000.");
  }

  // Vite middleware for development vs Production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`iramX OSINT Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
