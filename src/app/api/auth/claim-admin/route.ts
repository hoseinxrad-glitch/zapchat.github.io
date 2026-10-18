import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST /api/auth/claim-admin
// Claims admin role for the calling user IF no admin exists yet.
// This is a bootstrap mechanism — once an admin exists, this route refuses to run.
// ============================================================

export async function POST(req: NextRequest) {
  // Check if any admin exists
  const existingAdmin = await db.user.findFirst({
    where: { role: 'admin' },
    select: { id: true, username: true },
  })
  if (existingAdmin) {
    return NextResponse.json({
      error: 'Admin already exists',
      adminUsername: existingAdmin.username,
    }, { status: 403 })
  }

  // Verify caller's token
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the token locally (to avoid circular import)
  const { verifyToken } = await import('@/lib/auth')
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Promote this user to admin
  const updated = await db.user.update({
    where: { id: payload.userId },
    data: { role: 'admin' },
    select: {
      id: true, username: true, displayName: true, avatarColor: true,
      role: true, isBanned: true, createdAt: true,
    },
  })

  return NextResponse.json({
    user: updated,
    message: 'You are now an admin!',
  })
}
