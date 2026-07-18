---
name: Per-account platform credentials
description: How social account credentials are stored and used for real posting
---

## Rule
Store per-account API credentials as a JSON blob in the `credentials` TEXT column of the `accounts` table. Never in .env files, gitignore, or Replit Secrets.

**Why:** User requirement — credentials must persist across all Replit actions and not be gitignored. DB storage survives restarts, task-agent merges, and environment resets.

## Structure
```json
// Twitter/X (OAuth 1.0a — from developer.twitter.com)
{ "apiKey": "consumer_key", "apiSecret": "consumer_secret", "accessToken": "...", "accessSecret": "..." }

// Reddit (password flow — script app from reddit.com/prefs/apps)
{ "clientId": "...", "clientSecret": "...", "username": "...", "password": "..." }
```

## How to apply
- `artifacts/api-server/src/lib/platform-publisher.ts` — `publishToTwitter()` and `publishToReddit()` + `hasValidCredentials()`
- `artifacts/api-server/src/routes/queue.ts` — scheduler calls publisher when `account.credentials` is set; gracefully degrades (marks published locally) if API call fails
- `artifacts/dashboard/src/pages/Accounts.tsx` — credential form in Add Node dialog
- `artifacts/dashboard/src/pages/AccountDetail.tsx` — 4th "Credentials" tab with status indicator

## DB migration
Run `pnpm --filter @workspace/db run push` after any schema change to `lib/db/src/schema/accounts.ts`.
