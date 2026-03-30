"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, ArrowLeftRight, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calculateTrade,
  calculateDirectExchange,
  sumFees,
} from "@/lib/calculations";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import type { Account, RateAd, TransactionType } from "@/types";
import { format } from "date-fns";

// ------------- Zod Schemas (one per mode) -------------------

const baseFields = {
  date: z.string().min(1, "Date is required"),
  description: z.string().max(500, "Max 500 characters").optional(),
  try_amount: z.coerce.number().positive("Must be > 0"),
  pkr_per_try_rate: z.coerce.number().positive("Must be > 0"),
  try_account_id: z.string().optional(),
  pkr_account_id: z.string().optional(),
  status: z.enum(["pending", "completed", "cancelled"]),
  fees: z.array(
    z.object({
      description: z.string().min(1, "Fee name required").max(100, "Max 100 characters"),
      amount_pkr: z.coerce.number().min(0),
    })
  ),
};

const usdtSchema = z.object({
  ...baseFields,
  transaction_type: z.literal("usdt_trade"),
  try_per_usdt_rate: z.coerce.number().positive("Must be > 0"),
  pkr_per_usdt_rate: z.coerce.number().positive("Must be > 0"),
  rate_ad_id: z.string().optional(),
  // not used in this mode
  sell_rate_pkr_per_try: z.coerce.number().optional(),
});

const directSchema = z.object({
  ...baseFields,
  transaction_type: z.literal("direct_exchange"),
  sell_rate_pkr_per_try: z.coerce.number().positive("Must be > 0"),
  // not used in this mode
  try_per_usdt_rate: z.coerce.number().optional(),
  pkr_per_usdt_rate: z.coerce.number().optional(),
  rate_ad_id: z.string().optional(),
});

const schema = z.discriminatedUnion("transaction_type", [
  usdtSchema,
  directSchema,
]);

type FormValues = z.infer<typeof schema>;

