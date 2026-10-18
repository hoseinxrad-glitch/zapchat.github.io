import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// GET /api/users/search?q=keyword
// Search users by username or display name (excluding self)
// ============================================================
// GET /api/users/all  - list all users (excluding self)
// ============================================================
// PATCH /api/users/profile  - update profile
// ============================================================

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'search') {
    const q = (url.searchParams.get('q') || '').trim()
    if (q.length < 1) {
      return NextResponse.json({ users: [] })
    }
    const users = await db.user.findMany({
      where: {
        AND: [
          { id: { not: authUser.userId } },
          {
            OR: [
              { username: { contains: q } },
              { displayName: { contains: q } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarColor: true,
        lastSeen: true,
      },
      take: 30,
    })
    return NextResponse.json({ users })
  }

  if (action === 'all') {
    const users = await db.user.findMany({
      where: { id: { not: authUser.userId } },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarColor: true,
        lastSeen: true,
      },
      take: 100,
    })
    return NextResponse.json({ users })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ------------------------------------------------------------
// PATCH - update own profile
// ------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { displayName, bio, avatarColor } = body

    const data: any = {}
    if (typeof displayName === 'string' && displayName.trim()) {
      data.displayName = displayName.trim().slice(0, 50)
    }
    if (typeof bio === 'string') {
      data.bio = bio.slice(0, 200)
    }
    if (typeof avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
      data.avatarColor = avatarColor
    }

    const user = await db.user.update({
      where: { id: authUser.userId },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarColor: true,
      },
    })

    return NextResponse.json({ user })
  } catch (e) {
    console.error('[users patch error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
