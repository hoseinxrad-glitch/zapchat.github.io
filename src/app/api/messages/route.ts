import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/messages  - persist a message
//   body for direct:  { chatId, receiverId, content, type?, ... }
//   body for group:   { groupId, content, type?, ... }
// ============================================================
// GET /api/messages?action=unread-count  - total unread messages
// DELETE /api/messages?id=xxx  - delete a message (own only)
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      chatId,
      groupId,
      receiverId,
      content,
      type,
      fileUrl,
      fileName,
      fileSize,
      tempId,
    } = body as {
      chatId?: string
      groupId?: string
      receiverId?: string
      content: string
      type?: string
      fileUrl?: string | null
      fileName?: string | null
      fileSize?: number | null
      tempId?: string
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // -------- Group message --------
    if (groupId) {
      // Verify membership
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: authUser.userId } },
      })
      if (!membership) {
        return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
      }

      const message = await db.message.create({
        data: {
          groupId,
          senderId: authUser.userId,
          content: content || '',
          type: type || 'text',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          // receiverId and chatId are null for group messages
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
        },
      })

      // Update group updatedAt for sorting
      await db.group.update({
        where: { id: groupId },
        data: { updatedAt: new Date() },
      })

      // Fetch all member user IDs to send to via WebSocket (returned to client)
      const members = await db.groupMember.findMany({
        where: { groupId, userId: { not: authUser.userId } },
        select: { userId: true },
      })

      return NextResponse.json({
        message: {
          id: message.id,
          chatId: message.chatId,
          groupId: message.groupId,
          content: message.content,
          type: message.type,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          senderId: message.senderId,
          receiverId: message.receiverId,
          read: message.read,
          createdAt: message.createdAt,
          sender: message.sender,
        },
        memberIds: members.map((m) => m.userId),
        tempId,
      })
    }

    // -------- Direct message --------
    if (!chatId || !receiverId) {
      return NextResponse.json(
        { error: 'Either (chatId + receiverId) or groupId is required' },
        { status: 400 }
      )
    }

    // Verify chat ownership
    const chat = await db.chat.findUnique({ where: { id: chatId } })
    if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if (receiverId !== authUser.userId && receiverId !== chat.user1Id && receiverId !== chat.user2Id) {
      return NextResponse.json({ error: 'Invalid receiverId' }, { status: 400 })
    }

    const message = await db.message.create({
      data: {
        chatId,
        senderId: authUser.userId,
        receiverId,
        content: content || '',
        type: type || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
      },
    })

    // Update chat updatedAt for sorting
    await db.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      message: {
        id: message.id,
        chatId: message.chatId,
        groupId: message.groupId,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        senderId: message.senderId,
        receiverId: message.receiverId,
        read: message.read,
        createdAt: message.createdAt,
        sender: message.sender,
      },
      tempId,
    })
  } catch (e) {
    console.error('[create message error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// GET unread count (direct messages only — group unread uses different model)
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'unread-count') {
    const count = await db.message.count({
      where: { receiverId: authUser.userId, read: false },
    })
    return NextResponse.json({ count })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ------------------------------------------------------------
// DELETE message (own only)
// ------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const message = await db.message.findUnique({ where: { id } })
    if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (message.senderId !== authUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await db.message.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[delete message error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