// ------------- Helper: Labelled field wrapper ----------------
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {hint && (
          <span className="text-slate-400 font-normal ml-1 text-xs">
            ({hint})
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ------------- Main Component --------------------------------
export function TransactionForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<TransactionType>("usdt_trade");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rateAds, setRateAds] = useState<RateAd[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction_type: "usdt_trade",
      date: format(new Date(), "yyyy-MM-dd"),
      status: "completed",
      fees: [],
    } as unknown as FormValues,
  });

  const watched = useWatch({ control });

  const { fields: feeFields, append: addFee, remove: removeFee } =
    useFieldArray({ control, name: "fees" });

  // Load accounts and rate ads on mount
  useEffect(() => {
    async function load() {
      const [{ data: accs }, { data: rates }] = await Promise.all([
        supabase.from("accounts").select("*").order("name"),
        supabase.from("rate_ads").select("*").order("ad_name"),
      ]);
      setAccounts(accs ?? []);
      setRateAds(rates ?? []);
    }
    load();
  }, []);

  // When user switches mode, reset to defaults for that mode
  function switchMode(newMode: TransactionType) {
    setMode(newMode);
    reset({
      transaction_type: newMode,
      date: format(new Date(), "yyyy-MM-dd"),
      status: "completed",
      fees: [],
    } as unknown as FormValues);
  }

  // ---------- Live calculation ----------
  const calc = useMemo(() => {
    const fees = (watched.fees ?? []).map((f) => ({
      amount_pkr: Number(f?.amount_pkr) || 0,
    }));
    const totalFees = sumFees(fees);
    const tryAmount = Number(watched.try_amount) || 0;
    const buyRate = Number(watched.pkr_per_try_rate) || 0;

    if (mode === "usdt_trade") {
      return calculateTrade(
        tryAmount,
        buyRate,
        Number(watched.try_per_usdt_rate) || 0,
        Number(watched.pkr_per_usdt_rate) || 0,
        totalFees
      );
    } else {
      return calculateDirectExchange(
        tryAmount,
        buyRate,
        Number(watched.sell_rate_pkr_per_try) || 0,
        totalFees
      );
    }
  }, [
    mode,
    watched.try_amount,
    watched.pkr_per_try_rate,
    watched.try_per_usdt_rate,
    watched.pkr_per_usdt_rate,
    watched.sell_rate_pkr_per_try,
    watched.fees,
  ]);

  // Auto-fill rates from a saved rate ad
  function handleRateAdSelect(rateAdId: string) {
    const ad = rateAds.find((r) => r.id === rateAdId);
    if (ad && mode === "usdt_trade") {
      setValue("try_per_usdt_rate" as never, ad.usdt_try_rate as never);
      setValue("pkr_per_usdt_rate" as never, ad.usdt_pkr_rate as never);
    }
  }

  // ---------- Submit ----------
  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const totalFeesPkr = sumFees(values.fees);

      let insertData: Record<string, unknown>;

      if (values.transaction_type === "usdt_trade") {
        const trade = calculateTrade(
          values.try_amount,
          values.pkr_per_try_rate,
          values.try_per_usdt_rate ?? 0,
          values.pkr_per_usdt_rate ?? 0,
          totalFeesPkr
        );
        insertData = {
          transaction_type: "usdt_trade",
          date: values.date,
          description: values.description || null,
          try_amount: values.try_amount,
          pkr_per_try_rate: values.pkr_per_try_rate,
          pkr_cost: trade.pkrCost,
          try_per_usdt_rate: values.try_per_usdt_rate,
          usdt_amount: trade.usdtAmount,
          pkr_per_usdt_rate: values.pkr_per_usdt_rate,
          pkr_received: trade.pkrReceived,
          total_fees_pkr: totalFeesPkr,
          gross_profit_pkr: trade.grossProfit,
          net_profit_pkr: trade.netProfit,
          try_account_id: values.try_account_id || null,
          pkr_account_id: values.pkr_account_id || null,
          rate_ad_id: values.rate_ad_id || null,
          status: values.status,
          sell_rate_pkr_per_try: null,
        };
      } else {
        const trade = calculateDirectExchange(
          values.try_amount,
          values.pkr_per_try_rate,
          values.sell_rate_pkr_per_try ?? 0,
          totalFeesPkr
        );
        insertData = {
          transaction_type: "direct_exchange",
          date: values.date,
          description: values.description || null,
          try_amount: values.try_amount,
          pkr_per_try_rate: values.pkr_per_try_rate,
          pkr_cost: trade.pkrCost,
          try_per_usdt_rate: null,
          usdt_amount: null,
          pkr_per_usdt_rate: null,
          pkr_received: trade.pkrReceived,
          sell_rate_pkr_per_try: values.sell_rate_pkr_per_try,
          total_fees_pkr: totalFeesPkr,
          gross_profit_pkr: trade.grossProfit,
          net_profit_pkr: trade.netProfit,
          try_account_id: values.try_account_id || null,
          pkr_account_id: values.pkr_account_id || null,
          rate_ad_id: null,
          status: values.status,
        };
      }

      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert(insertData)
        .select()
        .single();

      if (txnError) throw txnError;

      // Insert itemised fees
      if (values.fees.length > 0 && txn) {
        const { error: feesError } = await supabase
          .from("transaction_fees")
          .insert(
            values.fees.map((fee) => ({
              transaction_id: txn.id,
              description: fee.description,
              amount_pkr: fee.amount_pkr,
            }))
          );
        if (feesError) throw feesError;
      }

      toast.success("Trade recorded!");
      router.push("/transactions");
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const tryAccounts = accounts.filter((a) => a.currency === "TRY");
  const pkrAccounts = accounts.filter((a) => a.currency === "PKR");

  // Narrow the error type for fields that differ by mode
  const formErrors = errors as Record<string, { message?: string }>;

  // ---------- Render ----------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">

      {/* ── Mode selector ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("usdt_trade")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors ${
            mode === "usdt_trade"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          USDT Trade
          <span
            className={`text-xs font-normal ${
              mode === "usdt_trade" ? "text-blue-200" : "text-slate-400"
            }`}
          >
            TRY → USDT → PKR
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchMode("direct_exchange")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors ${
            mode === "direct_exchange"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Direct Exchange
          <span
            className={`text-xs font-normal ${
              mode === "direct_exchange" ? "text-purple-200" : "text-slate-400"
            }`}
          >
            TRY ↔ PKR
          </span>
        </button>
      </div>

      {/* Hidden field for transaction_type */}
      <input type="hidden" {...register("transaction_type")} value={mode} />

      {/* ── Basic info ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Trade Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date" error={formErrors.date?.message}>
            <input
              type="date"
              {...register("date")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="Status">
            <select
              {...register("status")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>

        <Field label="Description" hint="optional">
          <input
            type="text"
            {...register("description")}
            placeholder={
              mode === "usdt_trade"
                ? "e.g. Ahmed – 10k TRY USDT trade"
                : "e.g. Ali – bought 5k TRY at 6.8"
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      </section>

      {/* ════════════════════════════════════════════════════
          USDT TRADE MODE
          ════════════════════════════════════════════════════ */}
      {mode === "usdt_trade" && (
        <>
          {/* Rate Ad quick-fill */}
          {rateAds.length > 0 && (
            <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 mb-2">
                Quick-fill from saved Rate Ad
              </p>
              <select
                onChange={(e) => handleRateAdSelect(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                defaultValue=""
              >
                <option value="" disabled>
                  Select a rate ad…
                </option>
                {rateAds.map((ad) => (
                  <option key={ad.id} value={ad.id}>
                    {ad.ad_name} — {ad.usdt_try_rate} TRY/USDT · {ad.usdt_pkr_rate} PKR/USDT
                  </option>
                ))}
              </select>
              <input type="hidden" {...register("rate_ad_id" as never)} />
            </section>
          )}

          {/* Step 1 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <StepBadge n={1} />
              <h2 className="text-sm font-semibold text-slate-700">
                TRY Acquisition Cost
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              How much TRY did you receive, and what PKR rate did you pay?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="TRY Amount"
                hint="TRY received"
                error={formErrors.try_amount?.message}
              >
                <input
                  type="number"
                  step="0.01"
                  {...register("try_amount")}
                  placeholder="e.g. 10000"
                  className="input"
                />
              </Field>

              <Field
                label="PKR / TRY Rate"
                hint="PKR cost per 1 TRY"
                error={formErrors.pkr_per_try_rate?.message}
              >
                <input
                  type="number"
                  step="0.0001"
                  {...register("pkr_per_try_rate")}
                  placeholder="e.g. 6.5"
                  className="input"
                />
              </Field>
            </div>

            {calc.pkrCost > 0 && (
              <Pill>
                PKR Cost ={" "}
                <strong>{formatCurrency(calc.pkrCost, "PKR")}</strong>
              </Pill>
            )}

            <Field label="TRY Account" hint="optional">
              <AccountSelect
                {...register("try_account_id" as never)}
                options={tryAccounts}
                currency="TRY"
              />
            </Field>
          </section>

          {/* Step 2 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <StepBadge n={2} />
              <h2 className="text-sm font-semibold text-slate-700">
                TRY → USDT (P2P Buy)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              At what rate did you buy USDT with TRY?
            </p>

            <Field
              label="TRY / USDT Rate"
              hint="TRY per 1 USDT — P2P buy price"
              error={formErrors.try_per_usdt_rate?.message}
            >
              <input
                type="number"
                step="0.0001"
                {...register("try_per_usdt_rate" as never)}
                placeholder="e.g. 44"
                className="input sm:w-64"
              />
            </Field>

            {"usdtAmount" in calc && calc.usdtAmount > 0 && (
              <Pill>
                USDT Received ={" "}
                <strong>
                  {formatNumber((calc as { usdtAmount: number }).usdtAmount, 4)} USDT
                </strong>
              </Pill>
            )}
          </section>

          {/* Step 3 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <StepBadge n={3} />
              <h2 className="text-sm font-semibold text-slate-700">
                USDT → PKR (P2P Sell)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              At what rate did you sell USDT for PKR?
            </p>

            <Field
              label="PKR / USDT Rate"
              hint="PKR per 1 USDT — P2P sell price"
              error={formErrors.pkr_per_usdt_rate?.message}
            >
              <input
                type="number"
                step="0.0001"
                {...register("pkr_per_usdt_rate" as never)}
                placeholder="e.g. 293.5"
                className="input sm:w-64"
              />
            </Field>

            {calc.pkrReceived > 0 && (
              <Pill>
                PKR Received ={" "}
                <strong>{formatCurrency(calc.pkrReceived, "PKR")}</strong>
              </Pill>
            )}

            <Field label="PKR Account" hint="optional">
              <AccountSelect
                {...register("pkr_account_id" as never)}
                options={pkrAccounts}
                currency="PKR"
              />
            </Field>
          </section>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          DIRECT EXCHANGE MODE
          ════════════════════════════════════════════════════ */}
      {mode === "direct_exchange" && (
        <section className="bg-white rounded-xl border border-purple-200 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-1">
              TRY ↔ PKR Exchange Rates
            </h2>
            <p className="text-xs text-slate-400">
              Your profit is the spread: (sell rate − buy rate) × TRY amount
            </p>
          </div>

          {/* TRY Amount */}
          <Field
            label="TRY Amount"
            error={formErrors.try_amount?.message}
          >
            <input
              type="number"
              step="0.01"
              {...register("try_amount")}
              placeholder="e.g. 10000"
              className="input sm:w-64"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Buy Rate */}
            <Field
              label="Buy Rate — PKR / TRY"
              hint="what you paid per TRY in PKR"
              error={formErrors.pkr_per_try_rate?.message}
            >
              <input
                type="number"
                step="0.0001"
                {...register("pkr_per_try_rate")}
                placeholder="e.g. 6.5"
                className="input"
              />
            </Field>

            {/* Sell Rate */}
            <Field
              label="Sell Rate — PKR / TRY"
              hint="what you received per TRY in PKR"
              error={formErrors.sell_rate_pkr_per_try?.message}
            >
              <input
                type="number"
                step="0.0001"
                {...register("sell_rate_pkr_per_try" as never)}
                placeholder="e.g. 6.8"
                className="input"
              />
            </Field>
          </div>

          {/* Live spread indicator */}
          {"spreadPerTry" in calc && (calc as { spreadPerTry: number }).spreadPerTry !== 0 && (
            <div className="flex items-center gap-4 bg-slate-50 rounded-lg px-4 py-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Spread</p>
                <p
                  className={`font-semibold ${
                    (calc as { spreadPerTry: number }).spreadPerTry > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {(calc as { spreadPerTry: number }).spreadPerTry > 0 ? "+" : ""}
                  {formatNumber((calc as { spreadPerTry: number }).spreadPerTry, 4)} PKR / TRY
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">PKR Spent</p>
                <p className="font-medium text-slate-700">
                  {formatCurrency(calc.pkrCost, "PKR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">PKR Received</p>
                <p className="font-medium text-slate-700">
                  {formatCurrency(calc.pkrReceived, "PKR")}
                </p>
              </div>
            </div>
          )}

          {/* Accounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="TRY Account" hint="optional">
              <AccountSelect
                {...register("try_account_id" as never)}
                options={tryAccounts}
                currency="TRY"
              />
            </Field>
            <Field label="PKR Account" hint="optional">
              <AccountSelect
                {...register("pkr_account_id" as never)}
                options={pkrAccounts}
                currency="PKR"
              />
            </Field>
          </div>
        </section>
      )}

      {/* ── Fees (same for both modes) ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Fees &amp; Charges{" "}
            <span className="text-slate-400 font-normal">(optional)</span>
          </h2>
          <button
            type="button"
            onClick={() => addFee({ description: "", amount_pkr: 0 })}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Fee
          </button>
        </div>

        {feeFields.length === 0 && (
          <p className="text-xs text-slate-400">
            No fees added. Click &ldquo;Add Fee&rdquo; to add bank charges, etc.
          </p>
        )}

        {feeFields.map((field, index) => (
          <div key={field.id} className="flex gap-3 items-start">
            <div className="flex-1">
              <input
                type="text"
                {...register(`fees.${index}.description`)}
                placeholder="e.g. Bank transfer fee"
                className="input w-full"
              />
            </div>
            <div className="w-36 relative">
              <input
                type="number"
                step="0.01"
                {...register(`fees.${index}.amount_pkr`)}
                placeholder="0"
                className="input w-full pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                PKR
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeFee(index)}
              className="mt-1 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>

      {/* ── Live Profit Summary ── */}
      <section
        className={`text-white rounded-xl p-6 space-y-3 ${
          mode === "direct_exchange" ? "bg-purple-900" : "bg-slate-900"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold">Live Profit Summary</h2>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              mode === "direct_exchange"
                ? "bg-purple-700 text-purple-200"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            {mode === "direct_exchange" ? "Direct Exchange" : "USDT Trade"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="text-slate-400">PKR Spent</div>
          <div className="text-right font-medium">
            {formatCurrency(calc.pkrCost, "PKR")}
          </div>

          <div className="text-slate-400">PKR Received</div>
          <div className="text-right font-medium">
            {formatCurrency(calc.pkrReceived, "PKR")}
          </div>

          {mode === "usdt_trade" && "usdtAmount" in calc && (
            <>
              <div className="text-slate-400">USDT Amount</div>
              <div className="text-right font-medium">
                {formatNumber((calc as { usdtAmount: number }).usdtAmount, 4)} USDT
              </div>
            </>
          )}

          {mode === "direct_exchange" && "spreadPerTry" in calc && (
            <>
              <div className="text-slate-400">Spread per TRY</div>
              <div className="text-right font-medium">
                {formatNumber((calc as { spreadPerTry: number }).spreadPerTry, 4)} PKR
              </div>
            </>
          )}

          <div className="text-slate-400">Total Fees</div>
          <div className="text-right font-medium text-orange-400">
            - {formatCurrency(sumFees((watched.fees ?? []).map(f => ({ amount_pkr: f.amount_pkr ?? 0 }))), "PKR")}
          </div>
        </div>

        <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-400">Gross Profit</p>
            <p className="font-semibold text-base">
              {formatCurrency(calc.grossProfit, "PKR")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Net Profit</p>
            <p className={`font-bold text-xl ${profitClass(calc.netProfit)}`}>
              {calc.netProfit >= 0 ? "+" : ""}
              {formatCurrency(calc.netProfit, "PKR")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Submit ── */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg text-sm font-medium transition-colors ${
            mode === "direct_exchange"
              ? "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400"
              : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
          }`}
        >
          {saving ? "Saving…" : "Save Trade"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ------------- Small shared sub-components ------------------

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
      {n}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-700">
      {children}
    </div>
  );
}

interface AccountSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Account[];
  currency: string;
}

const AccountSelect = ({ options, currency, ...props }: AccountSelectProps) => (
  <select
    {...props}
    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  >
    <option value="">— None —</option>
    {options.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name} ({a.bank_name ?? currency})
      </option>
    ))}
  </select>
);
