"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/types";
import { X } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Account name is required").max(100, "Max 100 characters"),
  currency: z.enum(["TRY", "PKR"]),
  bank_name: z.string().max(100, "Max 100 characters").optional(),
  account_number: z.string().max(50, "Max 50 characters").optional(),
  current_balance: z.coerce.number(),
  notes: z.string().max(500, "Max 500 characters").optional(),
});

type FormValues = z.infer<typeof schema>;

interface AccountFormProps {
  onSuccess: (account: Account) => void;
  onClose: () => void;
  existing?: Account;
}

export function AccountForm({ onSuccess, onClose, existing }: AccountFormProps) {
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
          name: existing.name,
          currency: existing.currency,
          bank_name: existing.bank_name ?? "",
          account_number: existing.account_number ?? "",
          current_balance: existing.current_balance,
          notes: existing.notes ?? "",
        }
      : {
          currency: "PKR",
          current_balance: 0,
        },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (existing) {
        const { data, error } = await supabase
          .from("accounts")
          .update({
            name: values.name,
            currency: values.currency,
            bank_name: values.bank_name || null,
            account_number: values.account_number || null,
            current_balance: values.current_balance,
            notes: values.notes || null,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        toast.success("Account updated!");
        onSuccess(data);
      } else {
        const { data, error } = await supabase
          .from("accounts")
          .insert({
            name: values.name,
            currency: values.currency,
            bank_name: values.bank_name || null,
            account_number: values.account_number || null,
            current_balance: values.current_balance,
            notes: values.notes || null,
          })
          .select()
          .single();
        if (error) throw error;
        toast.success("Account added!");
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
        {/* Modal header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {existing ? "Edit Account" : "Add Account"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Account Name *
            </label>
            <input
              type="text"
              {...register("name")}
              placeholder="e.g. HBL Main Account"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Currency *
            </label>
            <select
              {...register("currency")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="PKR">PKR — Pakistani Rupee</option>
              <option value="TRY">TRY — Turkish Lira</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bank Name
            </label>
            <input
              type="text"
              {...register("bank_name")}
              placeholder="e.g. HBL, Ziraat Bank"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Account Number
            </label>
            <input
              type="text"
              {...register("account_number")}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Balance
            </label>
            <input
              type="number"
              step="0.01"
              {...register("current_balance")}
              placeholder="0"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              {...register("notes")}
              placeholder="Any additional notes…"
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
              {saving ? "Saving…" : existing ? "Update" : "Add Account"}
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
