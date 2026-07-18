import { Router, type IRouter } from "express";
import { count, sql } from "drizzle-orm";
import { db, queueJobsTable, postsTable, accountsTable, auditLogsTable } from "@workspace/db";
import {
  ListQueueJobsQueryParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /queue/jobs
router.get("/queue/jobs", async (req, res): Promise<void> => {
  const query = ListQueueJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, limit = 20 } = query.data;

  let jobs = await db
    .select()
    .from(queueJobsTable)
    .orderBy(sql`${queueJobsTable.createdAt} DESC`)
    .limit(limit);

  if (status && status !== "all") {
    jobs = jobs.filter((j) => j.status === status);
  }

  res.json(jobs.map((j) => ({
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
  })));
});

// POST /queue/jobs/:id/retry — reset a failed job back to pending
router.post("/queue/jobs/:id/retry", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const [job] = await db.select().from(queueJobsTable).where(sql`${queueJobsTable.id} = ${id}`);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "failed") { res.status(409).json({ error: "Only failed jobs can be retried" }); return; }

  const [updated] = await db
    .update(queueJobsTable)
    .set({ status: "pending", attempts: 0, errorMessage: null, scheduledFor: new Date() })
    .where(sql`${queueJobsTable.id} = ${id}`)
    .returning();

  logger.info({ jobId: id }, "Job queued for retry");
  res.json({ id: String(updated.id), status: updated.status });
});

// DELETE /queue/jobs/:id — cancel a pending job
router.delete("/queue/jobs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const [job] = await db.select().from(queueJobsTable).where(sql`${queueJobsTable.id} = ${id}`);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "pending") { res.status(409).json({ error: "Only pending jobs can be cancelled" }); return; }

  await db.update(queueJobsTable)
    .set({ status: "failed", errorMessage: "Cancelled by user" })
    .where(sql`${queueJobsTable.id} = ${id}`);

  logger.info({ jobId: id }, "Job cancelled");
  res.status(204).send();
});

// GET /queue/stats
router.get("/queue/stats", async (req, res): Promise<void> => {
  const [pending] = await db
    .select({ count: count() })
    .from(queueJobsTable)
    .where(sql`${queueJobsTable.status} = 'pending'`);

  const [processing] = await db
    .select({ count: count() })
    .from(queueJobsTable)
    .where(sql`${queueJobsTable.status} = 'processing'`);

  const [completed] = await db
    .select({ count: count() })
    .from(queueJobsTable)
    .where(sql`${queueJobsTable.status} = 'completed'`);

  const [failed] = await db
    .select({ count: count() })
    .from(queueJobsTable)
    .where(sql`${queueJobsTable.status} = 'failed'`);

  const completedCount = Number(completed?.count ?? 0);
  const failedCount = Number(failed?.count ?? 0);
  const total = completedCount + failedCount;
  const successRate = total === 0 ? 100 : Math.round((completedCount / total) * 1000) / 10;

  res.json({
    pending: Number(pending?.count ?? 0),
    processing: Number(processing?.count ?? 0),
    completed: completedCount,
    failed: failedCount,
    successRate,
  });
});

// Background scheduler: process due jobs every 30 seconds
async function processDueJobs(): Promise<void> {
  const now = new Date();
  const dueJobs = await db
    .select()
    .from(queueJobsTable)
    .where(
      sql`${queueJobsTable.status} = 'pending' AND (${queueJobsTable.scheduledFor} IS NULL OR ${queueJobsTable.scheduledFor} <= ${now})`
    )
    .limit(10);

  for (const job of dueJobs) {
    // Mark as processing
    await db
      .update(queueJobsTable)
      .set({ status: "processing", attempts: job.attempts + 1 })
      .where(sql`${queueJobsTable.id} = ${job.id}`);

    try {
      if (job.type === "post_publish") {
        const payload = job.payload as { postId?: number };
        if (payload.postId) {
          await db
            .update(postsTable)
            .set({ status: "published", publishedAt: new Date() })
            .where(sql`${postsTable.id} = ${payload.postId}`);

          const [post] = await db
            .select()
            .from(postsTable)
            .where(sql`${postsTable.id} = ${payload.postId}`);

          if (post) {
            await db
              .update(accountsTable)
              .set({ lastPostAt: new Date() })
              .where(sql`${accountsTable.id} = ${post.accountId}`);

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
        .where(sql`${queueJobsTable.id} = ${job.id}`);
    } catch (err) {
      const shouldRetry = job.attempts < job.maxAttempts;
      await db
        .update(queueJobsTable)
        .set({
          status: shouldRetry ? "pending" : "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        })
        .where(sql`${queueJobsTable.id} = ${job.id}`);

      logger.error({ err, jobId: job.id }, "Job processing failed");
    }
  }
}

// Start background scheduler
setInterval(() => {
  processDueJobs().catch((err) => {
    logger.error({ err }, "Scheduler error");
  });
}, 30_000);

export default router;
