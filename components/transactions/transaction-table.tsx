"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import type { Transaction } from "@/types";

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

// Expandable row — shows full breakdown depending on transaction type
function ExpandedRow({ t }: { t: Transaction }) {
  const isUsdt = t.transaction_type === "usdt_trade";

  return (
    <tr>
      <td
        colSpan={7}
        className="bg-slate-50 px-6 py-4 border-b border-slate-200"
      >
        {isUsdt ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium mb-1">Step 1 — TRY Cost</p>
              <p className="text-slate-600">
                {formatNumber(t.try_amount, 0)} TRY × {t.pkr_per_try_rate} PKR/TRY
              </p>
              <p className="font-semibold text-slate-900">
                = {formatCurrency(t.pkr_cost, "PKR")}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium mb-1">Step 2 — Buy USDT</p>
              <p className="text-slate-600">
                {formatNumber(t.try_amount, 0)} TRY ÷ {t.try_per_usdt_rate} TRY/USDT
              </p>
              <p className="font-semibold text-slate-900">
                = {formatNumber(t.usdt_amount ?? 0, 4)} USDT
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium mb-1">Step 3 — Sell USDT</p>
              <p className="text-slate-600">
                {formatNumber(t.usdt_amount ?? 0, 4)} USDT × {t.pkr_per_usdt_rate} PKR/USDT
              </p>
              <p className="font-semibold text-slate-900">
                = {formatCurrency(t.pkr_received, "PKR")}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium mb-1">Profit</p>
              <p className="text-slate-600">
                Gross: {formatCurrency(t.gross_profit_pkr, "PKR")}
              </p>
              <p className="text-slate-600">
                Fees: -{formatCurrency(t.total_fees_pkr, "PKR")}
              </p>
              <p className={`font-semibold ${profitClass(t.net_profit_pkr)}`}>
                Net: {formatCurrency(t.net_profit_pkr, "PKR")}
              </p>
            </div>
          </div>
        ) : (
          // Direct exchange breakdown
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium mb-1">TRY Amount</p>
              <p className="font-semibold text-slate-900">
                {formatNumber(t.try_amount, 0)} TRY
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium mb-1">Buy Rate</p>
              <p className="text-slate-600">PKR you paid per TRY</p>
              <p className="font-semibold text-slate-900">
                {t.pkr_per_try_rate} PKR/TRY
              </p>
              <p className="text-slate-500 mt-0.5">
                Cost = {formatCurrency(t.pkr_cost, "PKR")}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium mb-1">Sell Rate</p>
              <p className="text-slate-600">PKR you received per TRY</p>
              <p className="font-semibold text-slate-900">
                {t.sell_rate_pkr_per_try} PKR/TRY
              </p>
              <p className="text-slate-500 mt-0.5">
                Received = {formatCurrency(t.pkr_received, "PKR")}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium mb-1">Profit</p>
              <p className="text-slate-600">
                Spread:{" "}
                {formatNumber(
                  (t.sell_rate_pkr_per_try ?? 0) - t.pkr_per_try_rate,
                  4
                )}{" "}
                PKR/TRY
              </p>
              <p className="text-slate-600">
                Fees: -{formatCurrency(t.total_fees_pkr, "PKR")}
              </p>
              <p className={`font-semibold ${profitClass(t.net_profit_pkr)}`}>
                Net: {formatCurrency(t.net_profit_pkr, "PKR")}
              </p>
            </div>
          </div>
        )}

        {t.description && (
          <p className="mt-3 text-xs text-slate-500">Note: {t.description}</p>
        )}
      </td>
    </tr>
  );
}

export function TransactionTable({
  transactions,
  onDelete,
}: TransactionTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Transaction deleted");
      onDelete(id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
        No transactions found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                Type
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                TRY
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                USDT / Spread
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                PKR Received
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                Net Profit
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const isUsdt = t.transaction_type === "usdt_trade";
              const isExpanded = expandedId === t.id;

              return (
                <>
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        {format(new Date(t.date), "dd MMM yyyy")}
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          isUsdt
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {isUsdt ? "USDT" : "Direct"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatNumber(t.try_amount, 0)}
                    </td>

                    {/* USDT amount for usdt_trade, spread for direct */}
                    <td className="px-4 py-3 text-right text-slate-500">
                      {isUsdt
                        ? formatNumber(t.usdt_amount ?? 0, 2) + " USDT"
                        : "+" +
                          formatNumber(
                            (t.sell_rate_pkr_per_try ?? 0) - t.pkr_per_try_rate,
                            4
                          ) +
                          " PKR/TRY"}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(t.pkr_received, "PKR")}
                    </td>

                    <td
                      className={`px-4 py-3 text-right font-semibold ${profitClass(
                        t.net_profit_pkr
                      )}`}
                    >
                      {t.net_profit_pkr >= 0 ? "+" : ""}
                      {formatCurrency(t.net_profit_pkr, "PKR")}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[t.status] ?? ""
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                        disabled={deletingId === t.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {isExpanded && <ExpandedRow key={`${t.id}-expanded`} t={t} />}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
