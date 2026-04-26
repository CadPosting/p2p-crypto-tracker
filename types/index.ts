// ============================================================
// Shared TypeScript types for the entire application
// ============================================================

export type Currency = "TRY" | "PKR" | "USDT";

// New 4-type system (separate buy/sell)
export type NewTransactionType =
  | "pkr_to_try"   // Buy TRY with PKR
  | "try_to_pkr"   // Sell TRY directly for PKR
  | "try_to_usdt"  // Convert TRY → USDT
  | "usdt_to_pkr"; // Sell USDT for PKR

// Legacy types (archived, read-only display only)
export type LegacyTransactionType = "usdt_trade" | "direct_exchange";

export type TransactionType = NewTransactionType | LegacyTransactionType;

// Buy transactions create inventory; sell transactions consume it
export type BuyTransactionType = "pkr_to_try" | "try_to_usdt";
export type SellTransactionType = "try_to_pkr" | "usdt_to_pkr";

export function isBuyType(t: TransactionType): t is BuyTransactionType {
  return t === "pkr_to_try" || t === "try_to_usdt";
}

export function isSellType(t: TransactionType): t is SellTransactionType {
  return t === "try_to_pkr" || t === "usdt_to_pkr";
}

export function isLegacyType(t: TransactionType): t is LegacyTransactionType {
  return t === "usdt_trade" || t === "direct_exchange";
}

// Human-readable labels
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  pkr_to_try:      "PKR → TRY",
  try_to_pkr:      "TRY → PKR",
  try_to_usdt:     "TRY → USDT",
  usdt_to_pkr:     "USDT → PKR",
  usdt_trade:      "USDT Trade (Legacy)",
  direct_exchange: "Direct Exchange (Legacy)",
};

export interface Account {
  id: string;
  user_id: string;
  name: string;
  currency: "TRY" | "PKR";
  bank_name: string | null;
  account_number: string | null;
  current_balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateAd {
  id: string;
  user_id: string;
  ad_name: string;
  platform: string;
  usdt_try_rate: number; // TRY per 1 USDT
  usdt_pkr_rate: number; // PKR per 1 USDT
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionFee {
  id: string;
  transaction_id: string;
  description: string;
  amount_pkr: number;
  created_at: string;
}

// ============================================================
// Transaction
//
// Column semantics vary by transaction_type:
//
// pkr_to_try:
//   try_amount       = TRY received
//   pkr_per_try_rate = buy rate (PKR per TRY)
//   pkr_cost         = PKR spent
//   remaining_amount = TRY not yet sold/converted
//
// try_to_pkr:
//   try_amount       = TRY sold
//   pkr_per_try_rate = sell rate (PKR per TRY)
//   pkr_received     = PKR received
//   pkr_cost         = FIFO cost basis in PKR
//   gross_profit_pkr = pkr_received - pkr_cost
//   net_profit_pkr   = gross - fees
//
// try_to_usdt:
//   try_amount        = TRY converted
//   try_per_usdt_rate = TRY per 1 USDT
//   usdt_amount       = USDT received
//   pkr_cost          = FIFO cost basis in PKR of TRY used
//   remaining_amount  = USDT not yet sold
//
// usdt_to_pkr:
//   usdt_amount       = USDT sold
//   pkr_per_usdt_rate = PKR per 1 USDT
//   pkr_received      = PKR received
//   pkr_cost          = FIFO cost basis in PKR
//   gross_profit_pkr  = pkr_received - pkr_cost
//   net_profit_pkr    = gross - fees
// ============================================================
export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string | null;

  transaction_type: TransactionType;
  is_archived: boolean;

  // TRY fields (pkr_to_try, try_to_pkr, try_to_usdt)
  try_amount: number | null;
  pkr_per_try_rate: number | null; // buy rate (pkr_to_try) or sell rate (try_to_pkr)

  // PKR fields
  pkr_cost: number | null;      // PKR spent (buy) or FIFO cost basis (sell/convert)
  pkr_received: number | null;  // PKR received on sell types

  // USDT fields (try_to_usdt, usdt_to_pkr)
  try_per_usdt_rate: number | null;
  usdt_amount: number | null;
  pkr_per_usdt_rate: number | null;

  // Legacy direct exchange field
  sell_rate_pkr_per_try: number | null;

  // Inventory tracking (buy types only)
  remaining_amount: number | null;

  // Profit (sell types only)
  total_fees_pkr: number;
  gross_profit_pkr: number | null;
  net_profit_pkr: number | null;

  // References
  try_account_id: string | null;
  pkr_account_id: string | null;
  rate_ad_id: string | null;

  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;

  // Joined data
  try_account?: Account;
  pkr_account?: Account;
  fees?: TransactionFee[];
  attachments?: TransactionAttachment[];
  fifo_matches?: FifoMatch[];
}

// ============================================================
// FifoMatch — audit trail of buy→sell FIFO allocation
// ============================================================
export interface FifoMatch {
  id: string;
  sell_tx_id: string;
  buy_tx_id: string;
  matched_amount: number;   // units matched (TRY or USDT)
  cost_per_unit_pkr: number; // PKR cost per unit from the buy
  created_at: string;

  // Joined data
  buy_transaction?: Transaction;
}

// ============================================================
// TransactionAttachment — receipt/proof image or file
// ============================================================
export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  user_id: string;
  storage_path: string;  // path in Supabase Storage bucket
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

// ============================================================
// InventoryPosition — open (unsold) inventory for a given asset
// ============================================================
export interface InventoryPosition {
  asset: "TRY" | "USDT";
  total_bought: number;
  total_remaining: number;
  total_pkr_cost: number;           // total PKR spent on remaining units
  avg_cost_pkr_per_unit: number;    // avg PKR per TRY/USDT
  open_buy_records: Transaction[];  // individual buy rows with remaining > 0
}

// ============================================================
// DailySummary — aggregated from sell transactions per day
// ============================================================
export interface DailySummary {
  date: string;
  sell_count: number;
  total_try_sold: number;
  total_usdt_sold: number;
  total_pkr_received: number;
  total_pkr_cost: number;
  total_fees: number;
  total_gross_profit: number;
  total_net_profit: number;
}
