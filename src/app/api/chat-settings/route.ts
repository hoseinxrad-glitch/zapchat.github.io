import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// PATCH /api/chat-settings
//   body: { chatId?, groupId?, archived?, muted?, autoDeleteSecs? }
// GET /api/chat-settings?chatId=xxx OR ?groupId=xxx
// ============================================================

export async function PATCH(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { chatId, groupId, archived, muted, autoDeleteSecs } = body

    if (!chatId && !groupId) {
      return NextResponse.json({ error: 'chatId or groupId required' }, { status: 400 })
    }

    const data: any = {}
    if (typeof archived === 'boolean') data.archived = archived
    if (typeof muted === 'boolean') data.muted = muted
    if (typeof autoDeleteSecs === 'number') {
      if (![0, 86400, 604800, 2592000].includes(autoDeleteSecs)) {
        return NextResponse.json({ error: 'Invalid autoDeleteSecs (allowed: 0, 86400, 604800, 2592000)' }, { status: 400 })
      }
      data.autoDeleteSecs = autoDeleteSecs
    }

    if (groupId) {
      // Verify membership
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: authUser.userId } },
      })
      if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

      const updated = await db.groupMember.update({
        where: { id: membership.id },
        data,
      })
      return NextResponse.json({
        settings: {
          archived: updated.archived,
          muted: updated.muted,
          autoDeleteSecs: updated.autoDeleteSecs,
        },
      })
    }

    // Direct chat
    const chat = await db.chat.findUnique({ where: { id: chatId } })
    if (!chat || (chat.user1Id !== authUser.userId && chat.user2Id !== authUser.userId)) {
      return NextResponse.json({ error: 'Not your chat' }, { status: 403 })
    }

    const updated = await db.chatUserSettings.upsert({
      where: { chatId_userId: { chatId, userId: authUser.userId } },
      create: { chatId, userId: authUser.userId, ...data },
      update: data,
    })

    return NextResponse.json({
      settings: {
        archived: updated.archived,
        muted: updated.muted,
        autoDeleteSecs: updated.autoDeleteSecs,
        pinnedMessageId: updated.pinnedMessageId,
      },
    })
  } catch (e) {
    console.error('[chat-settings error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const chatId = url.searchParams.get('chatId')
  const groupId = url.searchParams.get('groupId')

  if (groupId) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: authUser.userId } },
    })
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

    const group = await db.group.findUnique({ where: { id: groupId } })
    return NextResponse.json({
      settings: {
        archived: membership.archived,
        muted: membership.muted,
        autoDeleteSecs: membership.autoDeleteSecs,
        pinnedMessageId: group?.pinnedMessageId,
        slowModeSecs: group?.slowModeSecs,
        allowAnonymousAdmins: group?.allowAnonymousAdmins,
      },
    })
  }

  if (chatId) {
    const settings = await db.chatUserSettings.findUnique({
      where: { chatId_userId: { chatId, userId: authUser.userId } },
    })
    return NextResponse.json({
      settings: settings ? {
        archived: settings.archived,
        muted: settings.muted,
        autoDeleteSecs: settings.autoDeleteSecs,
        pinnedMessageId: settings.pinnedMessageId,
      } : null,
    })
  }

  return NextResponse.json({ error: 'chatId or groupId required' }, { status: 400 })
}
