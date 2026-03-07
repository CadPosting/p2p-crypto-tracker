"use client";

import { Pencil, Trash2, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { RateAd } from "@/types";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";

interface RateTableProps {
  rates: RateAd[];
  pkrPerTryReference: number; // Used to calculate effective margin
  onEdit: (rate: RateAd) => void;
  onDelete: (id: string) => void;
}

export function RateTable({
  rates,
  pkrPerTryReference,
  onEdit,
  onDelete,
}: RateTableProps) {
  const supabase = createClient();

  async function handleDelete(rate: RateAd) {
    if (!confirm(`Delete rate ad "${rate.ad_name}"?`)) return;

    const { error } = await supabase
      .from("rate_ads")
      .delete()
      .eq("id", rate.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Rate ad deleted");
    onDelete(rate.id);
  }

  if (rates.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
        No rate ads saved. Click &ldquo;Add Rate Ad&rdquo; to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {pkrPerTryReference > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Margin calculated using reference PKR/TRY rate:{" "}
          <span className="font-semibold">{pkrPerTryReference}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                Ad Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                Platform
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                TRY / USDT
                <span className="block font-normal text-slate-400">
                  buy price
                </span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                PKR / USDT
                <span className="block font-normal text-slate-400">
                  sell price
                </span>
              </th>
              {pkrPerTryReference > 0 && (
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                  Est. Margin
                  <span className="block font-normal text-slate-400">
                    per USDT trade
                  </span>
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                Added
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => {
              // Margin: (PKR sell - PKR cost per USDT) / PKR cost per USDT × 100
              const pkrCostPerUsdt =
                pkrPerTryReference > 0
                  ? rate.usdt_try_rate * pkrPerTryReference
                  : 0;
              const marginPct =
                pkrCostPerUsdt > 0
                  ? ((rate.usdt_pkr_rate - pkrCostPerUsdt) / pkrCostPerUsdt) *
                    100
                  : 0;
              const profitPerUsdt =
                pkrCostPerUsdt > 0
                  ? rate.usdt_pkr_rate - pkrCostPerUsdt
                  : 0;

              return (
                <tr
                  key={rate.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {rate.ad_name}
                    {rate.notes && (
                      <p className="text-xs text-slate-400 font-normal mt-0.5">
                        {rate.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{rate.platform}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {formatNumber(rate.usdt_try_rate, 4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {formatNumber(rate.usdt_pkr_rate, 4)}
                  </td>
                  {pkrPerTryReference > 0 && (
                    <td className="px-4 py-3 text-right">
                      {pkrCostPerUsdt > 0 ? (
                        <div>
                          <span
                            className={`font-semibold ${
                              marginPct >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {marginPct >= 0 ? "+" : ""}
                            {formatNumber(marginPct, 2)}%
                          </span>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {profitPerUsdt >= 0 ? "+" : ""}
                            {formatNumber(profitPerUsdt, 2)} PKR/USDT
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {format(new Date(rate.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(rate)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rate)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
