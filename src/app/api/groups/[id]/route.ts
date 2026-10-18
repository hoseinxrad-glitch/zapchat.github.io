import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// PATCH /api/groups/[id]?action=settings
//   body: { slowModeSecs?, allowAnonymousAdmins?, isSupergroup?, name?, description?, avatarColor? }
//   (admin only)

export async function PATCH(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'settings') {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: authUser.userId } },
    })
    if (!membership || membership.role === 'member') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await req.json()
    const { slowModeSecs, allowAnonymousAdmins, isSupergroup, name, description, avatarColor } = body
    const data: any = {}

    if (typeof slowModeSecs === 'number') {
      if (![0, 10, 30, 60, 300, 900, 3600].includes(slowModeSecs)) {
        return NextResponse.json({
          error: 'Invalid slowModeSecs (allowed: 0, 10, 30, 60, 300, 900, 3600)',
        }, { status: 400 })
      }
      data.slowModeSecs = slowModeSecs
    }
    if (typeof allowAnonymousAdmins === 'boolean') data.allowAnonymousAdmins = allowAnonymousAdmins
    if (typeof isSupergroup === 'boolean') data.isSupergroup = isSupergroup
    if (typeof name === 'string' && name.trim().length >= 2) data.name = name.trim().slice(0, 50)
    if (typeof description === 'string') data.description = description.slice(0, 200)
    if (typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) data.avatarColor = avatarColor

    const group = await db.group.update({ where: { id }, data })

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        avatarColor: group.avatarColor,
        slowModeSecs: group.slowModeSecs,
        allowAnonymousAdmins: group.allowAnonymousAdmins,
        isSupergroup: group.isSupergroup,
        updatedAt: group.updatedAt,
      },
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ============================================================
// GET /api/groups/[id]  - get group info (with new fields)
// ============================================================
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
        id: m.id, role: m.role, joinedAt: m.joinedAt, user: m.user,
        archived: m.archived, muted: m.muted, autoDeleteSecs: m.autoDeleteSecs, isAnonymous: m.isAnonymous,
      })),
      slowModeSecs: group.slowModeSecs,
      allowAnonymousAdmins: group.allowAnonymousAdmins,
      isSupergroup: group.isSupergroup,
      isChannel: group.isChannel,
      pinnedMessageId: group.pinnedMessageId,
      isGroup: true,
    },
  })
}

// ============================================================
// DELETE /api/groups/[id]?action=leave  - leave group
// DELETE /api/groups/[id]  - delete group (creator only)
// ============================================================
export async function DELETE(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  if (action === 'leave') {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: authUser.userId } },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 404 })

    await db.groupMember.delete({ where: { id: membership.id } })

    if (group.creatorId === authUser.userId) {
      const nextAdmin = await db.groupMember.findFirst({
        where: { groupId: id, role: 'admin', userId: { not: authUser.userId } },
      })
      if (nextAdmin) {
        await db.group.update({ where: { id }, data: { creatorId: nextAdmin.userId } })
      } else {
        const oldestMember = await db.groupMember.findFirst({
          where: { groupId: id },
          orderBy: { joinedAt: 'asc' },
        })
        if (oldestMember) {
          await db.$transaction([
            db.groupMember.update({ where: { id: oldestMember.id }, data: { role: 'admin' } }),
            db.group.update({ where: { id }, data: { creatorId: oldestMember.userId } }),
          ])
        } else {
          await db.group.delete({ where: { id } })
        }
      }
    }

    return NextResponse.json({ success: true })
  }

  if (group.creatorId !== authUser.userId) {
    return NextResponse.json({ error: 'Creator only' }, { status: 403 })
  }

  await db.group.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
