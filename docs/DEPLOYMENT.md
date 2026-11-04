# ThirdEye AI — Deployment Guide

## Prerequisites

- Node.js 20+
- pnpm 12+
- Docker & Docker Compose (for containerised deployment)
- Supabase project (hosted or self-hosted)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in required values:

```bash
cp .env.example .env.local
```

Required variables:
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

Optional variables are documented in `.env.example`.

## Local Development

```bash
pnpm install
pnpm dev
```

The app runs on `http://localhost:3000`.

## Production Build

```bash
pnpm build
pnpm start
```

The build outputs a standalone server in `.next/standalone/`.

## Docker Deployment

### Build and Run

```bash
# Build image
pnpm docker:build

# Run with docker-compose (includes Postgres)
pnpm docker:run
```

### Manual Docker

```bash
docker build -t thirdeye-ai .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  thirdeye-ai
```

## Health Checks

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness probe — returns system status, uptime, DB connectivity |
| `GET /api/health/ready` | Readiness probe — returns 200 only when DB is reachable |

### Kubernetes / Docker Health Check Example

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Monitoring

- **Structured Logging**: JSON logs to stdout via `createLogger()`. Set `LOG_LEVEL` to `debug | info | warn | error`.
- **Performance**: `measureAsync()` wraps async operations with automatic timing.
- Logs are compatible with any log aggregator (Datadog, Grafana Loki, AWS CloudWatch).

## Feature Flags

Toggle features via environment variables:

| Flag | Default | Description |
|---|---|---|
| `FEATURE_AI_ANALYSIS` | `true` | AI-powered risk analysis |
| `FEATURE_PDF_EXPORT` | `true` | PDF report generation |
| `FEATURE_OWNERSHIP_GRAPH` | `true` | D3 ownership visualisation |
| `FEATURE_ADVERSE_MEDIA` | `true` | Adverse media screening |

## Security

- All API routes enforce RBAC via `getUser()` + `hasPermission()`
- Rate limiting on screening (10 req/min) and AI analysis (5 req/min)
- UUID validation on all parameterised routes
- Security headers configured in `next.config.ts`
- Audit logging for sensitive operations

## Database Migrations

```bash
pnpm db:migrate
```

Generate TypeScript types from the database schema:

```bash
pnpm db:generate
```
