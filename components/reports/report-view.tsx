"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Download, FileText } from "lucide-react";
import type { Transaction, ReportSummary } from "@/types";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import { exportTransactionsToExcel, exportDailySummaryToExcel } from "@/lib/export";

type GroupBy = "day" | "month";

export function ReportView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [groupBy, setGroupBy] = useState<GroupBy>("day");

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .eq("status", "completed")
      .order("date", { ascending: true });
    setTransactions(data ?? []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick date range shortcuts
  function setRange(range: string) {
    const today = new Date();
    if (range === "today") {
      const d = format(today, "yyyy-MM-dd");
      setDateFrom(d);
      setDateTo(d);
    } else if (range === "7d") {
      setDateFrom(format(subDays(today, 6), "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
    } else if (range === "30d") {
      setDateFrom(format(subDays(today, 29), "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
    } else if (range === "month") {
      setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
      setDateTo(format(endOfMonth(today), "yyyy-MM-dd"));
    }
  }

  // Aggregate by day or month
  const summary: ReportSummary[] = (() => {
    const map = new Map<string, ReportSummary>();

    for (const t of transactions) {
      const key =
        groupBy === "day"
          ? t.date
          : format(parseISO(t.date), "yyyy-MM"); // e.g. "2024-02"

      const existing = map.get(key) ?? {
        date: key,
        transaction_count: 0,
        total_try: 0,
        total_usdt: 0,
        total_pkr_cost: 0,
        total_pkr_received: 0,
        total_fees: 0,
        total_gross_profit: 0,
        total_net_profit: 0,
      };

      existing.transaction_count += 1;
      existing.total_try += t.try_amount ?? 0;
      existing.total_usdt += t.usdt_amount ?? 0;
      existing.total_pkr_cost += t.pkr_cost ?? 0;
      existing.total_pkr_received += t.pkr_received ?? 0;
      existing.total_fees += t.total_fees_pkr;
      existing.total_gross_profit += t.gross_profit_pkr ?? 0;
      existing.total_net_profit += t.net_profit_pkr ?? 0;

      map.set(key, existing);
    }

    return Array.from(map.values());
  })();

  // Overall totals
  const totals = summary.reduce(
    (acc, s) => ({
      transactions: acc.transactions + s.transaction_count,
      try: acc.try + s.total_try,
      usdt: acc.usdt + s.total_usdt,
      pkrCost: acc.pkrCost + s.total_pkr_cost,
      pkrReceived: acc.pkrReceived + s.total_pkr_received,
      fees: acc.fees + s.total_fees,
      grossProfit: acc.grossProfit + s.total_gross_profit,
      netProfit: acc.netProfit + s.total_net_profit,
    }),
    {
      transactions: 0,
      try: 0,
      usdt: 0,
      pkrCost: 0,
      pkrReceived: 0,
      fees: 0,
      grossProfit: 0,
      netProfit: 0,
    }
  );

  function formatPeriodLabel(dateKey: string) {
    if (groupBy === "day") {
      return format(parseISO(dateKey), "EEE, dd MMM yyyy");
    }
    // Month label e.g. "February 2024"
    return format(parseISO(dateKey + "-01"), "MMMM yyyy");
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Quick ranges */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Today", range: "today" },
            { label: "Last 7 days", range: "7d" },
            { label: "Last 30 days", range: "30d" },
            { label: "This month", range: "month" },
          ].map(({ label, range }) => (
            <button
              key={range}
              onClick={() => setRange(range)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 sm:ml-auto">
            <button
              onClick={() =>
                exportDailySummaryToExcel(
                  summary,
                  `report-${dateFrom}-to-${dateTo}.xlsx`
                )
              }
              disabled={summary.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Summary Excel
            </button>
            <button
              onClick={() =>
                exportTransactionsToExcel(
                  transactions,
                  `transactions-${dateFrom}-to-${dateTo}.xlsx`
                )
              }
              disabled={transactions.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Transactions Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Transactions",
            value: totals.transactions.toString(),
            sub: null,
          },
          {
            label: "Net Profit",
            value: formatCurrency(totals.netProfit, "PKR"),
            sub: `Gross: ${formatCurrency(totals.grossProfit, "PKR")}`,
            highlight: true,
            profit: totals.netProfit,
          },
          {
            label: "TRY Traded",
            value: formatNumber(totals.try, 0) + " TRY",
            sub: formatNumber(totals.usdt, 2) + " USDT",
          },
          {
            label: "Total Fees",
            value: formatCurrency(totals.fees, "PKR"),
            sub: null,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <p className="text-xs text-slate-500">{item.label}</p>
            <p
              className={`text-lg font-bold mt-1 ${
                "profit" in item
                  ? profitClass(item.profit as number)
                  : "text-slate-800"
              }`}
            >
              {item.value}
            </p>
            {item.sub && (
              <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Summary table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Loading…
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          No completed transactions in this date range.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                    {groupBy === "day" ? "Date" : "Month"}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    Trades
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    TRY
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    USDT
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    PKR Spent
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    PKR Received
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    Fees
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    Net Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr
                    key={s.date}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {formatPeriodLabel(s.date)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {s.transaction_count}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatNumber(s.total_try, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatNumber(s.total_usdt, 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(s.total_pkr_cost, "PKR")}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(s.total_pkr_received, "PKR")}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatCurrency(s.total_fees, "PKR")}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${profitClass(
                        s.total_net_profit
                      )}`}
                    >
                      {s.total_net_profit >= 0 ? "+" : ""}
                      {formatCurrency(s.total_net_profit, "PKR")}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {totals.transactions}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {formatNumber(totals.try, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {formatNumber(totals.usdt, 2)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {formatCurrency(totals.pkrCost, "PKR")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {formatCurrency(totals.pkrReceived, "PKR")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {formatCurrency(totals.fees, "PKR")}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold text-base ${profitClass(
                      totals.netProfit
                    )}`}
                  >
                    {totals.netProfit >= 0 ? "+" : ""}
                    {formatCurrency(totals.netProfit, "PKR")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
