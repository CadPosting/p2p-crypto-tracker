import { createClient } from "@/lib/supabase/server";
import { subDays, format, startOfDay } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ProfitChart } from "@/components/dashboard/profit-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import type { DailySummary, Transaction } from "@/types";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const thirtyDaysAgo = format(subDays(new Date(), 29), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  // Fetch sell transactions only (profit is realised on sells)
  const { data: sellTxns } = await supabase
    .from("transactions")
    .select("*")
    .in("transaction_type", ["try_to_pkr", "usdt_to_pkr"])
    .eq("is_archived", false)
    .eq("status", "completed")
    .gte("date", thirtyDaysAgo)
    .lte("date", today)
    .order("date", { ascending: true });

  // Fetch buy transactions to show open inventory
  const { data: openBuys } = await supabase
    .from("transactions")
    .select("remaining_amount, transaction_type")
    .in("transaction_type", ["pkr_to_try", "try_to_usdt"])
    .eq("is_archived", false)
    .gt("remaining_amount", 0);

  // Fetch recent transactions (all non-archived types, last 5)
  const { data: recentAll } = await supabase
    .from("transactions")
    .select("*")
    .eq("is_archived", false)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const txns: Transaction[] = sellTxns ?? [];
  const recent: Transaction[] = recentAll ?? [];

  // Aggregate sell stats
  const totalNetProfit   = txns.reduce((s, t) => s + (t.net_profit_pkr ?? 0), 0);
  const totalGrossProfit = txns.reduce((s, t) => s + (t.gross_profit_pkr ?? 0), 0);
  const totalFees        = txns.reduce((s, t) => s + t.total_fees_pkr, 0);
  const totalTrySold     = txns.filter((t) => t.transaction_type === "try_to_pkr")
    .reduce((s, t) => s + (t.try_amount ?? 0), 0);
  const totalUsdtSold    = txns.filter((t) => t.transaction_type === "usdt_to_pkr")
    .reduce((s, t) => s + (t.usdt_amount ?? 0), 0);
  const totalPkrReceived = txns.reduce((s, t) => s + (t.pkr_received ?? 0), 0);

  // Open inventory
  const openTry = (openBuys ?? [])
    .filter((r) => r.transaction_type === "pkr_to_try")
    .reduce((s, r) => s + (r.remaining_amount ?? 0), 0);
  const openUsdt = (openBuys ?? [])
    .filter((r) => r.transaction_type === "try_to_usdt")
    .reduce((s, r) => s + (r.remaining_amount ?? 0), 0);

  // Build 30-day chart data (sell transactions only)
  const dailyMap = new Map<string, DailySummary>();
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    dailyMap.set(d, {
      date: d,
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

  for (const t of txns) {
    const entry = dailyMap.get(t.date);
    if (entry) {
      entry.sell_count         += 1;
      entry.total_try_sold     += t.transaction_type === "try_to_pkr" ? (t.try_amount ?? 0) : 0;
      entry.total_usdt_sold    += t.transaction_type === "usdt_to_pkr" ? (t.usdt_amount ?? 0) : 0;
      entry.total_pkr_received += (t.pkr_received ?? 0);
      entry.total_pkr_cost     += (t.pkr_cost ?? 0);
      entry.total_fees         += t.total_fees_pkr;
      entry.total_gross_profit += (t.gross_profit_pkr ?? 0);
      entry.total_net_profit   += (t.net_profit_pkr ?? 0);
    }
  }

  const chartData = Array.from(dailyMap.values());

  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");
  const todayProfit = txns
    .filter((t) => t.date === todayStr)
    .reduce((s, t) => s + (t.net_profit_pkr ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy")} &mdash; Today&apos;s profit:{" "}
            <span className={todayProfit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
              {todayProfit >= 0 ? "+" : ""}
              {new Intl.NumberFormat("en-US").format(Math.round(todayProfit))} PKR
            </span>
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Trade
        </Link>
      </div>

      {/* Stats cards */}
      <StatsCards
        totalNetProfit={totalNetProfit}
        totalTransactions={txns.length}
        totalTry={totalTrySold}
        totalUsdt={totalUsdtSold}
        totalPkrReceived={totalPkrReceived}
        periodLabel="Last 30 days (sells)"
      />

      {/* Chart + recent */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <ProfitChart data={chartData} />
        </div>
        <div className="xl:col-span-2">
          <RecentTransactions transactions={recent} />
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gross Profit",   value: totalGrossProfit, unit: "PKR",  decimals: 0 },
          { label: "Total Fees",     value: totalFees,        unit: "PKR",  decimals: 0 },
          { label: "Open TRY",       value: openTry,          unit: "TRY",  decimals: 0 },
          { label: "Open USDT",      value: openUsdt,         unit: "USDT", decimals: 4 },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
              {new Intl.NumberFormat("en-US", {
                minimumFractionDigits: item.decimals,
                maximumFractionDigits: item.decimals,
              }).format(item.value)}
            </p>
            <p className="text-xs text-slate-400">{item.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
