-- ============================================================
-- Migration 002: Add Direct Exchange transaction type
-- ============================================================
-- Run this in Supabase SQL Editor AFTER running 001_initial.sql
-- ============================================================

-- Add transaction type column
-- 'usdt_trade'       = existing flow: TRY → USDT → PKR
-- 'direct_exchange'  = new: TRY ↔ PKR directly, profit from spread
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT
    NOT NULL DEFAULT 'usdt_trade'
    CHECK (transaction_type IN ('usdt_trade', 'direct_exchange'));

-- For direct exchange we need the sell rate (PKR received per TRY).
-- pkr_per_try_rate already stores the BUY rate (what you paid per TRY).
-- This new column stores the SELL rate (what you received per TRY).
-- It is NULL for usdt_trade rows.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sell_rate_pkr_per_try DECIMAL(10, 4) NULL;

-- Make the USDT columns nullable so they can be NULL for direct exchange rows
ALTER TABLE transactions
  ALTER COLUMN try_per_usdt_rate DROP NOT NULL;

ALTER TABLE transactions
  ALTER COLUMN usdt_amount DROP NOT NULL;

ALTER TABLE transactions
  ALTER COLUMN pkr_per_usdt_rate DROP NOT NULL;

-- ============================================================
-- How direct_exchange profit is calculated:
--
--   pkr_cost     = try_amount × pkr_per_try_rate  (what you paid in PKR)
--   pkr_received = try_amount × sell_rate_pkr_per_try (what you received in PKR)
--   gross_profit = pkr_received − pkr_cost
--               = try_amount × (sell_rate − buy_rate)
--   net_profit   = gross_profit − total_fees_pkr
--
-- Example:
--   10,000 TRY, buy @ 6.5 PKR/TRY, sell @ 6.8 PKR/TRY
--   PKR cost     = 65,000
--   PKR received = 68,000
--   Gross profit = 3,000 PKR
-- ============================================================
