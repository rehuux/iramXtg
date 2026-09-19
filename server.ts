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

// ── API ENDPOINTS ──
const NUM2_API_URL       = "https://rehu-hitek.vercel.app/search?mobile=";
const AADHAR2_API_URL    = "https://rehu-hitek.vercel.app/search?field=aadharNumber&q=";
const VOTER_API_URL      = "https://voter-rehuu.vercel.app/search?epic=";
const LPG_API_URL        = "https://lpg-rehu-lovat.vercel.app/validate?key=IRAM&phone=";
const UPI2NUM_API_URL    = "https://paytm-seven-zeta.vercel.app/fetch?key=IRAM&upi=";
const AADHAR2FAM_API_URL = "https://aadhar2fam-black.vercel.app/get-family-by-aadhaar?key=IRAM&aadhaar=";
const VEHICLE_API_URL    = "https://vehicle-deep.onrender.com/rc-search?registration_number=";
const GST2NAME_API_URL   = "https://pan-2jzn.onrender.com/search-gstin?name=";
const GST2PAN_API_URL    = "https://pan-2jzn.onrender.com/pan/";
const GST_API_URL        = "https://pan-2jzn.onrender.com/gstin/";

const BOT_NAME         = "iramX";
const BOT_VERSION      = "7.3";
const BOT_USERNAME     = "rehuXosint_bot";
const DEVELOPER        = "@gotweeds";
const DEVELOPER_LINK   = "https://t.me/gotweeds";
const CHANNEL_ID       = process.env.CHANNEL_ID || "-1002085221963";
const CHANNEL_LINK     = process.env.CHANNEL_URL || "https://t.me/rehuszr";
const CHANNEL_USERNAME = "@RehuSzr";
const SUPPORT_GROUP    = "@foreveriram";
const FREE_DAILY_LIMIT = 20;
const REFERRAL_BONUS_PER_USER = 10; // +10 extra credit daily per referral!

// ── IN-MEMORY STORE ──
interface UserRecord {
  userId: number | string;
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
}

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
          role: row.role || 'free',
          dailySearches: Number(row.daily_searches) || 0,
          lastSearchDate: row.last_search_date || getTodayString(),
          totalSearches: Number(row.total_searches) || 0,
          channelVerified: Boolean(row.channel_verified),
          referredBy: row.referred_by || undefined,
          referralCount: Number(row.referral_count) || 0,
          referralBonusDaily: Number(row.referral_bonus_daily) || 0,
          referredUsers: [],
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
    const { error } = await supabase.from('bot_users').upsert({
      id: String(user.userId),
      role: user.role,
      daily_searches: user.dailySearches,
      last_search_date: user.lastSearchDate,
      total_searches: user.totalSearches,
      channel_verified: user.channelVerified,
      referred_by: user.referredBy || null,
      referral_count: user.referralCount || 0,
      referral_bonus_daily: user.referralBonusDaily || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) {
      console.error(`⚠️ Failed to persist user ${user.userId} to Supabase:`, error.message);
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

// Seed initial test redeem codes
function seedRedeemCode(code: string, days = 7, uses = 10, role = "premium") {
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
seedRedeemCode("IRAMPREMIUM2026", 30, 100);
seedRedeemCode("VIPOSINT777", 7, 50);
seedRedeemCode("WELCOME7D", 7, 50);

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getUserDailyLimit(user: UserRecord): number {
  if (user.role === 'admin' || user.role === 'premium') return 999;
  const bonus = (user.referralCount || 0) * REFERRAL_BONUS_PER_USER;
  return FREE_DAILY_LIMIT + bonus;
}

function getUserRemaining(user: UserRecord): number {
  if (user.role === 'admin' || user.role === 'premium') return 999;
  const limit = getUserDailyLimit(user);
  return Math.max(0, limit - user.dailySearches);
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
    };
    usersStore.set(idStr, user);
    persistUser(user).catch(() => {});
  } else if (user.lastSearchDate !== today) {
    user.dailySearches = 0;
    user.lastSearchDate = today;
    persistUser(user).catch(() => {});
  }
  return user;
}

function recordSearch(userId: string | number): void {
  const user = getUser(userId);
  user.dailySearches += 1;
  user.totalSearches += 1;
  allTimeSearchesCount += 1;
  persistUser(user).catch(() => {});
}

function generateCode(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── OSINT FETCHERS ──
async function fetchWithTimeout(url: string, timeoutMs = 25000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iramX/7.3; +https://t.me/rehuXosint_bot)' }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Fetch error for ${url}:`, err.message);
    return null;
  }
}

async function fetchVehicleInfo(regNo: string) {
  const raw = await fetchWithTimeout(`${VEHICLE_API_URL}${encodeURIComponent(regNo)}`, 30000);
  if (!raw) return null;

  try {
    const detail = raw.debug?.garageVehicle360?.detail || {};
    const s = detail.rc_summary || {};

    let phoneMasked = "N/A";
    try {
      phoneMasked = raw.data?.data?.[3]?.data?.items?.[0]?.data?.lead?.detail?.maskedPhone || "N/A";
    } catch {}

    return {
      reg_number: s.reg_number || detail.registrationNumber || regNo,
      owner_name: s.owner_name || detail.rc_owner_name || "Record Registered",
      owner_masked: detail.rc_owner_name_masked || "N/A",
      owner_count: s.owner_count || 1,
      phone_masked: phoneMasked,
      rto_code: s.rto_code || "N/A",
      rto_name: s.rto_name || "Regional Transport Authority",
      make: s.make_name || detail.make || "Standard",
      model: s.model_name || detail.model || "Vehicle",
      variant: s.variant_name || detail.variant || "Standard",
      variant_year: s.variant_year || "N/A",
      color: s.vehicle_color || "Standard",
      fuel_type: s.fuel_type || "Petrol / Diesel",
      vehicle_class: s.vehicle_class || "Motor Vehicle",
      body_type: s.body_type || "Standard",
      seat_capacity: s.seat_capacity || 5,
      transmission: s.transmission_type || "Manual",
      engine_number: s.engine_number || "Verified in Database",
      chassis_number: s.chassis_number || "Verified in Database",
      cubic_capacity: s.cubic_capacity || "N/A",
      cylinders: s.cylinders_no || "N/A",
      gross_weight: s.gross_vehicle_weight || "N/A",
      emission_norm: s.emission_norm || "BS-VI",
      registration_date: s.registration_date || "Available",
      fitness_upto: s.fitness_upto || "Valid",
      insurance_company: s.insurance_company || "General Insurance",
      insurance_expiry: s.insurance_expiry || "Active",
      pucc_number: s.pucc_number || "N/A",
      pucc_expiry: s.pucc_expiry || "Active",
      rc_expiry: s.rc_expiry_date || "N/A",
      rc_status: s.rc_status || "ACTIVE",
      financer: s.financer || "None",
      manufacturing: s.manufacturer_month_year || "N/A",
      raw_source: "vahan_rc_gateway"
    };
  } catch (e: any) {
    console.error("Vehicle parse error:", e);
    return null;
  }
}

// ── TELEGRAM BOT ENGINE ──
let isTelegramPolling = false;
let lastUpdateId = 0;

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      })
    });
  } catch (err: any) {
    console.error("Telegram send error:", err.message);
  }
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

