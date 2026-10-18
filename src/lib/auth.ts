import crypto from 'crypto'

// ============================================================
// Password hashing (using Node's built-in scrypt)
// ============================================================
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(stored: string, password: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'))
  } catch {
    return false
  }
}

// ============================================================
// Simple JWT-like token (HMAC signed, base64 encoded)
// We use this instead of a library to keep things dependency-free
// ============================================================
const SECRET = process.env.AUTH_SECRET || 'zapchat-dev-secret-change-in-production-2026'

interface TokenPayload {
  userId: string
  username: string
  iat?: number
  exp?: number
}

export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 60 * 60 * 24 * 30 // 30 days
  const data: TokenPayload = { ...payload, iat, exp }
  const body = Buffer.from(JSON.stringify(data)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expectedSig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ============================================================
// Middleware helper - get authenticated user from request
// ============================================================
export function getAuthUser(req: Request): { userId: string; username: string } | null {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return { userId: payload.userId, username: payload.username }
}

// ============================================================
// Admin check - returns user if admin, otherwise null
// ============================================================
export async function requireAdmin(req: Request): Promise<{ userId: string; username: string } | null> {
  const authUser = getAuthUser(req)
  if (!authUser) return null
  // Dynamic import to avoid circular dependency
  const { db } = await import('@/lib/db')
  const user = await db.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true, isBanned: true },
  })
  if (!user || user.isBanned || user.role !== 'admin') return null
  return authUser
}
