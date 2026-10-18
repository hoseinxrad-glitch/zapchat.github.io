import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const MAX_GROUP_SIZE = 10

// ============================================================
// POST /api/groups/[id]/members  - add a member (admin only)
//   body: { userId: string }
// GET /api/groups/[id]/members  - list members
// DELETE /api/groups/[id]/members?userId=xxx  - remove a member (admin only)
// ============================================================

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify membership
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: authUser.userId } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const members = await db.groupMember.findMany({
    where: { groupId: id },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify the requester is an admin
  const adminMembership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: authUser.userId } },
  })
  if (!adminMembership || adminMembership.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId } = body as { userId: string }

    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    // Check group size limit
    const currentCount = await db.groupMember.count({ where: { groupId: id } })
    if (currentCount >= MAX_GROUP_SIZE) {
      return NextResponse.json(
        { error: `Group already at max size (${MAX_GROUP_SIZE} members)` },
        { status: 400 }
      )
    }

    // Check the user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check if already a member
    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }

    const membership = await db.groupMember.create({
      data: { groupId: id, userId, role: 'member' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true },
        },
      },
    })

    return NextResponse.json({
      member: {
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joinedAt,
        user: membership.user,
      },
    })
  } catch (e) {
    console.error('[add member error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const userIdToRemove = url.searchParams.get('userId')

  if (!userIdToRemove) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // If removing yourself, anyone can do it (= leave group, but admin-only handled separately)
  // For removing others, you must be admin
  if (userIdToRemove !== authUser.userId) {
    const adminMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: authUser.userId } },
    })
    if (!adminMembership || adminMembership.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
  }

  // If removing the creator, transfer ownership first
  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  if (group.creatorId === userIdToRemove) {
    // Find next admin or oldest member
    const nextAdmin = await db.groupMember.findFirst({
      where: { groupId: id, role: 'admin', userId: { not: userIdToRemove } },
    })
    if (nextAdmin) {
      await db.group.update({
        where: { id },
        data: { creatorId: nextAdmin.userId },
      })
    } else {
      const oldestMember = await db.groupMember.findFirst({
        where: { groupId: id, userId: { not: userIdToRemove } },
        orderBy: { joinedAt: 'asc' },
      })
      if (oldestMember) {
        await db.$transaction([
          db.groupMember.update({
            where: { id: oldestMember.id },
            data: { role: 'admin' },
          }),
          db.group.update({
            where: { id },
            data: { creatorId: oldestMember.userId },
          }),
        ])
      } else {
        // No members left, delete the group
        await db.group.delete({ where: { id } })
        return NextResponse.json({ success: true, groupDeleted: true })
      }
    }
  }

  await db.groupMember.deleteMany({
    where: { groupId: id, userId: userIdToRemove },
  })

  return NextResponse.json({ success: true })
}
