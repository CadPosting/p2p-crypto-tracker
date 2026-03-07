import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "P2P Crypto Tracker",
  description:
    "Track and calculate profits from TRY/PKR P2P crypto trading via USDT",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* Toast notifications — shows success/error messages */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
