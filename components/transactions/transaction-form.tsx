"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, ArrowDown, ArrowUp, Repeat, Coins } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  calculatePkrToTry,
  calculateTryToPkr,
  calculateTryToUsdt,
  calculateUsdtToPkr,
  sumFees,
} from "@/lib/calculations";
import {
  estimateFifoCost,
  executeFifoMatch,
  applyFifoUpdates,
  getAvailableBalance,
} from "@/lib/fifo";
import { formatCurrency, formatNumber, profitClass } from "@/lib/utils";
import type {
  Account,
  RateAd,
  NewTransactionType,
  BuyTransactionType,
  SellTransactionType,
} from "@/types";
import { isSellType } from "@/types";
import { AttachmentUpload, PendingAttachment } from "./attachment-upload";

// ============================================================
// Zod schemas — one per mode (discriminated union)
// ============================================================
const baseFields = {
  date: z.string().min(1, "Date is required"),
  description: z.string().max(500).optional(),
  status: z.enum(["pending", "completed", "cancelled"]),
  fees: z.array(
    z.object({
      description: z.string().min(1, "Fee name required").max(100),
      amount_pkr: z.coerce.number().min(0),
    })
  ),
  try_account_id: z.string().optional(),
  pkr_account_id: z.string().optional(),
  rate_ad_id: z.string().optional(),
};

const pkrToTrySchema = z.object({
  ...baseFields,
  transaction_type: z.literal("pkr_to_try"),
  pkr_amount: z.coerce.number().positive("Must be > 0"),
  pkr_per_try_rate: z.coerce.number().positive("Must be > 0"),
});

const tryToPkrSchema = z.object({
  ...baseFields,
  transaction_type: z.literal("try_to_pkr"),
  try_amount: z.coerce.number().positive("Must be > 0"),
  pkr_per_try_rate: z.coerce.number().positive("Must be > 0"),
});

const tryToUsdtSchema = z.object({
  ...baseFields,
  transaction_type: z.literal("try_to_usdt"),
  try_amount: z.coerce.number().positive("Must be > 0"),
  try_per_usdt_rate: z.coerce.number().positive("Must be > 0"),
});

const usdtToPkrSchema = z.object({
  ...baseFields,
  transaction_type: z.literal("usdt_to_pkr"),
  usdt_amount: z.coerce.number().positive("Must be > 0"),
  pkr_per_usdt_rate: z.coerce.number().positive("Must be > 0"),
});

const schema = z.discriminatedUnion("transaction_type", [
  pkrToTrySchema,
  tryToPkrSchema,
  tryToUsdtSchema,
  usdtToPkrSchema,
]);

type FormValues = z.infer<typeof schema>;

// ============================================================
// Mode metadata
// ============================================================
const MODE_META: Record<
  NewTransactionType,
  {
    label: string;
    sublabel: string;
    color: string;
    activeBg: string;
    activeText: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pkr_to_try: {
    label: "Buy TRY",
    sublabel: "PKR → TRY",
    color: "blue",
    activeBg: "bg-blue-600",
    activeText: "text-blue-200",
    icon: ArrowDown,
  },
  try_to_pkr: {
    label: "Sell TRY",
    sublabel: "TRY → PKR",
    color: "green",
    activeBg: "bg-green-600",
    activeText: "text-green-200",
    icon: ArrowUp,
  },
  try_to_usdt: {
    label: "Convert to USDT",
    sublabel: "TRY → USDT",
    color: "orange",
    activeBg: "bg-orange-600",
    activeText: "text-orange-200",
    icon: Repeat,
  },
  usdt_to_pkr: {
    label: "Sell USDT",
    sublabel: "USDT → PKR",
    color: "purple",
    activeBg: "bg-purple-600",
    activeText: "text-purple-200",
    icon: Coins,
  },
};

