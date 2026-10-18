import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// ============================================================
// GET /api/admin?action=stats  - dashboard stats
// GET /api/admin?action=users&q=&limit=&offset=  - paginated users
// GET /api/admin?action=channels  - all channels
// GET /api/admin?action=bots  - all bots
// GET /api/admin?action=stories  - all stories
// GET /api/admin?action=groups  - all groups
// GET /api/admin?action=messages&limit=  - recent messages
// ============================================================

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'stats') {
    const [
      totalUsers, totalGroups, totalChannels, totalBots, totalStories,
      totalMessages, totalReactions, bannedUsers, onlineToday,
    ] = await Promise.all([
      db.user.count(),
      db.group.count(),
      db.channel.count(),
      db.bot.count(),
      db.story.count({ where: { expiresAt: { gt: new Date() } } }),
      db.message.count(),
      db.reaction.count(),
      db.user.count({ where: { isBanned: true } }),
      db.user.count({ where: { lastSeen: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ])

    // Get recent signups (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentUsers = await db.user.count({ where: { createdAt: { gt: sevenDaysAgo } } })

    // Messages sent today
    const today = new Date(new Date().setHours(0, 0, 0, 0))
    const messagesToday = await db.message.count({ where: { createdAt: { gt: today } } })

    return NextResponse.json({
      stats: {
        totalUsers,
        totalGroups,
        totalChannels,
        totalBots,
        totalStories,
        totalMessages,
        totalReactions,
        bannedUsers,
        onlineToday,
        recentUsers,
        messagesToday,
      },
    })
  }

  if (action === 'users') {
    const q = url.searchParams.get('q') || ''
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    const where = q.trim()
      ? {
          OR: [
            { username: { contains: q.toLowerCase() } },
            { displayName: { contains: q } },
          ],
        }
      : {}

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, username: true, displayName: true, bio: true,
          avatarColor: true, role: true, isBanned: true,
          createdAt: true, lastSeen: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      db.user.count({ where }),
    ])

    // Add message count per user
    const userIds = users.map((u) => u.id)
    const messageCounts = await db.message.groupBy({
      by: ['senderId'],
      where: { senderId: { in: userIds } },
      _count: { id: true },
    })
    const countMap = new Map(messageCounts.map((m) => [m.senderId, m._count.id]))

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        messageCount: countMap.get(u.id) || 0,
      })),
      total,
    })
  }

  if (action === 'channels') {
    const channels = await db.channel.findMany({
      include: {
        members: { select: { id: true } },
        posts: { select: { id: true } },
        creator: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      channels: channels.map((c) => ({
        id: c.id, username: c.username, name: c.name, description: c.description,
        avatarColor: c.avatarColor, isPrivate: c.isPrivate, createdAt: c.createdAt,
        creator: c.creator, subscriberCount: c.members.length, postCount: c.posts.length,
      })),
    })
  }

  if (action === 'bots') {
    const bots = await db.bot.findMany({
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      bots: bots.map((b) => ({
        id: b.id, username: b.username, displayName: b.displayName, description: b.description,
        avatarColor: b.avatarColor, webhookUrl: b.webhookUrl, createdAt: b.createdAt,
        owner: b.owner,
      })),
    })
  }

  if (action === 'stories') {
    const stories = await db.story.findMany({
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarColor: true } },
        viewers: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      stories: stories.map((s) => ({
        id: s.id, type: s.type, text: s.text, mediaUrl: s.mediaUrl, bgColor: s.bgColor,
        duration: s.duration, views: s.views, createdAt: s.createdAt, expiresAt: s.expiresAt,
        user: s.user, viewerCount: s.viewers.length,
      })),
    })
  }

  if (action === 'groups') {
    const groups = await db.group.findMany({
      include: {
        members: { select: { id: true, userId: true } },
        creator: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id, name: g.name, description: g.description, avatarColor: g.avatarColor,
        createdAt: g.createdAt, slowModeSecs: g.slowModeSecs, allowAnonymousAdmins: g.allowAnonymousAdmins,
        isSupergroup: g.isSupergroup, isChannel: g.isChannel,
        creator: g.creator, memberCount: g.members.length,
      })),
    })
  }

  if (action === 'messages') {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const messages = await db.message.findMany({
      take: Math.min(limit, 200),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
      },
    })
    return NextResponse.json({ messages })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
