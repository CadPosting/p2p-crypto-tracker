"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import type { Transaction, DailySummary } from "@/types";
import { isSellType } from "@/types";
import { ChevronDown, ChevronUp } from "lucide-react";

// ─── Open Positions ───────────────────────────────────────────

interface OpenBuyGroup {
  asset: "TRY" | "USDT";
  totalRemaining: number;
  totalCostPkr: number;
  avgCostPerUnit: number;
  rows: Transaction[];
}

function OpenPositionCard({ group }: { group: OpenBuyGroup }) {
  const [expanded, setExpanded] = useState(false);
  const pctFilled =
    group.rows.length > 0
      ? Math.round(
          (group.rows.reduce((s, r) => {
            const total =
              group.asset === "TRY" ? (r.try_amount ?? 0) : (r.usdt_amount ?? 0);
            return s + (total - (r.remaining_amount ?? 0));
          }, 0) /
            group.rows.reduce((s, r) => {
              const total =
                group.asset === "TRY" ? (r.try_amount ?? 0) : (r.usdt_amount ?? 0);
              return s + total;
            }, 0)) *
            100
        )
      : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Asset pill */}
        <div
          className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white ${
            group.asset === "TRY" ? "bg-blue-600" : "bg-orange-500"
          }`}
        >
          {group.asset}
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat
            label="Open Balance"
            value={`${formatNumber(group.totalRemaining, group.asset === "USDT" ? 4 : 2)} ${group.asset}`}
            large
          />
          <Stat
            label="Total PKR Cost"
            value={formatCurrency(group.totalCostPkr, "PKR")}
          />
          <Stat
            label={`Avg Cost / ${group.asset}`}
            value={`${formatNumber(group.avgCostPerUnit, 4)} PKR`}
          />
          <Stat
            label="Buy Records"
            value={`${group.rows.length} open`}
          />
        </div>

        {/* Progress bar + toggle */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-slate-400">{pctFilled}% sold</div>
          <div className="w-32 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${group.asset === "TRY" ? "bg-blue-500" : "bg-orange-500"}`}
              style={{ width: `${pctFilled}%` }}
            />
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Hide" : "Show"} buys
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Date</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Total Bought</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Remaining</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">Rate</th>
                <th className="text-right px-4 py-2 font-medium text-slate-500">PKR Cost (remaining)</th>
                <th className="text-left px-4 py-2 font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => {
                const total =
                  group.asset === "TRY" ? (row.try_amount ?? 0) : (row.usdt_amount ?? 0);
                const rem = row.remaining_amount ?? 0;
                const costPerUnit =
                  group.asset === "TRY"
                    ? (row.pkr_per_try_rate ?? 0)
                    : (row.pkr_cost ?? 0) / (row.usdt_amount ?? 1);
                const remCost = rem * costPerUnit;
                return (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 dark:border-slate-700/50"
                  >
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {format(new Date(row.date + "T00:00:00"), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {formatNumber(total, group.asset === "USDT" ? 4 : 2)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {formatNumber(rem, group.asset === "USDT" ? 4 : 2)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {group.asset === "TRY"
                        ? `${row.pkr_per_try_rate} PKR/TRY`
                        : `${formatNumber(costPerUnit, 4)} PKR/USDT`}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {formatCurrency(remCost, "PKR")}
                    </td>
                    <td className="px-4 py-2 text-slate-400 dark:text-slate-500 max-w-[150px] truncate">
                      {row.description ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Realised P&L ─────────────────────────────────────────────

const QUICK_RANGES = [
  { label: "Today",     days: 0 },
  { label: "7 days",   days: 7 },
  { label: "30 days",  days: 30 },
  { label: "90 days",  days: 90 },
];

function DailySummaryTable({ rows }: { rows: DailySummary[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 text-sm">
        No sell transactions in this period
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      count:       acc.count + r.sell_count,
      pkrReceived: acc.pkrReceived + r.total_pkr_received,
      pkrCost:     acc.pkrCost + r.total_pkr_cost,
      fees:        acc.fees + r.total_fees,
      gross:       acc.gross + r.total_gross_profit,
      net:         acc.net + r.total_net_profit,
    }),
    { count: 0, pkrReceived: 0, pkrCost: 0, fees: 0, gross: 0, net: 0 }
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Date</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Sells</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">PKR Received</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Cost Basis</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Fees</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Gross</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 font-bold">Net Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.date}
                className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20"
              >
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {format(new Date(row.date + "T00:00:00"), "dd MMM yyyy")}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{row.sell_count}</td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                  {formatCurrency(row.total_pkr_received, "PKR")}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {formatCurrency(row.total_pkr_cost, "PKR")}
                </td>
                <td className="px-4 py-3 text-right text-orange-500">
                  -{formatCurrency(row.total_fees, "PKR")}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                  {formatCurrency(row.total_gross_profit, "PKR")}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${profitClass(row.total_net_profit)}`}>
                  {row.total_net_profit >= 0 ? "+" : ""}
                  {formatCurrency(row.total_net_profit, "PKR")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">TOTAL</td>
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{totals.count}</td>
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                {formatCurrency(totals.pkrReceived, "PKR")}
              </td>
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                {formatCurrency(totals.pkrCost, "PKR")}
              </td>
              <td className="px-4 py-3 text-right text-xs font-semibold text-orange-500">
                -{formatCurrency(totals.fees, "PKR")}
              </td>
              <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                {formatCurrency(totals.gross, "PKR")}
              </td>
              <td className={`px-4 py-3 text-right text-sm font-bold ${profitClass(totals.net)}`}>
                {totals.net >= 0 ? "+" : ""}
                {formatCurrency(totals.net, "PKR")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className={`font-semibold text-slate-800 dark:text-slate-100 ${large ? "text-lg" : "text-sm"}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function PositionsView() {
  const supabase = createClient();

  const [tryGroup,  setTryGroup]  = useState<OpenBuyGroup | null>(null);
  const [usdtGroup, setUsdtGroup] = useState<OpenBuyGroup | null>(null);
  const [loadingPos, setLoadingPos] = useState(true);

  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [loadingPnl, setLoadingPnl] = useState(true);

  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [dateTo,   setDateTo]   = useState(format(new Date(), "yyyy-MM-dd"));

  // Load open positions
  useEffect(() => {
    async function load() {
      setLoadingPos(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("transaction_type", ["pkr_to_try", "try_to_usdt"])
        .eq("is_archived", false)
        .gt("remaining_amount", 0)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) { setLoadingPos(false); return; }
      const rows = (data ?? []) as Transaction[];

      const tryRows  = rows.filter((r) => r.transaction_type === "pkr_to_try");
      const usdtRows = rows.filter((r) => r.transaction_type === "try_to_usdt");

      function buildGroup(asset: "TRY" | "USDT", groupRows: Transaction[]): OpenBuyGroup {
        const totalRemaining = groupRows.reduce((s, r) => s + (r.remaining_amount ?? 0), 0);
        const totalCostPkr = groupRows.reduce((s, r) => {
          const rem  = r.remaining_amount ?? 0;
          const cost = asset === "TRY"
            ? (r.pkr_per_try_rate ?? 0) * rem
            : ((r.pkr_cost ?? 0) / (r.usdt_amount ?? 1)) * rem;
          return s + cost;
        }, 0);
        const avgCostPerUnit = totalRemaining > 0 ? totalCostPkr / totalRemaining : 0;
        return { asset, totalRemaining, totalCostPkr, avgCostPerUnit, rows: groupRows };
      }

      setTryGroup(buildGroup("TRY", tryRows));
      setUsdtGroup(buildGroup("USDT", usdtRows));
      setLoadingPos(false);
    }
    load();
  }, [supabase]);

  // Load realised P&L
  const fetchPnl = useCallback(async () => {
    setLoadingPnl(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .in("transaction_type", ["try_to_pkr", "usdt_to_pkr"])
      .eq("is_archived", false)
      .eq("status", "completed")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true });

    if (error) { setLoadingPnl(false); return; }
    const txns = (data ?? []) as Transaction[];

    // Aggregate by date
    const map = new Map<string, DailySummary>();
    for (const t of txns) {
      if (!map.has(t.date)) {
        map.set(t.date, {
          date: t.date,
          sell_count: 0,
          total_try_sold: 0,
          total_usdt_sold: 0,
          total_pkr_received: 0,
          total_pkr_cost: 0,
          total_fees: 0,
          total_gross_profit: 0,
          total_net_profit: 0,
        });
      }
      const entry = map.get(t.date)!;
      entry.sell_count        += 1;
      entry.total_try_sold    += t.transaction_type === "try_to_pkr"  ? (t.try_amount ?? 0)  : 0;
      entry.total_usdt_sold   += t.transaction_type === "usdt_to_pkr" ? (t.usdt_amount ?? 0) : 0;
      entry.total_pkr_received += (t.pkr_received ?? 0);
      entry.total_pkr_cost     += (t.pkr_cost ?? 0);
      entry.total_fees         += t.total_fees_pkr;
      entry.total_gross_profit += (t.gross_profit_pkr ?? 0);
      entry.total_net_profit   += (t.net_profit_pkr ?? 0);
    }

    setDailySummaries(Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)));
    setLoadingPnl(false);
  }, [dateFrom, dateTo, supabase]);

  useEffect(() => { fetchPnl(); }, [fetchPnl]);

  return (
    <div className="space-y-8">
      {/* ── Open Positions ── */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Open Positions</h2>
        {loadingPos ? (
          <div className="text-slate-400 text-sm p-6">Loading positions…</div>
        ) : (
          <div className="space-y-4">
            {tryGroup && tryGroup.totalRemaining > 0 && (
              <OpenPositionCard group={tryGroup} />
            )}
            {usdtGroup && usdtGroup.totalRemaining > 0 && (
              <OpenPositionCard group={usdtGroup} />
            )}
            {(!tryGroup || tryGroup.totalRemaining === 0) &&
              (!usdtGroup || usdtGroup.totalRemaining === 0) && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 text-sm">
                  No open positions — all inventory has been sold.
                </div>
              )}
          </div>
        )}
      </section>

      {/* ── Realised P&L ── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Realised P&amp;L</h2>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => {
                  const from = r.days === 0
                    ? format(new Date(), "yyyy-MM-dd")
                    : format(subDays(new Date(), r.days), "yyyy-MM-dd");
                  setDateFrom(from);
                  setDateTo(format(new Date(), "yyyy-MM-dd"));
                }}
                className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {r.label}
              </button>
            ))}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loadingPnl ? (
          <div className="text-slate-400 text-sm p-6">Loading P&amp;L…</div>
        ) : (
          <DailySummaryTable rows={dailySummaries} />
        )}
      </section>
    </div>
  );
}
