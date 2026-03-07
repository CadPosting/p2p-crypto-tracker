import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names intelligently.
 * Used throughout shadcn/ui components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency with the given currency code.
 * Example: formatCurrency(65000, "PKR") → "65,000.00 PKR"
 */
export function formatCurrency(amount: number, currency: string): string {
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) +
    " " +
    currency
  );
}

/**
 * Format a number with commas and fixed decimals.
 * Example: formatNumber(227.2727, 4) → "227.2727"
 */
export function formatNumber(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Returns "positive", "negative", or "neutral" based on a profit value.
 * Used for colour-coding profit/loss in the UI.
 */
export function profitClass(amount: number): string {
  if (amount > 0) return "text-green-600";
  if (amount < 0) return "text-red-600";
  return "text-gray-600";
}
