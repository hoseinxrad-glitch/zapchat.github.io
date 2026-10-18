import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// GET /api/chats?action=list  - get all chats for the current user
// GET /api/chats?action=messages&chatId=xxx  - get messages in a chat
// POST /api/chats  - create a new chat with another user
//   body: { otherUserId: string }
// PATCH /api/chats?action=read&chatId=xxx  - mark messages as read
// ============================================================

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'list') {
    return handleListChats(authUser.userId)
  }
  if (action === 'messages') {
    const chatId = url.searchParams.get('chatId')
    if (!chatId) return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)
    return handleGetMessages(authUser.userId, chatId, limit)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ------------------------------------------------------------
// List all chats for the user with last message preview
// ------------------------------------------------------------
async function handleListChats(userId: string) {
  const chats = await db.chat.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      user1: { select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true } },
      user2: { select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Count unread messages for each chat
  const result = await Promise.all(
    chats.map(async (chat) => {
      const otherUser = chat.user1Id === userId ? chat.user2 : chat.user1
      const unreadCount = await db.message.count({
        where: {
          chatId: chat.id,
          receiverId: userId,
          read: false,
        },
      })
      return {
        id: chat.id,
        otherUser,
        lastMessage: chat.messages[0] || null,
        unreadCount,
        updatedAt: chat.updatedAt,
      }
    })
  )

  return NextResponse.json({ chats: result })
}

// ------------------------------------------------------------
// Get messages in a chat
// ------------------------------------------------------------
async function handleGetMessages(userId: string, chatId: string, limit: number) {
  // Verify the chat belongs to the user
  const chat = await db.chat.findUnique({ where: { id: chatId } })
  if (!chat || (chat.user1Id !== userId && chat.user2Id !== userId)) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  const messages = await db.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    take: Math.min(limit, 500),
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
    },
  })

  return NextResponse.json({ messages, chatId })
}

// ------------------------------------------------------------
// Create a new chat (or return existing)
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { otherUserId } = body
    if (!otherUserId) return NextResponse.json({ error: 'otherUserId is required' }, { status: 400 })
    if (otherUserId === authUser.userId) {
      return NextResponse.json({ error: 'Cannot create chat with yourself' }, { status: 400 })
    }

    // Verify the other user exists
    const otherUser = await db.user.findUnique({ where: { id: otherUserId } })
    if (!otherUser) return NextResponse.json({ error: 'Other user not found' }, { status: 404 })

    // Find or create chat. We always store user1Id < user2Id lexicographically
    // to enforce the unique constraint.
    const [user1Id, user2Id] =
      authUser.userId < otherUserId ? [authUser.userId, otherUserId] : [otherUserId, authUser.userId]

    let chat = await db.chat.findUnique({
      where: { user1Id_user2Id: { user1Id, user2Id } },
    })

    if (!chat) {
      chat = await db.chat.create({ data: { user1Id, user2Id } })
    }

    return NextResponse.json({
      chat: {
        id: chat.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          displayName: otherUser.displayName,
          bio: otherUser.bio,
          avatarColor: otherUser.avatarColor,
          lastSeen: otherUser.lastSeen,
        },
        createdAt: chat.createdAt,
      },
      isNew: chat.createdAt.getTime() === chat.updatedAt.getTime(),
    })
  } catch (e) {
    console.error('[create chat error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// Mark messages as read
// ------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'read') {
    try {
      const body = await req.json()
      const { chatId, messageIds } = body as { chatId: string; messageIds?: string[] }
      if (!chatId) return NextResponse.json({ error: 'chatId is required' }, { status: 400 })

      const chat = await db.chat.findUnique({ where: { id: chatId } })
      if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }

      // Mark all unread messages in this chat addressed to me as read
      await db.message.updateMany({
        where: {
          chatId,
          receiverId: authUser.userId,
          read: false,
          ...(messageIds && messageIds.length > 0 ? { id: { in: messageIds } } : {}),
        },
        data: { read: true },
      })

      return NextResponse.json({ success: true })
    } catch (e) {
      console.error('[mark read error]', e)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
