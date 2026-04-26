import Link from "next/link";
import { format } from "date-fns";
import type { Transaction } from "@/types";
import { isSellType, isBuyType, TRANSACTION_TYPE_LABELS } from "@/types";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const TYPE_DOT: Record<string, string> = {
  pkr_to_try:      "bg-blue-500",
  try_to_pkr:      "bg-green-500",
  try_to_usdt:     "bg-orange-500",
  usdt_to_pkr:     "bg-purple-500",
  usdt_trade:      "bg-slate-400",
  direct_exchange: "bg-slate-400",
};

function getAmountDisplay(t: Transaction): string {
  const type = t.transaction_type;
  if (type === "pkr_to_try")
    return `${formatNumber(t.try_amount ?? 0, 0)} TRY`;
  if (type === "try_to_pkr")
    return `${formatNumber(t.try_amount ?? 0, 0)} TRY`;
  if (type === "try_to_usdt")
    return `${formatNumber(t.usdt_amount ?? 0, 4)} USDT`;
  if (type === "usdt_to_pkr")
    return `${formatNumber(t.usdt_amount ?? 0, 4)} USDT`;
  // Legacy
  return `${formatNumber(t.try_amount ?? 0, 0)} TRY`;
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Recent Transactions
        </h2>
        <Link
          href="/transactions"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <p className="text-sm">No transactions yet</p>
          <Link href="/transactions/new" className="mt-2 text-xs text-blue-600 hover:underline">
            Record your first trade
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {transactions.map((t) => {
            const netProfit = t.net_profit_pkr ?? 0;
            const hasPnl = isSellType(t.transaction_type);
            const isBuy = isBuyType(t.transaction_type);

            return (
              <div
                key={t.id}
                className="flex items-center gap-3 py-2.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0"
              >
                {/* Type dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[t.transaction_type] ?? "bg-slate-400"}`} />

                {/* Date + type */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {format(new Date(t.date + "T00:00:00"), "dd MMM")}
                    {" · "}
                    <span className="text-slate-400 dark:text-slate-500">
                      {TRANSACTION_TYPE_LABELS[t.transaction_type]}
                    </span>
                  </p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {getAmountDisplay(t)}
                    {isBuy && t.remaining_amount != null && (
                      <span className="text-xs text-amber-500 ml-1">
                        ({formatNumber(t.remaining_amount, t.transaction_type === "try_to_usdt" ? 4 : 0)} left)
                      </span>
                    )}
                  </p>
                </div>

                {/* Profit or placeholder */}
                <div className="text-right flex-shrink-0">
                  {hasPnl ? (
                    <p className={`text-sm font-semibold ${profitClass(netProfit)}`}>
                      {netProfit >= 0 ? "+" : ""}
                      {formatCurrency(netProfit, "PKR")}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 dark:text-slate-600">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
