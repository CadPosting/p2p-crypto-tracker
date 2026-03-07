// ============================================================
// Shared TypeScript types for the entire application
// ============================================================

export type Currency = "TRY" | "PKR" | "USDT";

// Two transaction modes:
//   usdt_trade      = TRY → USDT → PKR (3-step, profit from rate spread)
//   direct_exchange = TRY ↔ PKR directly (profit = spread between buy & sell rate)
export type TransactionType = "usdt_trade" | "direct_exchange";

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
  usdt_try_rate: number; // TRY per 1 USDT — you pay this TRY to get 1 USDT
  usdt_pkr_rate: number; // PKR per 1 USDT — you receive this PKR when selling 1 USDT
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

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string | null;

  // Which mode this trade was
  transaction_type: TransactionType;

  // --- Fields used by BOTH types ---
  try_amount: number;
  pkr_per_try_rate: number; // buy rate: PKR you paid per TRY
  pkr_cost: number;         // try_amount × pkr_per_try_rate
  pkr_received: number;     // what you received in PKR
  total_fees_pkr: number;
  gross_profit_pkr: number;
  net_profit_pkr: number;

  // --- USDT trade only ---
  try_per_usdt_rate: number | null; // TRY per 1 USDT on P2P ad
  usdt_amount: number | null;       // try_amount / try_per_usdt_rate
  pkr_per_usdt_rate: number | null; // PKR per 1 USDT on P2P ad

  // --- Direct exchange only ---
  sell_rate_pkr_per_try: number | null; // PKR received per TRY (sell rate)

  // References
  try_account_id: string | null;
  pkr_account_id: string | null;
  rate_ad_id: string | null;

  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;

  // Joined data (when fetched with related tables)
  try_account?: Account;
  pkr_account?: Account;
  fees?: TransactionFee[];
}

// Used for building the reports page
export interface DailySummary {
  date: string;
  transaction_count: number;
  total_try: number;
  total_usdt: number;
  total_pkr_cost: number;
  total_pkr_received: number;
  total_fees: number;
  total_gross_profit: number;
  total_net_profit: number;
}
