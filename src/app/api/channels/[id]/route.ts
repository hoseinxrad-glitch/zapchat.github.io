import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// GET /api/channels/[id] - channel info + posts (with replies)
// PATCH /api/channels/[id] - update channel (admin only)
// DELETE /api/channels/[id] - delete channel (owner only)

export async function GET(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const channel = await db.channel.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
      },
    },
  })

  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (channel.isPrivate) {
    const m = await db.channelMember.findUnique({
      where: { channelId_userId: { channelId: id, userId: authUser.userId } },
    })
    if (!m) return NextResponse.json({ error: 'Private channel' }, { status: 403 })
  }

  // Get recent posts
  const posts = await db.message.findMany({
    where: { channelId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
      reactions: {
        include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
      },
      replies: {
        include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const myMembership = channel.members.find((m) => m.userId === authUser.userId)

  return NextResponse.json({
    channel: {
      id: channel.id,
      username: channel.username,
      name: channel.name,
      description: channel.description,
      avatarColor: channel.avatarColor,
      isPrivate: channel.isPrivate,
      creatorId: channel.creatorId,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      members: channel.members.map((m) => ({
        id: m.id, role: m.role, joinedAt: m.joinedAt, user: m.user,
      })),
      subscriberCount: channel.members.length,
      myRole: myMembership?.role || null,
    },
    posts: posts.reverse(),
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: id, userId: authUser.userId } },
  })
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await req.json()
  const { name, description, avatarColor } = body
  const data: any = {}
  if (typeof name === 'string' && name.trim().length >= 2) data.name = name.trim().slice(0, 100)
  if (typeof description === 'string') data.description = description.slice(0, 200)
  if (typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) data.avatarColor = avatarColor

  const channel = await db.channel.update({ where: { id }, data })
  return NextResponse.json({ channel })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const channel = await db.channel.findUnique({ where: { id } })
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (channel.creatorId !== authUser.userId) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  await db.channel.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
