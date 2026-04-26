// ============================================================
// Core business logic for P2P trade calculations
// ============================================================

// ── Legacy: USDT Trade (TRY → USDT → PKR) ───────────────────
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

// ── Legacy: Direct Exchange (TRY ↔ PKR) ─────────────────────
export interface DirectExchangeCalculation {
  pkrCost: number;
  pkrReceived: number;
  spreadPerTry: number;
  grossProfit: number;
  netProfit: number;
}

export function calculateDirectExchange(
  tryAmount: number,
  buyRatePkrPerTry: number,
  sellRatePkrPerTry: number,
  totalFeesPkr: number = 0
): DirectExchangeCalculation {
  const pkrCost = tryAmount * buyRatePkrPerTry;
  const pkrReceived = tryAmount * sellRatePkrPerTry;
  const spreadPerTry = sellRatePkrPerTry - buyRatePkrPerTry;
  const grossProfit = pkrReceived - pkrCost;
  const netProfit = grossProfit - totalFeesPkr;
  return { pkrCost, pkrReceived, spreadPerTry, grossProfit, netProfit };
}

// ── New: PKR → TRY (Buy TRY with PKR) ───────────────────────
export interface PkrToTryCalculation {
  tryAmount: number;  // TRY received
  pkrCost: number;    // PKR spent
}

export function calculatePkrToTry(
  pkrAmount: number,
  pkrPerTryRate: number  // PKR per 1 TRY (buy rate)
): PkrToTryCalculation {
  const tryAmount = pkrPerTryRate > 0 ? pkrAmount / pkrPerTryRate : 0;
  return {
    tryAmount: parseFloat(tryAmount.toFixed(4)),
    pkrCost: pkrAmount,
  };
}

// ── New: TRY → PKR (Sell TRY directly) ──────────────────────
export interface TryToPkrCalculation {
  pkrReceived: number;
  grossProfit: number;
  netProfit: number;
}

export function calculateTryToPkr(
  tryAmount: number,
  sellRatePkrPerTry: number,
  costBasisPkr: number,
  totalFeesPkr: number = 0
): TryToPkrCalculation {
  const pkrReceived = tryAmount * sellRatePkrPerTry;
  const grossProfit = pkrReceived - costBasisPkr;
  const netProfit = grossProfit - totalFeesPkr;
  return {
    pkrReceived: parseFloat(pkrReceived.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
  };
}

// ── New: TRY → USDT (Convert TRY to USDT) ───────────────────
export interface TryToUsdtCalculation {
  usdtAmount: number;   // USDT received
  pkrCostPerUsdt: number; // PKR cost per USDT (for FIFO chain)
}

export function calculateTryToUsdt(
  tryAmount: number,
  tryPerUsdtRate: number,  // TRY per 1 USDT
  costBasisPkr: number     // PKR cost of TRY consumed (from FIFO)
): TryToUsdtCalculation {
  const usdtAmount = tryPerUsdtRate > 0 ? tryAmount / tryPerUsdtRate : 0;
  const pkrCostPerUsdt = usdtAmount > 0 ? costBasisPkr / usdtAmount : 0;
  return {
    usdtAmount: parseFloat(usdtAmount.toFixed(6)),
    pkrCostPerUsdt: parseFloat(pkrCostPerUsdt.toFixed(6)),
  };
}

// ── New: USDT → PKR (Sell USDT for PKR) ─────────────────────
export interface UsdtToPkrCalculation {
  pkrReceived: number;
  grossProfit: number;
  netProfit: number;
}

export function calculateUsdtToPkr(
  usdtAmount: number,
  pkrPerUsdtRate: number,
  costBasisPkr: number,
  totalFeesPkr: number = 0
): UsdtToPkrCalculation {
  const pkrReceived = usdtAmount * pkrPerUsdtRate;
  const grossProfit = pkrReceived - costBasisPkr;
  const netProfit = grossProfit - totalFeesPkr;
  return {
    pkrReceived: parseFloat(pkrReceived.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
  };
}

// ── Shared helpers ───────────────────────────────────────────

export function calculateRateMargin(
  tryPerUsdtRate: number,
  pkrPerUsdtRate: number,
  pkrPerTryRate: number
): number {
  const pkrCostPerUsdt = tryPerUsdtRate * pkrPerTryRate;
  if (pkrCostPerUsdt === 0) return 0;
  return ((pkrPerUsdtRate - pkrCostPerUsdt) / pkrCostPerUsdt) * 100;
}

export function sumFees(fees: { amount_pkr: number }[]): number {
  return fees.reduce((total, fee) => total + (Number(fee.amount_pkr) || 0), 0);
}
