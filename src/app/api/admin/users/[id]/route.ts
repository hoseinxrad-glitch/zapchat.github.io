import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// PATCH /api/admin/users/[id]
//   body: { action: 'ban' | 'unban' | 'promote' | 'demote' }
// DELETE /api/admin/users/[id]  - delete user account

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { action } = body as { action: 'ban' | 'unban' | 'promote' | 'demote' }

  if (!['ban', 'unban', 'promote', 'demote'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Prevent self-ban/demote
  if (id === admin.userId) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 })
  }

  // Prevent demoting other admins (only super-admin could, but for simplicity we don't allow it)
  if (targetUser.role === 'admin' && action !== 'demote') {
    return NextResponse.json({ error: 'Cannot modify another admin' }, { status: 403 })
  }

  let data: any = {}
  if (action === 'ban') data.isBanned = true
  if (action === 'unban') data.isBanned = false
  if (action === 'promote') data.role = 'admin'
  if (action === 'demote') data.role = 'user'

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true, username: true, displayName: true, avatarColor: true,
      role: true, isBanned: true, lastSeen: true, createdAt: true,
    },
  })

  return NextResponse.json({ user: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  if (id === admin.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const targetUser = await db.user.findUnique({ where: { id } })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (targetUser.role === 'admin') {
    return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 403 })
  }

  // Cascade: delete all user's data
  await db.$transaction([
    db.reaction.deleteMany({ where: { userId: id } }),
    db.storyView.deleteMany({ where: { userId: id } }),
    db.groupMember.deleteMany({ where: { userId: id } }),
    db.channelMember.deleteMany({ where: { userId: id } }),
    db.message.deleteMany({ where: { senderId: id } }),
    db.message.deleteMany({ where: { receiverId: id } }),
    db.bot.deleteMany({ where: { ownerId: id } }),
    db.chatUserSettings.deleteMany({ where: { userId: id } }),
    db.story.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
