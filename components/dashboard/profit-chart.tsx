"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { DailySummary } from "@/types";

interface ProfitChartProps {
  data: DailySummary[];
}

// Custom tooltip shown when hovering over a bar
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  const isProfit = value >= 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
      <p className="text-xs text-slate-500 mb-1">
        {label ? format(parseISO(label), "dd MMM yyyy") : ""}
      </p>
      <p
        className={`text-sm font-bold ${
          isProfit ? "text-green-600" : "text-red-600"
        }`}
      >
        {isProfit ? "+" : ""}
        {new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)}{" "}
        PKR
      </p>
    </div>
  );
}

export function ProfitChart({ data }: ProfitChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Daily Net Profit (Last 30 Days)
        </h2>
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          No transactions in the last 30 days
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">
        Daily Net Profit (Last 30 Days)
      </h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={(val: string) => format(parseISO(val), "dd/MM")}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val: number) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#e2e8f0" />
            <Bar
              dataKey="total_net_profit"
              radius={[3, 3, 0, 0]}
              fill="#3b82f6"
              // Colour bars red when profit is negative
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
