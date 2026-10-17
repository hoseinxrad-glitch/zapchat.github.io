import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword, generateToken, verifyToken } from '@/lib/auth'

// ============================================================
// POST /api/auth/register
// Body: { username, displayName, password, bio?, avatarColor? }
// ============================================================
// POST /api/auth/login
// Body: { username, password }
// ============================================================
// GET /api/auth/me  (token in header)
// ============================================================

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'register') {
    return handleRegister(req)
  }
  if (action === 'login') {
    return handleLogin(req)
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'me') {
    return handleMe(req)
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ------------------------------------------------------------
// Register
// ------------------------------------------------------------
async function handleRegister(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, displayName, password, bio, avatarColor } = body

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: 'username, displayName and password are required' },
        { status: 400 }
      )
    }
    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers and underscore' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316']
    const finalColor = avatarColor || colors[Math.floor(Math.random() * colors.length)]

    const user = await db.user.create({
      data: {
        username,
        displayName,
        bio: bio || '',
        avatarColor: finalColor,
        passwordHash: hashPassword(password),
      },
    })

    const token = generateToken({ userId: user.id, username: user.username })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
      },
    })
  } catch (e) {
    console.error('[register error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------
async function handleLogin(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { username } })
    if (!user || !verifyPassword(user.passwordHash, password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date() },
    })

    const token = generateToken({ userId: user.id, username: user.username })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
      },
    })
  } catch (e) {
    console.error('[login error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// Me - get current user from token
// ------------------------------------------------------------
async function handleMe(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const user = await db.user.findUnique({ where: { id: payload.userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
    },
  })
}
