# SocialCommander

AI-powered social media management dashboard for managing up to 10 X (Twitter) + 10 Reddit accounts with automated scheduling, AI content generation, and analytics.

---

## Quick Start

The app runs automatically on Replit. Two services start together:

| Service | URL | What it does |
|---------|-----|-------------|
| Dashboard | Preview pane (root `/`) | React + Vite frontend |
| API Server | `/api` | Express 5 backend |

---

## Run & Operate

```bash
# API server (dev with hot-rebuild)
pnpm --filter @workspace/api-server run dev

# Frontend dashboard (Vite HMR)
pnpm --filter @workspace/dashboard run dev

# Push DB schema changes to development database
pnpm --filter @workspace/db run push

# Manually push code to GitHub
pnpm --filter @workspace/scripts run push-to-github

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

---

## GitHub Auto-Push Setup

Every checkpoint (git commit) automatically pushes to GitHub when configured. **One-time setup:**

1. Open Replit Secrets tab (lock icon in sidebar)
2. Add `GITHUB_TOKEN` — Personal Access Token with `repo` scope ([create one](https://github.com/settings/tokens/new))
3. Add `GITHUB_REPO` — `owner/reponame` (e.g. `alice/socialcommander`)
4. Optionally add `GITHUB_BRANCH` (default: `main`)

That's it — every checkpoint now pushes in the background. Check push log: `cat /tmp/github-autopush.log`

See full docs at `docs/push-to-github.md`.

---

## Required Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `SESSION_SECRET` | ✅ Already set | Session security |
| `GROQ_API_KEY` | Optional | AI content generation (free at [console.groq.com](https://console.groq.com)) |
| `GITHUB_TOKEN` | Optional | Auto-push to GitHub |
| `GITHUB_REPO` | Optional | Target GitHub repo (`owner/repo`) |
| `GITHUB_BRANCH` | Optional | Branch (default: `main`) |

The database (`DATABASE_URL`, `PGHOST`, etc.) is automatically provided by Replit — do not set manually.

---

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 18 + Vite + Tailwind + shadcn/ui + Recharts + Wouter
- **API**: Express 5 (built with esbuild, runs compiled JS)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Validation**: Zod v4, `drizzle-zod`, Orval codegen from OpenAPI spec
- **AI**: Groq `llama-3.1-8b-instant` / OpenAI-compatible (graceful mock when no key)
- **Scheduler**: In-process 30s polling loop in `queue.ts` (BullMQ-ready)

---

## Where Things Live

| Path | Purpose |
|------|---------|
| `lib/api-spec/openapi.yaml` | **Source of truth** for all API contracts |
| `lib/db/src/schema/` | Drizzle schema (`accounts.ts`, `posts.ts`, `queue.ts`, `audit.ts`) |
| `lib/api-client-react/src/generated/` | Auto-generated React Query hooks — **do not edit** |
| `lib/api-zod/src/generated/` | Auto-generated Zod validators — **do not edit** |
| `artifacts/api-server/src/routes/` | Express route handlers |
| `artifacts/dashboard/src/pages/` | React pages (Dashboard, Compose, Calendar, Analytics, Queue, Audit, Settings) |
| `artifacts/dashboard/src/components/layout/` | Shell (sidebar + command palette) |
| `scripts/src/push-to-github.ts` | Manual GitHub push script |
| `scripts/git-hooks/post-commit` | Git hook template for auto-push |
| `scripts/post-merge.sh` | Post-task-merge setup (reinstalls hook, runs DB push) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET/POST | `/api/accounts` | List / create accounts |
| GET/PATCH/DELETE | `/api/accounts/:id` | Account CRUD |
| GET | `/api/accounts/overview` | Aggregate counts |
| GET | `/api/accounts/:id/stats` | Per-account stats |
| GET/POST | `/api/posts` | List (paginated) / create posts |
| GET/PATCH/DELETE | `/api/posts/:id` | Post CRUD |
| POST | `/api/posts/:id/publish` | Publish immediately |
| POST | `/api/posts/:id/schedule` | Schedule with jitter |
| POST | `/api/posts/:id/duplicate` | Clone as draft |
| POST | `/api/posts/bulk-delete` | Delete multiple by ID |
| GET | `/api/posts/calendar` | Calendar view |
| GET | `/api/posts/recent` | Recently published |
| GET | `/api/analytics/overview` | Aggregate metrics |
| GET | `/api/analytics/account-metrics` | Per-account analytics |
| GET | `/api/analytics/heatmap` | 7×24 engagement heatmap |
| GET | `/api/analytics/timeseries` | Time series data |
| POST | `/api/ai/generate` | AI content generation |
| POST | `/api/ai/optimize-time` | Optimal posting time |
| GET | `/api/queue/jobs` | List background jobs |
| POST | `/api/queue/jobs/:id/retry` | Retry failed job |
| DELETE | `/api/queue/jobs/:id` | Cancel pending job |
| GET | `/api/queue/stats` | Queue health |
| GET | `/api/audit` | Audit log |
| GET | `/api/settings/status` | Integration health check |

---

## Adding New Features

### Add a new API endpoint

1. Add the path + schemas to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen` — generates hooks + Zod validators
3. Add the route handler in `artifacts/api-server/src/routes/`
4. Register it in `artifacts/api-server/src/routes/index.ts`
5. Use the generated hook in the frontend

### Add a new DB table

1. Add schema in `lib/db/src/schema/`
2. Export from `lib/db/src/index.ts`
3. Run `pnpm --filter @workspace/db run push` to apply to dev DB

---

## Architecture Decisions

- **OpenAPI-first**: The spec gates codegen which gates the frontend — never hand-write types that codegen produces
- **Built-in scheduler**: 30s polling loop processes due jobs; BullMQ-ready (swap when Redis is available)
- **Per-account color coding**: `color` hex stored in DB, used throughout UI for account identification
- **AI graceful degradation**: AI routes return mock content when no API key is set — UI always works
- **Audit log on mutations**: Every create/update/delete writes to `audit_logs`
- **Auto-push git hook**: `.git/hooks/post-commit` pushes to GitHub in background; reinstalled by `post-merge.sh`

---

## Dashboard Pages

| Page | Route | What it does |
|------|-------|-------------|
| Dashboard | `/` | Command center — live stats, recent posts, account health (auto-refreshes every 30s) |
| Compose | `/compose` | Post composer with AI generation, cross-posting, platform preview, character counter |
| Calendar | `/calendar` | Month/week view of scheduled + published posts |
| Analytics | `/analytics` | Aggregate metrics, time series, 7×24 heatmap, CSV export |
| Accounts | `/accounts` | Account management with status, metrics, add/edit/delete |
| Queue | `/queue` | Background job monitor with retry/cancel |
| Audit Log | `/audit` | Immutable action history |
| Settings | `/settings` | System integration status (DB, GROQ, GitHub, Scheduler) |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | Compose new post (from Dashboard) |
| `⌘K` / `Ctrl+K` | Open command palette |
| `Esc` | Close dialogs |

---

## User Preferences
