# P2P Crypto Tracker

A web app to track and calculate profits from TRY/PKR P2P crypto trading.

Supports two trade types:
- **USDT Trade** — TRY → USDT → PKR (3-step conversion via P2P platform)
- **Direct Exchange** — TRY ↔ PKR directly (profit from spread between buy & sell rate)

---

## Trade Flow Examples

### USDT Trade
```
You receive TRY  →  Buy USDT with TRY (P2P)  →  Sell USDT for PKR (P2P)

PKR Cost     = TRY amount × (PKR/TRY rate)
USDT Amount  = TRY amount / (TRY/USDT rate)
PKR Received = USDT amount × (PKR/USDT rate)
Net Profit   = PKR Received − PKR Cost − Fees
```
**Example:** 10,000 TRY @ 6.5 PKR/TRY → 227.27 USDT @ 44 TRY/USDT → 66,704 PKR @ 293.5 PKR/USDT → **1,652 PKR net profit** (after 52 PKR fees)

### Direct Exchange
```
You buy TRY at one rate and sell at a higher rate

PKR Cost     = TRY amount × buy rate
PKR Received = TRY amount × sell rate
Net Profit   = TRY amount × (sell rate − buy rate) − Fees
```
**Example:** 10,000 TRY, buy @ 6.5 PKR/TRY, sell @ 6.8 PKR/TRY → **3,000 PKR gross profit**

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Server Actions) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Export | xlsx |
| Deployment | Vercel (free) |

---

## Features

- **Dashboard** — 30-day profit chart, today's profit, stats summary
- **Transactions** — Two trade modes with live profit calculator, itemised fees, date/account filters, click-to-expand breakdown
- **Accounts** — Unlimited TRY and PKR bank accounts with balances
- **Rate Tracker** — Save P2P ad rates (TRY/USDT, PKR/USDT), see estimated margins
- **Reports** — Daily/monthly summaries with Excel export

---

