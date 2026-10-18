#!/usr/bin/env bash
# ZapChat deployment helper
# Usage:
#   ./scripts/deploy.sh render     - deploy to Render (creates services)
#   ./scripts/deploy.sh pages      - trigger GitHub Pages build
#   ./scripts/deploy.sh local      - test production build locally

set -e

case "${1:-}" in
  render)
    echo "🚀 Deploying ZapChat to Render..."
    echo ""
    echo "Step 1: Push this code to GitHub:"
    echo "  git init && git add . && git commit -m 'Initial ZapChat commit'"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/zapchat.git"
    echo "  git push -u origin main"
    echo ""
    echo "Step 2: Go to https://render.com and click 'New Blueprint'"
    echo "  - Select your GitHub repo"
    echo "  - Render will detect render.yaml and create 3 services:"
    echo "    1. PostgreSQL database"
    echo "    2. Next.js web service (frontend + API + auth)"
    echo "    3. Socket.io WebSocket service"
    echo ""
    echo "Step 3: After deployment, your app will be at:"
    echo "  https://zapchat-web.onrender.com"
    echo ""
    echo "Step 4: Set these secrets in GitHub repo (Settings → Secrets):"
    echo "  - NEXT_PUBLIC_SOCKET_URL = https://zapchat-web.onrender.com"
    echo "  - AUTH_SECRET = (generate with: openssl rand -hex 32)"
    echo "  - NEXT_BASE_PATH = /zapchat (or your repo name)"
    echo ""
    echo "Step 5: Register your first user, then go to Profile → 'Claim admin role'"
    echo "  to become the site administrator."
    ;;

  pages)
    echo "📦 Triggering GitHub Pages build..."
    echo ""
    echo "To deploy to GitHub Pages:"
    echo "1. Push code to GitHub main branch"
    echo "2. The deploy.yml workflow runs automatically"
    echo "3. Or trigger manually: Actions → Deploy to GitHub Pages → Run workflow"
    echo ""
    echo "Before first deploy, set these secrets in your GitHub repo:"
    echo "  Settings → Secrets and variables → Actions → New repository secret"
    echo ""
    echo "Required secrets:"
    echo "  NEXT_PUBLIC_SOCKET_URL - Your Render backend URL (https://xxx.onrender.com)"
    echo "  AUTH_SECRET            - Random 32-char hex (run: openssl rand -hex 32)"
    echo ""
    echo "Optional secrets (with defaults):"
    echo "  NEXT_BASE_PATH         - Repo path (default: /zapchat)"
    echo ""
    echo "After deployment, your app will be at:"
    echo "  https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"
    ;;

  local)
    echo "🔨 Testing production build locally..."
    cd "$(dirname "$0")/.."

    echo "→ Building..."
    bun run build

    echo "→ Starting production server on port 3000..."
    echo "→ Press Ctrl+C to stop"
    PORT=3000 bun run start
    ;;

  *)
    echo "ZapChat deployment helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  render    Show steps to deploy to Render (backend + database)"
    echo "  pages     Show steps to deploy frontend to GitHub Pages"
    echo "  local     Test production build locally"
    exit 1
    ;;
esac
