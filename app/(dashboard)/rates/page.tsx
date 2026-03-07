"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { RateForm } from "@/components/rates/rate-form";
import { RateTable } from "@/components/rates/rate-table";
import type { RateAd } from "@/types";
import { Plus, Info } from "lucide-react";

export default function RatesPage() {
  const [rates, setRates] = useState<RateAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<RateAd | null>(null);

  // Reference PKR/TRY rate for margin calculation
  // User enters this manually to see estimated profit margins
  const [refPkrPerTry, setRefPkrPerTry] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    async function fetchRates() {
      const { data } = await supabase
        .from("rate_ads")
        .select("*")
        .order("platform")
        .order("ad_name");
      setRates(data ?? []);
      setLoading(false);
    }
    fetchRates();
  }, []);

  function handleSuccess(rate: RateAd) {
    setRates((prev) => {
      const idx = prev.findIndex((r) => r.id === rate.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = rate;
        return updated;
      }
      return [...prev, rate];
    });
    setShowForm(false);
    setEditingRate(null);
  }

  function handleEdit(rate: RateAd) {
    setEditingRate(rate);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setRates((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rate Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Save your P2P ad rates for quick use when recording trades
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRate(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rate Ad
        </button>
      </div>

      {/* How it works explainer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How Rate Ads work</p>
          <p className="text-blue-700">
            Save the rates from your P2P listings here. When recording a trade,
            you can select a rate ad to auto-fill the TRY/USDT and PKR/USDT
            rates. Enter a reference PKR/TRY rate below to see estimated profit
            margins for each ad.
          </p>
        </div>
      </div>

      {/* Reference rate for margin calculator */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
          Reference PKR / TRY rate:
        </label>
        <input
          type="number"
          step="0.0001"
          value={refPkrPerTry || ""}
          onChange={(e) => setRefPkrPerTry(Number(e.target.value))}
          placeholder="e.g. 6.5"
          className="w-full sm:w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400">
          Used only for displaying estimated margins — not saved.
        </p>
      </div>

      {/* Rate ads table */}
      {loading ? (
        <div className="text-sm text-slate-400 text-center py-12">
          Loading rate ads…
        </div>
      ) : (
        <RateTable
          rates={rates}
          pkrPerTryReference={refPkrPerTry}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {showForm && (
        <RateForm
          onSuccess={handleSuccess}
          onClose={() => {
            setShowForm(false);
            setEditingRate(null);
          }}
          existing={editingRate ?? undefined}
        />
      )}
    </div>
  );
}
