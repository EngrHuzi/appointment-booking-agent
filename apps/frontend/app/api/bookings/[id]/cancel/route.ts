import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiKey = req.headers.get('X-API-Key') ?? ''
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

  try {
    const upstream = await fetch(`${backendUrl}/bookings/${id}/cancel`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 503 })
  }
}
