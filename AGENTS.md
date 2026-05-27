# AI Appointment Booking Agent — Salon PoV


---

## Problem Statement

Salons in Pakistan and across emerging markets manage appointments manually through WhatsApp messages, phone calls, and handwritten diaries. This creates three compounding problems that cost them real money every month:

1. **No-shows destroy revenue** — a stylist sitting idle for a missed 90-minute colour appointment is pure loss. There is no automated follow-up, no reminder system, and no accountability.
2. **Booking friction kills conversions** — a potential client who has to wait for a human to read and reply to a WhatsApp message will book elsewhere or not book at all. Every hour of delay is a lost appointment.
3. **Owners have no bandwidth** — the salon owner is simultaneously the head stylist, the receptionist, the cashier, and the manager. They cannot monitor a booking inbox and deliver services at the same time.

The result: salons lose an estimated 20–30% of potential monthly revenue to missed bookings, unanswered messages, and no-shows with no reminder in place.

---

## Solution

An AI booking agent purpose-built for salons that handles the full appointment lifecycle autonomously — intake, slot checking, confirmation, reminders, and rescheduling — with zero human involvement required. The salon owner receives one shareable link. Clients open it on their phone, talk to the agent in natural language, and leave with a confirmed booking and a confirmation email in their inbox.

The Proof of Value is scoped tightly: one salon, one working URL, five user actions that complete end-to-end. Prove it works. Then sell it.

---

## Proof of Value Scope

The PoV delivers exactly the following and nothing else:

- A chat interface where a salon client books an appointment in natural language
- The agent collects client name, email, service, and preferred date/time
- The agent checks real availability before confirming any slot
- The agent offers three alternatives if the preferred slot is unavailable
- A branded confirmation email fires immediately via Resend on booking
- A reminder email fires 24 hours before the appointment via Resend scheduled send
- The salon owner can view all bookings at a protected `/bookings` endpoint
- The agent handles reschedule and cancel requests end-to-end

---

## Tech Stack

Every tool in this stack is either free or near-zero cost at PoV scale. Nothing requires a paid tier to ship the demo.

### AI Agent Layer
**OpenAI Agent SDK** (Python) orchestrates the full booking conversation. The SDK handles multi-turn memory, tool routing, and guardrails out of the box. One root agent manages intent detection — new booking, reschedule, cancel, or general query — and delegates to the correct tool. Tools are defined as Python functions decorated with `@function_tool` and called automatically by the SDK when the agent decides to act.

### Backend
**FastAPI** (Python) is the single backend process deployed on Railway. It exposes three routes: the agent chat endpoint, the bookings dashboard endpoint, and a health check. All business logic — availability checking, appointment writes, email triggers — lives in FastAPI service functions called by the agent tools. FastAPI also serves the confirmation email trigger and the Resend scheduled reminder on every new booking.

**SQLite** is the database for the PoV. No setup, no connection strings, no managed service. A single `.db` file on the Railway volume stores all appointments. The schema is one table. This is intentional — the goal is a working demo, not a scalable database. Postgres with a tenant ID replaces this after the PoV is sold.

**Resend** handles all transactional email. Two emails per booking: an immediate confirmation and a scheduled 24-hour reminder using Resend's `scheduled_at` parameter. This removes the need for any background job queue, asyncio tasks, Redis, or Celery entirely. Free tier covers 3,000 emails per month — more than sufficient for a PoV with one salon.

### Frontend
**Next.js** (App Router, TypeScript) is the chat UI deployed on Vercel. A single chat page with a streaming message component talks to the FastAPI backend via a `/api/chat` proxy route inside Next.js. The UI shows a booking confirmation card when the agent confirms an appointment. Nothing else. No auth, no dashboard, no multi-page app. One page, one purpose.

### Infrastructure
**Railway** hosts the FastAPI backend. Deploy from GitHub with a `railway.toml` config. Railway manages the SQLite file volume, environment variables, and the always-on process. The free tier is sufficient for a PoV with one salon.

**Vercel** hosts the Next.js frontend. Connect the GitHub repo, set the `NEXT_PUBLIC_API_URL` environment variable pointing to the Railway backend, and it deploys automatically on every push. Free tier is sufficient.

---

## Monorepo Structure