// ============================================================
// Helpers
// ============================================================
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
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
        {label}
        {hint && (
          <span className="text-slate-400 font-normal ml-1 text-xs">({hint})</span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function getBuyTypeFor(mode: NewTransactionType): BuyTransactionType | null {
  if (mode === "try_to_pkr" || mode === "try_to_usdt") return "pkr_to_try";
  if (mode === "usdt_to_pkr") return "try_to_usdt";
  return null;
}

// ============================================================
// Main component
// ============================================================
export function TransactionForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<NewTransactionType>("pkr_to_try");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rateAds, setRateAds] = useState<RateAd[]>([]);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [fifoEstimate, setFifoEstimate] = useState<{
    costBasisPkr: number;
    costPerUnit: number;
    insufficient: boolean;
  } | null>(null);

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
      transaction_type: "pkr_to_try",
      date: format(new Date(), "yyyy-MM-dd"),
      status: "completed",
      fees: [],
    } as unknown as FormValues,
  });

  const watched = useWatch({ control });
  // Cast to a flat optional type so mode-specific fields are accessible without narrowing
  const w = watched as Partial<{
    pkr_amount: number;
    pkr_per_try_rate: number;
    try_amount: number;
    try_per_usdt_rate: number;
    usdt_amount: number;
    pkr_per_usdt_rate: number;
    fees: Array<{ description?: string; amount_pkr?: number }>;
  }>;

  const { fields: feeFields, append: addFee, remove: removeFee } = useFieldArray({
    control,
    name: "fees",
  });

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
  }, [supabase]);

  // Fetch available balance when mode changes (for sell types)
  useEffect(() => {
    const buyType = getBuyTypeFor(mode);
    if (!buyType) {
      setAvailableBalance(null);
      return;
    }
    async function loadBalance() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const balance = await getAvailableBalance(user.id, buyType!, supabase);
        setAvailableBalance(balance);
      } catch {
        setAvailableBalance(0);
      }
    }
    loadBalance();
  }, [mode, supabase]);

  // Live FIFO cost-basis estimate (for sell types)
  const sellAmount = useMemo(() => {
    if (mode === "try_to_pkr") return Number(w.try_amount) || 0;
    if (mode === "try_to_usdt") return Number(w.try_amount) || 0;
    if (mode === "usdt_to_pkr") return Number(w.usdt_amount) || 0;
    return 0;
  }, [mode, w.try_amount, w.usdt_amount]);

  useEffect(() => {
    if (mode === "pkr_to_try" || sellAmount <= 0) {
      setFifoEstimate(null);
      return;
    }
    let cancelled = false;
    const sellType: SellTransactionType =
      mode === "try_to_usdt" ? "try_to_pkr" /* uses pkr_to_try inventory like try_to_pkr */ : (mode as SellTransactionType);
    // For try_to_usdt, FIFO consumes pkr_to_try just like try_to_pkr
    const effectiveSellType: SellTransactionType =
      mode === "try_to_usdt" ? "try_to_pkr" : (mode as SellTransactionType);

    const handle = setTimeout(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const est = await estimateFifoCost(sellAmount, effectiveSellType, user.id, supabase);
        if (!cancelled) {
          setFifoEstimate({
            costBasisPkr: est.costBasisPkr,
            costPerUnit: est.costPerUnit,
            insufficient: est.insufficient,
          });
        }
      } catch {
        if (!cancelled) setFifoEstimate(null);
      }
    }, 250);
    // suppress unused var
    void sellType;

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [mode, sellAmount, supabase]);

  // ---------- Live calculation summary ----------
  const totalFees = useMemo(
    () =>
      sumFees(
        (w.fees ?? []).map((f) => ({
          amount_pkr: Number(f?.amount_pkr) || 0,
        }))
      ),
    [w.fees]
  );

  const calcSummary = useMemo(() => {
    if (mode === "pkr_to_try") {
      const c = calculatePkrToTry(
        Number(w.pkr_amount) || 0,
        Number(w.pkr_per_try_rate) || 0
      );
      return {
        outAmount: c.tryAmount,
        outLabel: "TRY received",
        outUnit: "TRY",
        spent: c.pkrCost,
        spentLabel: "PKR spent",
        spentUnit: "PKR",
        showProfit: false,
        grossProfit: 0,
        netProfit: 0,
      };
    }
    if (mode === "try_to_pkr") {
      const cost = fifoEstimate?.costBasisPkr ?? 0;
      const c = calculateTryToPkr(
        Number(w.try_amount) || 0,
        Number(w.pkr_per_try_rate) || 0,
        cost,
        totalFees
      );
      return {
        outAmount: c.pkrReceived,
        outLabel: "PKR received",
        outUnit: "PKR",
        spent: cost,
        spentLabel: "Cost basis (FIFO)",
        spentUnit: "PKR",
        showProfit: true,
        grossProfit: c.grossProfit,
        netProfit: c.netProfit,
      };
    }
    if (mode === "try_to_usdt") {
      const cost = fifoEstimate?.costBasisPkr ?? 0;
      const c = calculateTryToUsdt(
        Number(w.try_amount) || 0,
        Number(w.try_per_usdt_rate) || 0,
        cost
      );
      return {
        outAmount: c.usdtAmount,
        outLabel: "USDT received",
        outUnit: "USDT",
        spent: cost,
        spentLabel: "TRY cost basis (FIFO)",
        spentUnit: "PKR",
        showProfit: false,
        grossProfit: 0,
        netProfit: 0,
        pkrCostPerUsdt: c.pkrCostPerUsdt,
      };
    }
    // usdt_to_pkr
    const cost = fifoEstimate?.costBasisPkr ?? 0;
    const c = calculateUsdtToPkr(
      Number(w.usdt_amount) || 0,
      Number(w.pkr_per_usdt_rate) || 0,
      cost,
      totalFees
    );
    return {
      outAmount: c.pkrReceived,
      outLabel: "PKR received",
      outUnit: "PKR",
      spent: cost,
      spentLabel: "Cost basis (FIFO)",
      spentUnit: "PKR",
      showProfit: true,
      grossProfit: c.grossProfit,
      netProfit: c.netProfit,
    };
  }, [mode, w, fifoEstimate, totalFees]);

  // ---------- Mode switch ----------
  const switchMode = useCallback(
    (newMode: NewTransactionType) => {
      setMode(newMode);
      setFifoEstimate(null);
      reset({
        transaction_type: newMode,
        date: format(new Date(), "yyyy-MM-dd"),
        status: "completed",
        fees: [],
      } as unknown as FormValues);
    },
    [reset]
  );

  // Auto-fill from rate ad
  function handleRateAdSelect(rateAdId: string) {
    const ad = rateAds.find((r) => r.id === rateAdId);
    if (!ad) return;
    if (mode === "try_to_usdt") {
      setValue("try_per_usdt_rate" as never, ad.usdt_try_rate as never);
      setValue("rate_ad_id" as never, rateAdId as never);
    } else if (mode === "usdt_to_pkr") {
      setValue("pkr_per_usdt_rate" as never, ad.usdt_pkr_rate as never);
      setValue("rate_ad_id" as never, rateAdId as never);
    }
  }

  // ---------- Upload attachments to Supabase Storage ----------
  async function uploadAttachments(transactionId: string, userId: string) {
    if (attachments.length === 0) return;
    for (const att of attachments) {
      const safeName = att.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${transactionId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("transaction-attachments")
        .upload(path, att.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: att.file.type,
        });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const { error: insErr } = await supabase.from("transaction_attachments").insert({
        transaction_id: transactionId,
        user_id: userId,
        storage_path: path,
        file_name: att.file.name,
        file_size: att.file.size,
        mime_type: att.file.type,
      });
      if (insErr) throw new Error(`Attachment record failed: ${insErr.message}`);
    }
  }

  // ---------- Submit ----------
  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const totalFeesPkr = sumFees(values.fees);
      let insertData: Record<string, unknown> = {
        date: values.date,
        description: values.description || null,
        status: values.status,
        total_fees_pkr: totalFeesPkr,
        is_archived: false,
        try_account_id: values.try_account_id || null,
        pkr_account_id: values.pkr_account_id || null,
      };

      let fifoResult: Awaited<ReturnType<typeof executeFifoMatch>> | null = null;

      switch (values.transaction_type) {
        case "pkr_to_try": {
          const c = calculatePkrToTry(values.pkr_amount, values.pkr_per_try_rate);
          insertData = {
            ...insertData,
            transaction_type: "pkr_to_try",
            try_amount: c.tryAmount,
            pkr_per_try_rate: values.pkr_per_try_rate,
            pkr_cost: c.pkrCost,
            remaining_amount: c.tryAmount, // entire amount available initially
          };
          break;
        }
        case "try_to_pkr": {
          fifoResult = await executeFifoMatch(values.try_amount, "try_to_pkr", user.id, supabase);
          if (fifoResult.insufficientInventory) {
            throw new Error(
              `Insufficient TRY balance. Available: ${formatNumber(fifoResult.availableAmount, 2)} TRY`
            );
          }
          const c = calculateTryToPkr(
            values.try_amount,
            values.pkr_per_try_rate,
            fifoResult.costBasisPkr,
            totalFeesPkr
          );
          insertData = {
            ...insertData,
            transaction_type: "try_to_pkr",
            try_amount: values.try_amount,
            pkr_per_try_rate: values.pkr_per_try_rate,
            pkr_received: c.pkrReceived,
            pkr_cost: fifoResult.costBasisPkr,
            gross_profit_pkr: c.grossProfit,
            net_profit_pkr: c.netProfit,
          };
          break;
        }
        case "try_to_usdt": {
          // FIFO consumes pkr_to_try inventory (same pool as try_to_pkr)
          fifoResult = await executeFifoMatch(values.try_amount, "try_to_pkr", user.id, supabase);
          if (fifoResult.insufficientInventory) {
            throw new Error(
              `Insufficient TRY balance. Available: ${formatNumber(fifoResult.availableAmount, 2)} TRY`
            );
          }
          const c = calculateTryToUsdt(
            values.try_amount,
            values.try_per_usdt_rate,
            fifoResult.costBasisPkr
          );
          insertData = {
            ...insertData,
            transaction_type: "try_to_usdt",
            try_amount: values.try_amount,
            try_per_usdt_rate: values.try_per_usdt_rate,
            usdt_amount: c.usdtAmount,
            pkr_cost: fifoResult.costBasisPkr,
            remaining_amount: c.usdtAmount,
            rate_ad_id: values.rate_ad_id || null,
          };
          break;
        }
        case "usdt_to_pkr": {
          fifoResult = await executeFifoMatch(values.usdt_amount, "usdt_to_pkr", user.id, supabase);
          if (fifoResult.insufficientInventory) {
            throw new Error(
              `Insufficient USDT balance. Available: ${formatNumber(fifoResult.availableAmount, 4)} USDT`
            );
          }
          const c = calculateUsdtToPkr(
            values.usdt_amount,
            values.pkr_per_usdt_rate,
            fifoResult.costBasisPkr,
            totalFeesPkr
          );
          insertData = {
            ...insertData,
            transaction_type: "usdt_to_pkr",
            usdt_amount: values.usdt_amount,
            pkr_per_usdt_rate: values.pkr_per_usdt_rate,
            pkr_received: c.pkrReceived,
            pkr_cost: fifoResult.costBasisPkr,
            gross_profit_pkr: c.grossProfit,
            net_profit_pkr: c.netProfit,
            rate_ad_id: values.rate_ad_id || null,
          };
          break;
        }
      }

      // Insert the transaction
      const { data: txn, error: txnError } = await supabase
        .from("transactions")
        .insert(insertData)
        .select()
        .single();
      if (txnError) throw txnError;

      // Apply FIFO updates (matches + buy remaining_amount)
      if (fifoResult && txn) {
        await applyFifoUpdates(txn.id, fifoResult, supabase);
      }

      // Insert itemised fees
      if (values.fees.length > 0 && txn) {
        const { error: feesError } = await supabase.from("transaction_fees").insert(
          values.fees.map((fee) => ({
            transaction_id: txn.id,
            description: fee.description,
            amount_pkr: fee.amount_pkr,
          }))
        );
        if (feesError) throw feesError;
      }

      // Upload attachments
      if (txn) {
        await uploadAttachments(txn.id, user.id);
      }

      toast.success("Transaction recorded!");
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
  const formErrors = errors as Record<string, { message?: string }>;
  const meta = MODE_META[mode];

  // ---------- Render ----------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* Mode selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(Object.keys(MODE_META) as NewTransactionType[]).map((m) => {
          const md = MODE_META[m];
          const Icon = md.icon;
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? `${md.activeBg} text-white shadow-sm`
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{md.label}</span>
              <span className={`text-xs font-normal ${active ? md.activeText : "text-slate-400"}`}>
                {md.sublabel}
              </span>
            </button>
          );
        })}
      </div>

      <input type="hidden" {...register("transaction_type")} value={mode} />

      {/* Basic info */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Transaction Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date" error={formErrors.date?.message}>
            <input
              type="date"
              {...register("date")}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
            />
          </Field>
          <Field label="Status">
            <select
              {...register("status")}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
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
            placeholder="e.g. Ahmed - bank transfer"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
          />
        </Field>
      </section>

      {/* Available balance hint (sell types) */}
      {availableBalance !== null && isSellType(mode) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Available balance: </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {formatNumber(availableBalance, mode === "usdt_to_pkr" ? 4 : 2)}{" "}
            {mode === "usdt_to_pkr" ? "USDT" : "TRY"}
          </span>
        </div>
      )}

      {/* Mode-specific fields */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        {mode === "pkr_to_try" && (
          <>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Buy TRY with PKR</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="PKR Amount" hint="how much PKR you spent" error={formErrors.pkr_amount?.message}>
                <input
                  type="number"
                  step="0.01"
                  {...register("pkr_amount" as never)}
                  placeholder="e.g. 65000"
                  className="input"
                />
              </Field>
              <Field
                label="Buy Rate"
                hint="PKR per 1 TRY"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="PKR Account (deducted from)" hint="optional">
                <AccountSelect {...register("pkr_account_id" as never)} options={pkrAccounts} currency="PKR" />
              </Field>
              <Field label="TRY Account (deposited to)" hint="optional">
                <AccountSelect {...register("try_account_id" as never)} options={tryAccounts} currency="TRY" />
              </Field>
            </div>
          </>
        )}

        {mode === "try_to_pkr" && (
          <>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sell TRY for PKR</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="TRY Amount to sell" error={formErrors.try_amount?.message}>
                <input
                  type="number"
                  step="0.01"
                  {...register("try_amount" as never)}
                  placeholder="e.g. 5000"
                  className="input"
                />
              </Field>
              <Field
                label="Sell Rate"
                hint="PKR per 1 TRY"
                error={formErrors.pkr_per_try_rate?.message}
              >
                <input
                  type="number"
                  step="0.0001"
                  {...register("pkr_per_try_rate")}
                  placeholder="e.g. 6.8"
                  className="input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="TRY Account (deducted from)" hint="optional">
                <AccountSelect {...register("try_account_id" as never)} options={tryAccounts} currency="TRY" />
              </Field>
              <Field label="PKR Account (deposited to)" hint="optional">
                <AccountSelect {...register("pkr_account_id" as never)} options={pkrAccounts} currency="PKR" />
              </Field>
            </div>
          </>
        )}

        {mode === "try_to_usdt" && (
          <>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Convert TRY to USDT</h2>
            {rateAds.length > 0 && (
              <RateAdQuickFill rateAds={rateAds} mode={mode} onSelect={handleRateAdSelect} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="TRY Amount" error={formErrors.try_amount?.message}>
                <input
                  type="number"
                  step="0.01"
                  {...register("try_amount" as never)}
                  placeholder="e.g. 10000"
                  className="input"
                />
              </Field>
              <Field
                label="Rate"
                hint="TRY per 1 USDT"
                error={formErrors.try_per_usdt_rate?.message}
              >
                <input
                  type="number"
                  step="0.0001"
                  {...register("try_per_usdt_rate" as never)}
                  placeholder="e.g. 44"
                  className="input"
                />
              </Field>
            </div>
            <Field label="TRY Account (deducted from)" hint="optional">
              <AccountSelect {...register("try_account_id" as never)} options={tryAccounts} currency="TRY" />
            </Field>
          </>
        )}

        {mode === "usdt_to_pkr" && (
          <>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sell USDT for PKR</h2>
            {rateAds.length > 0 && (
              <RateAdQuickFill rateAds={rateAds} mode={mode} onSelect={handleRateAdSelect} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="USDT Amount to sell" error={formErrors.usdt_amount?.message}>
                <input
                  type="number"
                  step="0.0001"
                  {...register("usdt_amount" as never)}
                  placeholder="e.g. 500"
                  className="input"
                />
              </Field>
              <Field
                label="Rate"
                hint="PKR per 1 USDT"
                error={formErrors.pkr_per_usdt_rate?.message}
              >
                <input
                  type="number"
                  step="0.0001"
                  {...register("pkr_per_usdt_rate" as never)}
                  placeholder="e.g. 293.5"
                  className="input"
                />
              </Field>
            </div>
            <Field label="PKR Account (deposited to)" hint="optional">
              <AccountSelect {...register("pkr_account_id" as never)} options={pkrAccounts} currency="PKR" />
            </Field>
          </>
        )}

        {/* Insufficient balance warning */}
        {fifoEstimate?.insufficient && sellAmount > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Sell amount exceeds available balance ({formatNumber(availableBalance ?? 0, 4)}{" "}
            {mode === "usdt_to_pkr" ? "USDT" : "TRY"})
          </p>
        )}
      </section>

      {/* Fees */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Fees &amp; Charges <span className="text-slate-400 font-normal">(optional)</span>
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
          <p className="text-xs text-slate-400">No fees added.</p>
        )}

        {feeFields.map((field, index) => (
          <div key={field.id} className="flex gap-3 items-start">
            <input
              type="text"
              {...register(`fees.${index}.description`)}
              placeholder="e.g. Bank transfer fee"
              className="input flex-1"
            />
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

      {/* Attachments */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <AttachmentUpload attachments={attachments} onChange={setAttachments} />
      </section>

      {/* Live summary */}
      <section
        className={`text-white rounded-xl p-6 space-y-3 ${
          mode === "pkr_to_try"
            ? "bg-blue-900"
            : mode === "try_to_pkr"
            ? "bg-green-900"
            : mode === "try_to_usdt"
            ? "bg-orange-900"
            : "bg-purple-900"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="w-4 h-4" />
          <h2 className="text-sm font-semibold">Live Summary</h2>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-black/20">
            {meta.sublabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="opacity-75">{calcSummary.spentLabel}</div>
          <div className="text-right font-medium">
            {formatCurrency(calcSummary.spent, calcSummary.spentUnit)}
          </div>

          <div className="opacity-75">{calcSummary.outLabel}</div>
          <div className="text-right font-medium">
            {calcSummary.outUnit === "USDT"
              ? formatNumber(calcSummary.outAmount, 4) + " USDT"
              : formatCurrency(calcSummary.outAmount, calcSummary.outUnit)}
          </div>

          {calcSummary.showProfit && (
            <>
              <div className="opacity-75">Total Fees</div>
              <div className="text-right font-medium text-orange-300">
                - {formatCurrency(totalFees, "PKR")}
              </div>
            </>
          )}
        </div>

        {calcSummary.showProfit && (
          <div className="border-t border-white/20 pt-3 flex justify-between items-center">
            <div>
              <p className="text-xs opacity-75">Gross Profit</p>
              <p className="font-semibold text-base">{formatCurrency(calcSummary.grossProfit, "PKR")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">Net Profit</p>
              <p className={`font-bold text-xl ${profitClass(calcSummary.netProfit)}`}>
                {calcSummary.netProfit >= 0 ? "+" : ""}
                {formatCurrency(calcSummary.netProfit, "PKR")}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg text-sm font-medium transition-colors ${meta.activeBg} hover:opacity-90 disabled:opacity-60`}
        >
          {saving ? "Saving…" : "Save Transaction"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Sub-components
// ============================================================
interface AccountSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Account[];
  currency: string;
}

const AccountSelect = ({ options, currency, ...props }: AccountSelectProps) => (
  <select
    {...props}
    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
  >
    <option value="">— None —</option>
    {options.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name} ({a.bank_name ?? currency})
      </option>
    ))}
  </select>
);

function RateAdQuickFill({
  rateAds,
  mode,
  onSelect,
}: {
  rateAds: RateAd[];
  mode: NewTransactionType;
  onSelect: (id: string) => void;
}) {
  const isUsdtBuy = mode === "try_to_usdt";
  const isUsdtSell = mode === "usdt_to_pkr";
  if (!isUsdtBuy && !isUsdtSell) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
        Quick-fill from saved Rate Ad
      </p>
      <select
        onChange={(e) => onSelect(e.target.value)}
        className="w-full sm:w-72 px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-slate-100"
        defaultValue=""
      >
        <option value="" disabled>
          Select a rate ad…
        </option>
        {rateAds.map((ad) => (
          <option key={ad.id} value={ad.id}>
            {ad.ad_name} —{" "}
            {isUsdtBuy ? `${ad.usdt_try_rate} TRY/USDT` : `${ad.usdt_pkr_rate} PKR/USDT`}
          </option>
        ))}
      </select>
    </div>
  );
}
