# syntax=docker/dockerfile:1.7

FROM python:3.13-slim AS builder
WORKDIR /build
RUN pip install --no-cache-dir uv
COPY pyproject.toml ./
RUN uv pip compile pyproject.toml -o requirements.txt

FROM python:3.13-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd -r app && useradd -r -g app -d /app app

COPY --from=builder /build/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/ ./worker/

USER app

CMD ["python", "-m", "worker.main"]