```
salon-booking-agent/
├── apps/
│   ├── backend/                  # FastAPI — Railway
│   │   ├── main.py
│   │   ├── agent.py              # OpenAI Agent SDK setup, tools
│   │   ├── database.py           # SQLite connection, CRUD
│   │   ├── email_service.py      # Resend integration
│   │   ├── requirements.txt
│   │   └── railway.toml
│   └── frontend/                 # Next.js — Vercel
│       ├── app/
│       │   ├── page.tsx          # Chat UI
│       │   └── api/chat/route.ts # Proxy to FastAPI
│       ├── components/
│       │   ├── ChatWidget.tsx
│       │   └── BookingCard.tsx
│       ├── package.json
│       └── next.config.ts
├── AGENTS.md
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Agent System Prompt

This prompt is the core of the product. It defines the agent's persona, rules, and constraints. It is injected as the system message on every conversation turn.

```
You are Zara, a warm and professional booking assistant for {SALON_NAME}.

Your only job is to help clients book, reschedule, or cancel salon appointments.
You do not answer questions outside of appointment management.

## Salon details
Name: {SALON_NAME}
Location: {SALON_CITY}
Services offered:
  - Haircut — 45 minutes
  - Hair colour — 90 minutes
  - Blowout — 30 minutes
  - Facial — 60 minutes
  - Bridal package — 180 minutes

Working hours: Monday to Saturday, 10:00 AM to 7:00 PM
Closed: Sundays and all public holidays

## Conversation rules — follow these exactly, in order

1. Greet the client by name if known, otherwise greet warmly and ask their name first.
2. Identify intent: new booking, reschedule, cancel, or status check.
3. For a new booking, collect in order: full name, email address, service, preferred date and time.
4. Never assume a slot is available. Always call check_availability before confirming.
5. If the slot is taken, immediately offer exactly three alternatives within the next five days.
6. Once the client confirms a slot, call book_appointment immediately. Do not ask again.
7. After booking, tell the client they will receive a confirmation email shortly.
8. For rescheduling, ask for their booking ID or email, then call reschedule_appointment.
9. For cancellations, confirm the booking details once, then call cancel_appointment.
10. Keep every response to three sentences or fewer. Never write paragraphs.
11. If the client asks anything outside of bookings — product prices, medical advice, directions — reply: "I can only help with appointment bookings. Shall I book something for you?"
12. Never reveal that you are an AI or that you use any specific technology.
13. If a slot is fully booked for the day, say so and suggest the next available day.