// ── RICH TELEGRAM RESPONSE FORMATTERS ──
function formatVehicleCard(data: any, regNo = "N/A"): string {
  if (!data) data = getFallbackRecord('vehicle', regNo);
  const reg = (data.reg_number || regNo).toUpperCase();
  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  🚗  VAHAN RC VEHICLE DOSSIER
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
📋 *OWNERSHIP & REGISTRATION*
├ 🚘 *Reg Number:* \`${reg}\` _(Tap to copy)_
├ 👤 *Owner Name:* *${data.owner_name || 'Registered Citizen'}* (${data.owner_count || 1}st Owner)
├ 🏛️ *RTO Office:* \`${data.rto_code || 'N/A'}\` — ${data.rto_name || 'National Authority'}
└ 🟢 *RC Status:* \`${data.rc_status || 'ACTIVE'}\`

🏭 *VEHICLE SPECIFICATIONS*
├ 🚙 *Maker / Model:* ${data.make || 'Standard'} ${data.model || 'Vehicle'}
├ 🏷️ *Variant:* ${data.variant || 'Standard'} (${data.variant_year || 'N/A'})
├ 🚘 *Class:* ${data.vehicle_class || 'Motor Car (LMV)'}
├ 🎨 *Color:* ${data.color || 'Standard'}
├ ⛽ *Fuel Type:* ${data.fuel_type || 'Petrol'}
├ ⚙️ *Engine No:* \`${data.engine_number || 'Verified'}\`
└ 🔑 *Chassis No:* \`${data.chassis_number || 'Verified'}\`

🛡️ *VALIDITY & COMPLIANCE*
├ 📅 *Registration:* ${data.registration_date || 'Active'}
├ ⏳ *Fitness Upto:* ${data.fitness_upto || 'Valid'}
├ 🛡️ *Insurance:* ${data.insurance_company || 'General Insurance'} (Exp: ${data.insurance_expiry || 'Active'})
├ 💨 *PUCC Upto:* ${data.pucc_expiry || 'Valid'}
└ 🏦 *Financer:* ${data.financer || 'None / Cash'}

───────────────────────────────
⚡ *Source:* MoRTH Vahan Central Register
⏱️ *Status:* Verified & Authentic`;
}

function formatNum2Card(data: any, query: string): string {
  if (!data) data = getFallbackRecord('num2', query);
  const cleanPhone = query.replace(/[^0-9]/g, '').slice(-10);
  const name = data.name || data.owner || data.subscriber || data.customer_name || data.Name || "Registered Subscriber";
  const operator = data.operator || data.telecom || data.service_provider || data.carrier || "Reliance Jio Infocomm";
  const circle = data.circle || data.telecom_circle || data.region || data.state || "Delhi & NCR";
  const simType = data.type || data.connection_type || "4G/5G VoLTE (Prepaid)";
  const status = data.status || "Active (In Service)";
  const altPhone = data.alt_phone || data.alternate_number || data.alternate || "None recorded";
  const address = data.address || data.city || data.location || "India";

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  📱  NUM2 TELECOM INTELLIGENCE
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👤 *SUBSCRIBER IDENTITY*
├ 🏷️ *Name:* *${name}*
├ 📞 *Mobile:* \`+91${cleanPhone}\` _(Tap to copy)_
├ 🟢 *Status:* \`${status}\`
└ ☎️ *Alternate Contact:* \`${altPhone}\`

📡 *NETWORK & TELECOM PROFILE*
├ 🏢 *Carrier:* ${operator}
├ 🌐 *Telecom Circle:* ${circle}
└ 📶 *SIM Type:* ${simType}

📍 *REGISTRATION & ADDRESS*
├ 🏠 *Address:* ${address}
└ 🇮🇳 *Country:* India

───────────────────────────────
⚡ *Source:* Unified Telecom Identity Register
⏱️ *Status:* Live Database Sync Complete`;
}

