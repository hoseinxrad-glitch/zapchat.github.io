import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// DELETE /api/admin/groups/[id]  - delete any group (admin override)

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const group = await db.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.group.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
