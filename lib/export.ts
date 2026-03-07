"use client";

import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { Transaction, DailySummary } from "@/types";

/**
 * Export a list of transactions to an Excel (.xlsx) file.
 * The file downloads automatically in the browser.
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  filename?: string
) {
  const rows = transactions.map((t) => ({
    Date: format(new Date(t.date), "dd/MM/yyyy"),
    "TRY Amount": t.try_amount,
    "PKR/TRY Rate": t.pkr_per_try_rate,
    "PKR Cost": t.pkr_cost,
    "TRY/USDT Rate": t.try_per_usdt_rate,
    "USDT Amount": t.usdt_amount,
    "PKR/USDT Rate": t.pkr_per_usdt_rate,
    "PKR Received": t.pkr_received,
    "Fees (PKR)": t.total_fees_pkr,
    "Gross Profit (PKR)": t.gross_profit_pkr,
    "Net Profit (PKR)": t.net_profit_pkr,
    Status: t.status,
    Description: t.description ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
  XLSX.writeFile(
    workbook,
    filename ?? `transactions-${format(new Date(), "yyyy-MM-dd")}.xlsx`
  );
}

/**
 * Export the daily summary report to Excel.
 */
export function exportDailySummaryToExcel(
  summaries: DailySummary[],
  filename?: string
) {
  const rows = summaries.map((s) => ({
    Date: format(new Date(s.date), "dd/MM/yyyy"),
    Transactions: s.transaction_count,
    "Total TRY": s.total_try,
    "Total USDT": s.total_usdt,
    "Total PKR Spent": s.total_pkr_cost,
    "Total PKR Received": s.total_pkr_received,
    "Total Fees (PKR)": s.total_fees,
    "Gross Profit (PKR)": s.total_gross_profit,
    "Net Profit (PKR)": s.total_net_profit,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");
  XLSX.writeFile(
    workbook,
    filename ?? `daily-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
  );
}

/**
 * Export any data array to CSV.
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
