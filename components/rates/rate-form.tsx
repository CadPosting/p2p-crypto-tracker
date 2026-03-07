"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { RateAd } from "@/types";
import { X } from "lucide-react";

const schema = z.object({
  ad_name: z.string().min(1, "Ad name is required"),
  platform: z.string().min(1, "Platform is required"),
  usdt_try_rate: z.coerce.number().positive("Must be > 0"),
  usdt_pkr_rate: z.coerce.number().positive("Must be > 0"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RateFormProps {
  onSuccess: (rate: RateAd) => void;
  onClose: () => void;
  existing?: RateAd;
}

export function RateForm({ onSuccess, onClose, existing }: RateFormProps) {
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          ad_name: existing.ad_name,
          platform: existing.platform,
          usdt_try_rate: existing.usdt_try_rate,
          usdt_pkr_rate: existing.usdt_pkr_rate,
          notes: existing.notes ?? "",
        }
      : {
          platform: "Binance",
        },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (existing) {
        const { data, error } = await supabase
          .from("rate_ads")
          .update(values)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        toast.success("Rate updated!");
        onSuccess(data);
      } else {
        const { data, error } = await supabase
          .from("rate_ads")
          .insert(values)
          .select()
          .single();
        if (error) throw error;
        toast.success("Rate ad saved!");
        onSuccess(data);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {existing ? "Edit Rate Ad" : "Add Rate Ad"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ad Name *
              </label>
              <input
                type="text"
                {...register("ad_name")}
                placeholder="e.g. Binance Ad – Ahmed"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.ad_name && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.ad_name.message}
                </p>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Platform
              </label>
              <select
                {...register("platform")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Binance">Binance</option>
                <option value="OKX">OKX</option>
                <option value="Bybit">Bybit</option>
                <option value="KuCoin">KuCoin</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                TRY / USDT Rate
                <span className="text-slate-400 font-normal ml-1 text-xs">
                  (buy USDT with TRY)
                </span>
              </label>
              <input
                type="number"
                step="0.0001"
                {...register("usdt_try_rate")}
                placeholder="e.g. 44"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.usdt_try_rate && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.usdt_try_rate.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PKR / USDT Rate
                <span className="text-slate-400 font-normal ml-1 text-xs">
                  (sell USDT for PKR)
                </span>
              </label>
              <input
                type="number"
                step="0.0001"
                {...register("usdt_pkr_rate")}
                placeholder="e.g. 293.5"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.usdt_pkr_rate && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.usdt_pkr_rate.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              {...register("notes")}
              placeholder="Any notes about this ad…"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving…" : existing ? "Update" : "Add Rate Ad"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
