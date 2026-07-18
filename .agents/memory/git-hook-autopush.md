---
name: Git hook auto-push
description: Post-commit hook pushes to GitHub on every checkpoint; must be reinstalled after merges.
---

## Rule
The git hook at `.git/hooks/post-commit` auto-pushes to GitHub when `GITHUB_TOKEN` and `GITHUB_REPO` are set. It runs in background (non-blocking).

## Why
`.git/hooks/` is not committed to git, so it's lost after task-agent merges. The hook template lives at `scripts/git-hooks/post-commit` (committed) and is reinstalled by `scripts/post-merge.sh`.

## How to apply
- If auto-push stops working after a merge: `cp scripts/git-hooks/post-commit .git/hooks/post-commit && chmod +x .git/hooks/post-commit`
- Push log: `/tmp/github-autopush.log`
- Requires secrets: `GITHUB_TOKEN` (PAT with repo scope), `GITHUB_REPO` (owner/repo)
