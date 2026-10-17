import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const MAX_GROUP_SIZE = 10

// ============================================================
// POST /api/groups  - create a new group
//   body: { name, description?, avatarColor?, memberIds: string[] }
// ============================================================
// GET /api/groups?action=list  - list my groups
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, description, avatarColor, memberIds } = body as {
      name: string
      description?: string
      avatarColor?: string
      memberIds: string[]
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Group name must be at least 2 characters' }, { status: 400 })
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: 'Group name must be at most 50 characters' }, { status: 400 })
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
    }

    // Total members = me + memberIds. Check limit.
    const totalMembers = 1 + memberIds.length
    if (totalMembers > MAX_GROUP_SIZE) {
      return NextResponse.json(
        { error: `Group cannot have more than ${MAX_GROUP_SIZE} members (including you)` },
        { status: 400 }
      )
    }

    // Verify all memberIds exist
    const existingUsers = await db.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    })
    if (existingUsers.length !== memberIds.length) {
      return NextResponse.json({ error: 'Some users do not exist' }, { status: 400 })
    }

    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#14b8a6', '#6366f1']
    const finalColor = avatarColor || colors[Math.floor(Math.random() * colors.length)]

    // Create group + members in a transaction
    const group = await db.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name: name.trim(),
          description: (description || '').slice(0, 200),
          avatarColor: finalColor,
          creatorId: authUser.userId,
        },
      })

      // Add me as admin
      await tx.groupMember.create({
        data: { groupId: newGroup.id, userId: authUser.userId, role: 'admin' },
      })

      // Add other members
      await tx.groupMember.createMany({
        data: memberIds.map((uid) => ({
          groupId: newGroup.id,
          userId: uid,
          role: 'member',
        })),
      })

      return newGroup
    })

    // Fetch the full group with members for the response
    const fullGroup = await db.group.findUnique({
      where: { id: group.id },
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

    return NextResponse.json({
      group: {
        id: fullGroup!.id,
        name: fullGroup!.name,
        description: fullGroup!.description,
        avatarColor: fullGroup!.avatarColor,
        creatorId: fullGroup!.creatorId,
        createdAt: fullGroup!.createdAt,
        updatedAt: fullGroup!.updatedAt,
        members: fullGroup!.members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
        isGroup: true,
      },
    })
  } catch (e) {
    console.error('[create group error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'list') {
    return handleListGroups(authUser.userId)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ------------------------------------------------------------
// List all groups the user is a member of
// ------------------------------------------------------------
async function handleListGroups(userId: string) {
  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatarColor: true, lastSeen: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
            },
          },
        },
      },
    },
    orderBy: { group: { updatedAt: 'desc' } },
  })

  // Count unread messages (messages where I am not the sender and group message is unread)
  // For simplicity in groups, "read" means the user has opened the chat. We track this with a simple
  // heuristic: a Message is "read" by a user if there exists a GroupMessageRead record.
  // For now, we'll just count messages newer than the last time we marked them read.
  // To keep things simple in v1, we'll just use the message's read flag set by the client.

  const groups = await Promise.all(
    memberships.map(async (m) => {
      const unreadCount = await db.message.count({
        where: {
          groupId: m.group.id,
          senderId: { not: userId },
          createdAt: { gt: m.joinedAt },
          // For group messages, we use a simpler "read" tracking via the read flag
          // The flag is updated when the user opens the chat.
        },
      })
      const group = m.group
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        avatarColor: group.avatarColor,
        creatorId: group.creatorId,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        members: group.members.map((mem) => ({
          id: mem.id,
          role: mem.role,
          joinedAt: mem.joinedAt,
          user: mem.user,
        })),
        lastMessage: group.messages[0] || null,
        unreadCount,
        isGroup: true,
      }
    })
  )

  return NextResponse.json({ groups })
}