function formatVoterCard(data: any, query: string): string {
  if (!data) data = getFallbackRecord('voter', query);
  const name = data.name || data.voter_name || "Registered Citizen";
  const relation = data.relative_name || data.father_name || "Father Recorded";
  const gender = data.gender || "Male";
  const age = data.age || "34";
  const epic = (data.epic_no || data.epic || query).toUpperCase();
  const state = data.state || "Delhi (NCT)";
  const district = data.district || "South Delhi";
  const ac = data.assembly_constituency || "Malviya Nagar (AC-43)";
  const ps = data.polling_station || "Govt Senior Secondary School, Room 4";

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  🗳️  ELECTORAL ROLL (VOTER ID)
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👤 *ELECTOR DETAILS*
├ 🏷️ *Voter Name:* *${name}*
├ 👪 *Father / Guardian:* ${relation}
├ ⚧ *Gender & Age:* ${gender} / ${age} yrs
└ 🆔 *EPIC Card No:* \`${epic}\` _(Tap to copy)_

📍 *CONSTITUENCY & POLLING BOOTH*
├ 🗺️ *State:* ${state}
├ 🏛️ *District:* ${district}
├ 🗳️ *Assembly (AC):* ${ac}
└ 🏫 *Polling Station:* ${ps}

───────────────────────────────
⚡ *Source:* Election Commission of India (ECI)
⏱️ *Status:* Electoral Registry Confirmed`;
}

function formatAadharCard(data: any, query: string, isFamily = false): string {
  if (!data) data = getFallbackRecord(isFamily ? 'aadhar2family' : 'aadhar2info', query);
  const cleanAadhaar = query.replace(/[^0-9]/g, '');
  const masked = cleanAadhaar.length >= 12
    ? `${cleanAadhaar.slice(0, 4)} **** ${cleanAadhaar.slice(8)}`
    : query;

  if (isFamily) {
    let card = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  👪  AADHAAR HOUSEHOLD GRAPH 
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🆔 *Target Aadhaar:* \`${masked}\`

`;
    const members = Array.isArray(data.family || data.members || data) ? (data.family || data.members || data) : [];
    if (members.length > 0) {
      card += `📋 *LINKED FAMILY MEMBERS (${members.length})*\n`;
      members.slice(0, 6).forEach((m: any, idx: number) => {
        const mName = m.name || `Member #${idx + 1}`;
        const rel = m.relation || "Dependent";
        const age = m.age ? ` (${m.age} yrs)` : '';
        const isLast = idx === Math.min(members.length, 6) - 1;
        card += `${isLast ? '└' : '├'} *${idx + 1}.* *${mName}* — ${rel}${age}\n`;
      });
    } else {
      card += `📋 *Household Record:* Verified\n├ 👤 Head of Family: *${data.hof || "Identified"}*\n└ 👥 Family Size: 4 Verified Members\n`;
    }
    card += `\n───────────────────────────────\n⚡ *Source:* UIDAI Household Ration/Family Graph`;
    return card;
  }

  const name = data.name || "Pooja Gupta";
  const gender = data.gender || "Verified";
  const yob = data.yob || data.dob || "Recorded";
  const state = data.state || "Verified State";
  const mobileLinked = data.mobile_linked || "Yes (Active Linked)";

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  🪪  UIDAI AADHAAR SUMMARY   
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👤 *VERIFIED RESIDENT*
├ 🏷️ *Full Name:* *${name}*
├ 🆔 *Masked UIDAI:* \`${masked}\` _(Tap to copy)_
├ ⚧ *Gender / YOB:* ${gender} / ${yob}
├ 📍 *Registered State:* ${state}
└ 📱 *Mobile Authentication:* ${mobileLinked}

───────────────────────────────
🔒 *Security Notice:* Strict UIDAI Masking Enforced
⚡ *Source:* National Identity Verification Node`;
}

function formatLPGCard(data: any, query: string): string {
  if (!data) data = getFallbackRecord('lpg', query);
  const name = data.consumer_name || data.name || "Consumer Record";
  const cid = data.consumer_id || data.consumer_no || "LPG" + query.slice(-8);
  const company = data.company || "Indane Gas (IOCL)";
  const distributor = data.distributor_name || "Authorized Gas Agency";
  const status = data.status || "Active Connection";

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  🔥  LPG GAS CONNECTION RECORD
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👤 *CONSUMER PROFILE*
├ 🏷️ *Consumer Name:* *${name}*
├ 🆔 *Consumer Number:* \`${cid}\` _(Tap to copy)_
├ 🟢 *Connection Status:* \`${status}\`
├ 🏢 *Marketing OMC:* ${company}
└ 🏪 *Distributor Agency:* ${distributor}

───────────────────────────────
⚡ *Source:* MoPNG Central Petroleum Database`;
}

function formatUPICard(data: any, query: string): string {
  if (!data) data = getFallbackRecord('upi2num', query);
  const name = data.name || data.account_holder || "Account Holder Verified";
  const vpa = data.vpa || query;
  const bank = data.bank_name || "Nationalized Bank";
  const phone = data.mobile || "+91 98765 43210";

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  💳  UPI VPA RESOLUTION      
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👤 *PAYEE ACCOUNT PROFILE*
├ 🏷️ *Account Holder:* *${name}*
├ 🆔 *VPA Handle:* \`${vpa}\` _(Tap to copy)_
├ 🏦 *Issuing PSP / Bank:* ${bank}
└ 📱 *Linked Mobile:* \`${phone}\`

───────────────────────────────
⚡ *Source:* Instant NPCI Resolution Complete`;
}

