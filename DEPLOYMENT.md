# ⚡ ZapChat — Deployment Guide

> **ZapChat** is a privacy-first, open-source messenger. No phone number, real-time messaging, channels, stories, bots, voice calls, and a full admin panel.

This guide covers deploying ZapChat to **Render** (backend + database) and **GitHub Pages** (frontend).

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start: Full Render Deployment](#quick-start-full-render-deployment)
3. [Quick Start: GitHub Pages + Render](#quick-start-github-pages--render)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Post-Deployment Setup](#post-deployment-setup)
6. [Local Production Test](#local-production-test)
7. [Troubleshooting](#troubleshooting)

---

## 🏗 Architecture Overview

```
┌─────────────────────────────┐
│  Frontend (Next.js)         │
│  - Pages UI                 │
│  - Real-time chat UI        │
│  - Admin panel              │
└──────────┬──────────────────┘
           │
           │ HTTPS / WebSocket
           ▼
┌─────────────────────────────┐         ┌──────────────────────────┐
│  Next.js Web Service        │ ◄─────► │  Socket.io WS Service    │
│  - REST API routes          │  HTTP   │  - Real-time messaging   │
│  - Auth (JWT)               │  (mem)  │  - Presence / typing     │
│  - File uploads             │         │  - WebRTC call signaling │
│  - Admin endpoints          │         └──────────────────────────┘
└──────────┬──────────────────┘
           │
           │ SQL
           ▼
┌─────────────────────────────┐
│  PostgreSQL Database        │
│  - Users / Chats / Groups   │
│  - Channels / Stories / Bots │
│  - Messages / Reactions     │
└─────────────────────────────┘
```

### Deployment Options

| Option | Frontend | Backend | Database | Cost | Best for |
|--------|----------|---------|----------|------|----------|
| **A. Render full** | Render | Render | Render PG | Free → $7/mo | Quick & easiest |
| **B. Pages + Render** | GitHub Pages | Render | Render PG | Free (slower) | Showcase |
| **C. Self-hosted** | Your server | Your server | Your DB | Variable | Production at scale |

---

## 🚀 Quick Start: Full Render Deployment

This is the recommended path — deploy everything to Render with one click.

### Step 1: Push to GitHub

```bash
# Initialize and push to a new GitHub repo
git init
git add .
git commit -m "Initial ZapChat commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/zapchat.git
git push -u origin main
```

### Step 2: Create Render Blueprint

1. Go to [render.com](https://render.com) and sign up / log in (free)
2. Click **New → Blueprint**
3. Select your GitHub repo (`zapchat`)
4. Render will detect `render.yaml` and prompt you to create:
   - `zapchat-database` (PostgreSQL)
   - `zapchat-web` (Next.js app)
   - `zapchat-socket` (Socket.io service)
5. Click **Apply** and wait ~5-10 minutes for first deploy

### Step 3: Update Socket URL

After the web service deploys, you'll get a URL like:
```
https://zapchat-web.onrender.com
```

Update `NEXT_PUBLIC_SOCKET_URL` in the Render dashboard (Environment tab of `zapchat-web`) to point to your deployed socket service URL, then trigger a redeploy.

### Step 4: Open the App

Visit `https://zapchat-web.onrender.com`. The first user to register can claim admin by going to **Profile → "Claim admin role"** (shown automatically when no admin exists).

---

## 🚀 Quick Start: GitHub Pages + Render

Use this if you want the frontend on GitHub Pages (free, fast CDN) and only the backend on Render.

### Step 1: Deploy Backend to Render

Follow [Quick Start: Full Render Deployment](#quick-start-full-render-deployment) steps 1-3 above. Note your Render URLs.

### Step 2: Add GitHub Secrets

In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret Name | Value | Required |
|-------------|-------|----------|
| `NEXT_PUBLIC_SOCKET_URL` | `https://zapchat-web.onrender.com` | ✅ Yes |
| `AUTH_SECRET` | `openssl rand -hex 32` | ✅ Yes |
| `NEXT_BASE_PATH` | `/zapchat` (or your repo name) | Optional (defaults to `/zapchat`) |

### Step 3: Configure GitHub Pages

1. In your GitHub repo, go to **Settings → Pages**
2. Under **Build and deployment → Source**, select **GitHub Actions**
3. Push to `main` — the workflow at `.github/workflows/deploy.yml` will run automatically

### Step 4: Wait for Build

Go to **Actions** tab and watch the build. After ~3 minutes, your site will be live at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

### ⚠️ Important Notes for GitHub Pages

GitHub Pages serves **static files only**. This means:
- ❌ API routes won't work (use Render for backend)
- ❌ File uploads won't persist (need a server)
- ❌ Auth won't work (need JWT server)

**For GitHub Pages deployment, you must use the Render backend for all API calls.** Update the `apiFetch` function in `src/lib/chat-utils.ts` to point to your Render URL:

```ts
const API_BASE = process.env.NEXT_PUBLIC_APP_URL || ''
export async function apiFetch(path: string, options: RequestInit = {}) {
  // ... existing code ...
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  // ...
}
```

---

## 🔑 Environment Variables Reference

### Required for All Deployments

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | Random 32-char hex for JWT signing | `a1b2c3...` (run `openssl rand -hex 32`) |
| `NEXT_PUBLIC_SOCKET_URL` | Public URL of your WebSocket service | `https://zapchat-socket.onrender.com` |

### For GitHub Pages Only

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_BASE_PATH` | Repo name with leading slash | `/zapchat` |
| `NEXT_ASSETS_PREFIX` | Same as NEXT_BASE_PATH with trailing slash | `/zapchat/` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | (empty) | Your frontend URL (for CORS, etc.) |
| `UPLOAD_DIR` | `./uploads` | Where uploaded files are stored |
| `PORT` | `3000` (web), `3003` (socket) | Server port |

---

## 🔧 Post-Deployment Setup

### 1. Create Your Admin User

1. Open your deployed ZapChat URL
2. Register a new user
3. Click your avatar → **Profile settings**
4. Scroll to **"Become Admin"** section
5. Click **"Claim admin role"**

> ⚠️ This only works when no admin exists yet. Once an admin is set, the button disappears.

### 2. Test Real-Time Messaging

1. Open ZapChat in two different browsers (or incognito)
2. Register two different users
3. Start a chat between them
4. Send messages — they should appear in real-time

### 3. Configure CORS (if frontend & backend on different domains)

If you deployed frontend to GitHub Pages and backend to Render, update the Socket.io server CORS in `mini-services/chat-service/index.ts`:

```ts
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: ['https://YOUR_USERNAME.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  // ...
})
```

Then redeploy the Render socket service.

---

## 🧪 Local Production Test

Test the production build locally before deploying:

```bash
# Build the production bundle
npm run build

# Start the production server (port 3000)
npm run start
```

Visit `http://localhost:3000` — this is exactly what your users will see.

---

## 🛠 Troubleshooting

### "Cannot connect to WebSocket"

1. Check `NEXT_PUBLIC_SOCKET_URL` is set correctly
2. Verify your socket service is running on Render
3. Check browser console for CORS errors
4. Make sure HTTPS is used (Render provides this automatically)

### "Database connection failed"

1. Verify `DATABASE_URL` is set in Render environment
2. Check that the database service is running
3. Run `npx prisma db push` manually in Render shell to verify schema

### "Admin button doesn't appear"

The "Claim admin role" button only shows when **no admin exists in the database**. If you accidentally promoted someone else, you'll need to manually demote them in the database, OR directly update the User table:

```sql
UPDATE User SET role = 'user' WHERE role = 'admin';
```

Then refresh the page — the button should appear.

### "Uploads don't work on GitHub Pages"

GitHub Pages is static — it can't accept file uploads. You must use the Render backend for uploads. Update the upload URL in your client code to point to Render.

### "Build fails on GitHub Actions"

1. Check the Actions log for the specific error
2. Common issues:
   - Missing secrets (check Settings → Secrets)
   - Wrong `NEXT_BASE_PATH` (should match your repo name)
   - TypeScript errors (check with `npm run lint` locally)

### Render free tier limitations

- Web services sleep after 15 min of inactivity (first request takes ~30s to wake)
- 750 hours/month total (enough for 1 always-on service)
- PostgreSQL free for 90 days, then $7/month

For production use, consider upgrading to a paid plan.

---

## 📚 Additional Resources

- **Render Docs**: https://render.com/docs
- **GitHub Pages Docs**: https://docs.github.com/en/pages
- **Prisma + PostgreSQL**: https://pris.ly/d/postgresql
- **Socket.io Deployment**: https://socket.io/docs/v4/server-initialization/

---

## 🆘 Need Help?

Open an issue on GitHub: https://github.com/YOUR_USERNAME/zapchat/issues

---

Built with 💜 — Happy deploying! 🚀
