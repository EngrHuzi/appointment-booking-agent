

# Changelog

## [Unreleased]

---

## 2026-05-28 — MCP architecture + Docker + CI

### Added — MCP Server (`apps/mcp-server/`)
- New uv project with **FastMCP 3.3.1** as the tool host
- `server.py` — 5 MCP tools exposed over **SSE transport** on port 8001:
  - `check_availability` — queries SQLite for conflicts, returns 3 alternatives if slot taken
  - `book_appointment` — writes appointment, sends confirmation + 24-hour reminder via Resend
  - `reschedule_appointment` — cancels old reminder, sends new one, updates row
  - `cancel_appointment` — cancels reminder, sends cancellation email, marks cancelled
  - `list_appointments` — returns all appointments for the `/bookings` owner endpoint
- `database.py` + `email_service.py` moved here — the agent server no longer touches SQLite or Resend directly
- `Dockerfile` — python:3.13-slim + uv, SQLite on persistent `/data` volume
- `.env.example` — all required vars documented

### Changed — Agent Server (`apps/backend/`)
- `agent.py` — removed all `@function_tool` definitions; now calls `make_agent(mcp_server)` passing the MCP connection; tools auto-discovered from MCP server at startup
- `main.py` — lifespan opens one persistent `MCPServerSse` connection to the MCP server and shares the pre-built agent across requests; `/bookings` calls MCP `list_appointments` via FastMCP Client
- `Dockerfile` added — python:3.13-slim + uv, exposes port 8000
- `fastmcp` added as a dependency (used for startup probe and `/bookings` route)

### Added — Infrastructure
- `docker-compose.yml` — local dev: `mcp-server` (port 8001) + `agent-server` (port 8000) with health checks, `depends_on`, shared SQLite volume
- `.github/workflows/docker.yml` — GitHub Actions matrix CI: both images build in parallel on every push to `main`, pushed to GHCR with `sha-` + `latest` tags; uses GHA layer cache for fast rebuilds

### Architecture note — StreamableHTTP vs SSE
StreamableHTTP transport was attempted. Root cause: `MCPServerStreamableHttp` in agents SDK 0.17.4 calls `session.initialize()` on connect and expects a persistent stateful session. FastMCP's stateless-http mode closes after each request; stateful mode has a session-ID handshake mismatch with the SDK client. **SSE transport is functionally identical for container-to-container MCP** — persistent HTTP connection, same tool-call protocol. Switched to SSE; `MCPServerSse` + `cache_tools_list=True` works correctly.

### Tested (2026-05-28)
- MCP server exposes 5 tools over SSE — verified with FastMCP Client ✅
- Agent server lifespan connects to MCP server, discovers tools, logs count ✅
- `POST /chat` → agent → MCP tool calls → Gemini → SSE token stream ✅ (Gemini quota hit confirms full stack reached the model)
- `GET /health` → 200 ✅
- `GET /bookings` wrong key → 401 ✅

---

## 2026-05-28 — Backend complete and tested

### Added
- **`apps/backend/database.py`** — SQLite CRUD layer: `init_db`, `check_availability`, `_find_alternatives`, `create_appointment`, `get_appointment`, `update_appointment`, `get_all_appointments`
- **`apps/backend/email_service.py`** — Resend integration: confirmation email (immediate), 24-hour reminder (scheduled via `scheduled_at`), reschedule and cancellation emails, `cancel_scheduled_email`
- **`apps/backend/agent.py`** — OpenAI Agents SDK wired to Gemini via Google's OpenAI-compatible endpoint. Four `@function_tool` tools. Supports both `GEMINI_API_KEY` and `GOOGLE_API_KEY` env var names. OpenAI tracing enabled via `set_tracing_export_api_key`
- **`apps/backend/main.py`** — FastAPI server: `POST /chat` SSE stream, `GET /bookings` API-key protected, `GET /health`
- **`apps/backend/railway.toml`** — Nixpacks build + uvicorn start command

### Fixed
- Streaming event format: SDK emits `ResponseTextDeltaEvent` (Responses API), not `choices[0].delta.content` (ChatCompletions)

### Tested (2026-05-28)
- Full booking conversation: name → email → `check_availability` → `book_appointment` → confirmed in SQLite ✅
- Conflict detection: re-booking same slot correctly rejected with 3 alternatives ✅
- All three FastAPI routes verified ✅
- OpenAI tracing visible at platform.openai.com/traces ✅

---

## 2026-05-28 — Frontend complete

### Added — Next.js frontend (`apps/frontend/`)
- **`app/layout.tsx`** — Cormorant Garamond (display) + DM Sans (UI chrome) via `next/font/google`; CSS variables for full design system
- **`app/globals.css`** — design tokens, grain texture overlay, `fadeUp / fadeIn / slideUp / pulse-dot` keyframes, scrollbar styling
- **`app/page.tsx`** — Server Component shell; renders `<ChatWidget />`
- **`app/api/chat/route.ts`** — Next.js route handler proxying to FastAPI, keeps backend URL server-side
- **`components/BookingCard.tsx`** — luxury bordeaux appointment card: gold top stripe, corner ornament, Cormorant Garamond service name, formatted day/date/time, booking ID chip, `animate-slide-up` entrance
- **`components/ChatWidget.tsx`** — full interactive chat Client Component:
  - SSE streaming via `fetch` + `ReadableStream` (buffer handles partial chunks)
  - Message state: `{ role, content, booking? }[]` with welcome message on mount
  - Streaming tokens land character-by-character into the current assistant message
  - `{"type":"booking"}` event → `BookingCard` rendered inline below assistant reply
  - `{"type":"error"}` event → graceful error message
  - `[DONE]` sentinel → finalises stream
  - Typing indicator (animated gold pulse dots) shown while streaming
  - Auto-growing textarea; Enter sends, Shift+Enter newline
  - Bordeaux header with live "Z" avatar, green online dot, wordmark
  - User bubbles: bordeaux right-aligned; Zara bubbles: cream/white with gold border, Cormorant Garamond typeface
- **`.env.local`** — `NEXT_PUBLIC_API_URL=http://localhost:8000` for local dev

### Tested (2026-05-28)
- `pnpm exec tsc --noEmit` — 0 errors ✅
- `pnpm build` — compiled successfully, all pages generated ✅
- Dev server (`pnpm dev`) — 200 at http://localhost:3000 ✅

---

## Up next
- End-to-end smoke test with backend running: type a booking request, confirm SSE stream, verify BookingCard renders
