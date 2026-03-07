import { TransactionForm } from "@/components/transactions/transaction-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewTransactionPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/transactions"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Record Trade</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Enter the details of your TRY → USDT → PKR trade
          </p>
        </div>
      </div>

      {/* Form */}
      <TransactionForm />
    </div>
  );
}
