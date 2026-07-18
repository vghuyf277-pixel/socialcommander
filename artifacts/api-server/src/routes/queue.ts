import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, queueJobsTable, postsTable, accountsTable, auditLogsTable } from "@workspace/db";
import { ListQueueJobsQueryParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const formatJob = (j: typeof queueJobsTable.$inferSelect) => ({
  id: String(j.id),
  type: j.type,
  status: j.status,
  payload: j.payload,
  attempts: j.attempts,
  maxAttempts: j.maxAttempts,
  scheduledFor: j.scheduledFor?.toISOString() ?? null,
  errorMessage: j.errorMessage,
  createdAt: j.createdAt.toISOString(),
  updatedAt: j.updatedAt.toISOString(),
});

// GET /queue/jobs — filtered at DB level
router.get("/queue/jobs", async (req, res): Promise<void> => {
  const query = ListQueueJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, limit = 50 } = query.data;

  const jobs = await db
    .select()
    .from(queueJobsTable)
    .where(status && status !== "all" ? eq(queueJobsTable.status, status as typeof queueJobsTable.$inferSelect["status"]) : undefined)
    .orderBy(sql`${queueJobsTable.createdAt} DESC`)
    .limit(limit);

  res.json(jobs.map(formatJob));
});

// POST /queue/jobs/:id/retry
router.post("/queue/jobs/:id/retry", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const [job] = await db.select().from(queueJobsTable).where(eq(queueJobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "failed") {
    res.status(409).json({ error: "Only failed jobs can be retried" });
    return;
  }

  const [updated] = await db
    .update(queueJobsTable)
    .set({ status: "pending", attempts: 0, errorMessage: null, scheduledFor: new Date() })
    .where(eq(queueJobsTable.id, id))
    .returning();

  logger.info({ jobId: id }, "Job queued for retry");
  res.json(formatJob(updated));
});

// DELETE /queue/jobs/:id — cancel a pending job
router.delete("/queue/jobs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const [job] = await db.select().from(queueJobsTable).where(eq(queueJobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "pending") {
    res.status(409).json({ error: "Only pending jobs can be cancelled" });
    return;
  }

  await db
    .update(queueJobsTable)
    .set({ status: "failed", errorMessage: "Cancelled by user" })
    .where(eq(queueJobsTable.id, id));

  logger.info({ jobId: id }, "Job cancelled");
  res.status(204).send();
});

// GET /queue/stats — single aggregated query
router.get("/queue/stats", async (req, res): Promise<void> => {
  const [stats] = await db.execute<{
    pending: string;
    processing: string;
    completed: string;
    failed: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
      COUNT(*) FILTER (WHERE status = 'processing')::text AS processing,
      COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
      COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
    FROM queue_jobs
  `);

  const completed = Number(stats?.completed ?? 0);
  const failed = Number(stats?.failed ?? 0);
  const total = completed + failed;
  const successRate = total === 0 ? 100 : Math.round((completed / total) * 1000) / 10;

  res.json({
    pending: Number(stats?.pending ?? 0),
    processing: Number(stats?.processing ?? 0),
    completed,
    failed,
    successRate,
  });
});

// ─── Background scheduler ────────────────────────────────────────────────────

let schedulerRunning = false;

async function processDueJobs(): Promise<void> {
  if (schedulerRunning) return; // prevent overlap
  schedulerRunning = true;

  try {
    const now = new Date();
    const dueJobs = await db
      .select()
      .from(queueJobsTable)
      .where(
        sql`${queueJobsTable.status} = 'pending' AND (${queueJobsTable.scheduledFor} IS NULL OR ${queueJobsTable.scheduledFor} <= ${now})`
      )
      .limit(10);

    for (const job of dueJobs) {
      await db
        .update(queueJobsTable)
        .set({ status: "processing", attempts: job.attempts + 1 })
        .where(eq(queueJobsTable.id, job.id));

      try {
        if (job.type === "post_publish") {
          const payload = job.payload as { postId?: number };
          if (payload.postId) {
            const [post] = await db
              .update(postsTable)
              .set({ status: "published", publishedAt: new Date() })
              .where(eq(postsTable.id, payload.postId))
              .returning();

            if (post) {
              await db
                .update(accountsTable)
                .set({ lastPostAt: new Date() })
                .where(eq(accountsTable.id, post.accountId));

              await db.insert(auditLogsTable).values({
                accountId: post.accountId,
                postId: post.id,
                action: "post_published_scheduled",
                details: "Published via scheduler",
              });
            }
          }
        }

        await db
          .update(queueJobsTable)
          .set({ status: "completed" })
          .where(eq(queueJobsTable.id, job.id));

        logger.info({ jobId: job.id, type: job.type }, "Job completed");
      } catch (err) {
        const shouldRetry = job.attempts < job.maxAttempts;
        await db
          .update(queueJobsTable)
          .set({
            status: shouldRetry ? "pending" : "failed",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
          })
          .where(eq(queueJobsTable.id, job.id));

        logger.error({ err, jobId: job.id }, "Job processing failed");
      }
    }
  } finally {
    schedulerRunning = false;
  }
}

// Start scheduler — process immediately then every 30s
processDueJobs().catch((err) => logger.error({ err }, "Initial scheduler run failed"));
setInterval(() => {
  processDueJobs().catch((err) => logger.error({ err }, "Scheduler error"));
}, 30_000);

export default router;
