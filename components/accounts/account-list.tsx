"use client";

import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Account } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface AccountListProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}

// Flag emojis for currencies
const currencyFlags: Record<string, string> = {
  TRY: "🇹🇷",
  PKR: "🇵🇰",
};

export function AccountList({ accounts, onEdit, onDelete }: AccountListProps) {
  const supabase = createClient();

  async function handleDelete(account: Account) {
    if (
      !confirm(
        `Delete account "${account.name}"? This will not delete transactions linked to it.`
      )
    )
      return;

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Account deleted");
    onDelete(account.id);
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
        No accounts yet. Click &ldquo;Add Account&rdquo; to get started.
      </div>
    );
  }

  const tryAccounts = accounts.filter((a) => a.currency === "TRY");
  const pkrAccounts = accounts.filter((a) => a.currency === "PKR");

  return (
    <div className="space-y-8">
      {[
        { label: "PKR Accounts", items: pkrAccounts, currency: "PKR" },
        { label: "TRY Accounts", items: tryAccounts, currency: "TRY" },
      ].map(({ label, items, currency }) => (
        <div key={currency}>
          <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
            {currencyFlags[currency]} {label}
            <span className="text-slate-400 font-normal">({items.length})</span>
          </h2>

          {items.length === 0 ? (
            <p className="text-sm text-slate-400">
              No {currency} accounts added yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((account) => (
                <div
                  key={account.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {account.name}
                      </p>
                      {account.bank_name && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {account.bank_name}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {currencyFlags[account.currency]} {account.currency}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Balance</p>
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(account.current_balance, account.currency)}
                    </p>
                  </div>

                  {account.account_number && (
                    <p className="text-xs text-slate-400 font-mono">
                      {account.account_number}
                    </p>
                  )}

                  {account.notes && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      {account.notes}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onEdit(account)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