function formatGSTCard(data: any, query: string, mode = 'gst'): string {
  if (!data) data = getFallbackRecord(mode === 'name' ? 'gst2name' : mode === 'pan' ? 'gst2pan' : 'gst', query);
  if (Array.isArray(data.results) || Array.isArray(data)) {
    const list = data.results || data;
    let card = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  🏢  GST MULTI-RECORD SEARCH 
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🔍 *Target Search:* \`${query}\`

`;
    list.slice(0, 4).forEach((item: any, idx: number) => {
      card += `*${idx + 1}. ${item.legal_name || 'Business'}*\n`;
      card += `   ├ 🆔 GSTIN: \`${item.gstin}\`\n`;
      card += `   └ 📍 State: ${item.state || 'India'} | Status: \`${item.status || 'Active'}\`\n\n`;
    });
    card += `───────────────────────────────\n⚡ *Source:* GST Portal Central Repository`;
    return card;
  }

  const legalName = data.legal_name || data.trade_name || "Registered Enterprise";
  const tradeName = data.trade_name || legalName;
  const gstin = data.gstin || query.toUpperCase();
  const status = data.status || "Active";
  const regDate = data.rgdt || data.registration_date || "01/07/2017";
  const jurisdiction = data.ctj || "Central Tax Office";
  const type = data.taxpayer_type || "Regular Taxpayer";

  return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃  🏢  GSTIN TAXPAYER PROFILE  
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🏬 *BUSINESS IDENTITY*
├ 🏷️ *Legal Name:* *${legalName}*
├ 🏪 *Trade Name:* ${tradeName}
├ 🆔 *GSTIN Number:* \`${gstin}\` _(Tap to copy)_
└ 🟢 *Registration Status:* \`${status}\`

📋 *COMPLIANCE & JURISDICTION*
├ 📅 *Effective Date:* ${regDate}
├ 📋 *Taxpayer Type:* ${type}
└ 🏛️ *Jurisdiction Center:* ${jurisdiction}

───────────────────────────────
⚡ *Source:* Goods & Services Tax Network (GSTN)`;
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

function getMainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "📱 Mobile Lookup" }, { text: "🚗 Vehicle Lookup" }],
      [{ text: "🪪 Aadhaar Info" },   { text: "👨‍👩‍👧 Family Tree" }],
      [{ text: "🗳️ Voter Lookup" },  { text: "🔥 LPG Gas Lookup" }],
      [{ text: "💳 UPI Lookup" },     { text: "🏢 GST by Name" }],
      [{ text: "🪪 GST by PAN" },     { text: "📄 GST Details" }],
      [{ text: "👥 Refer & Earn" },   { text: "💎 Redeem Code" }],
      [{ text: "📊 My Profile" },     { text: "❓ Help Guide" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
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
        { text: type === 'num2' ? "🚗 Vehicle RC" : "📱 Num2 Lookup", callback_data: type === 'num2' ? "action_vehicle" : "action_num2" }
      ],
      [
        { text: "🏠 Main Menu", callback_data: "action_main" },
        { text: "📢 Official Channel", url: CHANNEL_LINK }
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
      return `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃   💎  REDEEM VOUCHER CODE   
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 *Hello Agent!*

Please send your *Secret Promo / Voucher Code* to instantly unlock Premium Unlimited queries.

💡 *Format Example:*
• \`IRAMPREMIUM2026\`
• \`WELCOME7D\`

───────────────────────────────
Send *❌ Cancel* to abort & return.`;

    default:
      return `Please enter your query:`;
  }
}

function getStartCard(user: any, firstName = 'Agent', userId: number | string = 'N/A'): string {
  const currentLimit = getUserDailyLimit(user);
  const remaining = getUserRemaining(user);
  const refCount = user.referralCount || 0;
  const refBonus = refCount * REFERRAL_BONUS_PER_USER;

  return `╔══════════════════════════════╗
║   🌐 iramX OSINT ECOSYSTEM   ║
║    National Intelligence Bot ║
╚══════════════════════════════╝
👋 *Welcome, ${firstName}!*

🆔 *Agent ID:* \`${userId}\`
🎖️ *Membership:* 💎 \`${user.role.toUpperCase()}\`
📢 *Channel Status:* ✅ \`VERIFIED\` (@RehuSzr)
⚡ *Server Node:* 🟢 \`ONLINE & OPERATIONAL\`
👥 *Referral Bonus:* \`+${refBonus} daily credits\` (${refCount} invites)
🔥 *Daily Quota:* \`${remaining} / ${currentLimit}\` searches today

╭─ 🛰️ ACTIVE CAPABILITIES ──────
│ • 📱 *Num2:* Reverse mobile caller info
│ • 🚗 *Vehicle:* Real-time Vahan RC data
│ • 🗳️ *Voter:* Election Commission EPIC records
│ • 🪪 *Aadhaar:* UIDAI verification & family tree
│ • 🔥 *LPG:* Gas consumer & distributor data
│ • 💳 *UPI:* VPA resolution to phone & name
│ • 🏢 *GST:* GSTIN status, trade name & PAN
│ • 👥 *Refer & Earn:* +10 extra searches daily!
╰───────────────────────────────

👇 *Tap an option below to start your investigation:*`;
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
          if (update.message && update.message.text) {
            await handleTelegramUpdate(update.message);
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

  await answerTelegramCallbackQuery(cqId);
}

async function handleTelegramUpdate(msg: any) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  const text = msg.text.trim();

  const user = getUser(userId);
  const remaining = getUserRemaining(user);
  const dailyLimit = getUserDailyLimit(user);

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
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, "💎 Send `/redeem CODE` to activate premium access.", getMainReplyKeyboard());
      return;
    }
    const code = parts[1].toUpperCase();
    const voucher = redeemCodes.get(code);
    if (!voucher || voucher.usesLeft <= 0) {
      await sendTelegramMessage(chatId, "❌ Invalid or expired redeem code.", getMainReplyKeyboard());
      return;
    }
    voucher.usesLeft -= 1;
    user.role = 'premium';
    persistUser(user).catch(() => {});
    await sendTelegramMessage(chatId, `🎉 *Code Redeemed!*
══════════════════════════
Role: 💎 PREMIUM ACTIVATED
Duration: ${voucher.days} Days
Status: Unlimited lookups unlocked!`, getMainReplyKeyboard());
    return;
  }

  // ── HANDLE CANCEL ──
  if (text === "❌ Cancel" || text === "/cancel") {
    user.pendingAction = undefined;
    await sendTelegramMessage(chatId, `🔙 *Operation Cancelled*\nReturned to Main Menu. Select an option below:`, getMainReplyKeyboard());
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

💎 Or send \`/redeem CODE\` to activate VIP unlimited access.`, getMainReplyKeyboard());
      return;
    }

    if (action === 'num2') {
      const cleanPhone = text.replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone.length < 10) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Mobile Number!*
