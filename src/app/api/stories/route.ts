import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/stories  - create a story
//   body: { type: 'image'|'text', mediaUrl?, text?, bgColor?, duration? }
// GET /api/stories?action=feed  - stories from users I follow + mine
// GET /api/stories?action=mine
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { type, mediaUrl, text, bgColor, duration } = body as {
      type: 'image' | 'text'
      mediaUrl?: string
      text?: string
      bgColor?: string
      duration?: number
    }

    if (!type || (type === 'image' && !mediaUrl) || (type === 'text' && !text)) {
      return NextResponse.json({ error: 'Invalid story' }, { status: 400 })
    }

    const hours = duration || 24
    if (![6, 12, 24, 48].includes(hours)) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
    }

    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#6366f1']
    const finalColor = bgColor || colors[Math.floor(Math.random() * colors.length)]

    const story = await db.story.create({
      data: {
        userId: authUser.userId,
        type,
        mediaUrl: mediaUrl || null,
        text: text || null,
        bgColor: finalColor,
        duration: hours,
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({ story })
  } catch (e) {
    console.error('[create story error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'feed') {
    // Get active stories (not expired) from this user + all other users (since we don't have follow graph)
    const stories = await db.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarColor: true } },
        viewers: { select: { userId: true } },
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
    })

    // Group by user
    const byUser: Record<string, { user: any; stories: any[] }> = {}
    for (const s of stories) {
      if (!byUser[s.userId]) {
        byUser[s.userId] = { user: s.user, stories: [] }
      }
      const viewedByMe = s.viewers.some((v) => v.userId === authUser.userId)
      byUser[s.userId].stories.push({
        id: s.id,
        type: s.type,
        mediaUrl: s.mediaUrl,
        text: s.text,
        bgColor: s.bgColor,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        views: s.views,
        viewedByMe,
        isMine: s.userId === authUser.userId,
      })
    }

    return NextResponse.json({
      groups: Object.values(byUser).sort((a: any, b: any) => {
        // Mine first, then by most recent
        if (a.user.id === authUser.userId) return -1
        if (b.user.id === authUser.userId) return 1
        return new Date(b.stories[0].createdAt).getTime() - new Date(a.stories[0].createdAt).getTime()
      }),
    })
  }

  if (action === 'mine') {
    const stories = await db.story.findMany({
      where: {
        userId: authUser.userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ stories })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const story = await db.story.findUnique({ where: { id } })
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (story.userId !== authUser.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.story.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
