import Link from "next/link";
import { format } from "date-fns";
import type { Transaction } from "@/types";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">
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
          <Link
            href="/transactions/new"
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Record your first trade
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">
                  Date
                </th>
                <th className="text-right py-2 pr-4 text-xs font-medium text-slate-500">
                  TRY
                </th>
                <th className="text-right py-2 pr-4 text-xs font-medium text-slate-500">
                  USDT
                </th>
                <th className="text-right py-2 text-xs font-medium text-slate-500">
                  Net Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-2.5 pr-4 text-slate-600">
                    {format(new Date(t.date), "dd MMM yyyy")}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-700 font-medium">
                    {formatNumber(t.try_amount, 0)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-500">
                    {t.transaction_type === "direct_exchange" ? "—" : formatNumber(t.usdt_amount ?? 0, 2)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${profitClass(
                      t.net_profit_pkr
                    )}`}
                  >
                    {t.net_profit_pkr >= 0 ? "+" : ""}
                    {formatCurrency(t.net_profit_pkr, "PKR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
