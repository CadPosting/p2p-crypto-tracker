-- ============================================================
-- P2P Crypto Tracker - Database Schema
-- ============================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: accounts
-- Stores TRY and PKR bank accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                          -- e.g. "HBL Main Account"
  currency      TEXT NOT NULL CHECK (currency IN ('TRY', 'PKR')),
  bank_name     TEXT,                                   -- e.g. "HBL", "Ziraat Bank"
  account_number TEXT,                                  -- optional account number
  current_balance DECIMAL(15, 2) DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: rate_ads
-- Manually tracked P2P exchange rates for different ads
-- e.g. "Binance Ad 1: Buy USDT at 44 TRY, Sell at 293.5 PKR"
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_ads (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_name         TEXT NOT NULL,          -- e.g. "Binance Ad - Ahmed"
  platform        TEXT DEFAULT 'Binance', -- e.g. "Binance", "OKX", "Bybit"
  usdt_try_rate   DECIMAL(10, 4) NOT NULL, -- TRY per 1 USDT (you spend this to buy USDT)
  usdt_pkr_rate   DECIMAL(10, 4) NOT NULL, -- PKR per 1 USDT (you receive this when selling)
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: transactions
-- Core table — each row is one complete TRY→USDT→PKR trade
--
-- The flow:
--   1. You receive TRY (cost in PKR = try_amount × pkr_per_try_rate)
--   2. You buy USDT with TRY (usdt_amount = try_amount / try_per_usdt_rate)
--   3. You sell USDT for PKR (pkr_received = usdt_amount × pkr_per_usdt_rate)
--   4. Profit = pkr_received - pkr_cost - fees
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT,

  -- Step 1: TRY acquisition cost
  try_amount      DECIMAL(15, 2) NOT NULL,   -- How much TRY you received
  pkr_per_try_rate DECIMAL(10, 4) NOT NULL,  -- PKR you paid per 1 TRY
  pkr_cost        DECIMAL(15, 2) NOT NULL,   -- = try_amount × pkr_per_try_rate

  -- Step 2: TRY → USDT conversion
  try_per_usdt_rate DECIMAL(10, 4) NOT NULL, -- TRY per 1 USDT on P2P ad
  usdt_amount     DECIMAL(15, 6) NOT NULL,   -- = try_amount / try_per_usdt_rate

  -- Step 3: USDT → PKR conversion
  pkr_per_usdt_rate DECIMAL(10, 4) NOT NULL, -- PKR per 1 USDT on P2P ad
  pkr_received    DECIMAL(15, 2) NOT NULL,   -- = usdt_amount × pkr_per_usdt_rate

  -- Fees & Profit
  total_fees_pkr    DECIMAL(15, 2) DEFAULT 0,  -- Sum of all fees in PKR
  gross_profit_pkr  DECIMAL(15, 2) NOT NULL,   -- = pkr_received - pkr_cost
  net_profit_pkr    DECIMAL(15, 2) NOT NULL,   -- = gross_profit_pkr - total_fees_pkr

  -- References to accounts and rate ad used
  try_account_id  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  pkr_account_id  UUID REFERENCES accounts(id) ON DELETE SET NULL,
  rate_ad_id      UUID REFERENCES rate_ads(id) ON DELETE SET NULL,

  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: transaction_fees
-- Itemized fee breakdown per transaction
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_fees (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,      -- e.g. "Bank Transfer Fee", "P2P Platform Fee"
  amount_pkr      DECIMAL(15, 2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- This ensures every user can ONLY see their own data.
-- This is a critical security feature.
-- ============================================================

ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_ads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_fees ENABLE ROW LEVEL SECURITY;

-- accounts policies
CREATE POLICY "accounts: select own"  ON accounts FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "accounts: insert own"  ON accounts FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts: update own"  ON accounts FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "accounts: delete own"  ON accounts FOR DELETE  USING (auth.uid() = user_id);

-- rate_ads policies
CREATE POLICY "rate_ads: select own" ON rate_ads FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "rate_ads: insert own" ON rate_ads FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rate_ads: update own" ON rate_ads FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "rate_ads: delete own" ON rate_ads FOR DELETE  USING (auth.uid() = user_id);

-- transactions policies
CREATE POLICY "transactions: select own" ON transactions FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "transactions: insert own" ON transactions FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: update own" ON transactions FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "transactions: delete own" ON transactions FOR DELETE  USING (auth.uid() = user_id);

-- transaction_fees: users can manage fees that belong to their transactions
CREATE POLICY "fees: manage via transactions" ON transaction_fees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_fees.transaction_id
        AND transactions.user_id = auth.uid()
    )
  );

-- ============================================================
-- AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_rate_ads_updated_at
  BEFORE UPDATE ON rate_ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
