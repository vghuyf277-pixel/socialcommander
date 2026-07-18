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

// GET /accounts
router.get("/accounts", async (req, res): Promise<void> => {
  const query = ListAccountsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { platform, status } = query.data;

  const accounts = await db.select().from(accountsTable);
  let filtered = accounts;
  if (platform && platform !== "all") {
    filtered = filtered.filter((a) => a.platform === platform);
  }
  if (status && status !== "all") {
    filtered = filtered.filter((a) => a.status === status);
  }
  res.json(filtered);
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

  // Audit log
  await db.insert(auditLogsTable).values({
    accountId: account.id,
    action: "account_created",
    details: `Added ${platform} account @${username}`,
    ipAddress: req.ip,
  });

  req.log.info({ accountId: account.id }, "Account created");
  res.status(201).json(account);
});

// GET /accounts/overview  (must come before /:id)
router.get("/accounts/overview", async (req, res): Promise<void> => {
  const accounts = await db.select().from(accountsTable);

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.status === "active").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [postsToday] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(sql`${postsTable.publishedAt} >= ${today} AND ${postsTable.status} = 'published'`);

  const [scheduled] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(sql`${postsTable.status} = 'scheduled'`);

  const twitterCount = accounts.filter((a) => a.platform === "twitter").length;
  const redditCount = accounts.filter((a) => a.platform === "reddit").length;

  res.json({
    totalAccounts,
    activeAccounts,
    totalPostsToday: Number(postsToday?.count ?? 0),
    totalScheduled: Number(scheduled?.count ?? 0),
    platformBreakdown: { twitter: twitterCount, reddit: redditCount },
  });
});

// GET /accounts/:id
router.get("/accounts/:id", async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, params.data.id));

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

// PATCH /accounts/:id/status — quick toggle active/paused/suspended
router.patch("/accounts/:id/status", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

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

  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  await db.insert(auditLogsTable).values({
    accountId: id,
    action: "account_status_changed",
    details: `Status changed to ${status}`,
    ipAddress: req.ip,
  });

  res.json(account);
});

// GET /accounts/:id/stats
router.get("/accounts/:id/stats", async (req, res): Promise<void> => {
  const params = GetAccountStatsParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const id = params.data.id;

  const [totalRow] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(eq(postsTable.accountId, id));

  const [scheduledRow] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(sql`${postsTable.accountId} = ${id} AND ${postsTable.status} = 'scheduled'`);

  const [failedRow] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(sql`${postsTable.accountId} = ${id} AND ${postsTable.status} = 'failed'`);

  const publishedPosts = await db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.accountId} = ${id} AND ${postsTable.status} = 'published'`);

  const avgEngagement =
    publishedPosts.length > 0
      ? publishedPosts.reduce((acc, p) => acc + p.likes + p.comments + p.reposts, 0) /
        publishedPosts.length
      : 0;

  const topPost = publishedPosts.reduce(
    (best, p) =>
      p.likes + p.comments + p.reposts > (best?.likes ?? 0) + (best?.comments ?? 0) + (best?.reposts ?? 0)
        ? p
        : best,
    null as (typeof publishedPosts)[0] | null
  );

  res.json({
    accountId: id,
    totalPosts: Number(totalRow?.count ?? 0),
    scheduledPosts: Number(scheduledRow?.count ?? 0),
    failedPosts: Number(failedRow?.count ?? 0),
    avgEngagement,
    topPostId: topPost?.id ?? null,
  });
});

export default router;
