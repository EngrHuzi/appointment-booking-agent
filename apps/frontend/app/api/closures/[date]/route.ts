import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const apiKey = req.headers.get('X-API-Key') ?? ''
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

  try {
    const upstream = await fetch(`${backendUrl}/closures/${date}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey },
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 503 })
  }
}
