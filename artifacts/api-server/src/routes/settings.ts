import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /settings/status — system integration health check
router.get("/settings/status", async (req, res): Promise<void> => {
  // Database connectivity
  let dbConnected = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  // AI key
  const groqConfigured = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
  const groqKeyHint = process.env.GROQ_API_KEY
    ? `${process.env.GROQ_API_KEY.slice(0, 6)}…`
    : process.env.OPENAI_API_KEY
    ? `sk-…`
    : null;

  // GitHub
  const githubToken = !!process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO ?? null;
  const githubBranch = process.env.GITHUB_BRANCH ?? "main";

  res.json({
    database: {
      connected: dbConnected,
    },
    groq: {
      configured: groqConfigured,
      keyHint: groqKeyHint,
      model: groqConfigured ? "llama-3.1-8b-instant" : null,
    },
    github: {
      tokenSet: githubToken,
      repo: githubRepo,
      branch: githubBranch,
      autoPushEnabled: githubToken && !!githubRepo,
    },
    scheduler: {
      running: true,
      intervalSeconds: 30,
    },
  });
});

export default router;
