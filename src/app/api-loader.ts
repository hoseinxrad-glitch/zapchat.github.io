// This file tells Render that we have API routes
// It's a placeholder so Render builds the server correctly
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ 
    status: 'ok', 
    message: 'ZapChat API is running',
    timestamp: new Date().toISOString()
  })
}
