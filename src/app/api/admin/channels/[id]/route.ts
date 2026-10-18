import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// DELETE /api/admin/channels/[id]  - delete any channel

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const channel = await db.channel.findUnique({ where: { id } })
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.channel.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
