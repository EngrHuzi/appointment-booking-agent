# Appointment Booking Agent

An AI-powered salon booking agent that handles the full appointment lifecycle — intake, availability checking, confirmation, reminders, and rescheduling — with zero human involvement. Clients chat in natural language and leave with a confirmed booking and a confirmation email in their inbox.

> **Proof of Value** — one salon, one working URL, five user actions end-to-end.

---

## Demo

![Zara — AI Booking Assistant chat interface](assets/chat-ui.png)

| Chat Interface | Booking Confirmation |
|---|---|
| Client types naturally: *"I want a haircut on Saturday at 2pm"* | Agent confirms slot, fires email, renders booking card |

---

## How It Works

```
Client (browser)
    │  SSE stream
    ▼
Next.js Frontend  ──proxy──▶  FastAPI Agent Server
                                     │  OpenAI Agents SDK
                                     │  Gemini (google endpoint)
                                     ▼
                              MCP Server (FastMCP)
                                     │
                              ┌──────┴──────┐
                           Neon DB       Resend
                         (PostgreSQL)   (emails)
```

1. Client sends a message from the Next.js chat UI
2. Next.js proxies it to the FastAPI agent server (keeps backend URL server-side)
3. FastAPI passes the conversation to the OpenAI Agents SDK running Gemini
4. The agent calls tools hosted on a FastMCP server over SSE when it needs to act
5. Tools read/write Neon PostgreSQL and send emails via Resend
6. Responses stream back token-by-token as SSE events
7. A `BookingCard` renders in the UI when a booking is confirmed

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Agent | OpenAI Agents SDK 0.17.4 + Gemini via Google OpenAI-compatible endpoint |
| Backend | FastAPI + uvicorn |
| Tools | FastMCP 3.3.1 over SSE transport |
| Database | PostgreSQL on Neon (serverless, free tier) |
| Email | Resend (confirmation + 24-hour scheduled reminder) |
| Frontend | Next.js 16 App Router, TypeScript |
| Styling | Tailwind CSS v4 + CSS variables, Cormorant Garamond + DM Sans |
| Package manager | uv (Python), pnpm (Node) |
| Backend hosting | Railway |
| Frontend hosting | Vercel |
| CI | GitHub Actions → GHCR (Docker images) |

---

## Monorepo Structure

```
appointment-booking-agent/
├── apps/
│   ├── backend/                  # FastAPI agent server → Railway
│   │   ├── main.py               # /chat, /bookings, /closures, /health + cancel/reschedule
│   │   ├── agent.py              # Agents SDK setup, Gemini model
│   │   ├── Dockerfile
│   │   ├── railway.toml
│   │   └── pyproject.toml
│   │
│   ├── mcp-server/               # FastMCP tool server → Railway
│   │   ├── server.py             # 8 MCP tools over SSE
│   │   ├── database.py           # PostgreSQL CRUD + salon_hours + closed_dates
│   │   ├── email_service.py      # Resend integration
│   │   ├── Dockerfile
│   │   ├── railway.toml
│   │   └── pyproject.toml
│   │
│   └── frontend/                 # Next.js chat UI + owner dashboard → Vercel
│       ├── app/
│       │   ├── page.tsx
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   ├── dashboard/page.tsx          # Owner dashboard (All/Today/Closures)
│       │   └── api/
│       │       ├── chat/route.ts
│       │       ├── bookings/route.ts
│       │       ├── bookings/[id]/cancel/route.ts
│       │       ├── bookings/[id]/reschedule/route.ts
│       │       ├── closures/route.ts
│       │       └── closures/[date]/route.ts
│       ├── components/
│       │   ├── ChatWidget.tsx    # SSE streaming chat, mobile responsive
│       │   └── BookingCard.tsx   # Confirmed booking card
│       └── hooks/
│           └── useIsMobile.ts   # 768px matchMedia hook
│
├── docker-compose.yml            # Local dev (all three services)
├── .github/workflows/docker.yml  # CI: build + push to GHCR
└── AGENTS.md                     # AI agent coding instructions
```

---

## Agent Capabilities

The agent (Zara) handles four intents via MCP tools:

| Tool | What it does |
|---|---|
| `check_availability` | Checks `salon_hours` + `closed_dates` first, then queries Neon for booking conflicts; returns alternatives with friendly display strings |
| `book_appointment` | Writes appointment to Neon, fires confirmation email, schedules 24h reminder via Resend |
| `reschedule_appointment` | Cancels old reminder, updates slot, sends reschedule email |
| `cancel_appointment` | Marks cancelled, cancels reminder, sends cancellation email |
| `list_appointments` | Returns all appointments for the `/bookings` endpoint |
| `get_closed_dates` | Returns all holiday/closure dates |
| `add_closed_date` | Adds a specific closure date (e.g. Eid) — blocks it from bookings immediately |
| `remove_closed_date` | Removes a closure date, making it bookable again |

---

## Local Development

### Prerequisites

