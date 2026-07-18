import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /audit
router.get("/audit", async (req, res): Promise<void> => {
  const query = ListAuditLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, action, limit = 50, offset = 0 } = query.data;

  let logs = await db
    .select()
    .from(auditLogsTable)
    .orderBy(sql`${auditLogsTable.createdAt} DESC`);

  if (accountId) logs = logs.filter((l) => l.accountId === accountId);
  if (action) logs = logs.filter((l) => l.action.includes(action));

  const total = logs.length;
  const page = logs.slice(offset, offset + limit);

  res.json(page.map((l) => ({
    id: l.id,
    accountId: l.accountId ?? null,
    postId: l.postId ?? null,
    action: l.action,
    details: l.details ?? null,
    ipAddress: l.ipAddress ?? null,
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
