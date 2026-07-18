import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /audit — filtered and paginated at the DB level
router.get("/audit", async (req, res): Promise<void> => {
  const query = ListAuditLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, action, limit = 50, offset = 0 } = query.data;

  const conditions: ReturnType<typeof sql>[] = [];
  if (accountId) conditions.push(sql`${auditLogsTable.accountId} = ${accountId}`);
  if (action) conditions.push(sql`${auditLogsTable.action} ILIKE ${"%" + action + "%"}`);

  const where = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const { rows: [countRow] } = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text as count FROM audit_logs ${where}`
  );
  const total = Number(countRow?.count ?? 0);

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
    .orderBy(sql`${auditLogsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      accountId: l.accountId ?? null,
      postId: l.postId ?? null,
      action: l.action,
      details: l.details ?? null,
      ipAddress: l.ipAddress ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
});

export default router;
