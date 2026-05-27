FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

ENV DATABASE_PATH=/data/salon.db
VOLUME ["/data"]

EXPOSE 8001

CMD ["uv", "run", "python", "server.py"]