## Tone
Warm, confident, and efficient. You sound like the best receptionist the salon has ever had.
You respect the client's time. You do not over-explain. You do not repeat yourself.
```

---

## OpenAI Agent SDK — Tool Definitions

Four tools cover the entire booking lifecycle. Each tool is a Python function that FastAPI service functions execute. The SDK calls them automatically based on the agent's decision.

**check_availability**
Input: service name, ISO 8601 datetime string.
Action: queries the SQLite appointments table for conflicting bookings within the service duration window. Returns available or unavailable with the next three open slots if unavailable.

**book_appointment**
Input: client name, client email, service, ISO 8601 datetime string.
Action: writes a new appointment row to SQLite with a UUID booking ID, triggers the Resend confirmation email immediately, and calls Resend's scheduled send API for the 24-hour reminder. Returns the booking ID and confirmation.

**reschedule_appointment**
Input: booking ID or client email, new ISO 8601 datetime string.
Action: checks availability at the new time, updates the appointment row status to rescheduled, updates the datetime, and sends a reschedule confirmation email via Resend. Cancels the old scheduled reminder via Resend's email ID if stored.

**cancel_appointment**
Input: booking ID or client email.
Action: sets the appointment status to cancelled in SQLite and sends a cancellation email via Resend.

---

## FastAPI Routes

Three routes. Nothing more is needed for the PoV.

**POST /chat**
Receives the client message and conversation history as a JSON array. Passes it to the OpenAI Agent SDK runner. Streams the agent's response back as server-sent events so the Next.js frontend can render tokens as they arrive. This is the only route the frontend calls.

**GET /bookings**
Protected by a simple API key header check. Returns all appointments from SQLite as JSON, ordered by datetime descending. This is the salon owner's dashboard — no UI needed for PoV, the owner can use a tool like Insomnia or a simple table page.

**GET /health**
Returns `{"status": "ok"}`. Used by Railway as the health check endpoint to confirm the process is running.

---

## Resend Email Strategy

Two emails per booking. Both sent at the time of the `book_appointment` tool call. No background workers, no Redis, no Celery, no asyncio tasks.

**Confirmation email** — sent immediately using `resend.Emails.send()`. Subject: `Confirmed: {service} on {formatted_date}`. Contains the client name, service, date, time, booking ID, and a note to reply to reschedule.

**24-hour reminder** — sent using Resend's `scheduled_at` parameter set to `appointment_datetime minus 24 hours` in ISO 8601 format. Resend's own infrastructure fires the email at the right time. The reminder email ID is stored in the appointments table so it can be cancelled if the appointment is rescheduled or cancelled.

This means the entire email infrastructure is one Python file with two function calls. No queue. No scheduler. No infrastructure.

---

## SQLite Schema

One table. Every field needed for the PoV and nothing extra.

```
appointments
  id                TEXT PRIMARY KEY     UUID, generated at booking time
  client_name       TEXT NOT NULL
  client_email      TEXT NOT NULL
  service           TEXT NOT NULL
  datetime          TEXT NOT NULL        ISO 8601 format
  duration_minutes  INTEGER NOT NULL     Derived from service at booking time
  status            TEXT DEFAULT confirmed   confirmed | rescheduled | cancelled
  reminder_email_id TEXT                 Resend email ID for the scheduled reminder
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
```

---

## Next.js Frontend

One page. One component. One API route.

**app/page.tsx** renders the chat UI. A `useState` array holds the message thread. An input field and send button submit messages. Responses stream in via the EventSource API connected to the Next.js proxy route. When the agent response contains a booking confirmation signal, a `BookingCard` component renders below the message with the booking details.

**app/api/chat/route.ts** is a Next.js route handler that proxies the client message and conversation history to the FastAPI `/chat` endpoint and streams the response back to the browser. This keeps the FastAPI URL server-side and prevents it from being exposed in the browser.

**components/ChatWidget.tsx** handles the message list, input field, send button, and streaming token rendering.

**components/BookingCard.tsx** displays the confirmed booking details — name, service, date, time, booking ID — in a clean card format when the agent confirms a booking.

The frontend has no auth, no routing, no state management library, no component library beyond what is needed. It is intentionally minimal.

---

## Environment Variables

**Backend (Railway)**
```
OPENAI_API_KEY          OpenAI API key for the Agent SDK
RESEND_API_KEY          Resend API key
SALON_NAME              Name shown in agent responses and emails
SALON_CITY              City shown in agent responses
SALON_EMAIL             From address for emails
BOOKING_API_KEY         Simple key for protecting the /bookings route
DATABASE_PATH           Path to the SQLite file on the Railway volume
```

**Frontend (Vercel)**
```
NEXT_PUBLIC_API_URL     Full URL of the Railway FastAPI backend
```

---

## Railway Deploy Config

```
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
restartPolicyType = "on_failure"
```

The SQLite file is stored on a Railway persistent volume mounted at `/data`. Set `DATABASE_PATH=/data/salon.db` in environment variables.

---

## PoV Success Criteria

The PoV is complete when all five of the following are true with a real phone on a real network:

1. A client opens the Vercel URL on their phone and sees the chat interface load in under three seconds.
2. The client types "I want to book a haircut for Saturday at 2pm" and the agent responds with a confirmation or offers alternatives — no human involved.
3. A confirmation email arrives in the client's inbox within 60 seconds of the agent confirming the booking.
4. The reminder email arrives exactly 24 hours before the appointment time.
5. The salon owner opens the `/bookings` endpoint with their API key and sees the booking listed.

That is the entire Proof of Value. Ship this first. Everything else comes after a paying client.

---

## AGENTS.md

This file lives at the root of the monorepo and tells any AI coding agent how to navigate and work in this codebase.

```markdown
# AGENTS.md

## Repository overview
This is a pnpm monorepo with two apps: `backend` (FastAPI, Python) and `frontend` (Next.js, TypeScript).
The backend deploys to Railway. The frontend deploys to Vercel.
All commands below assume you are at the monorepo root unless stated otherwise.

