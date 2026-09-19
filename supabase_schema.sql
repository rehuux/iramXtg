-- ================================================================
-- Supabase Schema for iramX OSINT Bot
-- Run this in your Supabase Project -> SQL Editor
-- This ensures users, credits, and referrals persist across Render restarts!
-- ================================================================

-- 1. Create table for Bot Users
CREATE TABLE IF NOT EXISTS bot_users (
    id TEXT PRIMARY KEY,                       -- Telegram User ID (e.g. '5225326313')
    role TEXT NOT NULL DEFAULT 'free',         -- 'free', 'premium', 'admin'
    daily_searches INTEGER NOT NULL DEFAULT 0, -- Searches consumed today
    last_search_date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT, -- Date string YYYY-MM-DD
    total_searches INTEGER NOT NULL DEFAULT 0, -- Total lifetime queries executed
    channel_verified BOOLEAN NOT NULL DEFAULT FALSE, -- Channel membership verified
    referred_by TEXT,                          -- User ID of who referred them
    referral_count INTEGER NOT NULL DEFAULT 0, -- Total successful invites
    referral_bonus_daily INTEGER NOT NULL DEFAULT 0, -- Bonus daily queries (+10/referral)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_bot_users_id ON bot_users(id);
CREATE INDEX IF NOT EXISTS idx_bot_users_referred_by ON bot_users(referred_by);

-- 2. Create table for Referrals History
CREATE TABLE IF NOT EXISTS bot_referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_referrals_referrer ON bot_referrals(referrer_id);

-- 3. Create table for Redeem Codes
CREATE TABLE IF NOT EXISTS bot_redeem_codes (
    code TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'premium',
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by TEXT,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert standard voucher redeem codes if they do not exist
INSERT INTO bot_redeem_codes (code, role, used)
VALUES 
    ('IRAMX-VIP-2025', 'premium', false),
    ('VIP-UNLIMITED', 'premium', false),
    ('ADMIN-SECRET-KEY', 'admin', false)
ON CONFLICT (code) DO NOTHING;

-- 4. Enable Row Level Security (RLS) but allow service role or public read/write via API key
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_redeem_codes ENABLE ROW LEVEL SECURITY;

-- Allow full access with Supabase anon/service_role API keys
CREATE POLICY "Allow all operations for service key" ON bot_users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service key referrals" ON bot_referrals
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service key codes" ON bot_redeem_codes
    FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- Done! Now add SUPABASE_URL and SUPABASE_KEY to your Render Environment Variables.
-- ================================================================
