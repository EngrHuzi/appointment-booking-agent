# Frontend — Next.js Chat UI

Next.js 16 App Router chat interface for the salon booking agent.

## Stack

- Next.js 16 App Router (TypeScript)
- Tailwind CSS v4
- Cormorant Garamond + DM Sans (Google Fonts)
- SSE streaming via `fetch` + `ReadableStream`

## Structure

```
app/
├── page.tsx              # Server component shell
├── layout.tsx            # Fonts, metadata
├── globals.css           # Design tokens, animations
└── api/chat/route.ts     # Proxy to FastAPI (keeps backend URL server-side)

components/
├── ChatWidget.tsx        # Interactive chat with SSE streaming
└── BookingCard.tsx       # Confirmed booking card
```

## Dev

```bash
pnpm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Connect this repo to Vercel. Set one environment variable:

```
NEXT_PUBLIC_API_URL=https://your-railway-backend-url.up.railway.app
```
