"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Trash2, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import type { Transaction } from "@/types";
import {
  isBuyType,
  isSellType,
  isLegacyType,
  TRANSACTION_TYPE_LABELS,
} from "@/types";

// ─── Badge colours per type ──────────────────────────────────
const TYPE_BADGE: Record<string, string> = {
  pkr_to_try:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  try_to_pkr:      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  try_to_usdt:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  usdt_to_pkr:     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  usdt_trade:      "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
  direct_exchange: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// ─── Expanded row detail ──────────────────────────────────────
function ExpandedDetail({ t }: { t: Transaction }) {
  const type = t.transaction_type;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
      {type === "pkr_to_try" && (
        <>
          <Cell label="PKR Spent"        value={formatCurrency(t.pkr_cost ?? 0, "PKR")} />
          <Cell label="Buy Rate"         value={`${t.pkr_per_try_rate} PKR/TRY`} />
          <Cell label="TRY Received"     value={`${formatNumber(t.try_amount ?? 0, 2)} TRY`} bold />
          <Cell label="Remaining (open)" value={`${formatNumber(t.remaining_amount ?? 0, 2)} TRY`}
                highlight={t.remaining_amount ? "blue" : undefined} />
        </>
      )}

      {type === "try_to_pkr" && (
        <>
          <Cell label="TRY Sold"         value={`${formatNumber(t.try_amount ?? 0, 2)} TRY`} />
          <Cell label="Sell Rate"        value={`${t.pkr_per_try_rate} PKR/TRY`} />
          <Cell label="Cost Basis (FIFO)" value={formatCurrency(t.pkr_cost ?? 0, "PKR")} />
          <Cell label="PKR Received"     value={formatCurrency(t.pkr_received ?? 0, "PKR")} bold />
          <Cell label="Gross Profit"     value={formatCurrency(t.gross_profit_pkr ?? 0, "PKR")} />
          <Cell label="Fees"             value={`- ${formatCurrency(t.total_fees_pkr, "PKR")}`} />
          <Cell label="Net Profit"       value={formatCurrency(t.net_profit_pkr ?? 0, "PKR")}
                bold profitColour={t.net_profit_pkr ?? 0} />
        </>
      )}

      {type === "try_to_usdt" && (
        <>
          <Cell label="TRY Converted"    value={`${formatNumber(t.try_amount ?? 0, 2)} TRY`} />
          <Cell label="Rate"             value={`${t.try_per_usdt_rate} TRY/USDT`} />
          <Cell label="USDT Received"    value={`${formatNumber(t.usdt_amount ?? 0, 4)} USDT`} bold />
          <Cell label="TRY Cost Basis"   value={formatCurrency(t.pkr_cost ?? 0, "PKR")} />
          <Cell label="Remaining USDT"   value={`${formatNumber(t.remaining_amount ?? 0, 4)} USDT`}
                highlight={t.remaining_amount ? "orange" : undefined} />
        </>
      )}

      {type === "usdt_to_pkr" && (
        <>
          <Cell label="USDT Sold"        value={`${formatNumber(t.usdt_amount ?? 0, 4)} USDT`} />
          <Cell label="Rate"             value={`${t.pkr_per_usdt_rate} PKR/USDT`} />
          <Cell label="Cost Basis (FIFO)" value={formatCurrency(t.pkr_cost ?? 0, "PKR")} />
          <Cell label="PKR Received"     value={formatCurrency(t.pkr_received ?? 0, "PKR")} bold />
          <Cell label="Gross Profit"     value={formatCurrency(t.gross_profit_pkr ?? 0, "PKR")} />
          <Cell label="Fees"             value={`- ${formatCurrency(t.total_fees_pkr, "PKR")}`} />
          <Cell label="Net Profit"       value={formatCurrency(t.net_profit_pkr ?? 0, "PKR")}
                bold profitColour={t.net_profit_pkr ?? 0} />
        </>
      )}

      {/* Legacy: usdt_trade */}
      {type === "usdt_trade" && (
        <>
          <Cell label="TRY Cost"    value={formatCurrency(t.pkr_cost ?? 0, "PKR")} />
          <Cell label="USDT"        value={`${formatNumber(t.usdt_amount ?? 0, 4)} USDT`} />
          <Cell label="PKR Received" value={formatCurrency(t.pkr_received ?? 0, "PKR")} />
          <Cell label="Net Profit"   value={formatCurrency(t.net_profit_pkr ?? 0, "PKR")}
                bold profitColour={t.net_profit_pkr ?? 0} />
        </>
      )}

      {/* Legacy: direct_exchange */}
      {type === "direct_exchange" && (
        <>
          <Cell label="TRY"       value={`${formatNumber(t.try_amount ?? 0, 0)} TRY`} />
          <Cell label="Buy Rate"  value={`${t.pkr_per_try_rate} PKR/TRY`} />
          <Cell label="Sell Rate" value={`${t.sell_rate_pkr_per_try} PKR/TRY`} />
          <Cell label="Net Profit" value={formatCurrency(t.net_profit_pkr ?? 0, "PKR")}
                bold profitColour={t.net_profit_pkr ?? 0} />
        </>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  bold,
  highlight,
  profitColour,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: "blue" | "orange" | "green";
  profitColour?: number;
}) {
  const highlightClass =
    highlight === "blue"
      ? "text-blue-600 dark:text-blue-400"
      : highlight === "orange"
      ? "text-orange-600 dark:text-orange-400"
      : "";

  const valueClass =
    profitColour !== undefined
      ? profitClass(profitColour)
      : bold
      ? "font-semibold text-slate-900 dark:text-slate-100"
      : "text-slate-700 dark:text-slate-200";

  return (
    <div>
      <p className="text-slate-400 font-medium mb-0.5">{label}</p>
      <p className={`${valueClass} ${highlightClass}`}>{value}</p>
    </div>
  );
}

// ─── Summary row for buy types ─────────────────────────────────
function RemainingBadge({ t }: { t: Transaction }) {
  if (!isBuyType(t.transaction_type)) return null;
  const remaining = t.remaining_amount ?? 0;
  const total = t.transaction_type === "pkr_to_try"
    ? (t.try_amount ?? 0)
    : (t.usdt_amount ?? 0);
  const unit = t.transaction_type === "pkr_to_try" ? "TRY" : "USDT";
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;

  if (remaining <= 0) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
        fully matched
      </span>
    );
  }

  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      {formatNumber(remaining, unit === "USDT" ? 4 : 2)} {unit} left ({pct}%)
    </span>
  );
}

