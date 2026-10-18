import { NextResponse } from 'next/server'

// Health check endpoint for Render
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'zapchat-web',
    timestamp: new Date().toISOString(),
  })
}

// Allow Render's health checks to be fast
export const dynamic = 'force-static'
export const revalidate = 0
