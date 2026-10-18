import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/messages/forward
//   body: {
//     messageId: string,
//     targetChatId?: string,
//     targetGroupId?: string,
//     targetChannelId?: string,
//     targetReceiverId?: string,
//   }
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { messageId, targetChatId, targetGroupId, targetChannelId, targetReceiverId } = body

    if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

    const original = await db.message.findUnique({
      where: { id: messageId },
      include: { sender: { select: { id: true, username: true, displayName: true } } },
    })
    if (!original) return NextResponse.json({ error: 'Original message not found' }, { status: 404 })

    let chatId: string | null = null
    let groupId: string | null = null
    let channelId: string | null = null
    let receiverId: string | null = null

    if (targetChannelId) {
      const m = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId: targetChannelId, userId: authUser.userId } },
      })
      if (!m || (m.role !== 'admin' && m.role !== 'owner')) {
        return NextResponse.json({ error: 'Only channel admins can post' }, { status: 403 })
      }
      channelId = targetChannelId
    } else if (targetGroupId) {
      const m = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId: targetGroupId, userId: authUser.userId } },
      })
      if (!m) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
      groupId = targetGroupId
    } else if (targetChatId && targetReceiverId) {
      const chat = await db.chat.findUnique({ where: { id: targetChatId } })
      if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) {
        return NextResponse.json({ error: 'Not your chat' }, { status: 403 })
      }
      chatId = targetChatId
      receiverId = targetReceiverId
    } else {
      return NextResponse.json({ error: 'No valid target specified' }, { status: 400 })
    }

    const forwarded = await db.message.create({
      data: {
        chatId, groupId, channelId, receiverId,
        senderId: authUser.userId,
        content: original.content,
        type: original.type,
        fileUrl: original.fileUrl,
        fileName: original.fileName,
        fileSize: original.fileSize,
        audioDuration: original.audioDuration,
        audioWaveform: original.audioWaveform,
        gifId: original.gifId,
        gifUrl: original.gifUrl,
        videoDuration: original.videoDuration,
        videoThumbnail: original.videoThumbnail,
        forwardedFromName: original.sender?.displayName || original.sender?.username || 'Unknown',
        forwardedFromId: original.senderId,
        isSpoiler: original.isSpoiler,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarColor: true } },
      },
    })

    if (chatId) await db.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } })
    if (groupId) await db.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } })
    if (channelId) await db.channel.update({ where: { id: channelId }, data: { updatedAt: new Date() } })

    const recipientIds: string[] = []
    if (receiverId) recipientIds.push(receiverId)
    if (groupId) {
      const members = await db.groupMember.findMany({
        where: { groupId, userId: { not: authUser.userId } },
        select: { userId: true },
      })
      recipientIds.push(...members.map((m) => m.userId))
    } else if (channelId) {
      const subs = await db.channelMember.findMany({
        where: { channelId, userId: { not: authUser.userId } },
        select: { userId: true },
      })
      recipientIds.push(...subs.map((s) => s.userId))
    }

    return NextResponse.json({
      message: forwarded,
      recipientIds,
      conversationId: chatId || groupId || channelId,
      isGroup: !!groupId,
      isChannel: !!channelId,
    })
  } catch (e) {
    console.error('[forward error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
