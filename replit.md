# SocialCommander

AI-powered social media management dashboard for managing up to 10 X (Twitter) + 10 Reddit accounts with automated scheduling, AI content generation, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/dashboard run dev` — run the frontend dashboard
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run push-to-github` — push code to GitHub (set GITHUB_TOKEN and GITHUB_REPO in Secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + Recharts + Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (tables: accounts, posts, queue_jobs, audit_logs)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: Groq (llama-3.1-8b-instant) / OpenAI-compatible
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle schema (accounts.ts, posts.ts, queue.ts, audit.ts)
- `artifacts/api-server/src/routes/` — Express route handlers (accounts, posts, analytics, ai, queue, audit)
- `artifacts/dashboard/src/` — React frontend with all pages
- `scripts/src/push-to-github.ts` — Idempotent GitHub push script

## Architecture decisions

- OpenAPI-first: spec gates codegen which gates frontend — never hand-write types that codegen produces
- Built-in scheduler: 30-second polling loop in queue.ts processes due jobs (BullMQ-ready, swap in when Redis is available)
- Per-account color coding: `color` hex stored in DB, used throughout UI for account identification
- AI graceful degradation: AI routes return mock content when GROQ_API_KEY is not set
- Audit log on all mutations: every create/update/delete writes to audit_logs table

## Product

- **Dashboard**: Command center with live stats, recent post feed, and account health grid
- **Accounts**: Color-coded account management with per-account proxy config and AI voice profiles
- **Compose**: Post composer with AI generation, tone control, optimal time suggestions, and scheduled posting with jitter
- **Calendar**: Month/week view of all scheduled and published posts
- **Analytics**: Aggregate metrics, time series charts, 7×24 engagement heatmap
- **Queue**: Background job monitoring with status indicators
- **Audit Log**: Immutable action history

## User preferences

- Dark mode first
- No emojis in the UI
- Dense, information-rich layouts preferred

## Gotchas

- After any change to `lib/api-spec/openapi.yaml`, run codegen before touching frontend or backend validation
- The scheduler processes jobs every 30 seconds — jobs with `scheduled_for <= NOW()` get picked up automatically
- OAuth tokens stored in DB are plain text — encrypt before production use (see RISKS.md)
- See RISKS.md before running in production — automated multi-account posting violates platform ToS

## Pointers

- `README.md` — Full setup guide, API reference, deployment options
- `ARCHITECTURE.md` — Deep architecture notes, extension guide, Docker Compose
- `RISKS.md` — TOS warnings, security risks, legal notes
- `TODO.md` — Roadmap and extension ideas
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
