---
name: Git auto-push setup
description: How automatic GitHub push on every checkpoint works and what env vars are needed
---

## Rule
The `.git/hooks/post-commit` hook pushes to GitHub silently in the background after every checkpoint. The template lives at `scripts/git-hooks/post-commit` and is reinstalled by `scripts/post-merge.sh` after task-agent merges.

**Why:** User wants every commit auto-pushed without manual steps.

## Required environment
| Key | Type | Value |
|-----|------|-------|
| `GITHUB_TOKEN` | Secret | PAT with `repo` scope |
| `GITHUB_REPO` | Env var | `owner/reponame` (e.g. `vghuyf277-pixel/socialcommander`) |
| `GITHUB_BRANCH` | Env var | branch name, default `main` |

## How to apply
- The hook exits silently if `GITHUB_TOKEN` or `GITHUB_REPO` are unset — no errors.
- After any Replit action that might reset `.git/hooks/`, re-run: `cp scripts/git-hooks/post-commit .git/hooks/post-commit && chmod +x .git/hooks/post-commit`
- `post-merge.sh` does this automatically after task-agent merges.
- To push manually: `git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" && git push origin main`
