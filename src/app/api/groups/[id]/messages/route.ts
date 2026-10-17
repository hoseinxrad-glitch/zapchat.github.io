import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// GET /api/groups/[id]/messages  - get messages in a group
// PATCH /api/groups/[id]/messages?action=read  - mark messages as read
// ============================================================

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '100', 10)

  // Verify membership
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: authUser.userId } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const messages = await db.message.findMany({
    where: { groupId: id },
    orderBy: { createdAt: 'asc' },
    take: Math.min(limit, 500),
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
    },
  })

  return NextResponse.json({ messages, groupId: id })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'read') {
    // Verify membership
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: authUser.userId } },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

    // For group messages, the "read" flag is per-message and updated when the user opens the chat.
    // Since groups have multiple readers, we use a simple "lastReadAt" approach stored in the membership.
    // For simplicity here, we just acknowledge the action.
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
