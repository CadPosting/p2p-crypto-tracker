"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TransactionTable } from "@/components/transactions/transaction-table";
import type { Transaction, TransactionType } from "@/types";
import { Plus, Search, Archive } from "lucide-react";
import { format, subDays } from "date-fns";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { isSellType } from "@/types";

const ALL_TYPES: { value: string; label: string }[] = [
  { value: "all",            label: "All types" },
  { value: "pkr_to_try",    label: "PKR → TRY" },
  { value: "try_to_pkr",    label: "TRY → PKR" },
  { value: "try_to_usdt",   label: "TRY → USDT" },
  { value: "usdt_to_pkr",   label: "USDT → PKR" },
];

export default function TransactionsPage() {
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [dateFrom, setDateFrom]           = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo]               = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter]   = useState<string>("all");
  const [typeFilter, setTypeFilter]       = useState<string>("all");
  const [showArchived, setShowArchived]   = useState(false);

  const supabase = createClient();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("transactions")
      .select("*, fees:transaction_fees(*)")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .eq("is_archived", showArchived)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (typeFilter !== "all") {
      query = query.eq("transaction_type", typeFilter as TransactionType);
    }

    const { data, error } = await query;
    if (!error) setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
  }, [dateFrom, dateTo, statusFilter, typeFilter, showArchived, supabase]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = transactions.filter((t) => {
    if (!search) return true;
    return t.description?.toLowerCase().includes(search.toLowerCase());
  });

  // Totals — profit only from sell types
  const totalNetProfit = filtered
    .filter((t) => isSellType(t.transaction_type))
    .reduce((sum, t) => sum + (t.net_profit_pkr ?? 0), 0);

  const totalTryBought = filtered
    .filter((t) => t.transaction_type === "pkr_to_try")
    .reduce((sum, t) => sum + (t.try_amount ?? 0), 0);

  const totalUsdtSold = filtered
    .filter((t) => t.transaction_type === "usdt_to_pkr")
    .reduce((sum, t) => sum + (t.usdt_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {showArchived ? "Archived Transactions" : "Transactions"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {!showArchived && (
              <>
                {" · "}
                <span className={totalNetProfit >= 0 ? "text-green-600" : "text-red-600"}>
                  {totalNetProfit >= 0 ? "+" : ""}
                  {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(totalNetProfit)}{" "}
                  PKR realised profit
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showArchived
                ? "bg-slate-800 text-white border-slate-800"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
            title="Toggle legacy/archived transactions"
          >
            <Archive className="w-4 h-4" />
            {showArchived ? "Hide Legacy" : "Show Legacy"}
          </button>
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Trade
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Type filter */}
          {!showArchived && (
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
              >
                {ALL_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status filter */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary strip (non-archived only) */}
      {!showArchived && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Net Profit",   value: formatCurrency(totalNetProfit, "PKR"),           colour: totalNetProfit >= 0 ? "text-green-600" : "text-red-600" },
            { label: "TRY Bought",   value: `${formatNumber(totalTryBought, 0)} TRY`,         colour: "text-slate-800 dark:text-slate-100" },
            { label: "USDT Sold",    value: `${formatNumber(totalUsdtSold, 4)} USDT`,         colour: "text-slate-800 dark:text-slate-100" },
            { label: "Transactions", value: String(filtered.length),                          colour: "text-slate-800 dark:text-slate-100" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className={`text-base font-bold mt-0.5 ${s.colour}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-sm">
          Loading…
        </div>
      ) : (
        <TransactionTable transactions={filtered} onDelete={handleDelete} />
      )}
    </div>
  );
}
