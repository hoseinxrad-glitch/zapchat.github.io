import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// ============================================================
// POST /api/upload
// FormData: file=...
// Saves file to /home/z/my-project/uploads/
// Returns: { url, fileName, fileSize, mimeType }
// ============================================================

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_SIZE = 100 * 1024 * 1024 // 100 MB (was 10 MB)

const ALLOWED_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  // Videos
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/mpeg',
  // Audio
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/flac',
  // Documents
  'application/pdf', 'text/plain', 'application/zip', 'application/x-zip-compressed',
  'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Code & data
  'application/json', 'application/javascript', 'text/javascript', 'text/css',
  'text/csv', 'text/html', 'text/xml', 'application/xml',
  // Archives
  'application/gzip', 'application/x-tar',
]

export async function POST(req: NextRequest) {
  const authUser = getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large (max 100MB)` }, { status: 413 })
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
      mimeType: file.type || guessMimeType(ext),
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
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
    'video/x-msvideo': '.avi',
    'application/json': '.json',
    'text/csv': '.csv',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  }
  return map[type] || ''
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/x-m4a',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext.toLowerCase()] || 'application/octet-stream'
}