## Step-by-Step Setup

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later (`node --version` to check)
- A [GitHub](https://github.com) account
- A [Supabase](https://supabase.com) account (free)
- A [Vercel](https://vercel.com) account (free)

---

### Step 1 — Install Node.js

Go to **nodejs.org**, download the **LTS version**, install it. Verify in terminal:
```bash
node --version   # v20.x.x or higher
npm --version
```

---

### Step 2 — Install project dependencies

```bash
cd /path/to/p2p-crypto-tracker
npm install
```

Takes 1–3 minutes. Only needed once.

---

### Step 3 — Create a GitHub Repository

1. Go to **github.com/new**
2. Name: `p2p-crypto-tracker` | Visibility: **Private** | Do NOT add README
3. Click **Create repository**

In your terminal:
```bash
git remote add origin https://github.com/YOUR_USERNAME/p2p-crypto-tracker.git
git push -u origin main
```

> GitHub requires a **Personal Access Token** as your password.
> Create one at: GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → tick `repo` → copy the token.

---

### Step 4 — Create a Supabase Project

1. Go to **supabase.com** → New Project
2. Name: `p2p-tracker` | Choose a strong DB password (save it!)
3. Select nearest region → Create → wait ~2 minutes

---

### Step 5 — Run the Database Migrations

Run **both** SQL files in order via **Supabase dashboard → SQL Editor → New Query**:

**Migration 1** (creates all tables):
- Open `supabase/migrations/001_initial.sql` → copy all → paste → **Run**
- Expected result: "Success. No rows returned."

**Migration 2** (adds direct exchange support):
- New Query → open `supabase/migrations/002_add_direct_exchange.sql` → copy all → paste → **Run**
- Expected result: "Success. No rows returned."

Verify in **Table Editor** — you should see 4 tables:
`accounts`, `rate_ads`, `transactions`, `transaction_fees`

---

### Step 6 — Configure Environment Variables

1. Supabase dashboard → **Settings (gear icon) → API**
2. Copy **Project URL** and **anon/public key**

```bash
cp .env.local.example .env.local
# Open .env.local and fill in:
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

> `.env.local` is in `.gitignore` — it will never be pushed to GitHub. This is intentional.

---

### Step 7 — Run Locally

```bash
npm run dev
```

Open **http://localhost:3000**

1. Click **Sign up** → enter email + password → Create account
2. **Check your email** — click the confirmation link from Supabase
3. Go back to http://localhost:3000 → **Sign in**
4. You're in! Start by adding accounts, then record your first trade.

Press `Ctrl + C` to stop the server.

---

### Step 8 — Deploy to Vercel (free)

1. **vercel.com** → Add New Project → import `p2p-crypto-tracker` from GitHub
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Click **Deploy** → you get a free URL like `https://p2p-crypto-tracker.vercel.app`

Every `git push origin main` auto-redeploys. No manual steps needed.

---

## Project Structure

```
p2p-crypto-tracker/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── actions.ts        # Server Action: handles login server-side
│   │   │   └── page.tsx
│   │   └── signup/
│   │       ├── actions.ts        # Server Action: handles signup server-side
│   │       └── page.tsx
│   └── (dashboard)/
│       ├── page.tsx              # Dashboard overview (server component)
│       ├── transactions/         # Trade list + new trade form
│       ├── accounts/             # Bank accounts manager
│       ├── rates/                # P2P rate ad tracker
│       └── reports/              # Export daily/monthly reports
│
├── components/
│   ├── layout/                   # Sidebar, mobile nav
│   ├── dashboard/                # Stats cards, profit chart
│   ├── transactions/             # Transaction table (both trade types) + form
│   ├── accounts/                 # Account cards + form
│   ├── rates/                    # Rate table + form
│   └── reports/                  # Report view + export buttons
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   └── server.ts             # Server Supabase client (async, for Next.js 15+)
│   ├── calculations.ts           # Profit math for both trade types
│   ├── export.ts                 # Excel/CSV export
│   └── utils.ts                  # Formatting helpers
│
├── types/index.ts                # All TypeScript types
├── middleware.ts                 # Auth protection (redirects to /login if not authenticated)
└── supabase/migrations/
    ├── 001_initial.sql           # Creates all tables + Row Level Security
    └── 002_add_direct_exchange.sql  # Adds direct exchange columns
```

---

## Understanding the Profit Calculation

### USDT Trade
| Step | Formula | Example |
|------|---------|---------|
| PKR Cost | `TRY × PKR/TRY rate` | 10,000 × 6.5 = **65,000 PKR** |
| USDT Amount | `TRY ÷ TRY/USDT rate` | 10,000 ÷ 44 = **227.27 USDT** |
| PKR Received | `USDT × PKR/USDT rate` | 227.27 × 293.5 = **66,704 PKR** |
| Gross Profit | `PKR Received − PKR Cost` | 66,704 − 65,000 = **1,704 PKR** |
| Net Profit | `Gross − Fees` | 1,704 − 52 = **1,652 PKR** |

### Direct Exchange
| Step | Formula | Example |
|------|---------|---------|
| PKR Cost | `TRY × buy rate` | 10,000 × 6.5 = **65,000 PKR** |
| PKR Received | `TRY × sell rate` | 10,000 × 6.8 = **68,000 PKR** |
| Spread | `sell rate − buy rate` | 6.8 − 6.5 = **0.3 PKR/TRY** |
| Net Profit | `TRY × spread − Fees` | 10,000 × 0.3 = **3,000 PKR** |

---

## Common Issues

**Stuck on login screen after signing in**
→ Make sure you confirmed your email (check inbox for Supabase confirmation link).
→ Make sure both SQL migrations were run in Supabase.

**"relation does not exist" error**
→ Run the migrations in Supabase SQL Editor (Step 5 above).

**Page shows blank after deploy on Vercel**
→ Check that both environment variables are set in Vercel project settings.

**Email confirmation not arriving**
→ Check your spam folder. Or in Supabase dashboard → Authentication → Users — you can manually confirm users there.

---

## Future Ideas (V2)

- Multiple user roles / shared team accounts
- Auto-fetch TRY/PKR exchange rates from an API
- USDT wallet balance tracking
- Mobile app (React Native / Expo)
- WhatsApp notification per trade
- Monthly profit goal tracking