## Dev environment tips
- Use `pnpm dlx turbo run where <project_name>` to jump to a package instead of scanning with `ls`.
- Run `pnpm install --filter <project_name>` to add a package to the workspace so Vite, ESLint, and TypeScript can resolve it.
- Use `pnpm create vite@latest <project_name> -- --template react-ts` to spin up a new React + Vite package with TypeScript checks ready.
- Check the `name` field inside each `package.json` to confirm the right package name — skip the top-level one.
- For the Python backend, always work inside `apps/backend/` and use the virtualenv at `apps/backend/.venv`.
- Activate the backend virtualenv with `source apps/backend/.venv/bin/activate` before running or testing Python code.
- The SQLite database file is at the path set in `DATABASE_PATH`. For local dev, set it to `./local.db` in a `.env` file.

## Running locally
- Backend: `cd apps/backend && uvicorn main:app --reload --port 8000`
- Frontend: `cd apps/frontend && pnpm dev`
- The frontend expects the backend at the URL set in `NEXT_PUBLIC_API_URL`. For local dev, set this to `http://localhost:8000` in `apps/frontend/.env.local`.

## Testing instructions
- Find the CI plan in the `.github/workflows` folder.
- Run `pnpm turbo run test --filter <project_name>` to run every check defined for that package.
- From the package root you can call `pnpm test` directly.
- Every commit must pass all tests before merging.
- To focus on one test, use the Vitest pattern: `pnpm vitest run -t "<test name>"` from the frontend package root.
- For backend tests, run `pytest apps/backend/tests/` from the monorepo root.
- Fix all test and type errors until the full suite is green before opening a PR.
- After moving files or changing imports, run `pnpm lint --filter <project_name>` to confirm ESLint and TypeScript rules still pass.
- Add or update tests for every code change, even if not explicitly asked.

## Agent-specific rules
- Never modify the system prompt in `agent.py` without an explicit instruction to do so.
- Never hardcode API keys. All secrets come from environment variables. Check `.env.example` for the full list.
- When adding a new agent tool, define it as a `@function_tool` decorated function in `agent.py` and register it in the `tools` list passed to the Agent constructor.
- The SQLite schema lives in `database.py` in the `init_db()` function. Run this function on app startup via the FastAPI `lifespan` context manager.
- Resend email logic lives exclusively in `email_service.py`. Do not call `resend.Emails.send()` from any other file.
- The `/chat` route in FastAPI must always stream responses. Do not change it to a non-streaming endpoint.
- The Next.js `/api/chat` route handler is the only place the backend URL is referenced on the server side. Never put `NEXT_PUBLIC_API_URL` in client components.

## PR instructions
- Title format: `[backend]` or `[frontend]` followed by a short description. Example: `[backend] Add reschedule tool`
- Always run `pnpm lint` and `pnpm test` before committing.
- One concern per PR. Do not mix backend and frontend changes in the same PR unless they are tightly coupled.
- Write a one-paragraph description in the PR body explaining what changed and why.
- Tag the PR with the label `pov` if it is part of the initial Proof of Value scope.
```

---

## What Comes After PoV

Once a salon owner is paying, layer these in one at a time. Do not build any of this before the PoV is sold.

| Feature | Tech to add |
|---|---|
| WhatsApp booking channel | Twilio WhatsApp API webhook |
| Multi-salon support | Postgres on Railway + salon tenant ID |
| Reliable reminder queue | Railway Redis + arq worker |
| Salon owner dashboard UI | Next.js dashboard page + auth |
| Staff scheduling and calendar sync | Google Calendar API |
| Payments and deposits | Stripe Payment Links |
| SMS reminders | Twilio SMS |
| MCP server for advanced tooling | OpenAI Agent SDK MCP host |

---

## Cost at PoV Stage

| Service | Monthly cost |
|---|---|
| OpenAI Agent SDK + GPT-4o mini | ~$0.002 per conversation |
| Resend | Free — 3,000 emails/month |
| Railway | Free tier — sufficient for one salon |
| Vercel | Free tier — sufficient for one salon |
| SQLite | Free — built in, no service needed |
| **Total for one salon, ~200 bookings/month** | **Under $5** |

The PoV costs almost nothing to run. The only investment is build time.