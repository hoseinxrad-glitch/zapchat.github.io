import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

// POST /api/stories/[id]/view  - mark a story as viewed

export async function POST(req: NextRequest, { params }: Params) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const story = await db.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (story.userId === authUser.userId) {
    // Don't count own view
    return NextResponse.json({ success: true, self: true })
  }

  const existing = await db.storyView.findUnique({
    where: { storyId_userId: { storyId: id, userId: authUser.userId } },
  })
  if (!existing) {
    await db.$transaction([
      db.storyView.create({ data: { storyId: id, userId: authUser.userId } }),
      db.story.update({ where: { id }, data: { views: { increment: 1 } } }),
    ])
  }

  return NextResponse.json({ success: true, views: story.views + (existing ? 0 : 1) })
}
