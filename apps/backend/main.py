import json
import os
from contextlib import asynccontextmanager
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, field_validator

load_dotenv()

from agent import MCP_SERVER_URL, make_agent

BOOKING_API_KEY = os.getenv("BOOKING_API_KEY", "changeme")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


# ---------------------------------------------------------------------------
# Lifespan — hold one SSE-MCP connection open for the server lifetime
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    from agents.mcp import MCPServerSse, MCPServerSseParams

    mcp = MCPServerSse(
        params=MCPServerSseParams(url=MCP_SERVER_URL, timeout=30.0, sse_read_timeout=30.0),
        name="SalonTools",
        cache_tools_list=True,
        client_session_timeout_seconds=30,
    )
    await mcp.__aenter__()
    app.state.mcp = mcp
    app.state.agent = make_agent(mcp)

    tools = await mcp.list_tools()
    print(f"MCP ready — {len(tools)} tools: {[t.name for t in tools]}")

    yield

    await mcp.__aexit__(None, None, None)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Salon Booking Agent",
    description="AI-powered appointment booking for salons.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

async def require_api_key(key: Annotated[str | None, Security(_api_key_header)]) -> str:
    if key != BOOKING_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return key


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in {"user", "assistant", "system"}:
            raise ValueError("role must be user, assistant, or system")
        return v


class ChatRequest(BaseModel):
    messages: list[Message]

    @field_validator("messages")
    @classmethod
    def messages_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("messages must not be empty")
        return v


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/chat", summary="Stream a conversation turn through the booking agent")
async def chat(request: ChatRequest, req: Request):
    from agents import Runner, RunConfig

    agent = req.app.state.agent
    input_messages = [{"role": m.role, "content": m.content} for m in request.messages]
    run_config = RunConfig(workflow_name="Salon Booking Agent")

    async def generate():
        booking_event: dict | None = None

        try:
            result = Runner.run_streamed(agent, input_messages, run_config=run_config)

            async for event in result.stream_events():
                if event.type == "raw_response_event":
                    data = event.data
                    if type(data).__name__ == "ResponseTextDeltaEvent" and hasattr(data, "delta"):
                        yield f"data: {json.dumps({'type': 'delta', 'content': data.delta})}\n\n"

            # After stream ends, scan all new items for a book_appointment result.
            # MCP tool outputs come as ToolCallOutputItem where .output is a dict
            # {'type': 'text', 'text': '<json>'}, a plain str, or a list of content items.
            for item in getattr(result, "new_items", []):
                raw = getattr(item, "output", None)
                if raw is None:
                    continue
                if isinstance(raw, str):
                    candidates = [raw]
                elif isinstance(raw, dict):
                    candidates = [raw.get("text", "")]
                elif isinstance(raw, list):
                    candidates = [
                        (c.get("text") or getattr(c, "text", ""))
                        for c in raw
                    ]
                else:
                    candidates = []
                for candidate in candidates:
                    try:
                        parsed = json.loads(candidate)
                        if (
                            isinstance(parsed, dict)
                            and parsed.get("tool") == "book_appointment"
                            and parsed.get("success")
                        ):
                            booking_event = parsed
                    except (json.JSONDecodeError, TypeError):
                        pass

        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

        if booking_event:
            yield f"data: {json.dumps({'type': 'booking', 'booking': booking_event})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get(
    "/bookings",
    summary="List all appointments (salon owner only)",
    dependencies=[Depends(require_api_key)],
)
async def get_bookings():
    from fastmcp import Client

    async with Client(MCP_SERVER_URL) as client:
        result = await client.call_tool("list_appointments", {})
        return json.loads(result.content[0].text)


@app.get("/health", summary="Health check for Railway")
async def health():
    return {"status": "ok"}
