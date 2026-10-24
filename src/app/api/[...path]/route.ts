import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, hashPassword, verifyPassword, generateToken, verifyToken } from '@/lib/auth'

// Allow GitHub Pages to skip this during static export
export const dynamic = 'force-static'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// Main handlers
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const res = await handleRequest(req, params, 'GET')
  res.headers.set('Access-Control-Allow-Origin', '*')
  return res
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const res = await handleRequest(req, params, 'POST')
  res.headers.set('Access-Control-Allow-Origin', '*')
  return res
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  const res = await handleRequest(req, params, 'PATCH')
  res.headers.set('Access-Control-Allow-Origin', '*')
  return res
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  const res = await handleRequest(req, params, 'DELETE')
  res.headers.set('Access-Control-Allow-Origin', '*')
  return res
}

// ============================================================
// Main Router
// ============================================================
async function handleRequest(req: NextRequest, params: { path: string[] }, method: string) {
  const path = params.path || []
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    // ------------------------------------------------------------
    // /api/auth
    // ------------------------------------------------------------
    if (path[0] === 'auth') {
      if (method === 'POST') {
        const body = await req.json()
        
        if (action === 'register') {
          const { username, displayName, password, bio, avatarColor } = body
          if (!username || !password || !displayName) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
          if (username.length < 3) return NextResponse.json({ error: 'Username too short' }, { status: 400 })
          if (password.length < 6) return NextResponse.json({ error: 'Password too short' }, { status: 400 })
          if (!/^[a-zA-Z0-9_]+$/.test(username)) return NextResponse.json({ error: 'Invalid username' }, { status: 400 })

          const existing = await db.user.findUnique({ where: { username } })
          if (existing) return NextResponse.json({ error: 'Username taken' }, { status: 409 })

          const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316']
          const finalColor = avatarColor || colors[Math.floor(Math.random() * colors.length)]

          const user = await db.user.create({
            data: { username, displayName, bio: bio || '', avatarColor: finalColor, passwordHash: hashPassword(password) },
          })
          const token = generateToken({ userId: user.id, username: user.username })
          return NextResponse.json({ token, user: { id: user.id, username, displayName, bio: user.bio, avatarColor: user.avatarColor, role: user.role, isBanned: user.isBanned, createdAt: user.createdAt } })
        }

        if (action === 'login') {
          const { username, password } = body
          if (!username || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
          const user = await db.user.findUnique({ where: { username } })
          if (!user || !verifyPassword(user.passwordHash, password)) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
          if (user.isBanned) return NextResponse.json({ error: 'Banned' }, { status: 403 })
          await db.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } })
          const token = generateToken({ userId: user.id, username: user.username })
          return NextResponse.json({ token, user: { id: user.id, username, displayName: user.displayName, bio: user.bio, avatarColor: user.avatarColor, role: user.role, isBanned: user.isBanned, createdAt: user.createdAt } })
        }
      }

      if (method === 'GET' && action === 'me') {
        const auth = req.headers.get('authorization') || ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
        const payload = verifyToken(token)
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        const user = await db.user.findUnique({ where: { id: payload.userId } })
        if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, avatarColor: user.avatarColor, role: user.role, isBanned: user.isBanned, createdAt: user.createdAt, lastSeen: user.lastSeen } })
      }
    }

    // ------------------------------------------------------------
    // /api/users
    // ------------------------------------------------------------
    if (path[0] === 'users') {
      const authUser = getAuthUser(req)
      if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (method === 'GET') {
        if (action === 'search' || action === 'all') {
          const q = url.searchParams.get('q') || ''
          const users = await db.user.findMany({
            where: q ? { AND: [{ id: { not: authUser.userId } }, { OR: [{ username: { contains: q } }, { displayName: { contains: q } }] }] } : { id: { not: authUser.userId } },
            select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true },
            take: 50,
          })
          return NextResponse.json({ users })
        }
      }

      if (method === 'PATCH') {
        const body = await req.json()
        const data: any = {}
        if (typeof body.displayName === 'string' && body.displayName.trim()) data.displayName = body.displayName.trim().slice(0, 50)
        if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 200)
        if (typeof body.avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.avatarColor)) data.avatarColor = body.avatarColor
        const user = await db.user.update({ where: { id: authUser.userId }, data, select: { id: true, username: true, displayName: true, bio: true, avatarColor: true } })
        return NextResponse.json({ user })
      }
    }

    // ------------------------------------------------------------
    // /api/chats
    // ------------------------------------------------------------
    if (path[0] === 'chats') {
      const authUser = getAuthUser(req)
      if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (method === 'GET') {
        if (action === 'list') {
          const chats = await db.chat.findMany({
            where: { OR: [{ user1Id: authUser.userId }, { user2Id: authUser.userId }] },
            include: {
              messages: { orderBy: { createdAt: 'desc' }, take: 1 },
              user1: { select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true } },
              user2: { select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })
          const result = await Promise.all(chats.map(async (chat) => {
            const otherUser = chat.user1Id === authUser.userId ? chat.user2 : chat.user1
            const unreadCount = await db.message.count({ where: { chatId: chat.id, receiverId: authUser.userId, read: false } })
            return { id: chat.id, otherUser, lastMessage: chat.messages[0] || null, unreadCount, updatedAt: chat.updatedAt }
          }))
          return NextResponse.json({ chats: result })
        }
        if (action === 'messages') {
          const chatId = url.searchParams.get('chatId')
          if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 })
          const messages = await db.message.findMany({ where: { chatId }, orderBy: { createdAt: 'asc' }, take: 200, include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } } })
          return NextResponse.json({ messages, chatId })
        }
      }

      if (method === 'POST') {
        const body = await req.json()
        const { otherUserId } = body
        if (!otherUserId) return NextResponse.json({ error: 'otherUserId required' }, { status: 400 })
        if (otherUserId === authUser.userId) return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 })
        const otherUser = await db.user.findUnique({ where: { id: otherUserId } })
        if (!otherUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        const [user1Id, user2Id] = authUser.userId < otherUserId ? [authUser.userId, otherUserId] : [otherUserId, authUser.userId]
        let chat = await db.chat.findUnique({ where: { user1Id_user2Id: { user1Id, user2Id } } })
        if (!chat) chat = await db.chat.create({ data: { user1Id, user2Id } })
        return NextResponse.json({ chat: { id: chat.id, otherUser, createdAt: chat.createdAt } })
      }

      if (method === 'PATCH' && action === 'read') {
        const body = await req.json()
        const { chatId } = body
        if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 })
        await db.message.updateMany({ where: { chatId, receiverId: authUser.userId, read: false }, data: { read: true } })
        return NextResponse.json({ success: true })
      }
    }

    // ------------------------------------------------------------
    // /api/messages
    // ------------------------------------------------------------
    if (path[0] === 'messages') {
      const authUser = getAuthUser(req)
      if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (method === 'POST') {
        const body = await req.json()
        const { chatId, groupId, channelId, receiverId, content, type, fileUrl, fileName, fileSize, audioDuration, audioWaveform, gifId, gifUrl, videoDuration, videoThumbnail, replyToId, isAnonymous, silent, isSpoiler, tempId } = body

        if (channelId) {
          const membership = await db.channelMember.findUnique({ where: { channelId_userId: { channelId, userId: authUser.userId } } })
          if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
          const message = await db.message.create({ data: { channelId, senderId: authUser.userId, content: content || '', type: type || 'text', fileUrl, fileName, fileSize, gifId, gifUrl, videoDuration, videoThumbnail, replyToId: replyToId || null, silent: !!silent, isSpoiler: !!isSpoiler }, include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } } })
          return NextResponse.json({ message, tempId })
        }

        if (groupId) {
          const membership = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: authUser.userId } } })
          if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
          const group = await db.group.findUnique({ where: { id: groupId } })
          if (group?.slowModeSecs && group.slowModeSecs > 0) {
            const lastMsg = await db.message.findFirst({ where: { groupId, senderId: authUser.userId }, orderBy: { createdAt: 'desc' } })
            if (lastMsg) {
              const elapsed = (Date.now() - lastMsg.createdAt.getTime()) / 1000
              if (elapsed < group.slowModeSecs) return NextResponse.json({ error: `Slow mode: wait ${Math.ceil(group.slowModeSecs - elapsed)}s` }, { status: 429 })
            }
          }
          const canAnon = group?.allowAnonymousAdmins && membership.role === 'admin'
          const finalAnon = canAnon && !!isAnonymous
          const message = await db.message.create({ data: { groupId, senderId: authUser.userId, content: content || '', type: type || 'text', fileUrl, fileName, fileSize, audioDuration, audioWaveform, gifId, gifUrl, videoDuration, videoThumbnail, replyToId: replyToId || null, silent: !!silent, isAnonymous: finalAnon, isSpoiler: !!isSpoiler }, include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } } })
          await db.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } })
          const members = await db.groupMember.findMany({ where: { groupId, userId: { not: authUser.userId } }, select: { userId: true } })
          return NextResponse.json({ message: finalAnon ? { ...message, sender: null } : message, memberIds: members.map((m) => m.userId), tempId })
        }

        if (!chatId || !receiverId) return NextResponse.json({ error: 'chatId+receiverId or groupId or channelId required' }, { status: 400 })
        const chat = await db.chat.findUnique({ where: { id: chatId } })
        if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
        if (receiverId !== chat.user1Id && receiverId !== chat.user2Id) return NextResponse.json({ error: 'Invalid receiverId' }, { status: 400 })
        const message = await db.message.create({ data: { chatId, senderId: authUser.userId, receiverId, content: content || '', type: type || 'text', fileUrl, fileName, fileSize, audioDuration, audioWaveform, gifId, gifUrl, videoDuration, videoThumbnail, replyToId: replyToId || null, silent: !!silent, isSpoiler: !!isSpoiler }, include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } } })
        await db.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } })
        return NextResponse.json({ message, tempId })
      }

      if (method === 'PATCH') {
        if (action === 'edit') {
          const body = await req.json()
          const { id, content } = body
          if (!id || !content) return NextResponse.json({ error: 'id and content required' }, { status: 400 })
          const msg = await db.message.findUnique({ where: { id } })
          if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
          if (msg.senderId !== authUser.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          const updated = await db.message.update({ where: { id }, data: { content, editedAt: new Date() }, include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } } })
          return NextResponse.json({ message: updated, recipientIds: msg.receiverId ? [msg.receiverId] : [] })
        }
        if (action === 'pin') {
          const body = await req.json()
          const { id, chatId, groupId } = body
          if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
          if (groupId) {
            const membership = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: authUser.userId } } })
            if (!membership || membership.role === 'member') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
            await db.group.update({ where: { id: groupId }, data: { pinnedMessageId: id } })
          } else if (chatId) {
            const chat = await db.chat.findUnique({ where: { id: chatId } })
            if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) return NextResponse.json({ error: 'Not your chat' }, { status: 403 })
            await db.chatUserSettings.upsert({ where: { chatId_userId: { chatId, userId: authUser.userId } }, create: { chatId, userId: authUser.userId, pinnedMessageId: id }, update: { pinnedMessageId: id } })
          }
          return NextResponse.json({ success: true, pinnedMessageId: id })
        }
        if (action === 'unpin') {
          const body = await req.json()
          const { chatId, groupId } = body
          if (groupId) await db.group.update({ where: { id: groupId }, data: { pinnedMessageId: null } })
          else if (chatId) await db.chatUserSettings.updateMany({ where: { chatId, userId: authUser.userId }, data: { pinnedMessageId: null } })
          return NextResponse.json({ success: true })
        }
      }

      if (method === 'DELETE') {
        const id = url.searchParams.get('id')
        const forBoth = url.searchParams.get('action') === 'both'
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const message = await db.message.findUnique({ where: { id } })
        if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (message.senderId !== authUser.userId) {
          if (!forBoth) return NextResponse.json({ success: true, hidden: true })
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        await db.reaction.deleteMany({ where: { messageId: id } })
        await db.message.updateMany({ where: { replyToId: id }, data: { replyToId: null } })
        await db.message.delete({ where: { id } })
        return NextResponse.json({ success: true, recipientIds: message.receiverId ? [message.receiverId] : [] })
      }

      if (method === 'GET' && action === 'unread-count') {
        const count = await db.message.count({ where: { receiverId: authUser.userId, read: false } })
        return NextResponse.json({ count })
      }
    }

    // ------------------------------------------------------------
    // /api/groups
    // ------------------------------------------------------------
    if (path[0] === 'groups') {
      const authUser = getAuthUser(req)
      if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (method === 'POST' && path.length === 1) {
        const body = await req.json()
        const { name, description, avatarColor, memberIds } = body
        if (!name || name.trim().length < 2) return NextResponse.json({ error: 'Name too short' }, { status: 400 })
        if (!Array.isArray(memberIds) || memberIds.length === 0) return NextResponse.json({ error: 'Members required' }, { status: 400 })
        const totalMembers = 1 + memberIds.length
        if (totalMembers > 10) return NextResponse.json({ error: 'Max 10 members' }, { status: 400 })
        const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#14b8a6', '#6366f1']
        const finalColor = avatarColor || colors[Math.floor(Math.random() * colors.length)]
        const group = await db.$transaction(async (tx) => {
          const newGroup = await tx.group.create({ data: { name: name.trim(), description: (description || '').slice(0, 200), avatarColor: finalColor, creatorId: authUser.userId } })
          await tx.groupMember.create({ data: { groupId: newGroup.id, userId: authUser.userId, role: 'admin' } })
          await tx.groupMember.createMany({ data: memberIds.map((uid: string) => ({ groupId: newGroup.id, userId: uid, role: 'member' })) })
          return newGroup
        })
        const fullGroup = await db.group.findUnique({ where: { id: group.id }, include: { members: { include: { user: { select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true } } }, orderBy: { joinedAt: 'asc' } } } })
        return NextResponse.json({ group: { id: fullGroup!.id, name: fullGroup!.name, description: fullGroup!.description, avatarColor: fullGroup!.avatarColor, creatorId: fullGroup!.creatorId, createdAt: fullGroup!.createdAt, updatedAt: fullGroup!.updatedAt, members: fullGroup!.members.map((m) => ({ id: m.id, role: m.role, joinedAt: m.joinedAt, user: m.user })), isGroup: true } })
      }

      if (method === 'GET' && action === 'list') {
        const memberships = await db.groupMember.findMany({
          where: { userId: authUser.userId },
          include: {
            group: { include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true, lastSeen: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } } } } },
          },
          orderBy: { group: { updatedAt: 'desc' } },
        })
        const groups = await Promise.all(memberships.map(async (m) => {
          const unreadCount = await db.message.count({ where: { groupId: m.group.id, senderId: { not: userId }, createdAt: { gt: m.joinedAt } } })
          const group = m.group
          return { id: group.id, name: group.name, description: group.description, avatarColor: group.avatarColor, creatorId: group.creatorId, createdAt: group.createdAt, updatedAt: group.updatedAt, members: group.members.map((mem) => ({ id: mem.id, role: mem.role, joinedAt: mem.joinedAt, user: mem.user })), lastMessage: group.messages[0] || null, unreadCount, isGroup: true }
        }))
        return NextResponse.json({ groups })
      }
    }

    // ------------------------------------------------------------
    // /api/reactions
    // ------------------------------------------------------------
    if (path[0] === 'reactions') {
      const authUser = getAuthUser(req)
      if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (method === 'POST') {
        const body = await req.json()
        const { messageId, emoji } = body
        if (!messageId || !emoji) return NextResponse.json({ error: 'messageId and emoji required' }, { status: 400 })
        const existing = await db.reaction.findUnique({ where: { messageId_userId_emoji: { messageId, userId: authUser.userId, emoji } } })
        if (existing) { await db.reaction.delete({ where: { id: existing.id } }); return NextResponse.json({ action: 'removed', emoji }) }
        await db.reaction.create({ data: { messageId, userId: authUser.userId, emoji } })
        return NextResponse.json({ action: 'added', emoji })
      }
      if (method === 'GET') {
        const messageId = url.searchParams.get('messageId')
        if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })
        const reactions = await db.reaction.findMany({ where: { messageId }, include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true } } }, orderBy: { createdAt: 'asc' } })
        const grouped: Record<string, { count: number; users: any[]; mine: boolean }> = {}
        for (const r of reactions) {
          if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, users: [], mine: false }
          grouped[r.emoji].count++
          grouped[r.emoji].users.push(r.user)
          if (r.userId === authUser.userId) grouped[r.emoji].mine = true
        }
        return NextResponse.json({ reactions: Object.entries(grouped).map(([emoji, info]) => ({ emoji, ...info })) })
      }
    }

    // ------------------------------------------------------------
    // /api/upload
    // ------------------------------------------------------------
    if (path[0] === 'upload') {
      const authUser = getAuthUser(req)
      if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (method === 'POST') {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
        if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: 'Too large' }, { status: 413 })
        const fs = await import('fs/promises')
        const pathMod = await import('path')
        const crypto = await import('crypto')
        const UPLOAD_DIR = pathMod.join(process.cwd(), 'uploads')
        await fs.mkdir(UPLOAD_DIR, { recursive: true })
        const ext = pathMod.extname(file.name) || ''
        const safeName = `${crypto.randomBytes(12).toString('hex')}${ext}`
        const filePath = pathMod.join(UPLOAD_DIR, safeName)
        const buffer = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(filePath, buffer)
        return NextResponse.json({ url: `/uploads/${safeName}`, fileName: file.name, fileSize: file.size })
      }
    }

    // ------------------------------------------------------------
    // /api/uploads/*
    // ------------------------------------------------------------
    if (path[0] === 'uploads') {
      const filePath = path.slice(1).join('/')
      if (!filePath || filePath.includes('..')) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
      const fs = await import('fs/promises')
      const pathMod = await import('path')
      const fullPath = pathMod.join(process.cwd(), 'uploads', filePath)
      try {
        const data = await fs.readFile(fullPath)
        const ext = pathMod.extname(filePath).toLowerCase()
        const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain', '.zip': 'application/zip' }
        return new NextResponse(data, { headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' } })
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    // ------------------------------------------------------------
    // /api/health
    // ------------------------------------------------------------
    if (path[0] === 'health') {
      return NextResponse.json({ status: 'ok', service: 'zapchat-web', timestamp: new Date().toISOString() })
    }

    // ------------------------------------------------------------
    // /api/admin
    // ------------------------------------------------------------
    if (path[0] === 'admin') {
      const authHeader = req.headers.get('authorization') || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const payload = verifyToken(token)
      if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      const adminUser = await db.user.findUnique({ where: { id: payload.userId }, select: { role: true, isBanned: true } })
      if (!adminUser || adminUser.isBanned || adminUser.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

      if (method === 'GET' && action === 'stats') {
        const [totalUsers, totalGroups, totalChannels, totalBots, totalStories, totalMessages] = await Promise.all([
          db.user.count(), db.group.count(), db.channel.count(), db.bot.count(), db.story.count({ where: { expiresAt: { gt: new Date() } } }), db.message.count(),
        ])
        return NextResponse.json({ stats: { totalUsers, totalGroups, totalChannels, totalBots, totalStories, totalMessages } })
      }
      if (method === 'GET' && action === 'users') {
        const users = await db.user.findMany({ select: { id: true, username: true, displayName: true, avatarColor: true, role: true, isBanned: true, createdAt: true, lastSeen: true }, orderBy: { createdAt: 'desc' }, take: 50 })
        return NextResponse.json({ users })
      }
    }

    // ------------------------------------------------------------
    // /api/auth/claim-admin
    // ------------------------------------------------------------
    if (path[0] === 'auth' && path[1] === 'claim-admin') {
      if (method === 'POST') {
        const existingAdmin = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true, username: true } })
        if (existingAdmin) return NextResponse.json({ error: 'Admin exists', adminUsername: existingAdmin.username }, { status: 403 })
        const authHeader = req.headers.get('authorization') || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const payload = verifyToken(token)
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        const updated = await db.user.update({ where: { id: payload.userId }, data: { role: 'admin' }, select: { id: true, username: true, displayName: true, avatarColor: true, role: true, isBanned: true, createdAt: true } })
        return NextResponse.json({ user: updated, message: 'You are now an admin!' })
      }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal error', details: String(e) }, { status: 500 })
  }
}
