import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('X-API-Key') ?? ''
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

  try {
    const upstream = await fetch(`${backendUrl}/closures`, {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('X-API-Key') ?? ''
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
  const body = await req.json()

  try {
    const upstream = await fetch(`${backendUrl}/closures`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 503 })
  }
}
