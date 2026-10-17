import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import crypto from 'crypto'

// ============================================================
// POST /api/bots  - register a new bot
//   body: { username, displayName, description?, avatarColor?, webhookUrl? }
// GET /api/bots?action=mine
// GET /api/bots?action=search&q=xxx
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { username, displayName, description, avatarColor, webhookUrl } = body as {
      username: string
      displayName: string
      description?: string
      avatarColor?: string
      webhookUrl?: string
    }

    if (!username || !displayName) {
      return NextResponse.json({ error: 'username and displayName are required' }, { status: 400 })
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(username)) {
      return NextResponse.json({
        error: 'Bot username must be 3-32 chars, start with letter, only letters/numbers/_',
      }, { status: 400 })
    }
    const botUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '')
    // Append _bot suffix if not present (Telegram convention)
    const finalUsername = botUsername.endsWith('_bot') ? botUsername : `${botUsername}_bot`

    // Check uniqueness against Users, Channels, and Bots
    const [existingBot, existingChannel, existingUser] = await Promise.all([
      db.bot.findUnique({ where: { username: finalUsername } }),
      db.channel.findUnique({ where: { username: finalUsername } }),
      db.user.findUnique({ where: { username: finalUsername } }),
    ])
    if (existingBot || existingChannel || existingUser) {
      return NextResponse.json({ error: 'Bot username already taken' }, { status: 409 })
    }

    const colors = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']
    const finalColor = avatarColor || colors[Math.floor(Math.random() * colors.length)]

    if (webhookUrl) {
      try { new URL(webhookUrl) } catch {
        return NextResponse.json({ error: 'Invalid webhookUrl' }, { status: 400 })
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const bot = await db.bot.create({
      data: {
        username: finalUsername,
        displayName: displayName.trim(),
        description: (description || '').slice(0, 200),
        avatarColor: finalColor,
        token,
        ownerId: authUser.userId,
        webhookUrl: webhookUrl || null,
      },
    })

    return NextResponse.json({ bot: { ...bot, token } })
  } catch (e) {
    console.error('[create bot error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'mine') {
    const bots = await db.bot.findMany({
      where: { ownerId: authUser.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, displayName: true, description: true,
        avatarColor: true, ownerId: true, webhookUrl: true, createdAt: true,
        // Do NOT return token
      },
    })
    return NextResponse.json({ bots })
  }

  if (action === 'search') {
    const q = (url.searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ bots: [] })

    const bots = await db.bot.findMany({
      where: {
        OR: [
          { username: { contains: q.toLowerCase() } },
          { displayName: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 30,
      select: {
        id: true, username: true, displayName: true, description: true, avatarColor: true,
      },
    })

    return NextResponse.json({ bots })
  }

  if (action === 'list') {
    // Public bot directory
    const bots = await db.bot.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, displayName: true, description: true, avatarColor: true,
      },
    })
    return NextResponse.json({ bots })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
