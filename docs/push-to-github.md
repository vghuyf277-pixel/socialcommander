# How to Use the GitHub Push Script

The push script (`scripts/src/push-to-github.ts`) synchronises this Replit project to a GitHub repository. It is fully **idempotent** — safe to run multiple times.

## Quick Run

```bash
pnpm --filter @workspace/scripts run push-to-github
```

That's it. If `GITHUB_TOKEN` and `GITHUB_REPO` are already in Replit Secrets, the command pushes everything to GitHub.

## First-Time Setup

### 1 — Add Secrets in Replit

Open the **Secrets** tab (padlock icon in the sidebar) and add:

| Key | Example Value | Required |
|-----|--------------|----------|
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxxxxxxxxxx` | Yes |
| `GITHUB_REPO` | `youruser/socialcommander` | Yes |
| `GITHUB_BRANCH` | `main` | No (defaults to `main`) |

**Getting a GitHub token:**
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it `repo` scope (full control of private repositories)
4. Copy the token — you only see it once

### 2 — Run the script

```bash
pnpm --filter @workspace/scripts run push-to-github
```

**What it does, step by step:**
1. Validates that `GITHUB_TOKEN` is set
2. Looks up `GITHUB_REPO` — falls back to the current git remote if the env var is missing
3. Checks if the repo exists on GitHub via the API
4. **Creates the repo** (private, no auto-init) if it doesn't exist
5. Configures git user (`Replit Agent` / `agent@replit.com`)
6. Initialises a git repo if there isn't one yet
7. Sets/replaces the `origin` remote with a token-authenticated URL
8. Stages all files (`git add -A`)
9. Commits with the message in `COMMIT_MSG` (default: `chore: sync from Replit`)
10. Pushes to the branch — uses `--set-upstream` on first push, regular push after

## Custom Options

All options are set via environment variables (or Replit Secrets):

```bash
# Override repo without touching Secrets
GITHUB_REPO=myorg/my-repo pnpm --filter @workspace/scripts run push-to-github

# Custom commit message
COMMIT_MSG="feat: add bulk scheduling" pnpm --filter @workspace/scripts run push-to-github

# Push to a different branch
GITHUB_BRANCH=staging pnpm --filter @workspace/scripts run push-to-github

# All options at once
GITHUB_REPO=myorg/repo GITHUB_BRANCH=dev COMMIT_MSG="wip: analytics" \
  pnpm --filter @workspace/scripts run push-to-github
```

## Running from Replit Shell

Click the **Shell** tab and run:

```bash
pnpm --filter @workspace/scripts run push-to-github
```

You'll see output like:

```
[push-to-github] Target: https://github.com/vghuyf277-pixel/socialcommander @ main
[push-to-github] Repository already exists.
[push-to-github] $ git add -A
[push-to-github] $ git commit -m "chore: sync from Replit"
[main a4f1b2c] chore: sync from Replit
 3 files changed, 142 insertions(+)
[push-to-github] Committed changes.
[push-to-github] $ git push origin main
...
[push-to-github] Success! Code pushed to https://github.com/vghuyf277-pixel/socialcommander/tree/main
```

## Automating Pushes

To push every time you make a significant change, you can run the script directly from the Replit Shell. There is no auto-push-on-save — pushes are always intentional and require a manual run.

## Troubleshooting

### `GITHUB_TOKEN not found`
→ Add `GITHUB_TOKEN` to Replit Secrets (padlock icon).

### `Could not determine GitHub repo`
→ Add `GITHUB_REPO=owner/reponame` to Replit Secrets.

### `401 Unauthorized` from GitHub API
→ Token expired or doesn't have `repo` scope. Generate a new one.

### `403 Forbidden` on push
→ Token exists but the account doesn't have push access to that repo.

### `Repository already exists` but push fails with `non-fast-forward`
→ The remote has commits not in your local. This can happen if you pushed from another machine. Resolve by running:
```bash
git pull origin main --rebase
# then re-run the push script
```

### Nothing to commit / clean working tree
→ No files have changed since the last push. Make a change and run again.

## How the Token URL Works

The script builds an authenticated remote URL:
```
https://<GITHUB_TOKEN>@github.com/owner/repo.git
```

This lets git push without interactive credential prompts. The token is **never written to any file** — it's only used in memory for the duration of the script run.

## For Next Agents

The script lives at `scripts/src/push-to-github.ts` and is invoked via:
```bash
pnpm --filter @workspace/scripts run push-to-github
```

The npm script entry is in `scripts/package.json`:
```json
"push-to-github": "tsx ./src/push-to-github.ts"
```

Key environment variables it reads (in order of priority):
1. Environment variables passed inline (e.g. `GITHUB_REPO=x pnpm ...`)
2. Replit Secrets (automatically injected as env vars)
3. Git remote URL fallback (for `GITHUB_REPO` only)

The script uses Node.js built-ins only (`child_process`, `fetch`) — no extra dependencies.
