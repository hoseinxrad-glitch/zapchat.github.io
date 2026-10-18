# ⚡ ZapChat

> A modern, real-time messaging app — like Telegram, but **better**.

ZapChat is a privacy-first, open-source messenger that requires **no phone number**. Built with Next.js 16, Socket.io, and Prisma, it deploys free on GitHub Pages + Render.

📖 **[Read the Deployment Guide →](./DEPLOYMENT.md)** — full instructions for Render and GitHub Pages.

## ✨ Features

- 🔐 **No phone number required** — sign up with just a username
- ⚡ **Real-time messaging** via WebSocket (Socket.io)
- 🟢 **Online presence** — see who's online
- ✍️ **Typing indicators**
- ✓✓ **Read receipts** (single & double check marks)
- 📎 **File & image sharing** (up to 10 MB)
- 😀 **Emoji picker**
- 🎨 **Customizable avatar colors** with auto-generated gradients
- 📱 **Fully responsive** — works great on mobile and desktop
- 🌙 **Dark mode** by default
- 💬 **Message history** with persistent storage
- 🔍 **Search** chats and users
- 👤 **User profiles** with bio and avatar customization

## 🚀 Quick Start (Local Development)

```bash
# Install dependencies
bun install

# Set up the database
cp .env.example .env  # then edit DATABASE_URL if needed
bun run db:push

# Start the WebSocket chat service (in a separate terminal)
bun run server:dev

# Start the Next.js dev server
bun run dev
# Open http://localhost:3000 (or use the preview panel)
```

## 🏗️ Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Next.js Frontend  │ ◄────► │   Socket.io Server  │
│  (GitHub Pages)     │  WS     │   (Render free)     │
│                     │         │                      │
│  • Auth UI          │         │  • Real-time relay   │
│  • Chat UI          │         │  • Presence          │
│  • State mgmt       │         │  • Typing indicator  │
└──────────┬──────────┘         └──────────────────────┘
           │
           │ REST API
           ▼
┌─────────────────────┐
│  Next.js API Routes │
│  (Render or local)  │
│                     │
│  • Auth (JWT)       │
│  • Users CRUD       │
│  • Chats CRUD       │
│  • Messages CRUD    │
│  • File uploads     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SQLite / Postgres  │
│  (via Prisma)       │
└─────────────────────┘
```

## ☁️ Deployment

### Option A: Full-stack on Render (recommended, easiest)

Deploy the entire Next.js app (with API routes + WebSocket) to Render as a single web service.

1. Push this repo to GitHub.
2. On [render.com](https://render.com), create a new **Web Service** from your repo.
3. Configure:
   - **Build Command**: `bun install && bun run db:push`
   - **Start Command**: `bun run start`
   - **Environment Variables**:
     - `DATABASE_URL` — a Postgres URL (Render provides free Postgres for 90 days)
     - `AUTH_SECRET` — a random 32+ char string (run `openssl rand -hex 32`)
     - `NEXT_PUBLIC_SOCKET_URL` — your Render app URL
4. Deploy. Done! 🎉

### Option B: Static frontend on GitHub Pages + API/WebSocket on Render

This is the architecture the user originally requested. It splits the app:

#### Step 1: Deploy the WebSocket server to Render

1. Push this repo to GitHub.
2. On Render, create a new **Web Service**.
3. Configure:
   - **Root Directory**: `render-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Note the URL (e.g., `https://zapchat-server.onrender.com`).

#### Step 2: Deploy the REST API to Render (separate service)

You'll need to extract the API routes into a standalone Express/Hono server, or simply deploy the Next.js app to Render as in **Option A**. For a pure static frontend, use Option C below.

#### Step 3: Deploy the frontend to GitHub Pages

The Next.js app can be statically exported, but since our app uses server-side API routes, the recommended path is **Option A**. If you want a pure static frontend, you'll need to:

1. Move all API logic to the Render server (Express + Prisma).
2. Update `src/lib/chat-utils.ts` `apiFetch` to point to the Render API URL.
3. Update `src/components/chat/useChatSocket.ts` to connect to the Render WebSocket URL.
4. Add `output: 'export'` to `next.config.ts`.
5. Run `bun run build:static` and push the `out/` folder to GitHub Pages.

The GitHub Actions workflow at `.github/workflows/deploy.yml` automates this.

## 🗂️ Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── api/                  # REST API routes
│   │   │   ├── auth/             # POST/GET  /api/auth
│   │   │   ├── users/            # GET/PATCH /api/users
│   │   │   ├── chats/            # GET/POST/PATCH /api/chats
│   │   │   ├── messages/         # GET/POST/DELETE /api/messages
│   │   │   ├── upload/           # POST /api/upload
│   │   │   └── uploads/[...path] # Serve static uploaded files
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Main app entry
│   │   └── globals.css           # Theme + custom styles
│   ├── components/
│   │   ├── chat/                 # Chat UI components
│   │   │   ├── AuthScreen.tsx    # Login / Register screen
│   │   │   ├── ChatList.tsx      # Sidebar with chat list
│   │   │   ├── ChatWindow.tsx    # Main chat area
│   │   │   ├── NewChatModal.tsx  # Find users to chat with
│   │   │   ├── ProfilePanel.tsx  # View / edit profile
│   │   │   ├── Avatar.tsx        # Avatar component
│   │   │   └── useChatSocket.ts  # WebSocket hook
│   │   └── ui/                   # shadcn/ui components
│   └── lib/
│       ├── auth.ts               # JWT + password hashing
│       ├── chat-store.ts         # Zustand store
│       ├── chat-utils.ts         # Helpers + API client
│       └── db.ts                 # Prisma client
├── prisma/
│   └── schema.prisma             # Database schema
├── mini-services/
│   └── chat-service/             # WebSocket server (dev)
├── render-server/                # Standalone WS server for Render
├── .github/workflows/deploy.yml  # GitHub Pages CI
└── render.yaml                   # Render Blueprint
```

## 🗄️ Database Schema

- **User**: `id`, `username` (unique), `displayName`, `bio`, `avatarColor`, `passwordHash`, `lastSeen`
- **Chat**: `id`, `user1Id`, `user2Id` (unique pair)
- **Message**: `id`, `chatId`, `senderId`, `receiverId`, `content`, `type`, `fileUrl`, `fileName`, `fileSize`, `read`

## 🔐 Security

- Passwords hashed with **scrypt** (Node's built-in, no extra deps)
- JWT-like tokens (HMAC-SHA256 signed) for session management
- Tokens expire after 30 days
- All API routes (except auth) require a valid token
- File uploads restricted to 10 MB and safe MIME types
- Path traversal protection on file serving

## 🛣️ Roadmap (Things Telegram has that we don't yet)

- [ ] Voice/video calls (WebRTC)
- [ ] Group chats (currently 1-on-1 only)
- [ ] Channels
- [ ] E2E encryption (currently messages are stored in plaintext on server)
- [ ] Message editing
- [ ] Message reactions
- [ ] Stickers
- [ ] Bot API
- [ ] Voice messages
- [ ] Message search across all chats

## 📜 License

MIT — feel free to fork, modify, and self-host.

---

Built with 💜 using Next.js, Socket.io, Prisma, and shadcn/ui.
