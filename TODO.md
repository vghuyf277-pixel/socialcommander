# TODO / Roadmap

## High Priority

- [ ] **Authentication** — Add JWT or session-based auth to all API routes
- [ ] **Encrypt sensitive fields** — OAuth tokens and proxy configs in DB
- [ ] **Twitter/X API integration** — Direct API posting (v2 OAuth 2.0 PKCE)
- [ ] **Reddit API integration** — Direct API posting via Reddit OAuth
- [ ] **Rate limiting** — `express-rate-limit` on all routes

## Platform Integration

- [ ] X (Twitter) direct API posting (replace mock publish)
- [ ] Reddit direct API posting
- [ ] Playwright stealth workers for cookie-based fallback posting
- [ ] Per-account proxy configuration validation
- [ ] Platform API credential verification on account add

## AI Features

- [ ] Voice profile trainer — analyze past posts to build voice profile
- [ ] A/B variant testing — track which variant performed better
- [ ] Auto-reply suggestions based on engagement rules
- [ ] Content calendar AI filling — suggest optimal schedule
- [ ] Sentiment analysis on engagement

## Scheduler / Queue

- [ ] Upgrade to BullMQ + Redis for production scheduling
- [ ] Dead letter queue for permanently failed jobs
- [ ] Webhook receivers for real-time engagement data
- [ ] Engagement sync job (pull metrics from platform APIs)
- [ ] Auto-retry with exponential backoff

## Analytics

- [ ] Follower growth tracking over time
- [ ] Cross-account comparison view
- [ ] CSV/PDF export
- [ ] Best time predictor trained on account history
- [ ] Competitor analysis (manual entry)

## Safety / Compliance

- [ ] Human approval workflow (toggle per account)
- [ ] Content filters (blocked words, spam patterns)
- [ ] Rate limit enforcement per platform
- [ ] Daily post limits configurable per account
- [ ] Ban risk score indicator

## Infrastructure

- [ ] Docker Compose configuration
- [ ] Railway one-click deploy button
- [ ] Database backup scheduler
- [ ] Health monitoring with alerting
- [ ] Playwright workers package (`workers/`)

## UI / UX

- [ ] Drag-and-drop calendar for rescheduling
- [ ] Thread composer for X (multiple tweets)
- [ ] Media upload (images, video)
- [ ] Bulk import posts from CSV
- [ ] Mobile-responsive improvements
- [ ] Real-time updates via WebSockets

## Developer Experience

- [ ] Vitest test suite
- [ ] OpenAPI spec validation in CI
- [ ] Prettier + ESLint configuration
- [ ] Contributing guide
