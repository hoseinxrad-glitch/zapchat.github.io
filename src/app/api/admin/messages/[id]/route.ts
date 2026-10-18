import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// DELETE /api/admin/messages/[id]  - delete any message (admin override)

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const msg = await db.message.findUnique({ where: { id } })
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction([
    db.reaction.deleteMany({ where: { messageId: id } }),
    db.message.updateMany({ where: { replyToId: id }, data: { replyToId: null } }),
    db.message.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true, messageId: id })
}
