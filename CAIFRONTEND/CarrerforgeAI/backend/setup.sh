#!/bin/bash

# CareerforgeAI — FastAPI Backend Setup Script
# ─────────────────────────────────────────────

set -e
echo "🚀 Setting up FastAPI backend..."

cd "$(dirname "$0")"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "✅ Virtual environment created."
fi

# Activate and install
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "✅ Dependencies installed."

echo ""
echo "══════════════════════════════════════════"
echo "  🎯 FastAPI backend is ready to run!"
echo "  Run: source venv/bin/activate"
echo "  Then: uvicorn main:app --reload --port 8000"
echo "══════════════════════════════════════════"
