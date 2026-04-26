-- ============================================================
-- Migration 003: Redesign for 4 separate transaction types
--   with FIFO inventory, partial-sell tracking, and attachments
-- ============================================================
-- Run this in Supabase SQL Editor AFTER 001 and 002
-- ============================================================

-- ============================================================
-- 1. Extend transaction_type CHECK to include 4 new types
--    (legacy types kept for archived rows)
-- ============================================================
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN (
    'usdt_trade',      -- legacy (archived)
    'direct_exchange', -- legacy (archived)
    'pkr_to_try',      -- Buy TRY with PKR
    'try_to_pkr',      -- Sell TRY directly for PKR
    'try_to_usdt',     -- Convert TRY → USDT
    'usdt_to_pkr'      -- Sell USDT for PKR
  ));

-- ============================================================
-- 2. Add remaining_amount column
--    For buy transactions (pkr_to_try, try_to_usdt):
--      - pkr_to_try  → remaining TRY not yet sold/converted
--      - try_to_usdt → remaining USDT not yet sold
--    NULL for sell transactions.
-- ============================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15, 6) NULL;

-- ============================================================
-- 3. Add is_archived flag
--    TRUE for all legacy rows; new transactions default FALSE
-- ============================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 4. Make legacy-specific NOT NULL columns nullable
--    New transaction types will not populate all old columns
-- ============================================================
ALTER TABLE transactions ALTER COLUMN try_amount         DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN pkr_per_try_rate   DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN pkr_cost           DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN pkr_received       DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN gross_profit_pkr   DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN net_profit_pkr     DROP NOT NULL;

-- ============================================================
-- 5. Archive all existing legacy transactions
-- ============================================================
UPDATE transactions
  SET is_archived = true
  WHERE transaction_type IN ('usdt_trade', 'direct_exchange');

-- ============================================================
-- TABLE: fifo_matches
-- Audit trail of FIFO buy→sell matching.
-- When a sell transaction is recorded, each buy that was
-- (partially) consumed is recorded here.
-- ============================================================
CREATE TABLE IF NOT EXISTS fifo_matches (
  id                UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  sell_tx_id        UUID    NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  buy_tx_id         UUID    NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  matched_amount    DECIMAL(15, 6) NOT NULL,    -- units matched (TRY or USDT)
  cost_per_unit_pkr DECIMAL(12, 6) NOT NULL,    -- PKR cost per unit from the buy
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for fifo_matches: users can only access matches for their own transactions
ALTER TABLE fifo_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fifo_matches: select own" ON fifo_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = fifo_matches.sell_tx_id
        AND transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "fifo_matches: insert own" ON fifo_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = fifo_matches.sell_tx_id
        AND transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "fifo_matches: delete own" ON fifo_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = fifo_matches.sell_tx_id
        AND transactions.user_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: transaction_attachments
-- Image/file receipts attached to any transaction.
-- Files are stored in Supabase Storage bucket
-- "transaction-attachments" under the path: {user_id}/{file_name}
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_attachments (
  id              UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id  UUID    NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  storage_path    TEXT    NOT NULL,   -- full path in Storage bucket
  file_name       TEXT    NOT NULL,   -- original file name
  file_size       INTEGER,            -- bytes
  mime_type       TEXT,               -- e.g. image/jpeg, image/png, application/pdf
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transaction_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments: select own" ON transaction_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "attachments: insert own" ON transaction_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attachments: delete own" ON transaction_attachments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- COLUMN USAGE REFERENCE (for new transaction types)
--
-- pkr_to_try (Buy TRY with PKR):
--   try_amount        = TRY received
--   pkr_per_try_rate  = buy rate (PKR per TRY)
--   pkr_cost          = PKR spent (= try_amount × pkr_per_try_rate)
--   remaining_amount  = TRY not yet sold/converted (starts = try_amount)
--   pkr_received      = NULL
--   gross_profit_pkr  = NULL
--   net_profit_pkr    = NULL
--
-- try_to_pkr (Sell TRY directly for PKR):
--   try_amount        = TRY sold
--   pkr_per_try_rate  = sell rate (PKR per TRY)
--   pkr_received      = PKR received (= try_amount × pkr_per_try_rate)
--   pkr_cost          = FIFO cost basis in PKR
--   gross_profit_pkr  = pkr_received - pkr_cost
--   net_profit_pkr    = gross_profit_pkr - total_fees_pkr
--   remaining_amount  = NULL
--
-- try_to_usdt (Convert TRY → USDT):
--   try_amount        = TRY converted
--   try_per_usdt_rate = TRY per 1 USDT
--   usdt_amount       = USDT received (= try_amount / try_per_usdt_rate)
--   pkr_cost          = FIFO cost basis in PKR of TRY consumed
--   remaining_amount  = USDT not yet sold (starts = usdt_amount)
--   pkr_per_try_rate  = NULL
--   pkr_received      = NULL
--   gross_profit_pkr  = NULL
--   net_profit_pkr    = NULL
--
-- usdt_to_pkr (Sell USDT for PKR):
--   usdt_amount       = USDT sold
--   pkr_per_usdt_rate = PKR per 1 USDT
--   pkr_received      = PKR received (= usdt_amount × pkr_per_usdt_rate)
--   pkr_cost          = FIFO cost basis in PKR (from try_to_usdt records)
--   gross_profit_pkr  = pkr_received - pkr_cost
--   net_profit_pkr    = gross_profit_pkr - total_fees_pkr
--   remaining_amount  = NULL
--   try_amount        = NULL
--   pkr_per_try_rate  = NULL
-- ============================================================

-- ============================================================
-- SUPABASE STORAGE SETUP NOTE
-- You must manually create the storage bucket in the Supabase
-- dashboard (Storage → New Bucket):
--   Name:   transaction-attachments
--   Public: NO (private)
--
-- Then add these storage policies:
--   SELECT: bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
--   INSERT: bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
--   DELETE: bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
-- ============================================================
