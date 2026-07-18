#!/usr/bin/env tsx
/**
 * push-to-github.ts
 * ─────────────────
 * Idempotent GitHub push script for SocialCommander.
 *
 * Usage:
 *   npm run push-to-github
 *   GITHUB_REPO=myuser/my-repo npm run push-to-github
 *
 * Required secrets (set in Replit Secrets):
 *   GITHUB_TOKEN   — Personal Access Token with repo scope
 *
 * Optional environment variables:
 *   GITHUB_REPO    — "owner/repo" (default: derived from git remote or prompts)
 *   GITHUB_BRANCH  — branch to push to (default: "main")
 *   COMMIT_MSG     — commit message (default: "chore: sync from Replit")
 */

import { execSync } from "child_process";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH ?? "main";
const COMMIT_MSG = process.env.COMMIT_MSG ?? "chore: sync from Replit";

function log(msg: string) {
  console.log(`[push-to-github] ${msg}`);
}

function run(cmd: string, opts: { capture?: boolean; cwd?: string } = {}): string {
  log(`$ ${cmd}`);
  const result = execSync(cmd, {
    cwd: opts.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: opts.capture ? "pipe" : "inherit",
  });
  return typeof result === "string" ? result.trim() : "";
}

async function ensureRepoExists(owner: string, repo: string): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const checkRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (checkRes.status === 200) {
    log(`Repository ${owner}/${repo} already exists.`);
    return;
  }

  if (checkRes.status === 404) {
    log(`Repository not found — creating ${owner}/${repo}...`);
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repo,
        description: "SocialCommander — AI-powered social media management dashboard",
        private: true,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create repo: ${createRes.status} — ${err}`);
    }

    log(`Repository created: https://github.com/${owner}/${repo}`);
    return;
  }

  const body = await checkRes.text();
  throw new Error(`GitHub API error: ${checkRes.status} — ${body}`);
}

async function main() {
  // ── 1. Validate token ──────────────────────────────────────────────────
  if (!GITHUB_TOKEN) {
    console.error(
      "\n[push-to-github] ERROR: GITHUB_TOKEN not found in environment.\n" +
      "  Set it in Replit Secrets: https://docs.replit.com/replit-workspace/secrets\n"
    );
    process.exit(1);
  }

  // ── 2. Resolve repo ────────────────────────────────────────────────────
  let repoFullName = GITHUB_REPO;
  if (!repoFullName) {
    // Try to read from existing git remote
    try {
      const remoteUrl = run("git remote get-url origin", { capture: true });
      const match = remoteUrl.match(/github\.com[/:](.+?\/.+?)(?:\.git)?$/);
      if (match) {
        repoFullName = match[1];
        log(`Detected repo from git remote: ${repoFullName}`);
      }
    } catch {
      // No remote configured yet
    }
  }

  if (!repoFullName) {
    console.error(
      "\n[push-to-github] ERROR: Could not determine GitHub repo.\n" +
      "  Set GITHUB_REPO=owner/reponame in your environment or Replit Secrets.\n"
    );
    process.exit(1);
  }

  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    console.error(`[push-to-github] ERROR: Invalid GITHUB_REPO format. Expected "owner/repo", got "${repoFullName}".`);
    process.exit(1);
  }

  log(`Target: https://github.com/${owner}/${repo} @ ${BRANCH}`);

  // ── 3. Ensure repo exists on GitHub ────────────────────────────────────
  await ensureRepoExists(owner, repo);

  // ── 4. Configure git ───────────────────────────────────────────────────
  try {
    run('git config user.email "agent@replit.com"');
    run('git config user.name "Replit Agent"');
  } catch {
    log("Git user config already set.");
  }

  // ── 5. Init git if needed ──────────────────────────────────────────────
  try {
    run("git rev-parse --git-dir", { capture: true });
    log("Git repo already initialized.");
  } catch {
    log("Initializing git repository...");
    run("git init");
    run(`git checkout -b ${BRANCH}`);
  }

  // ── 6. Set/update remote ───────────────────────────────────────────────
  const remoteUrl = `https://${GITHUB_TOKEN}@github.com/${owner}/${repo}.git`;
  try {
    run("git remote remove origin");
  } catch {
    // Remote didn't exist
  }
  run(`git remote add origin ${remoteUrl}`);
  log("Remote configured.");

  // ── 7. Stage, commit, push ─────────────────────────────────────────────
  run("git add -A");

  // Check if there's anything to commit
  let hasChanges = true;
  try {
    const status = run("git status --porcelain", { capture: true });
    hasChanges = status.length > 0;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges) {
    // Check if there are commits at all
    try {
      run("git log --oneline -1", { capture: true });
      log("No changes to commit. Working tree is clean.");
    } catch {
      // No commits yet — make an initial commit
      run(`git commit -m "feat: initial SocialCommander commit"`);
    }
  } else {
    run(`git commit -m "${COMMIT_MSG.replace(/"/g, '\\"')}"`);
    log("Committed changes.");
  }

  // Fetch remote branch (if it exists) before pushing
  try {
    run(`git fetch origin ${BRANCH}`, { capture: true });
    run(`git push origin ${BRANCH}`);
  } catch {
    // Branch doesn't exist on remote yet — force push the first time
    run(`git push --set-upstream origin ${BRANCH}`);
  }

  log(`\nSuccess! Code pushed to https://github.com/${owner}/${repo}/tree/${BRANCH}`);
}

main().catch((err) => {
  console.error("[push-to-github] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
