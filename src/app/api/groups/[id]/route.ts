import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// GET /api/groups/[id]  - get group info
// PATCH /api/groups/[id]  - update group (name, description, color) - admin only
// DELETE /api/groups/[id]  - delete group (creator only) OR leave group (member)
// ============================================================

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const group = await db.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, bio: true, avatarColor: true, lastSeen: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Verify membership
  const isMember = group.members.some((m) => m.userId === authUser.userId)
  if (!isMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      avatarColor: group.avatarColor,
      creatorId: group.creatorId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: group.members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      isGroup: true,
    },
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: authUser.userId } },
  })
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, description, avatarColor } = body as {
      name?: string
      description?: string
      avatarColor?: string
    }

    const data: any = {}
    if (typeof name === 'string' && name.trim().length >= 2) {
      data.name = name.trim().slice(0, 50)
    }
    if (typeof description === 'string') {
      data.description = description.slice(0, 200)
    }
    if (typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
      data.avatarColor = avatarColor
    }

    const group = await db.group.update({ where: { id }, data })

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        avatarColor: group.avatarColor,
        creatorId: group.creatorId,
        updatedAt: group.updatedAt,
        isGroup: true,
      },
    })
  } catch (e) {
    console.error('[update group error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get('action') // 'leave' or null (delete)

  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  if (action === 'leave') {
    // Leave the group
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: authUser.userId } },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 404 })

    await db.groupMember.delete({ where: { id: membership.id } })

    // If creator leaves, either delete the group or transfer ownership
    if (group.creatorId === authUser.userId) {
      // Find next admin or oldest member
      const nextAdmin = await db.groupMember.findFirst({
        where: { groupId: id, role: 'admin', userId: { not: authUser.userId } },
      })
      if (nextAdmin) {
        await db.group.update({
          where: { id },
          data: { creatorId: nextAdmin.userId },
        })
      } else {
        // No other admin, find oldest member and make them admin
        const oldestMember = await db.groupMember.findFirst({
          where: { groupId: id },
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
        }
      }
    }

    // If no members left, the group is already deleted above.
    return NextResponse.json({ success: true })
  }

  // Delete group (creator only)
  if (group.creatorId !== authUser.userId) {
    return NextResponse.json({ error: 'Creator only' }, { status: 403 })
  }

  await db.group.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
