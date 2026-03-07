import { createClient } from "@/lib/supabase/server";
import { subDays, format, startOfDay } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ProfitChart } from "@/components/dashboard/profit-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import type { DailySummary, Transaction } from "@/types";
import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * Main dashboard page — server component that fetches data from Supabase.
 * Shows stats, profit chart, and recent transactions.
 *
 * Note: createClient() is async in Next.js 15+ because cookies() is async.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const thirtyDaysAgo = format(subDays(new Date(), 29), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", thirtyDaysAgo)
    .lte("date", today)
    .eq("status", "completed")
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching transactions:", error);
  }

  const txns: Transaction[] = transactions ?? [];

  // --- Aggregate stats ---
  // usdt_amount is null for direct_exchange trades — use ?? 0 to avoid NaN
  const totalNetProfit = txns.reduce((sum, t) => sum + t.net_profit_pkr, 0);
  const totalGrossProfit = txns.reduce((sum, t) => sum + t.gross_profit_pkr, 0);
  const totalFees = txns.reduce((sum, t) => sum + t.total_fees_pkr, 0);
  const totalTry = txns.reduce((sum, t) => sum + t.try_amount, 0);
  const totalUsdt = txns.reduce((sum, t) => sum + (t.usdt_amount ?? 0), 0);
  const totalPkrReceived = txns.reduce((sum, t) => sum + t.pkr_received, 0);
  const totalTransactions = txns.length;

  // --- Build daily summaries for the chart ---
  const dailyMap = new Map<string, DailySummary>();

  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    dailyMap.set(d, {
      date: d,
      transaction_count: 0,
      total_try: 0,
      total_usdt: 0,
      total_pkr_cost: 0,
      total_pkr_received: 0,
      total_fees: 0,
      total_gross_profit: 0,
      total_net_profit: 0,
    });
  }

  for (const t of txns) {
    const existing = dailyMap.get(t.date);
    if (existing) {
      existing.transaction_count += 1;
      existing.total_try += t.try_amount;
      existing.total_usdt += t.usdt_amount ?? 0;
      existing.total_pkr_cost += t.pkr_cost;
      existing.total_pkr_received += t.pkr_received;
      existing.total_fees += t.total_fees_pkr;
      existing.total_gross_profit += t.gross_profit_pkr;
      existing.total_net_profit += t.net_profit_pkr;
    }
  }

  const chartData = Array.from(dailyMap.values());

  const recentTransactions = [...txns]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const todayStr = format(startOfDay(new Date()), "yyyy-MM-dd");
  const todayProfit = txns
    .filter((t) => t.date === todayStr)
    .reduce((sum, t) => sum + t.net_profit_pkr, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy")} &mdash; Today&apos;s profit:{" "}
            <span
              className={
                todayProfit >= 0
                  ? "text-green-600 font-medium"
                  : "text-red-600 font-medium"
              }
            >
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
        totalTransactions={totalTransactions}
        totalTry={totalTry}
        totalUsdt={totalUsdt}
        totalPkrReceived={totalPkrReceived}
        periodLabel="Last 30 days"
      />

      {/* Profit chart + recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <ProfitChart data={chartData} />
        </div>
        <div className="xl:col-span-2">
          <RecentTransactions transactions={recentTransactions} />
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gross Profit", value: totalGrossProfit, currency: "PKR" },
          { label: "Total Fees", value: totalFees, currency: "PKR" },
          { label: "TRY Traded", value: totalTry, currency: "TRY", decimals: 0 },
          { label: "USDT Traded", value: totalUsdt, currency: "USDT" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-slate-200 p-4 text-center"
          >
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-lg font-bold text-slate-800 mt-1">
              {new Intl.NumberFormat("en-US", {
                minimumFractionDigits: item.decimals ?? 2,
                maximumFractionDigits: item.decimals ?? 2,
              }).format(item.value)}
            </p>
            <p className="text-xs text-slate-400">{item.currency}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
