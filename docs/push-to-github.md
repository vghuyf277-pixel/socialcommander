# Push to GitHub — Setup & Automation Guide

SocialCommander includes a fully automated GitHub sync that runs on every checkpoint and can also be triggered manually.

---

## Auto-Push on Checkpoints (Recommended)

Every time Replit creates a checkpoint (git commit), a git post-commit hook automatically pushes to GitHub **in the background** — no extra steps needed.

### One-time setup

1. **Get a GitHub token**
   - Go to [github.com/settings/tokens](https://github.com/settings/tokens/new)
   - Create a token with `repo` scope (or `public_repo` for public repos)

2. **Add secrets** in the Replit Secrets tab (lock icon in sidebar):
   | Secret | Value |
   |--------|-------|
   | `GITHUB_TOKEN` | Your PAT (`ghp_…`) |
   | `GITHUB_REPO` | `owner/reponame` (e.g. `alice/socialcommander`) |
   | `GITHUB_BRANCH` | _(optional)_ branch name, default `main` |

3. **That's it.** From now on, every checkpoint pushes automatically. No restart needed.

### Verify it's working

Check the push log anytime:
```bash
cat /tmp/github-autopush.log
```

Or open the **Settings** page in the dashboard — the GitHub section shows live status.

---

## Manual Push

Run this from the terminal whenever you want to push on demand:

```bash
pnpm --filter @workspace/scripts run push-to-github
```

The script is idempotent: it creates the repo if it doesn't exist, sets up the remote, stages all changes, commits (if anything is new), and pushes.

**Optional overrides:**
```bash
# Override repo for one push
GITHUB_REPO=myorg/other-repo pnpm --filter @workspace/scripts run push-to-github

# Custom commit message
COMMIT_MSG="feat: add bulk delete" pnpm --filter @workspace/scripts run push-to-github
```

---

## How it works internally

### Git hook (`scripts/git-hooks/post-commit`)

The hook is installed at `.git/hooks/post-commit` and reinstalled automatically by `scripts/post-merge.sh` after every task-agent merge. It:

1. Checks `GITHUB_TOKEN` and `GITHUB_REPO` are set — exits silently if not
2. Runs entirely in a background subshell (`&`) — never delays commits
3. Sets the authenticated remote URL
4. Pushes the current branch; uses `--set-upstream` on first push

### Manual script (`scripts/src/push-to-github.ts`)

The manual script does more: it also creates the GitHub repo if it doesn't exist, stages all files, and makes a commit if there are outstanding changes. Use this for the initial push or when you want to force a sync.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Pushes aren't happening | Check `/tmp/github-autopush.log` for errors |
| `403 Forbidden` | Token lacks `repo` scope — regenerate with correct scope |
| `remote: Repository not found` | Check `GITHUB_REPO` is correct (`owner/repo` format) |
| Hook not installed | Run: `chmod +x scripts/git-hooks/post-commit && cp scripts/git-hooks/post-commit .git/hooks/post-commit` |
| Push script fails | Run with `DEBUG=1` prefix and read the output |

---

## File locations

| File | Purpose |
|------|---------|
| `.git/hooks/post-commit` | Active hook (auto-runs on checkpoint) |
| `scripts/git-hooks/post-commit` | Template — reinstalled by `post-merge.sh` |
| `scripts/src/push-to-github.ts` | Manual push script |
| `scripts/post-merge.sh` | Post-merge setup (installs hook, runs migrations) |
