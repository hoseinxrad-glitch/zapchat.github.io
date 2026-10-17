import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// POST /api/channels/[id]/subscribe  - subscribe to a channel
// DELETE /api/channels/[id]/subscribe  - unsubscribe

export async function POST(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const channel = await db.channel.findUnique({ where: { id } })
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: id, userId: authUser.userId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
  }

  await db.channelMember.create({
    data: { channelId: id, userId: authUser.userId, role: 'subscriber' },
  })

  return NextResponse.json({ success: true, action: 'subscribed' })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: id, userId: authUser.userId } },
  })
  if (!membership) return NextResponse.json({ error: 'Not subscribed' }, { status: 404 })
  if (membership.role === 'owner') {
    return NextResponse.json({ error: 'Owner cannot unsubscribe. Delete the channel instead.' }, { status: 400 })
  }

  await db.channelMember.delete({ where: { id: membership.id } })
  return NextResponse.json({ success: true, action: 'unsubscribed' })
}
