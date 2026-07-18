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
 *
 * Security:
 *   - GITHUB_TOKEN is NEVER embedded in a remote URL.
 *   - Auth is delivered via git's http.extraheader config (set silently, not logged).
 *   - Any accidental token appearance in output is masked to "***<last4>".
 *
 * Reliability:
 *   - Push failures are caught and retried up to MAX_RETRIES times.
 *   - Before each retry: git fetch + rebase to reconcile diverged history.
 *   - After a successful push: verifies local HEAD equals origin/<branch> HEAD.
 *   - Exits non-zero and prints a clear error if all retries are exhausted.
 */

import { execSync } from "child_process";

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_REPO   = process.env.GITHUB_REPO;
const BRANCH        = process.env.GITHUB_BRANCH ?? "main";
const COMMIT_MSG    = process.env.COMMIT_MSG ?? "chore: sync from Replit";
const MAX_RETRIES   = 3;

// ── Logging helpers ───────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[push-to-github] ${msg}`);
}

/** Replace any occurrence of the raw token with "***<last4>" in a string. */
function maskToken(s: string): string {
  if (!GITHUB_TOKEN || GITHUB_TOKEN.length < 4) return s;
  // Use a regex so all occurrences are replaced, not just the first
  return s.split(GITHUB_TOKEN).join(`***${GITHUB_TOKEN.slice(-4)}`);
}

// ── Command runners ───────────────────────────────────────────────────────────

/**
 * Run a shell command, log it (with token masked), and return trimmed stdout.
 * Throws on non-zero exit — stderr is included in the error message (masked).
 */
function run(cmd: string, opts: { capture?: boolean; cwd?: string } = {}): string {
  log(`$ ${maskToken(cmd)}`);
  try {
    const result = execSync(cmd, {
      cwd: opts.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: opts.capture ? "pipe" : "inherit",
    });
    return typeof result === "string" ? result.trim() : "";
  } catch (err: unknown) {
    const e = err as { stderr?: string | Buffer; message?: string };
    const stderr = maskToken(String(e.stderr ?? "").trim());
    const base   = maskToken(e.message ?? "Command failed");
    throw new Error(`${base}${stderr ? `\n  stderr: ${stderr}` : ""}`);
  }
}

/**
 * Run a command that contains sensitive data (e.g. GITHUB_TOKEN).
 * The command is NOT logged and output is fully suppressed.
 * Throws a generic error (without leaking the command) on non-zero exit.
 */
function runSecret(description: string, cmd: string, opts: { cwd?: string } = {}): void {
  log(description); // log a human-friendly description, not the command
  try {
    execSync(cmd, {
      cwd: opts.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: "pipe", // suppress all output — command contains secret
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    // Do NOT include the error message — it may echo the command/token
    throw new Error(`${description} — command failed (check token permissions)`);
  }
}

/**
 * Run a command and return { stdout, stderr, exitCode } without throwing.
 * All output is masked before being stored or returned.
 */
function runCapture(cmd: string, opts: { cwd?: string } = {}): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, {
      cwd: opts.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    });
    return { stdout: maskToken((stdout ?? "").trim()), stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number };
    return {
      stdout:   maskToken(String(e.stdout ?? "").trim()),
      stderr:   maskToken(String(e.stderr ?? "").trim()),
      exitCode: e.status ?? 1,
    };
  }
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

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
    log(`Repository not found — creating ${owner}/${repo}…`);
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
      throw new Error(`Failed to create repo: ${createRes.status} — ${maskToken(err)}`);
    }

    log(`Repository created: https://github.com/${owner}/${repo}`);
    return;
  }

  const body = await checkRes.text();
  throw new Error(`GitHub API error: ${checkRes.status} — ${maskToken(body)}`);
}

// ── Push with retry ───────────────────────────────────────────────────────────

/**
 * Push local HEAD to origin/<branch> with up to MAX_RETRIES attempts.
 *
 * On each failure:
 *   1. fetch + rebase to reconcile diverged history.
 *   2. Wait with linear back-off (attempt × 2 s).
 *   3. Retry the push.
 *
 * After a push that returns exit code 0, verifies that local HEAD equals
 * origin/<branch> HEAD.  Only then reports success.
 *
 * Exits non-zero if every retry fails.
 */
