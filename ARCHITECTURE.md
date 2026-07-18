# Architecture

## System Overview

SocialCommander is a pnpm monorepo with three main runtime packages:

1. **`artifacts/api-server`** — Express 5 REST API, serving all business logic
2. **`artifacts/dashboard`** — React + Vite SPA, consuming the API via generated React Query hooks
3. **Shared libraries** (`lib/`) — OpenAPI spec, generated clients, DB schema

All traffic routes through Replit's reverse proxy. The frontend at `/` and API at `/api` are separate services coordinated by `artifact.toml`.

## Data Flow

```
User → Browser → Replit Proxy
                    │
                    ├─ /* → Dashboard (Vite, port 23183)
                    └─ /api/* → API Server (Express, port AUTO)
                                    │
                                    ├─ lib/db (Drizzle + PostgreSQL)
                                    ├─ Groq API (AI generation)
                                    └─ Built-in scheduler (30s loop)
```

## Database Schema

### `accounts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| platform | enum | twitter, reddit |
| username | text | |
| display_name | text | |
| color | text | Hex for UI color coding |
| status | enum | active, suspended, paused |
| avatar_url | text? | |
| proxy_config | text? | Proxy URL for this account |
| voice_profile | text? | AI voice/tone profile |
| oauth_access_token | text? | Encrypted in production |
| oauth_refresh_token | text? | Encrypted in production |
| posts_count | int | Denormalized count |
| followers_count | int | Synced from platform |
| engagement_rate | real | Rolling average |
| last_post_at | timestamptz? | |

### `posts`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| account_id | int FK | → accounts.id (cascade delete) |
| content | text | Post body |
| media_urls | text[] | Array of media URLs |
| status | enum | draft, scheduled, published, failed |
| scheduled_at | timestamptz? | When to publish |
| published_at | timestamptz? | When published |
| external_id | text? | Platform post ID after publish |
| impressions/likes/comments/reposts | int | Engagement metrics |
| ai_generated | bool | |
| subreddit | text? | Reddit only |
| post_title | text? | Reddit only |
| error_message | text? | Last failure reason |
| retry_count | int | |

### `queue_jobs`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| type | enum | post_publish, post_retry, analytics_sync, engagement_check |
| status | enum | pending, processing, completed, failed |
| payload | jsonb | Job-specific data |
| attempts | int | |
| max_attempts | int | Default 3 |
| scheduled_for | timestamptz? | When to execute |
| error_message | text? | |

### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| account_id | int? FK | Optional link |
| post_id | int? FK | Optional link |
| action | text | e.g. "post_published", "account_created" |
| details | text? | Human-readable description |
| ip_address | text? | Client IP |
| created_at | timestamptz | |

## API Contract

The `lib/api-spec/openapi.yaml` is the single source of truth. Changes there regenerate:
- `lib/api-client-react/src/generated/` — React Query hooks (frontend)
- `lib/api-zod/src/generated/` — Zod validators (backend)

Run codegen after any spec change:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## AI Integration

The AI route (`/api/ai/generate`) calls Groq's API with the account's voice profile as context. It:

1. Loads the account's `voice_profile` from DB
2. Builds a system prompt with platform-specific instructions
3. Calls `llama-3.1-8b-instant` via Groq's OpenAI-compatible API
4. Returns N variants + hashtag suggestions + engagement estimate

**To switch AI provider:** Change `GROQ_API_URL` in `artifacts/api-server/src/routes/ai.ts` to any OpenAI-compatible endpoint.

## Scheduler

The built-in scheduler runs a 30-second polling loop (`artifacts/api-server/src/routes/queue.ts`):

1. Queries `queue_jobs` for pending jobs where `scheduled_for <= NOW()`
2. Marks them as `processing`
3. Executes the job (currently: updates post status to `published`)
4. Marks as `completed` or `failed` with retry logic

**To upgrade to BullMQ:**
1. `pnpm add bullmq ioredis --filter @workspace/api-server`
2. Replace the `setInterval` with a BullMQ `Worker`
3. Add Redis connection config

## Per-Account Proxy Support

Each account has a `proxy_config` field (e.g., `http://user:pass@host:port`). Currently stored in DB for use by Playwright workers. To activate:

1. Add a `workers/` package with Playwright + stealth plugin
2. Read `account.proxyConfig` and configure Playwright context:
```typescript
const browser = await chromium.launch();
const context = await browser.newContext({
  proxy: { server: account.proxyConfig! }
});
```

## Extension Guide for AI Agents

### Adding a new platform

1. Add enum value to `platformEnum` in `lib/db/src/schema/accounts.ts`
2. Add platform-specific publishing logic in `artifacts/api-server/src/routes/posts.ts` (the `publishPost` handler)
3. Update the OpenAPI spec if needed, run codegen
4. Add platform icon in the frontend

### Adding webhook support

1. Create `artifacts/api-server/src/routes/webhooks.ts`
2. Add platform-specific signature verification middleware
3. Update engagement metrics from webhook payload

### Adding BullMQ

1. Install: `pnpm add bullmq ioredis --filter @workspace/api-server`
2. Create `artifacts/api-server/src/lib/queue.ts` with Queue + Worker setup
3. Replace the `setInterval` scheduler with BullMQ queues
4. Add `REDIS_URL` to `.env.example` and Replit Secrets

## Docker Compose (VPS / Railway)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: socialcommander
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      DATABASE_URL: postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/socialcommander
      GROQ_API_KEY: ${GROQ_API_KEY}
      PORT: 5000
    depends_on: [postgres]
    ports:
      - "5000:5000"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    depends_on: [api]

volumes:
  pgdata:
```
