/**
 * Core business logic for calculating P2P trade profits.
 */

// ── USDT Trade ──────────────────────────────────────────────
// Flow: TRY → USDT → PKR
//   pkrCost     = tryAmount × pkrPerTryRate
//   usdtAmount  = tryAmount / tryPerUsdtRate
//   pkrReceived = usdtAmount × pkrPerUsdtRate
//   grossProfit = pkrReceived − pkrCost
//   netProfit   = grossProfit − fees

export interface UsdtTradeCalculation {
  pkrCost: number;
  usdtAmount: number;
  pkrReceived: number;
  grossProfit: number;
  netProfit: number;
}

export function calculateTrade(
  tryAmount: number,
  pkrPerTryRate: number,
  tryPerUsdtRate: number,
  pkrPerUsdtRate: number,
  totalFeesPkr: number = 0
): UsdtTradeCalculation {
  const pkrCost = tryAmount * pkrPerTryRate;
  const usdtAmount = tryPerUsdtRate > 0 ? tryAmount / tryPerUsdtRate : 0;
  const pkrReceived = usdtAmount * pkrPerUsdtRate;
  const grossProfit = pkrReceived - pkrCost;
  const netProfit = grossProfit - totalFeesPkr;

  return { pkrCost, usdtAmount, pkrReceived, grossProfit, netProfit };
}

// ── Direct Exchange ──────────────────────────────────────────
// Flow: TRY ↔ PKR — profit comes from the spread between buy and sell rate.
//   pkrCost     = tryAmount × buyRatePkrPerTry   (what you paid in PKR)
//   pkrReceived = tryAmount × sellRatePkrPerTry  (what you received in PKR)
//   grossProfit = pkrReceived − pkrCost
//               = tryAmount × (sellRate − buyRate)
//   netProfit   = grossProfit − fees
//
// Example:
//   10,000 TRY, buy @ 6.5 PKR/TRY, sell @ 6.8 PKR/TRY
//   Cost = 65,000 | Received = 68,000 | Gross profit = 3,000 PKR

export interface DirectExchangeCalculation {
  pkrCost: number;
  pkrReceived: number;
  spreadPerTry: number;  // sellRate - buyRate
  grossProfit: number;
  netProfit: number;
}

export function calculateDirectExchange(
  tryAmount: number,
  buyRatePkrPerTry: number,   // pkr_per_try_rate — what you paid
  sellRatePkrPerTry: number,  // sell_rate_pkr_per_try — what you received
  totalFeesPkr: number = 0
): DirectExchangeCalculation {
  const pkrCost = tryAmount * buyRatePkrPerTry;
  const pkrReceived = tryAmount * sellRatePkrPerTry;
  const spreadPerTry = sellRatePkrPerTry - buyRatePkrPerTry;
  const grossProfit = pkrReceived - pkrCost;
  const netProfit = grossProfit - totalFeesPkr;

  return { pkrCost, pkrReceived, spreadPerTry, grossProfit, netProfit };
}

// ── Shared helpers ───────────────────────────────────────────

/** Calculates the effective profit margin for a saved rate ad. */
export function calculateRateMargin(
  tryPerUsdtRate: number,
  pkrPerUsdtRate: number,
  pkrPerTryRate: number
): number {
  const pkrCostPerUsdt = tryPerUsdtRate * pkrPerTryRate;
  if (pkrCostPerUsdt === 0) return 0;
  return ((pkrPerUsdtRate - pkrCostPerUsdt) / pkrCostPerUsdt) * 100;
}

/** Sums an array of fee objects. */
export function sumFees(fees: { amount_pkr: number }[]): number {
  return fees.reduce((total, fee) => total + (Number(fee.amount_pkr) || 0), 0);
}
