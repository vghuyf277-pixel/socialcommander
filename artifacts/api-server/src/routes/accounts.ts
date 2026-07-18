import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, accountsTable, postsTable, auditLogsTable } from "@workspace/db";
import type { Account } from "@workspace/db";
import {
  ListAccountsQueryParams,
  GetAccountParams,
  UpdateAccountParams,
  UpdateAccountBody,
  DeleteAccountParams,
  GetAccountStatsParams,
  CreateAccountBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /accounts — filtered at DB level
router.get("/accounts", async (req, res): Promise<void> => {
  const query = ListAccountsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { platform, status } = query.data;
  const conditions: ReturnType<typeof sql>[] = [];
  if (platform && platform !== "all") conditions.push(sql`${accountsTable.platform} = ${platform}`);
  if (status && status !== "all") conditions.push(sql`${accountsTable.status} = ${status}`);

  const accounts = conditions.length > 0
    ? await db.select().from(accountsTable).where(sql.join(conditions, sql` AND `))
    : await db.select().from(accountsTable);

  res.json(accounts);
});

// POST /accounts
router.post("/accounts", async (req, res): Promise<void> => {
  const body = CreateAccountBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { platform, username, displayName, color, avatarUrl, proxyConfig, voiceProfile, oauthAccessToken, oauthRefreshToken } = body.data;

  const [account] = await db
    .insert(accountsTable)
    .values({ platform, username, displayName, color, avatarUrl, proxyConfig, voiceProfile, oauthAccessToken, oauthRefreshToken })
    .returning();

  await db.insert(auditLogsTable).values({
    accountId: account.id,
    action: "account_created",
    details: `Added ${platform} account @${username}`,
    ipAddress: req.ip,
  });

  req.log.info({ accountId: account.id }, "Account created");
  res.status(201).json(account);
});

// GET /accounts/overview — single efficient query (must come before /:id)
router.get("/accounts/overview", async (req, res): Promise<void> => {
  const [stats] = await db.execute<{
    total_accounts: string;
    active_accounts: string;
    posts_today: string;
    scheduled: string;
    twitter_count: string;
    reddit_count: string;
  }>(sql`
    SELECT
      COUNT(*)::text AS total_accounts,
      COUNT(*) FILTER (WHERE status = 'active')::text AS active_accounts,
      COUNT(*) FILTER (WHERE platform = 'twitter')::text AS twitter_count,
      COUNT(*) FILTER (WHERE platform = 'reddit')::text AS reddit_count,
      (SELECT COUNT(*)::text FROM posts
        WHERE published_at >= CURRENT_DATE AND status = 'published') AS posts_today,
      (SELECT COUNT(*)::text FROM posts WHERE status = 'scheduled') AS scheduled
    FROM accounts
  `);

  res.json({
    totalAccounts: Number(stats?.total_accounts ?? 0),
    activeAccounts: Number(stats?.active_accounts ?? 0),
    totalPostsToday: Number(stats?.posts_today ?? 0),
    totalScheduled: Number(stats?.scheduled ?? 0),
    platformBreakdown: {
      twitter: Number(stats?.twitter_count ?? 0),
      reddit: Number(stats?.reddit_count ?? 0),
    },
  });
});

// GET /accounts/:id
router.get("/accounts/:id", async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, params.data.id));
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(account);
});

// PATCH /accounts/:id
router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateAccountBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const d = body.data;
  const updates: Partial<Account> = {};
  if (d.displayName != null) updates.displayName = d.displayName;
  if (d.color != null) updates.color = d.color;
  if (d.status != null) updates.status = d.status as Account["status"];
  if (d.avatarUrl !== undefined) updates.avatarUrl = d.avatarUrl ?? null;
  if (d.proxyConfig !== undefined) updates.proxyConfig = d.proxyConfig ?? null;
  if (d.voiceProfile !== undefined) updates.voiceProfile = d.voiceProfile ?? null;
  if (d.oauthAccessToken !== undefined) updates.oauthAccessToken = d.oauthAccessToken ?? null;
  if (d.oauthRefreshToken !== undefined) updates.oauthRefreshToken = d.oauthRefreshToken ?? null;

  const [account] = await db
    .update(accountsTable)
    .set(updates)
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    accountId: account.id,
    action: "account_updated",
    details: `Updated fields: ${Object.keys(updates).join(", ")}`,
    ipAddress: req.ip,
  });

  res.json(account);
});

// DELETE /accounts/:id
router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(accountsTable)
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  req.log.info({ accountId: params.data.id }, "Account deleted");
  res.status(204).send();
});

// PATCH /accounts/:id/status
router.patch("/accounts/:id/status", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { status } = req.body as { status?: string };
  if (!["active", "paused", "suspended"].includes(status ?? "")) {
    res.status(400).json({ error: "status must be active | paused | suspended" });
    return;
  }

  const [account] = await db
    .update(accountsTable)
    .set({ status: status as Account["status"] })
    .where(eq(accountsTable.id, id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    accountId: id,
    action: "account_status_changed",
    details: `Status changed to ${status}`,
    ipAddress: req.ip,
  });

  res.json(account);
});

// GET /accounts/:id/stats — single efficient query
router.get("/accounts/:id/stats", async (req, res): Promise<void> => {
  const params = GetAccountStatsParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const id = params.data.id;

  const [stats] = await db.execute<{
    total_posts: string;
    scheduled_posts: string;
    failed_posts: string;
    published_posts: string;
    total_engagement: string;
    top_post_id: number | null;
    top_post_eng: string;
  }>(sql`
    SELECT
      COUNT(*)::text AS total_posts,
      COUNT(*) FILTER (WHERE status = 'scheduled')::text AS scheduled_posts,
      COUNT(*) FILTER (WHERE status = 'failed')::text AS failed_posts,
      COUNT(*) FILTER (WHERE status = 'published')::text AS published_posts,
      COALESCE(SUM(likes + comments + reposts) FILTER (WHERE status = 'published'), 0)::text AS total_engagement,
      (SELECT id FROM posts WHERE account_id = ${id} AND status = 'published'
        ORDER BY (likes + comments + reposts) DESC LIMIT 1) AS top_post_id,
      COALESCE((SELECT (likes + comments + reposts)::text FROM posts WHERE account_id = ${id} AND status = 'published'
        ORDER BY (likes + comments + reposts) DESC LIMIT 1), '0') AS top_post_eng
    FROM posts
    WHERE account_id = ${id}
  `);

  const publishedCount = Number(stats?.published_posts ?? 0);
  const totalEng = Number(stats?.total_engagement ?? 0);

  res.json({
    accountId: id,
    totalPosts: Number(stats?.total_posts ?? 0),
    scheduledPosts: Number(stats?.scheduled_posts ?? 0),
    failedPosts: Number(stats?.failed_posts ?? 0),
    avgEngagement: publishedCount > 0 ? Math.round((totalEng / publishedCount) * 100) / 100 : 0,
    topPostId: stats?.top_post_id ?? null,
  });
});

export default router;
