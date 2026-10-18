import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

// ============================================================
// POST /api/calls?action=initiate
//   body: { receiverId, callType: 'audio'|'video' }
//   Creates a "call record" - actually we just use it to signal intent.
//   Real signaling happens over WebSocket (calls:offer, calls:answer, calls:ice).
// GET /api/calls?action=history  - recent calls
// ============================================================

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'initiate') {
    const body = await req.json()
    const { receiverId, callType } = body as { receiverId: string, callType: 'audio' | 'video' }
    if (!receiverId) return NextResponse.json({ error: 'receiverId required' }, { status: 400 })
    if (!['audio', 'video'].includes(callType)) {
      return NextResponse.json({ error: 'Invalid callType' }, { status: 400 })
    }

    // Verify they have a chat
    const otherUser = await db.user.findUnique({ where: { id: receiverId } })
    if (!otherUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Generate a call ID
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return NextResponse.json({
      callId,
      caller: { id: authUser.userId },
      receiver: { id: receiverId },
      callType,
      // The client should now emit a 'calls:invite' event via WebSocket with this callId
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'history') {
    // For simplicity, we don't store call history in DB. Return empty.
    return NextResponse.json({ calls: [] })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
