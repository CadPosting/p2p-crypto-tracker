import { TrendingUp, TrendingDown, ArrowLeftRight, DollarSign } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface StatsCardsProps {
  totalNetProfit: number;
  totalTransactions: number;
  totalTry: number;
  totalUsdt: number;
  totalPkrReceived: number;
  periodLabel: string;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  positive?: boolean | null;
}

function StatCard({ title, value, subtitle, icon, positive }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {title}
        </p>
        <p
          className={`text-2xl font-bold mt-1 ${
            positive === true
              ? "text-green-600"
              : positive === false
              ? "text-red-600"
              : "text-slate-900"
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex-shrink-0 p-2.5 rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </div>
    </div>
  );
}

export function StatsCards({
  totalNetProfit,
  totalTransactions,
  totalTry,
  totalUsdt,
  totalPkrReceived,
  periodLabel,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        title={`Net Profit (${periodLabel})`}
        value={formatCurrency(totalNetProfit, "PKR")}
        icon={
          totalNetProfit >= 0 ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )
        }
        positive={totalNetProfit > 0 ? true : totalNetProfit < 0 ? false : null}
      />
      <StatCard
        title="Transactions"
        value={totalTransactions.toString()}
        subtitle={periodLabel}
        icon={<ArrowLeftRight className="w-5 h-5" />}
      />
      <StatCard
        title="TRY Processed"
        value={formatNumber(totalTry, 0) + " TRY"}
        subtitle={formatNumber(totalUsdt, 2) + " USDT"}
        icon={<DollarSign className="w-5 h-5" />}
      />
      <StatCard
        title="PKR Received"
        value={formatCurrency(totalPkrReceived, "PKR")}
        subtitle={periodLabel}
        icon={<DollarSign className="w-5 h-5" />}
      />
    </div>
  );
}
