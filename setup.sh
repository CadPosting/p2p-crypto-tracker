#!/bin/bash
# ============================================================
# P2P Crypto Tracker — First-time Setup Script
# Run this ONCE after cloning the repo and installing deps.
# ============================================================

set -e  # Exit immediately on any error

echo ""
echo "================================================"
echo "  P2P Crypto Tracker — Setup"
echo "================================================"
echo ""

# 1. Check Node.js is installed
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed. Please install it from https://nodejs.org"
  exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# 2. Install dependencies
echo "Installing npm packages..."
npm install
echo ""

# 3. Copy env file if not exists
if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  echo "Created .env.local — IMPORTANT: Fill in your Supabase credentials!"
  echo ""
else
  echo ".env.local already exists, skipping..."
  echo ""
fi

# 4. Done
echo "================================================"
echo "Setup complete!"
echo ""
echo "NEXT STEPS:"
echo "  1. Go to https://supabase.com and create a new project"
echo "  2. Run supabase/migrations/001_initial.sql in the SQL Editor"
echo "  3. Add your Supabase URL and anon key to .env.local"
echo "  4. Run: npm run dev"
echo "  5. Open: http://localhost:3000"
echo "================================================"
echo ""