async function pushWithRetry(branch: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`Push attempt ${attempt}/${MAX_RETRIES}…`);

    const push = runCapture(`git push origin ${branch}`);

    if (push.exitCode === 0) {
      // ── Verify HEAD actually moved on the remote ──────────────────────────
      const localHead = runCapture("git rev-parse HEAD");
      // Refresh remote tracking ref before comparing
      runCapture(`git fetch origin ${branch}`);
      const remoteHead = runCapture(`git rev-parse origin/${branch}`);

      if (localHead.stdout === remoteHead.stdout) {
        log(`Push verified ✓  HEAD ${localHead.stdout.slice(0, 7)} matches origin/${branch}`);
        return; // genuine success — exit the retry loop
      }

      // Push said 0 but refs don't match — treat as failure
      throw new Error(
        `Push reported success but HEAD mismatch: ` +
        `local=${localHead.stdout.slice(0, 7)} ` +
        `remote=${remoteHead.stdout.slice(0, 7)}`
      );
    }

    // Push failed
    const reason = push.stderr || push.stdout || "(no output)";
    log(`Attempt ${attempt} failed (exit ${push.exitCode}): ${reason}`);

    if (attempt >= MAX_RETRIES) {
      throw new Error(
        `Push to origin/${branch} failed after ${MAX_RETRIES} attempts.\n` +
        `Last error: ${reason}`
      );
    }

    // ── Reconcile diverged history before retry ───────────────────────────
    log(`Reconciling with origin/${branch}…`);
    const fetch = runCapture(`git fetch origin ${branch}`);
    if (fetch.exitCode !== 0) {
      log(`Fetch failed: ${fetch.stderr} — will retry push anyway`);
    } else {
      // Try rebase first (clean linear history)
      const rebase = runCapture(`git rebase origin/${branch}`);
      if (rebase.exitCode !== 0) {
        log("Rebase conflicted — aborting and falling back to merge…");
        runCapture("git rebase --abort");
        const merge = runCapture(`git merge origin/${branch} --no-edit`);
        if (merge.exitCode !== 0) {
          throw new Error(
            `Cannot reconcile with origin/${branch}: ${merge.stderr || merge.stdout}\n` +
            `Resolve conflicts manually and re-run the script.`
          );
        }
        log("Merge succeeded.");
      } else {
        log("Rebase succeeded.");
      }
    }

    const delay = attempt * 2_000;
    log(`Waiting ${delay / 1_000}s before retry…`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Validate token
  if (!GITHUB_TOKEN) {
    console.error(
      "\n[push-to-github] ERROR: GITHUB_TOKEN not found in environment.\n" +
      "  Set it in Replit Secrets: https://docs.replit.com/replit-workspace/secrets\n"
    );
    process.exit(1);
  }

  // 2. Resolve repo
  let repoFullName = GITHUB_REPO;
  if (!repoFullName) {
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
    console.error(
      `[push-to-github] ERROR: Invalid GITHUB_REPO format. Expected "owner/repo", got "${repoFullName}".`
    );
    process.exit(1);
  }

  log(`Target: https://github.com/${owner}/${repo} @ ${BRANCH}`);

  // 3. Ensure repo exists on GitHub
  await ensureRepoExists(owner, repo);

  // 4. Configure git identity
  try {
    run('git config user.email "agent@replit.com"');
    run('git config user.name "Replit Agent"');
  } catch {
    log("Git user config already set.");
  }

  // 5. Init git if needed
  try {
    run("git rev-parse --git-dir", { capture: true });
    log("Git repo already initialized.");
  } catch {
    log("Initializing git repository…");
    run("git init");
    run(`git checkout -b ${BRANCH}`);
  }

  // 6. Configure remote — clean URL, token delivered via extraheader
  //    The token is NEVER embedded in the remote URL and is NOT logged.
  try { run("git remote remove origin"); } catch { /* didn't exist */ }
  run(`git remote add origin https://github.com/${owner}/${repo}.git`);

  // Set auth via git config extraheader (command is run silently — not logged)
  runSecret(
    `Configuring git auth header (token: ***${GITHUB_TOKEN.slice(-4)})`,
    `git config --local http.https://github.com/.extraheader "AUTHORIZATION: bearer ${GITHUB_TOKEN}"`
  );

  // 7. Stage and commit
  run("git add -A");

  const status = runCapture("git status --porcelain");
  const hasChanges = status.stdout.length > 0;

  if (!hasChanges) {
    try {
      run("git log --oneline -1", { capture: true });
      log("No changes to commit — working tree is clean.");
    } catch {
      // No commits yet — make an initial commit
      run(`git commit -m "feat: initial SocialCommander commit"`);
    }
  } else {
    run(`git commit -m "${COMMIT_MSG.replace(/"/g, '\\"')}"`);
    log("Changes committed.");
  }

  // 8. Push with retry + verification
  await pushWithRetry(BRANCH);

  log(`\nSuccess! Code pushed to https://github.com/${owner}/${repo}/tree/${BRANCH}`);
}

main().catch((err) => {
  console.error(
    "[push-to-github] Fatal error:",
    maskToken(err instanceof Error ? err.message : String(err))
  );
  process.exit(1);
});
