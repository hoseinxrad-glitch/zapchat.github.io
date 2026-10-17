import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// ============================================================
// POST /api/upload
// FormData: file=...
// Saves file to /home/z/my-project/uploads/
// Returns: { url, fileName, fileSize }
// ============================================================

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'application/zip',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'video/mp4', 'video/webm',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json', 'application/javascript', 'text/csv',
]

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
    }

    // Make sure uploads dir exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true })

    // Generate a unique filename
    const ext = path.extname(file.name) || guessExtFromType(file.type)
    const safeName = `${crypto.randomBytes(12).toString('hex')}${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    return NextResponse.json({
      url: `/uploads/${safeName}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
  } catch (e) {
    console.error('[upload error]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function guessExtFromType(type: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'audio/mpeg': '.mp3',
    'video/mp4': '.mp4',
  }
  return map[type] || ''
}
