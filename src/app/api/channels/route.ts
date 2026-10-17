import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/channels  - create a channel
//   body: { username, name, description?, avatarColor?, isPrivate? }
// GET /api/channels?action=list  - channels I created or subscribe to
// GET /api/channels?action=search&q=xxx
// GET /api/channels?action=mine  - channels I own
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { username, name, description, avatarColor, isPrivate } = body as {
      username: string
      name: string
      description?: string
      avatarColor?: string
      isPrivate?: boolean
    }

    if (!username || !name) {
      return NextResponse.json({ error: 'username and name are required' }, { status: 400 })
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(username)) {
      return NextResponse.json({
        error: 'Username must be 3-32 chars, start with letter, only letters/numbers/_',
      }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
    }

    // Check uniqueness of channel username AND user username
    const existingChannel = await db.channel.findUnique({ where: { username } })
    if (existingChannel) {
      return NextResponse.json({ error: 'Channel username already taken' }, { status: 409 })
    }
    const existingUser = await db.user.findUnique({ where: { username } })
    if (existingUser) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    const colors = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444']
    const finalColor = avatarColor || colors[Math.floor(Math.random() * colors.length)]

    const channel = await db.$transaction(async (tx) => {
      const newChannel = await tx.channel.create({
        data: {
          username: username.toLowerCase(),
          name: name.trim(),
          description: (description || '').slice(0, 200),
          avatarColor: finalColor,
          isPrivate: !!isPrivate,
          creatorId: authUser.userId,
        },
      })
      await tx.channelMember.create({
        data: { channelId: newChannel.id, userId: authUser.userId, role: 'owner' },
      })
      return newChannel
    })

    const full = await db.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true } } } },
      },
    })

    return NextResponse.json({
      channel: {
        id: full!.id,
        username: full!.username,
        name: full!.name,
        description: full!.description,
        avatarColor: full!.avatarColor,
        isPrivate: full!.isPrivate,
        creatorId: full!.creatorId,
        createdAt: full!.createdAt,
        members: full!.members.map((m) => ({ id: m.id, role: m.role, joinedAt: m.joinedAt, user: m.user })),
        subscriberCount: full!.members.length,
      },
    })
  } catch (e) {
    console.error('[create channel error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'list') {
    const memberships = await db.channelMember.findMany({
      where: { userId: authUser.userId },
      include: {
        channel: {
          include: {
            members: { select: { id: true } },
            posts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
            },
          },
        },
      },
      orderBy: { channel: { updatedAt: 'desc' } },
    })

    const channels = memberships.map((m) => ({
      id: m.channel.id,
      username: m.channel.username,
      name: m.channel.name,
      description: m.channel.description,
      avatarColor: m.channel.avatarColor,
      isPrivate: m.channel.isPrivate,
      creatorId: m.channel.creatorId,
      createdAt: m.channel.createdAt,
      updatedAt: m.channel.updatedAt,
      subscriberCount: m.channel.members.length,
      lastPost: m.channel.posts[0] || null,
      role: m.role,
      isChannel: true,
    }))

    return NextResponse.json({ channels })
  }

  if (action === 'search') {
    const q = (url.searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ channels: [] })

    const channels = await db.channel.findMany({
      where: {
        isPrivate: false,
        OR: [
          { username: { contains: q.toLowerCase() } },
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 30,
      include: { members: { select: { id: true } } },
    })

    return NextResponse.json({
      channels: channels.map((c) => ({
        id: c.id,
        username: c.username,
        name: c.name,
        description: c.description,
        avatarColor: c.avatarColor,
        subscriberCount: c.members.length,
      })),
    })
  }

  if (action === 'mine') {
    const channels = await db.channel.findMany({
      where: { creatorId: authUser.userId },
      include: { members: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      channels: channels.map((c) => ({
        id: c.id, username: c.username, name: c.name, description: c.description,
        avatarColor: c.avatarColor, subscriberCount: c.members.length, createdAt: c.createdAt,
      })),
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
