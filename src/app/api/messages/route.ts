import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/messages  - persist a message
//   body for direct:  { chatId, receiverId, content, type?, replyToId?, silent? }
//   body for group:   { groupId, content, type?, replyToId?, isAnonymous?, silent? }
//   body for channel: { channelId, content, type? }
// PATCH /api/messages?action=edit   body: { id, content }
// PATCH /api/messages?action=pin    body: { id, chatId?, groupId? }
// PATCH /api/messages?action=unpin  body: { chatId?, groupId? }
// GET /api/messages?action=unread-count
// DELETE /api/messages?id=xxx&action=both  - delete for both sides
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      chatId, groupId, channelId, receiverId,
      content, type, fileUrl, fileName, fileSize,
      audioDuration, audioWaveform, gifId, gifUrl,
      replyToId, isAnonymous, silent, tempId,
    } = body as any

    if (content === undefined && !fileUrl && !gifUrl) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    let message

    // -------- Channel post --------
    if (channelId) {
      const membership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId: authUser.userId } },
      })
      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return NextResponse.json({ error: 'Only channel admins can post' }, { status: 403 })
      }

      message = await db.message.create({
        data: {
          channelId, senderId: authUser.userId,
          content: content || '',
          type: type || 'text',
          fileUrl, fileName, fileSize,
          gifId, gifUrl,
          replyToId: replyToId || null,
          silent: !!silent,
        },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
      })

      return NextResponse.json({ message, tempId })
    }

    // -------- Group message --------
    if (groupId) {
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: authUser.userId } },
      })
      if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

      // Slow mode check
      const group = await db.group.findUnique({ where: { id: groupId } })
      if (group?.slowModeSecs && group.slowModeSecs > 0) {
        const lastMsg = await db.message.findFirst({
          where: { groupId, senderId: authUser.userId },
          orderBy: { createdAt: 'desc' },
        })
        if (lastMsg) {
          const elapsed = (Date.now() - lastMsg.createdAt.getTime()) / 1000
          if (elapsed < group.slowModeSecs) {
            return NextResponse.json({
              error: `Slow mode: wait ${Math.ceil(group.slowModeSecs - elapsed)}s`,
              retryAfter: Math.ceil(group.slowModeSecs - elapsed),
            }, { status: 429 })
          }
        }
      }

      // Anonymous check
      const canAnon = group?.allowAnonymousAdmins && membership.role === 'admin'
      const finalAnon = canAnon && !!isAnonymous

      message = await db.message.create({
        data: {
          groupId, senderId: authUser.userId,
          content: content || '',
          type: type || 'text',
          fileUrl, fileName, fileSize,
          audioDuration, audioWaveform,
          gifId, gifUrl,
          replyToId: replyToId || null,
          silent: !!silent,
          isAnonymous: finalAnon,
        },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
      })

      await db.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } })

      const members = await db.groupMember.findMany({
        where: { groupId, userId: { not: authUser.userId } },
        select: { userId: true },
      })

      return NextResponse.json({
        message: finalAnon ? { ...message, sender: null } : message,
        memberIds: members.map((m) => m.userId),
        tempId,
      })
    }

    // -------- Direct message --------
    if (!chatId || !receiverId) {
      return NextResponse.json({ error: 'Either (chatId+receiverId), groupId, or channelId is required' }, { status: 400 })
    }

    const chat = await db.chat.findUnique({ where: { id: chatId } })
    if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
    if (receiverId !== chat.user1Id && receiverId !== chat.user2Id) {
      return NextResponse.json({ error: 'Invalid receiverId' }, { status: 400 })
    }

    message = await db.message.create({
      data: {
        chatId, senderId: authUser.userId, receiverId,
        content: content || '',
        type: type || 'text',
        fileUrl, fileName, fileSize,
        audioDuration, audioWaveform,
        gifId, gifUrl,
        replyToId: replyToId || null,
        silent: !!silent,
      },
      include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
    })

    await db.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } })

    return NextResponse.json({ message, tempId })
  } catch (e) {
    console.error('[create message error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// PATCH — edit / pin / unpin
// ------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const body = await req.json()

  if (action === 'edit') {
    const { id, content } = body
    if (!id || !content) return NextResponse.json({ error: 'id and content required' }, { status: 400 })

    const msg = await db.message.findUnique({ where: { id } })
    if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (msg.senderId !== authUser.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updated = await db.message.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: { sender: { select: { id: true, username: true, displayName: true, avatarColor: true } } },
    })

    // Notify the other party via WS
    const recipientIds = msg.receiverId ? [msg.receiverId] : []
    if (msg.groupId) {
      const members = await db.groupMember.findMany({
        where: { groupId: msg.groupId, userId: { not: authUser.userId } },
        select: { userId: true },
      })
      recipientIds.push(...members.map((m) => m.userId))
    } else if (msg.channelId) {
      const subs = await db.channelMember.findMany({
        where: { channelId: msg.channelId, userId: { not: authUser.userId } },
        select: { userId: true },
      })
      recipientIds.push(...subs.map((m) => m.userId))
    }

    return NextResponse.json({ message: updated, recipientIds })
  }

  if (action === 'pin') {
    const { id, chatId, groupId } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Verify ownership/membership
    const msg = await db.message.findUnique({ where: { id } })
    if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (groupId) {
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: authUser.userId } },
      })
      if (!membership || membership.role === 'member') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      }
      await db.group.update({ where: { id: groupId }, data: { pinnedMessageId: id } })
    } else if (chatId) {
      // Direct chat - set pinned on both sides' settings
      const chat = await db.chat.findUnique({ where: { id: chatId } })
      if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) {
        return NextResponse.json({ error: 'Not your chat' }, { status: 403 })
      }
      await db.chatUserSettings.upsert({
        where: { chatId_userId: { chatId, userId: authUser.userId } },
        create: { chatId, userId: authUser.userId, pinnedMessageId: id },
        update: { pinnedMessageId: id },
      })
    }

    return NextResponse.json({ success: true, pinnedMessageId: id })
  }

  if (action === 'unpin') {
    const { chatId, groupId } = body
    if (groupId) {
      await db.group.update({ where: { id: groupId }, data: { pinnedMessageId: null } })
    } else if (chatId) {
      await db.chatUserSettings.updateMany({
        where: { chatId, userId: authUser.userId },
        data: { pinnedMessageId: null },
      })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ------------------------------------------------------------
// GET unread count
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
// DELETE — delete for both sides
// ------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const forBoth = url.searchParams.get('action') === 'both'
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const message = await db.message.findUnique({ where: { id } })
    if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Sender can always delete their own message
    // For "delete for both sides", sender can delete at any time
    // Receiver can only delete for themselves (no DB delete - we just hide)
    if (message.senderId !== authUser.userId) {
      if (!forBoth) {
        // For self delete - we don't actually delete, just return success
        return NextResponse.json({ success: true, hidden: true })
      }
      return NextResponse.json({ error: 'Forbidden — only sender can delete for both' }, { status: 403 })
    }

    // Sender deleting — also delete reactions and replies (cascade)
    await db.reaction.deleteMany({ where: { messageId: id } })

    // For replies pointing to this message, set replyToId to null
    await db.message.updateMany({
      where: { replyToId: id },
      data: { replyToId: null },
    })

    await db.message.delete({ where: { id } })

    // Get recipientIds for WS broadcast
    const recipientIds: string[] = []
    if (message.receiverId) recipientIds.push(message.receiverId)
    if (message.groupId) {
      const members = await db.groupMember.findMany({
        where: { groupId: message.groupId, userId: { not: authUser.userId } },
        select: { userId: true },
      })
      recipientIds.push(...members.map((m) => m.userId))
    } else if (message.channelId) {
      const subs = await db.channelMember.findMany({
        where: { channelId: message.channelId, userId: { not: authUser.userId } },
        select: { userId: true },
      })
      recipientIds.push(...subs.map((m) => m.userId))
    }

    return NextResponse.json({ success: true, recipientIds, messageId: id })
  } catch (e) {
    console.error('[delete message error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
