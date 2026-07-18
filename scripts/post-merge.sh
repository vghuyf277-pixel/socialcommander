#!/bin/bash
set -e

# Install/reinstall the git post-commit hook so auto-push survives merges
HOOK_SRC="$(git rev-parse --show-toplevel)/.git/hooks/post-commit"
HOOK_TEMPLATE="$(git rev-parse --show-toplevel)/scripts/git-hooks/post-commit"

if [ -f "$HOOK_TEMPLATE" ]; then
  cp "$HOOK_TEMPLATE" "$HOOK_SRC"
  chmod +x "$HOOK_SRC"
  echo "[post-merge] Git post-commit hook reinstalled."
fi

pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