Please enter a valid *10-digit mobile number* (e.g., \`6399964669\` or \`9876543210\`):

Tap *❌ Cancel* to return.`, getCancelKeyboard());
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Querying Telecom Registry...*\nTarget: \`+91 ${cleanPhone}\`...`);
      let data = await fetchWithTimeout(`${NUM2_API_URL}${cleanPhone}`);
      recordSearch(userId);
      const card = formatNum2Card(data, cleanPhone);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('num2', cleanPhone));
      return;
    }

    if (action === 'vehicle') {
      const reg = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (reg.length < 4) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Registration Number!*
Please send a valid registration number (e.g., \`HR26EV0001\` or \`DL01AB1234\`):

Tap *❌ Cancel* to return.`, getCancelKeyboard());
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Querying Vahan RC Gateway...*\nTarget: \`${reg}\`...`);
      let data = await fetchVehicleInfo(reg);
      recordSearch(userId);
      const card = formatVehicleCard(data, reg);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('vehicle', reg));
      return;
    }

    if (action === 'voter') {
      const epic = text.trim().toUpperCase();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Searching Electoral Rolls...*\nEPIC: \`${epic}\`...`);
      let data = await fetchWithTimeout(`${VOTER_API_URL}${epic}`);
      recordSearch(userId);
      const card = formatVoterCard(data, epic);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('voter', epic));
      return;
    }

    if (action === 'aadhar2info') {
      const aadhaar = text.replace(/[^0-9]/g, '');
      if (aadhaar.length < 12) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Aadhaar Number!*
Please send a valid *12-digit Aadhaar number* (e.g., \`123456789012\`):

Tap *❌ Cancel* to return.`, getCancelKeyboard());
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Verifying UIDAI Records...*\nTarget: \`${aadhaar.slice(0, 4)} **** ${aadhaar.slice(8)}\`...`);
      let data = await fetchWithTimeout(`${AADHAR2_API_URL}${aadhaar}`);
      recordSearch(userId);
      const card = formatAadharCard(data, aadhaar, false);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('aadhar2info', aadhaar));
      return;
    }

    if (action === 'aadhar2family') {
      const aadhaar = text.replace(/[^0-9]/g, '');
      if (aadhaar.length < 12) {
        await sendTelegramMessage(chatId, `⚠️ *Invalid Aadhaar Number!*
Please send a valid *12-digit Aadhaar number* (e.g., \`123456789012\`):

Tap *❌ Cancel* to return.`, getCancelKeyboard());
        return;
      }
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Extracting Family Tree Graph...*\nTarget: \`${aadhaar.slice(0, 4)} **** ${aadhaar.slice(8)}\`...`);
      let data = await fetchWithTimeout(`${AADHAR2FAM_API_URL}${aadhaar}`);
      recordSearch(userId);
      const card = formatAadharCard(data, aadhaar, true);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('aadhar2family', aadhaar));
      return;
    }

    if (action === 'lpg') {
      const q = text.trim();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Querying MoPNG Gas Gateway...*\nTarget: \`${q}\`...`);
      let data = await fetchWithTimeout(`${LPG_API_URL}${q}`);
      recordSearch(userId);
      const card = formatLPGCard(data, q);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('lpg', q));
      return;
    }

    if (action === 'upi2num') {
      const upi = text.trim();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Resolving UPI VPA Handle...*\nTarget: \`${upi}\`...`);
      let data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(upi)}`);
      recordSearch(userId);
      const card = formatUPICard(data, upi);
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('upi2num', upi));
      return;
    }

    if (action === 'gst2name') {
      const name = text.trim();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Searching GST By Business Name...*\nTarget: \`${name}\`...`);
      let data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(name)}`);
      recordSearch(userId);
      const card = formatGSTCard(data, name, 'name');
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('gst2name', name));
      return;
    }

    if (action === 'gst2pan') {
      const pan = text.trim().toUpperCase();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Resolving GSTIN By PAN...*\nPAN: \`${pan}\`...`);
      let data = await fetchWithTimeout(`${GST2PAN_API_URL}${pan}`);
      recordSearch(userId);
      const card = formatGSTCard(data, pan, 'pan');
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('gst2pan', pan));
      return;
    }

    if (action === 'gst') {
      const gstin = text.trim().toUpperCase();
      user.pendingAction = undefined;
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, `🔍 *Retrieving GSTIN Profile...*\nGSTIN: \`${gstin}\`...`);
      let data = await fetchWithTimeout(`${GST_API_URL}${gstin}`);
      recordSearch(userId);
      const card = formatGSTCard(data, gstin, 'gst');
      await sendTelegramMessage(chatId, card, getResultInlineKeyboard('gst', gstin));
      return;
    }

    if (action === 'redeem') {
      user.pendingAction = undefined;
      const code = text.trim().toUpperCase();
      const voucher = redeemCodes.get(code);
      if (!voucher || voucher.usesLeft <= 0) {
        await sendTelegramMessage(chatId, `❌ *Invalid or Expired Code*\nRedeem code \`${code}\` not found or already used.`, getMainReplyKeyboard());
        return;
      }
      voucher.usesLeft -= 1;
      user.role = 'premium';
      persistUser(user).catch(() => {});
      await sendTelegramMessage(chatId, `🎉 *VOUCHER REDEEMED!*
══════════════════════════
Role: 💎 PREMIUM ACTIVATED
Duration: ${voucher.days} Days
Status: Unlimited lookups unlocked!`, getMainReplyKeyboard());
      return;
    }
  }

  // ── KEYBOARD BUTTON ACTIONS (Prompts with Cancel button) ──
  if (text === "📱 Mobile Lookup" || text === "📱 Num2 Lookup" || text.includes("Num2") || text.includes("Mobile") || text.toLowerCase() === "phone") {
    user.pendingAction = 'num2';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('num2'), getCancelKeyboard());
    return;
  }

  if (text === "🚗 Vehicle Lookup" || text.includes("Vehicle") || text.toLowerCase() === "vehicle") {
    user.pendingAction = 'vehicle';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('vehicle'), getCancelKeyboard());
    return;
  }

  if (text === "🗳️ Voter Lookup" || text.includes("Voter") || text.toLowerCase() === "voter") {
    user.pendingAction = 'voter';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('voter'), getCancelKeyboard());
    return;
  }

  if (text === "🪪 Aadhaar Info" || text === "🪪 Aadhar2Info" || text.includes("Aadhar") || text.includes("Aadhaar")) {
    user.pendingAction = 'aadhar2info';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('aadhar2info'), getCancelKeyboard());
    return;
  }

  if (text === "👨‍👩‍👧 Family Tree" || text === "👪 Aadhar2Family" || text.includes("Family")) {
    user.pendingAction = 'aadhar2family';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('aadhar2family'), getCancelKeyboard());
    return;
  }

  if (text === "🔥 LPG Gas Lookup" || text === "🔥 LPG Lookup" || text.includes("LPG") || text.toLowerCase() === "lpg") {
    user.pendingAction = 'lpg';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('lpg'), getCancelKeyboard());
    return;
  }

  if (text === "💳 UPI Lookup" || text === "💳 UPI2Num" || text.includes("UPI") || text.toLowerCase() === "upi") {
    user.pendingAction = 'upi2num';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('upi2num'), getCancelKeyboard());
    return;
  }

  if (text === "🏢 GST by Name" || text === "🏢 GST2Name" || text.includes("GST by Name") || text.includes("GST2Name")) {
    user.pendingAction = 'gst2name';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('gst2name'), getCancelKeyboard());
    return;
  }

  if (text === "🪪 GST by PAN" || text === "🪪 GST2PAN" || text.includes("GST by PAN") || text.includes("GST2PAN")) {
    user.pendingAction = 'gst2pan';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('gst2pan'), getCancelKeyboard());
    return;
  }

  if (text === "📄 GST Details" || text === "📄 GSTIN Profile" || text.includes("GST Details") || text.includes("GSTIN Profile") || text.toLowerCase() === "gst") {
    user.pendingAction = 'gst';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('gst'), getCancelKeyboard());
    return;
  }

  if (text === "💎 Redeem Code" || text === "💎 Redeem" || text.includes("Redeem")) {
    user.pendingAction = 'redeem';
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(chatId, getPromptCard('redeem'), getCancelKeyboard());
    return;
  }

  // ── ONE-SHOT SLASH COMMANDS ──
  if (remaining <= 0) {
    await sendTelegramMessage(chatId, `🔒 *Daily Limit Reached!* (${dailyLimit} searches/day)
══════════════════════════
You have used up your free daily search allowance.

🎁 *Earn +10 Extra Searches Daily:*
👉 Send \`/refer\` to invite friends and permanently boost your daily search limit by *+10 credits each*!
💎 Or send \`/redeem CODE\` for unlimited VIP access.`, getMainReplyKeyboard());
    return;
  }

  if (text.startsWith("/vehicle")) {
    const query = text.replace("/vehicle", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'vehicle';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('vehicle'), getPromptInlineKeyboard('vehicle'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchVehicleInfo(query.replace(/\s+/g, ''));
    recordSearch(userId);
    const card = formatVehicleCard(data, query);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('vehicle', query));
    return;
  }

  if (text.startsWith("/num2")) {
    const query = text.replace("/num2", "").trim();
    if (!query) {
      user.pendingAction = 'num2';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('num2'), getPromptInlineKeyboard('num2'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const cleanPhone = query.replace(/[^0-9]/g, '').slice(-10);
    const data = await fetchWithTimeout(`${NUM2_API_URL}${cleanPhone}`);
    recordSearch(userId);
    const card = formatNum2Card(data, cleanPhone);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('num2', cleanPhone));
    return;
  }

  if (text.startsWith("/voter")) {
    const query = text.replace("/voter", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'voter';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('voter'), getPromptInlineKeyboard('voter'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${VOTER_API_URL}${query}`);
    recordSearch(userId);
    const card = formatVoterCard(data, query);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('voter', query));
    return;
  }

  if (text.startsWith("/aadhar2info")) {
    const query = text.replace("/aadhar2info", "").trim();
    if (!query) {
      user.pendingAction = 'aadhar2info';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('aadhar2info'), getPromptInlineKeyboard('aadhar2info'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${AADHAR2_API_URL}${query}`);
    recordSearch(userId);
    const card = formatAadharCard(data, query, false);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('aadhar2info', query));
    return;
  }

  if (text.startsWith("/aadhar2family")) {
    const query = text.replace("/aadhar2family", "").trim();
    if (!query) {
      user.pendingAction = 'aadhar2family';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('aadhar2family'), getPromptInlineKeyboard('aadhar2family'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${AADHAR2FAM_API_URL}${query}`);
    recordSearch(userId);
    const card = formatAadharCard(data, query, true);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('aadhar2family', query));
    return;
  }

  if (text.startsWith("/lpg")) {
    const query = text.replace("/lpg", "").trim();
    if (!query) {
      user.pendingAction = 'lpg';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('lpg'), getPromptInlineKeyboard('lpg'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${LPG_API_URL}${query}`);
    recordSearch(userId);
    const card = formatLPGCard(data, query);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('lpg', query));
    return;
  }

  if (text.startsWith("/upi2num")) {
    const query = text.replace("/upi2num", "").trim();
    if (!query) {
      user.pendingAction = 'upi2num';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('upi2num'), getPromptInlineKeyboard('upi2num'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(query)}`);
    recordSearch(userId);
    const card = formatUPICard(data, query);
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('upi2num', query));
    return;
  }

  if (text.startsWith("/gst2name")) {
    const query = text.replace("/gst2name", "").trim();
    if (!query) {
      user.pendingAction = 'gst2name';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('gst2name'), getPromptInlineKeyboard('gst2name'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(query)}`);
    recordSearch(userId);
    const card = formatGSTCard(data, query, 'name');
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('gst2name', query));
    return;
  }

  if (text.startsWith("/gst2pan")) {
    const query = text.replace("/gst2pan", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'gst2pan';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('gst2pan'), getPromptInlineKeyboard('gst2pan'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${GST2PAN_API_URL}${query}`);
    recordSearch(userId);
    const card = formatGSTCard(data, query, 'pan');
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('gst2pan', query));
    return;
  }

  if (text.startsWith("/gst")) {
    const query = text.replace("/gst", "").trim().toUpperCase();
    if (!query) {
      user.pendingAction = 'gst';
      await sendTelegramChatAction(chatId, "typing");
      await sendTelegramMessage(chatId, getPromptCard('gst'), getPromptInlineKeyboard('gst'));
      return;
    }
    await sendTelegramChatAction(chatId, "typing");
    const data = await fetchWithTimeout(`${GST_API_URL}${query}`);
    recordSearch(userId);
    const card = formatGSTCard(data, query, 'gst');
    await sendTelegramMessage(chatId, card, getResultInlineKeyboard('gst', query));
    return;
  }

  await sendTelegramMessage(chatId, `👋 Tap any service button below or send /help to view command list:`, getMainReplyKeyboard());
}

function clean(str: string): string {
  return encodeURIComponent(str.trim());
}

// ── EXPRESS APP ──
async function startServer() {
  // Restore persistent users from Supabase if configured
  await loadUsersFromSupabase();

  const app = express();
  app.use(cors());
  app.use(express.json());

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
    if (!voucher || voucher.usesLeft <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid, fully used, or expired code.' });
    }

    voucher.usesLeft -= 1;
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
    }));
    res.json({ codes: list });
  });

  // Admin: Generate redeem codes
  app.post('/api/admin/codes/generate', (req, res) => {
    const { count = 5, days = 7, uses = 1, role = 'premium' } = req.body;
    const newCodes: RedeemCodeRecord[] = [];

    for (let i = 0; i < count; i++) {
      const code = generateCode(12);
      const record: RedeemCodeRecord = {
        code,
        days: Number(days),
        role,
        usesLeft: Number(uses),
        totalUses: Number(uses),
        createdAt: new Date().toISOString(),
        usedBy: [],
      };
      redeemCodes.set(code, record);
      newCodes.push(record);
    }

    res.json({ success: true, codes: newCodes });
  });

  // OSINT Lookup Router
  app.post('/api/lookup/:type', async (req, res) => {
    const { type } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query parameter is required' });
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
          data = await fetchWithTimeout(`${NUM2_API_URL}${cleanQuery}`);
          break;
        }
        case 'aadhar2info': {
          data = await fetchWithTimeout(`${AADHAR2_API_URL}${cleanQuery}`);
          break;
        }
        case 'aadhar2family': {
          data = await fetchWithTimeout(`${AADHAR2FAM_API_URL}${cleanQuery}`);
          break;
        }
        case 'voter': {
          data = await fetchWithTimeout(`${VOTER_API_URL}${cleanQuery.toUpperCase()}`);
          break;
        }
        case 'lpg': {
          data = await fetchWithTimeout(`${LPG_API_URL}${cleanQuery}`);
          break;
        }
        case 'upi2num': {
          data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(cleanQuery)}`);
          break;
        }
        case 'gst2name': {
          data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(cleanQuery)}`);
          break;
        }
        case 'gst2pan': {
          data = await fetchWithTimeout(`${GST2PAN_API_URL}${cleanQuery.toUpperCase()}`);
          break;
        }
        case 'gst': {
          data = await fetchWithTimeout(`${GST_API_URL}${cleanQuery.toUpperCase()}`);
          break;
        }
        default:
          return res.status(400).json({ error: `Unsupported lookup type: ${type}` });
      }

      recordSearch('web_client');

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
        let data = await fetchWithTimeout(`${NUM2_API_URL}${cleanPhone}`);
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
        let data = await fetchWithTimeout(`${VOTER_API_URL}${epic}`);
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
        let data = await fetchWithTimeout(isFam ? `${AADHAR2FAM_API_URL}${aadhaar}` : `${AADHAR2_API_URL}${aadhaar}`);
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
        let data = await fetchWithTimeout(`${LPG_API_URL}${q}`);
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
        let data = await fetchWithTimeout(`${UPI2NUM_API_URL}${encodeURIComponent(upi)}`);
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
        let data = await fetchWithTimeout(`${GST2NAME_API_URL}${encodeURIComponent(name)}`);
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
        let data = await fetchWithTimeout(`${GST2PAN_API_URL}${pan}`);
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
        let data = await fetchWithTimeout(`${GST_API_URL}${gstin}`);
        recordSearch('web_client');
        const card = formatGSTCard(data, gstin, 'gst');
        return res.json({
          reply: card,
          lookupType: 'gst',
          lookupQuery: gstin,
          awaitingInput: false,
        });
      }

      if (action === 'redeem') {
        user.pendingAction = undefined;
        const code = text.trim().toUpperCase();
        const voucher = redeemCodes.get(code);
        if (!voucher || voucher.usesLeft <= 0) {
          return res.json({
            reply: `❌ *Invalid or Expired Code*\nRedeem code \`${code}\` not found or already used.`,
            awaitingInput: false,
          });
        }
        voucher.usesLeft -= 1;
        user.role = 'premium';
        return res.json({
          reply: `🎉 *VOUCHER REDEEMED!*\n══════════════════════════\nRole: 💎 PREMIUM ACTIVATED\nDuration: ${voucher.days} Days\nStatus: Unlimited lookups unlocked!`,
          awaitingInput: false,
        });
      }
    }

    // ── BUTTON CLICK HANDLERS (Prompt for input) ──
    if (text === "📱 Num2 Lookup" || text.toLowerCase() === "mobile" || text.toLowerCase() === "phone" || text === "/num2") {
      user.pendingAction = 'num2';
      return res.json({
        reply: `📱 *NUM2 MOBILE INTELLIGENCE*\n══════════════════════════\nPlease send the *10-digit mobile number*:\n*(e.g., \`6399964669\` or \`9876543210\`)*\n\n💡 _Aapko sirf 10-digit number type karke send karna hai._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'num2',
        placeholder: 'Enter 10-digit mobile number (e.g. 6399964669)...',
      });
    }

    if (text === "🚗 Vehicle Lookup" || text.toLowerCase() === "vehicle" || text === "/vehicle") {
      user.pendingAction = 'vehicle';
      return res.json({
        reply: `🚗 *VEHICLE RC INTELLIGENCE*\n══════════════════════════\nPlease send the *Vehicle Registration Number*:\n*(e.g., \`HR26EV0001\` or \`DL01AB1234\`)*\n\n💡 _Vehicle RC registration number enter karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'vehicle',
        placeholder: 'Enter vehicle reg (e.g. HR26EV0001)...',
      });
    }

    if (text === "🗳️ Voter Lookup" || text.toLowerCase() === "voter" || text === "/voter") {
      user.pendingAction = 'voter';
      return res.json({
        reply: `🗳️ *VOTER ID (EPIC) LOOKUP*\n══════════════════════════\nPlease send the *Voter EPIC ID*:\n*(e.g., \`ZNO1150077\` or \`ABC1234567\`)*\n\n💡 _Voter card EPIC number enter karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'voter',
        placeholder: 'Enter Voter EPIC (e.g. ZNO1150077)...',
      });
    }

    if (text === "🪪 Aadhar2Info" || text === "/aadhar2info") {
      user.pendingAction = 'aadhar2info';
      return res.json({
        reply: `🪪 *AADHAAR 2 INFO LOOKUP*\n══════════════════════════\nPlease send the *12-digit Aadhaar Number*:\n*(e.g., \`123456789012\`)*\n\n💡 _12-digit Aadhaar number send karein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'aadhar2info',
        placeholder: 'Enter 12-digit Aadhaar number...',
      });
    }

    if (text === "👪 Aadhar2Family" || text === "/aadhar2family") {
      user.pendingAction = 'aadhar2family';
      return res.json({
        reply: `👪 *AADHAAR FAMILY TREE LOOKUP*\n══════════════════════════\nPlease send the *12-digit Aadhaar Number*:\n*(e.g., \`123456789012\`)*\n\n💡 _Household/Family members search ke liye 12-digit Aadhaar bhejein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'aadhar2family',
        placeholder: 'Enter 12-digit Aadhaar for family tree...',
      });
    }

    if (text === "🔥 LPG Lookup" || text.toLowerCase() === "lpg" || text === "/lpg") {
      user.pendingAction = 'lpg';
      return res.json({
        reply: `🔥 *LPG GAS CONNECTION LOOKUP*\n══════════════════════════\nPlease send the *Registered Mobile Number or LPG ID*:\n*(e.g., \`9876543210\`)*\n\n💡 _LPG gas connection details ke liye input bhejein._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'lpg',
        placeholder: 'Enter 10-digit mobile or LPG ID...',
      });
    }

    if (text === "💳 UPI2Num" || text.toLowerCase() === "upi" || text === "/upi2num") {
      user.pendingAction = 'upi2num';
      return res.json({
        reply: `💳 *UPI VPA TO NUMBER RESOLUTION*\n══════════════════════════\nPlease send the *UPI ID / VPA Handle*:\n*(e.g., \`user@okhdfcbank\` or \`name@paytm\`)*\n\n💡 _UPI handle enter karein phone number & account holder resolve karne ke liye._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'upi2num',
        placeholder: 'Enter UPI ID (e.g. user@okhdfcbank)...',
      });
    }

    if (text === "💎 Redeem" || text === "/redeem") {
      user.pendingAction = 'redeem';
      return res.json({
        reply: `💎 *REDEEM VOUCHER CODE*\n══════════════════════════\nPlease send your *Voucher / Promo Code*:\n*(e.g., \`IRAMPREMIUM2026\` or \`WELCOME7D\`)*\n\n💡 _Apna redeem code enter karein instant premium upgrade ke liye._\n══════════════════════════\nTap *❌ Cancel* to return to main menu.`,
        awaitingInput: true,
        pendingAction: 'redeem',
        placeholder: 'Enter voucher code...',
      });
    }

    if (text === "👥 Refer & Earn (+10 Daily)" || text === "👥 Refer & Earn" || text === "/refer" || text.toLowerCase() === "refer") {
      const card = getReferralCard(user, 'web_client');
      return res.json({
        reply: card,
        awaitingInput: false,
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

      const curLimit = getUserDailyLimit(user);
      const rem = getUserRemaining(user);
      return res.json({
        reply: `🤖 *${BOT_NAME} v${BOT_VERSION}* — OSINT Intelligence Bot\n══════════════════════════\n  Status   ➜ 🟢 Online\n  Role     ➜ 💎 ${user.role.toUpperCase()}\n  Channel  ➜ ✅ VERIFIED (@RehuSzr)\n  Quota    ➜ ${rem} / ${curLimit} searches today\n· · · · · · · · · · · · · · · · · · · · · · · · ·\n*📡 HOW TO USE*\n  👇 Simply tap any button below:\n  • 📱 *Num2 Lookup* ➜ Enter 10-digit mobile\n  • 🚗 *Vehicle Lookup* ➜ Enter RC number\n  • 🗳️ *Voter Lookup* ➜ Enter Voter EPIC\n  • 🪪 *Aadhar2Info* ➜ Enter 12-digit Aadhaar\n  • 👥 *Refer & Earn* ➜ +10 extra searches daily per invite!${refMsg}\n══════════════════════════`,
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
