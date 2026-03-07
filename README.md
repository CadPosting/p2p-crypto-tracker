# P2P Crypto Tracker

A web app to track and calculate profits from TRY/PKR P2P crypto trading via USDT.

## How the trade flow works

```
You receive TRY  →  Buy USDT with TRY (P2P)  →  Sell USDT for PKR (P2P)
                         ↓                              ↓
                   TRY/USDT rate                PKR/USDT rate
                         ↓
PKR Cost = TRY × (PKR/TRY rate)
USDT     = TRY / (TRY/USDT rate)
PKR Recv = USDT × (PKR/USDT rate)
Net Profit = PKR Recv − PKR Cost − Fees
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Export | xlsx |
| Deployment | Vercel (free) |

---

## Step-by-Step Setup

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- A [GitHub](https://github.com) account
- A [Supabase](https://supabase.com) account (free)
- A [Vercel](https://vercel.com) account (free)

---

### Step 1 — Create a GitHub Repository

1. Go to https://github.com/new
2. Name it `p2p-crypto-tracker`
3. Set it to **Private** (recommended — this tracks financial data)
4. Do NOT initialise with README (we already have one)
5. Click **Create repository**

Then in your terminal:

```bash
cd /path/to/p2p-crypto-tracker

git init
git add .
git commit -m "Initial commit: P2P Crypto Tracker V1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/p2p-crypto-tracker.git
git push -u origin main
```

---

### Step 2 — Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Choose a name (e.g. `p2p-tracker`) and a strong database password — **save this password somewhere safe**
4. Select the region closest to you
5. Wait ~2 minutes for the project to spin up

---

### Step 3 — Run the Database Migration

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `supabase/migrations/001_initial.sql` from this repo
4. Copy its entire contents and paste into the SQL editor
5. Click **Run** (the green button)
6. You should see "Success. No rows returned" — that means it worked!

This creates your 4 tables: `accounts`, `rate_ads`, `transactions`, `transaction_fees`
and sets up Row Level Security so each user only sees their own data.

---

### Step 4 — Get Your Supabase API Keys

1. In your Supabase dashboard, go to **Settings → API** (gear icon in sidebar)
2. Copy:
   - **Project URL** (looks like `https://abcdef.supabase.co`)
   - **anon / public key** (a long string starting with `eyJ...`)

---

### Step 5 — Configure Environment Variables

Copy the example env file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

> **IMPORTANT:** Never commit `.env.local` to git. It's already in `.gitignore`.

---

### Step 6 — Install and Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

1. Click **Sign up** to create your account
2. Check your email and confirm your address (Supabase sends a confirmation)
3. Sign in and start using the app!

---

### Step 7 — Deploy to Vercel (Free)

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project**
3. Import your `p2p-crypto-tracker` repository
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
5. Click **Deploy**
6. Vercel gives you a free URL like `https://p2p-crypto-tracker.vercel.app`

> Every time you `git push` to `main`, Vercel automatically redeploys. No manual steps needed.

---

## Project Structure

```
p2p-crypto-tracker/
├── app/                          # Next.js pages
│   ├── (auth)/                   # Login & signup pages
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── (dashboard)/              # Protected pages (require login)
│       ├── page.tsx              # Dashboard overview
│       ├── transactions/         # Transaction list & new form
│       ├── accounts/             # Bank accounts management
│       ├── rates/                # P2P rate ad tracker
│       └── reports/              # Export reports
│
├── components/                   # Reusable React components
│   ├── layout/                   # Sidebar, mobile nav
│   ├── dashboard/                # Stats cards, chart
│   ├── transactions/             # Transaction table & form
│   ├── accounts/                 # Account cards & form
│   ├── rates/                    # Rate table & form
│   └── reports/                  # Report view & export
│
├── lib/
│   ├── supabase/                 # Supabase clients
│   ├── calculations.ts           # Core profit calculation logic
│   ├── export.ts                 # Excel/CSV export
│   └── utils.ts                  # Formatting helpers
│
├── types/index.ts                # TypeScript types
├── middleware.ts                 # Auth protection
└── supabase/migrations/          # Database SQL
    └── 001_initial.sql
```

---

## Features

- **Dashboard** — 30-day profit chart, stats, recent trades
- **Transactions** — Record trades with live profit calculation, itemised fees, date/account filters
- **Accounts** — Manage unlimited TRY and PKR bank accounts with balances
- **Rate Tracker** — Save P2P ad rates, see estimated margins
- **Reports** — Daily/monthly summaries, export to Excel

---

## Understanding the Profit Calculation

Example trade:
- You receive **10,000 TRY** at **6.5 PKR/TRY** → PKR cost = **65,000 PKR**
- You buy USDT at **44 TRY/USDT** → you get **≈227.27 USDT**
- You sell USDT at **293.5 PKR/USDT** → you receive **≈66,704 PKR**
- Bank fee: **52 PKR**
- **Net Profit = 66,704 − 65,000 − 52 = 1,652 PKR**

---

## Common Issues

**"Email not confirmed" error when signing in**
→ Check your email inbox and click the confirmation link from Supabase.

**Transactions not showing up**
→ Make sure you ran the SQL migration (Step 3). Check the Supabase Table Editor to confirm tables exist.

**Page shows blank after deploy**
→ Double-check the environment variables in Vercel match your Supabase project.

---

## Future Ideas (V2)

- Multiple user roles / team accounts
- Automatic TRY→PKR rate fetching from an API
- USDT balance tracking
- Mobile app (React Native)
- WhatsApp integration for trade confirmations
