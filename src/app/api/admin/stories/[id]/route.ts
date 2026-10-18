import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// DELETE /api/admin/stories/[id]  - delete any story

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const story = await db.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.story.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
