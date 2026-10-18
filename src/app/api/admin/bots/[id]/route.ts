import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// DELETE /api/admin/bots/[id]  - delete any bot
// PATCH /api/admin/bots/[id]  - regenerate token (body: { action: 'regenerate-token' })

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const bot = await db.bot.findUnique({ where: { id } })
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.bot.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
