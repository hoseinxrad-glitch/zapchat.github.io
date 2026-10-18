import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/reactions
//   body: { messageId, emoji }
//   If reaction exists for this user+emoji, remove it. Otherwise add.
// GET /api/reactions?messageId=xxx
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { messageId, emoji } = body
    if (!messageId || !emoji) {
      return NextResponse.json({ error: 'messageId and emoji are required' }, { status: 400 })
    }
    if (typeof emoji !== 'string' || emoji.length > 10) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }

    const message = await db.message.findUnique({ where: { id: messageId } })
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

    // Verify user can see this message (is sender, receiver, group member, or channel subscriber)
    const isSender = message.senderId === authUser.userId
    const isDirectParticipant =
      message.chatId && (message.receiverId === authUser.userId || isSender)
    let isGroupMember = false
    if (message.groupId) {
      const m = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId: message.groupId, userId: authUser.userId } },
      })
      isGroupMember = !!m
    }
    let isChannelSub = false
    if (message.channelId) {
      const m = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: message.channelId, userId: authUser.userId } },
      })
      isChannelSub = !!m
    }
    if (!isSender && !isDirectParticipant && !isGroupMember && !isChannelSub) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Toggle reaction
    const existing = await db.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId: authUser.userId, emoji } },
    })

    if (existing) {
      await db.reaction.delete({ where: { id: existing.id } })
      return NextResponse.json({ action: 'removed', emoji })
    } else {
      await db.reaction.create({
        data: { messageId, userId: authUser.userId, emoji },
      })
      return NextResponse.json({ action: 'added', emoji })
    }
  } catch (e) {
    console.error('[reaction error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const messageId = url.searchParams.get('messageId')
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

  const reactions = await db.reaction.findMany({
    where: { messageId },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarColor: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by emoji
  const grouped: Record<string, { count: number; users: any[]; mine: boolean }> = {}
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, users: [], mine: false }
    grouped[r.emoji].count++
    grouped[r.emoji].users.push(r.user)
    if (r.userId === authUser.userId) grouped[r.emoji].mine = true
  }

  return NextResponse.json({
    reactions: Object.entries(grouped).map(([emoji, info]) => ({ emoji, ...info })),
  })
}