// ─── Main export ──────────────────────────────────────────────
export interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export function TransactionTable({ transactions, onDelete }: TransactionTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Transaction deleted");
      onDelete(id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-sm">
        No transactions found
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Description</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">From</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">To / Remaining</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Net Profit</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const isExpanded = expandedId === t.id;
              const type = t.transaction_type;
              const isLegacy = isLegacyType(type);

              // Compute display values for the summary row
              const fromValue = (() => {
                if (type === "pkr_to_try")     return formatCurrency(t.pkr_cost ?? 0, "PKR");
                if (type === "try_to_pkr")     return `${formatNumber(t.try_amount ?? 0, 2)} TRY`;
                if (type === "try_to_usdt")    return `${formatNumber(t.try_amount ?? 0, 2)} TRY`;
                if (type === "usdt_to_pkr")    return `${formatNumber(t.usdt_amount ?? 0, 4)} USDT`;
                if (type === "usdt_trade")     return `${formatNumber(t.try_amount ?? 0, 0)} TRY`;
                if (type === "direct_exchange") return `${formatNumber(t.try_amount ?? 0, 0)} TRY`;
                return "—";
              })();

              const toValue = (() => {
                if (type === "pkr_to_try")     return `${formatNumber(t.try_amount ?? 0, 2)} TRY`;
                if (type === "try_to_pkr")     return formatCurrency(t.pkr_received ?? 0, "PKR");
                if (type === "try_to_usdt")    return `${formatNumber(t.usdt_amount ?? 0, 4)} USDT`;
                if (type === "usdt_to_pkr")    return formatCurrency(t.pkr_received ?? 0, "PKR");
                if (type === "usdt_trade")     return formatCurrency(t.pkr_received ?? 0, "PKR");
                if (type === "direct_exchange") return formatCurrency(t.pkr_received ?? 0, "PKR");
                return "—";
              })();

              const hasProfit = isSellType(type) || isLegacy;
              const netProfit = t.net_profit_pkr ?? 0;

              return (
                <>
                  <tr
                    key={t.id}
                    className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer ${
                      isLegacy ? "opacity-60" : ""
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                        {format(new Date(t.date + "T00:00:00"), "dd MMM yyyy")}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[type] ?? ""}`}>
                          {TRANSACTION_TYPE_LABELS[type] ?? type}
                        </span>
                        {isBuyType(type) && <RemainingBadge t={t} />}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell max-w-[150px] truncate">
                      <div className="flex items-center gap-1">
                        {t.description && <span className="truncate">{t.description}</span>}
                        {t.attachments && t.attachments.length > 0 && (
                          <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" title={`${t.attachments.length} attachment(s)`} />
                        )}
                      </div>
                    </td>

                    {/* From */}
                    <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {fromValue}
                    </td>

                    {/* To / Remaining */}
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {toValue}
                    </td>

                    {/* Net Profit */}
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${hasProfit ? profitClass(netProfit) : "text-slate-300 dark:text-slate-600"}`}>
                      {hasProfit
                        ? `${netProfit >= 0 ? "+" : ""}${formatCurrency(netProfit, "PKR")}`
                        : "—"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                        disabled={deletingId === t.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${t.id}-exp`}>
                      <td
                        colSpan={8}
                        className="bg-slate-50 dark:bg-slate-900/40 px-6 py-4 border-b border-slate-200 dark:border-slate-700"
                      >
                        <ExpandedDetail t={t} />
                        {t.description && (
                          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Note: {t.description}
                          </p>
                        )}
                        {isLegacy && (
                          <p className="mt-2 text-xs text-slate-400 italic">
                            Legacy transaction — recorded before the new system.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