- Python 3.13+
- [uv](https://docs.astral.sh/uv/) — `pip install uv`
- Node.js 18+ and [pnpm](https://pnpm.io) — `npm i -g pnpm`
- A [Google AI Studio](https://aistudio.google.com) API key (free tier)
- A [Resend](https://resend.com) API key (free tier, 3k emails/month)

### Option A — Docker (recommended)

```bash
# Copy and fill in env vars
cp apps/backend/.env.example apps/backend/.env
cp apps/mcp-server/.env.example apps/mcp-server/.env

# Start all three services
docker compose up --build
```

Services:
- MCP server: `http://localhost:8001`
- Agent server: `http://localhost:8000`
- Frontend: run separately (see Option B)

### Option B — Run each service manually

**MCP server**
```bash
cd apps/mcp-server
cp .env.example .env          # fill in RESEND_API_KEY etc.
uv sync
uv run python server.py
# → listening on http://localhost:8001
```

**Agent server**
```bash
cd apps/backend
cp .env.example .env          # fill in GOOGLE_API_KEY, MCP_SERVER_URL etc.
uv sync
uv run uvicorn main:app --reload --port 8000
# → listening on http://localhost:8000
```

**Frontend**
```bash
cd apps/frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
pnpm install
pnpm dev
# → http://localhost:3000
```

---

## Environment Variables

### `apps/backend/.env`

```env
GOOGLE_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
OPENAI_API_KEY=your_openai_key_for_tracing_optional
MCP_SERVER_URL=http://localhost:8001/sse
SALON_NAME=Huzi Salon
SALON_CITY=Lahore
SALON_EMAIL=bookings@yourdomain.com
BOOKING_API_KEY=your_secret_key_here
```

### `apps/mcp-server/.env`

```env
RESEND_API_KEY=your_resend_api_key
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SALON_NAME=Huzi Salon
SALON_CITY=Lahore
SALON_EMAIL=onboarding@resend.dev
```

### `apps/frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## API Reference

### `POST /chat`
Stream a conversation turn through the booking agent.

**Request**
```json
{
  "messages": [
    { "role": "user", "content": "I want to book a haircut on Saturday at 2pm" }
  ]
}
```

**Response** — `text/event-stream`
```
data: {"type": "delta", "content": "Hi! I'd be happy"}
data: {"type": "delta", "content": " to help you book that."}
data: {"type": "booking", "booking": {"booking_id": "A1B2C3D4", "client_name": "Sara", ...}}
data: [DONE]
```

### `GET /bookings`
Returns all appointments. Requires `X-API-Key` header.

### `POST /bookings/{id}/cancel`
Cancels a booking and fires a cancellation email. Requires `X-API-Key`.

### `POST /bookings/{id}/reschedule`
Body: `{"new_datetime": "2026-07-10T14:00:00"}`. Reschedules and fires email. Requires `X-API-Key`.

### `GET /closures`
Returns all closed dates. Requires `X-API-Key`.

### `POST /closures`
Body: `{"date": "2026-06-28", "reason": "Eid ul Adha"}`. Adds a closed date. Requires `X-API-Key`.

### `DELETE /closures/{date}`
Removes a closed date. Requires `X-API-Key`.

### `GET /health`
Returns `{"status": "ok"}`. Used by Railway health checks.

---

## Deployment

### 1 — Deploy MCP server to Railway

1. New project → deploy from GitHub
2. Set **Root Directory** to `apps/mcp-server`
3. Set environment variables: `RESEND_API_KEY`, `DATABASE_URL` (Neon connection string), `SALON_NAME`, `SALON_CITY`, `SALON_EMAIL`
4. Copy the generated service URL (e.g. `https://mcp-xxx.up.railway.app`)

### 2 — Deploy agent server to Railway

1. New service in the same project → GitHub, root `apps/backend`
2. Set `MCP_SERVER_URL` to `https://mcp-xxx.up.railway.app/sse` (URL from step 1 + `/sse`)
3. Set `GOOGLE_API_KEY`, `GEMINI_MODEL=gemini-3.1-flash-lite`, `BOOKING_API_KEY`, `SALON_NAME`, `SALON_CITY`, `SALON_EMAIL`

### 3 — Deploy frontend to Vercel

```bash
cd apps/frontend
npx vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to the agent server Railway URL.

---

## CI — Docker Images

GitHub Actions builds and pushes both Docker images to GHCR on every push to `main`:

```
ghcr.io/<owner>/mcp-server:latest
ghcr.io/<owner>/agent-server:latest
```

Images are tagged with both `latest` and the commit SHA.

---

## PostgreSQL Schema (Neon)

Three tables created by `init_db()` on MCP server startup. `salon_hours` is seeded once with Mon–Sat open 10:00–19:00 and Sunday closed.

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id                TEXT PRIMARY KEY,
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  service           TEXT NOT NULL,
  appt_datetime     TEXT NOT NULL,        -- ISO 8601 (aliased AS datetime in SELECTs)
  duration_minutes  INTEGER NOT NULL,
  status            TEXT DEFAULT 'confirmed',
  reminder_email_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_hours (
  day_of_week  INTEGER PRIMARY KEY,       -- 0=Mon … 6=Sun
  open_time    TEXT NOT NULL DEFAULT '10:00',
  close_time   TEXT NOT NULL DEFAULT '19:00',
  is_open      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS closed_dates (
  date    TEXT PRIMARY KEY,               -- YYYY-MM-DD
  reason  TEXT DEFAULT ''
);
```

---

## Services & Cost (PoV scale)

| Service | Cost |
|---|---|
| Gemini API (gemini-3.1-flash-lite, free tier) | ~$0 for dev/demo |
| OpenAI Agents SDK | Free (open-source) |
| Resend | Free — 3,000 emails/month |
| Neon PostgreSQL | Free — 0.5 GB storage |
| Railway | Free tier sufficient |
| Vercel | Free tier sufficient |
| **Total (~200 bookings/month)** | **Under $5** |

---

## License

MIT
