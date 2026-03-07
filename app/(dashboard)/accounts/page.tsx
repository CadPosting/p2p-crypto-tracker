"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AccountForm } from "@/components/accounts/account-form";
import { AccountList } from "@/components/accounts/account-list";
import type { Account } from "@/types";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const supabase = createClient();

  async function fetchAccounts() {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("currency")
      .order("name");
    setAccounts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchAccounts();
  }, []);

  function handleSuccess(account: Account) {
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.id === account.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = account;
        return updated;
      }
      return [...prev, account];
    });
    setShowForm(false);
    setEditingAccount(null);
  }

  function handleEdit(account: Account) {
    setEditingAccount(account);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  function handleClose() {
    setShowForm(false);
    setEditingAccount(null);
  }

  // Summary totals
  const totalPkr = accounts
    .filter((a) => a.currency === "PKR")
    .reduce((sum, a) => sum + a.current_balance, 0);
  const totalTry = accounts
    .filter((a) => a.currency === "TRY")
    .reduce((sum, a) => sum + a.current_balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAccount(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Balance summary strip */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700">Total PKR Balance</p>
          <p className="text-2xl font-bold text-green-800 mt-1">
            {formatCurrency(totalPkr, "PKR")}
          </p>
          <p className="text-xs text-green-600 mt-0.5">
            across{" "}
            {accounts.filter((a) => a.currency === "PKR").length} account
            {accounts.filter((a) => a.currency === "PKR").length !== 1
              ? "s"
              : ""}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700">Total TRY Balance</p>
          <p className="text-2xl font-bold text-red-800 mt-1">
            {formatCurrency(totalTry, "TRY")}
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            across{" "}
            {accounts.filter((a) => a.currency === "TRY").length} account
            {accounts.filter((a) => a.currency === "TRY").length !== 1
              ? "s"
              : ""}
          </p>
        </div>
      </div>

      {/* Account list */}
      {loading ? (
        <div className="text-sm text-slate-400 text-center py-12">
          Loading accounts…
        </div>
      ) : (
        <AccountList
          accounts={accounts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modal form */}
      {showForm && (
        <AccountForm
          onSuccess={handleSuccess}
          onClose={handleClose}
          existing={editingAccount ?? undefined}
        />
      )}
    </div>
  );
}
