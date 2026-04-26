// ============================================================
// FIFO Inventory Matching Engine
//
// When a sell transaction is recorded, this module:
//   1. Fetches available buy records (oldest first)
//   2. Allocates sell amount across buys until fully covered
//   3. Returns cost basis, match records, and updated remaining values
// ============================================================

import { SupabaseClient } from "@supabase/supabase-js";
import { BuyTransactionType, SellTransactionType, Transaction } from "@/types";

export interface FifoMatchRecord {
  buy_tx_id: string;
  matched_amount: number;
  cost_per_unit_pkr: number;
}

export interface FifoResult {
  costBasisPkr: number;          // total PKR cost for the sell amount
  costPerUnit: number;           // weighted average PKR per unit
  matches: FifoMatchRecord[];    // individual match records to insert
  updatedBuys: { id: string; remaining_amount: number }[]; // buys to update
  insufficientInventory: boolean; // true if sell exceeds available balance
  availableAmount: number;       // total available before this sell
}

// Maps each sell type to the corresponding buy type it consumes
export function getBuyTypeForSell(sellType: SellTransactionType): BuyTransactionType {
  if (sellType === "try_to_pkr") return "pkr_to_try";
  if (sellType === "try_to_usdt") return "pkr_to_try";
  if (sellType === "usdt_to_pkr") return "try_to_usdt";
  // Should never reach here
  throw new Error(`Unknown sell type: ${sellType}`);
}

// Returns the PKR cost per unit for a given buy transaction
export function getCostPerUnit(buy: Transaction): number {
  if (buy.transaction_type === "pkr_to_try") {
    // PKR per TRY = pkr_per_try_rate (buy rate)
    return buy.pkr_per_try_rate ?? 0;
  }
  if (buy.transaction_type === "try_to_usdt") {
    // PKR per USDT = pkr_cost / usdt_amount (stored at conversion time)
    const usdt = buy.usdt_amount ?? 0;
    const pkrCost = buy.pkr_cost ?? 0;
    if (usdt === 0) return 0;
    return pkrCost / usdt;
  }
  return 0;
}

// Fetch buy records with remaining inventory, ordered oldest first (FIFO)
export async function getAvailableBuys(
  userId: string,
  buyType: BuyTransactionType,
  supabase: SupabaseClient
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("transaction_type", buyType)
    .eq("is_archived", false)
    .gt("remaining_amount", 0)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch inventory: ${error.message}`);
  return (data ?? []) as Transaction[];
}

// Get total available balance for an asset type
export async function getAvailableBalance(
  userId: string,
  buyType: BuyTransactionType,
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .select("remaining_amount")
    .eq("user_id", userId)
    .eq("transaction_type", buyType)
    .eq("is_archived", false)
    .gt("remaining_amount", 0);

  if (error) throw new Error(`Failed to fetch balance: ${error.message}`);
  return (data ?? []).reduce(
    (sum: number, row: { remaining_amount: number }) => sum + (row.remaining_amount ?? 0),
    0
  );
}

// Core FIFO matching algorithm
export function computeFifoMatch(
  sellAmount: number,
  availableBuys: Transaction[]
): FifoResult {
  const totalAvailable = availableBuys.reduce(
    (sum, b) => sum + (b.remaining_amount ?? 0),
    0
  );

  const matches: FifoMatchRecord[] = [];
  const updatedBuys: { id: string; remaining_amount: number }[] = [];

  let remainingToMatch = sellAmount;
  let totalCostPkr = 0;

  for (const buy of availableBuys) {
    if (remainingToMatch <= 0) break;

    const available = buy.remaining_amount ?? 0;
    if (available <= 0) continue;

    const matched = Math.min(available, remainingToMatch);
    const costPerUnit = getCostPerUnit(buy);
    const costForMatched = matched * costPerUnit;

    matches.push({
      buy_tx_id: buy.id,
      matched_amount: matched,
      cost_per_unit_pkr: costPerUnit,
    });

    updatedBuys.push({
      id: buy.id,
      remaining_amount: parseFloat((available - matched).toFixed(6)),
    });

    totalCostPkr += costForMatched;
    remainingToMatch -= matched;
  }

  const fullyMatched = remainingToMatch <= 0.000001; // float tolerance

  return {
    costBasisPkr: parseFloat(totalCostPkr.toFixed(2)),
    costPerUnit: sellAmount > 0 ? parseFloat((totalCostPkr / sellAmount).toFixed(6)) : 0,
    matches,
    updatedBuys,
    insufficientInventory: !fullyMatched,
    availableAmount: parseFloat(totalAvailable.toFixed(6)),
  };
}

// Full FIFO execution: fetch buys, compute match, persist changes
// Returns the complete FifoResult. The caller is responsible for:
//   - Inserting fifo_matches records
//   - Updating buy remaining_amounts
//   - Inserting the sell transaction with the returned costBasisPkr
export async function executeFifoMatch(
  sellAmount: number,
  sellType: SellTransactionType,
  userId: string,
  supabase: SupabaseClient
): Promise<FifoResult> {
  const buyType = getBuyTypeForSell(sellType);
  const availableBuys = await getAvailableBuys(userId, buyType, supabase);
  return computeFifoMatch(sellAmount, availableBuys);
}

// Estimate FIFO cost basis without persisting (used for live preview in form)
export async function estimateFifoCost(
  sellAmount: number,
  sellType: SellTransactionType,
  userId: string,
  supabase: SupabaseClient
): Promise<{ costBasisPkr: number; costPerUnit: number; available: number; insufficient: boolean }> {
  const buyType = getBuyTypeForSell(sellType);
  const availableBuys = await getAvailableBuys(userId, buyType, supabase);
  const result = computeFifoMatch(sellAmount, availableBuys);
  return {
    costBasisPkr: result.costBasisPkr,
    costPerUnit: result.costPerUnit,
    available: result.availableAmount,
    insufficient: result.insufficientInventory,
  };
}

// Apply FIFO updates to the database (call after inserting the sell transaction)
export async function applyFifoUpdates(
  sellTxId: string,
  result: FifoResult,
  supabase: SupabaseClient
): Promise<void> {
  // Insert fifo_match records
  if (result.matches.length > 0) {
    const matchRows = result.matches.map((m) => ({
      sell_tx_id: sellTxId,
      buy_tx_id: m.buy_tx_id,
      matched_amount: m.matched_amount,
      cost_per_unit_pkr: m.cost_per_unit_pkr,
    }));

    const { error: matchError } = await supabase
      .from("fifo_matches")
      .insert(matchRows);

    if (matchError) throw new Error(`Failed to insert FIFO matches: ${matchError.message}`);
  }

  // Update remaining_amount on consumed buy transactions
  for (const upd of result.updatedBuys) {
    const { error: updError } = await supabase
      .from("transactions")
      .update({ remaining_amount: upd.remaining_amount })
      .eq("id", upd.id);

    if (updError) throw new Error(`Failed to update buy remaining: ${updError.message}`);
  }
}
