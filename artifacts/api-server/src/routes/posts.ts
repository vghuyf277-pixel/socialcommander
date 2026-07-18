import { Router, type IRouter } from "express";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { db, postsTable, accountsTable, auditLogsTable, queueJobsTable } from "@workspace/db";
import type { Post } from "@workspace/db";
import {
  ListPostsQueryParams,
  GetPostParams,
  CreatePostBody,
  UpdatePostParams,
  UpdatePostBody,
  DeletePostParams,
  PublishPostParams,
  SchedulePostParams,
  SchedulePostBody,
  GetCalendarQueryParams,
  GetRecentPostsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Helper: attach account objects to a list of posts
async function attachAccounts(posts: typeof postsTable.$inferSelect[]) {
  if (posts.length === 0) return posts.map((p) => ({ ...p, account: null }));
  const accountIds = [...new Set(posts.map((p) => p.accountId))];
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(inArray(accountsTable.id, accountIds));
  const map = Object.fromEntries(accounts.map((a) => [a.id, a]));
  return posts.map((p) => ({ ...p, account: map[p.accountId] ?? null }));
}

// GET /posts — paginated, filtered at the DB level
router.get("/posts", async (req, res): Promise<void> => {
  const query = ListPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, status, platform, limit = 50, offset = 0 } = query.data;

  // Build WHERE conditions
  const conditions: ReturnType<typeof sql>[] = [];
  if (accountId) conditions.push(sql`${postsTable.accountId} = ${accountId}`);
  if (status && status !== "all") conditions.push(sql`${postsTable.status} = ${status}`);

  // For platform filter we need a JOIN — build subquery of matching account ids
  let platformAccountIds: number[] | null = null;
  if (platform && platform !== "all") {
    const accs = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(sql`${accountsTable.platform} = ${platform}`);
    platformAccountIds = accs.map((a) => a.id);
    if (platformAccountIds.length === 0) {
      res.json({ posts: [], total: 0, limit, offset });
      return;
    }
    conditions.push(sql`${postsTable.accountId} = ANY(ARRAY[${sql.join(platformAccountIds.map((id) => sql`${id}`), sql`, `)}]::int[])`);
  }

  const where = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  // Count + page in one pass
  const { rows: [countRow] } = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text as count FROM posts ${where}`
  );
  const total = Number(countRow?.count ?? 0);

  const rawPosts = await db.execute<typeof postsTable.$inferSelect>(
    sql`SELECT * FROM posts ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  );

  const posts = await attachAccounts(rawPosts.rows as typeof postsTable.$inferSelect[]);
  res.json({ posts, total, limit, offset });
});

// POST /posts
router.post("/posts", async (req, res): Promise<void> => {
  const body = CreatePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { accountId, content, mediaUrls, status, scheduledAt, subreddit, postTitle, aiGenerated } = body.data;

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account) {
    res.status(400).json({ error: "Account not found" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      accountId,
      content,
      mediaUrls: mediaUrls ?? [],
      status: status ?? "draft",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      subreddit: subreddit ?? undefined,
      postTitle: postTitle ?? undefined,
      aiGenerated: aiGenerated ?? false,
    })
    .returning();

  // Queue a job if scheduled
  if (post.status === "scheduled" && post.scheduledAt) {
    await db.insert(queueJobsTable).values({
      type: "post_publish",
      payload: { postId: post.id },
      scheduledFor: post.scheduledAt,
    });
  }

  await db.insert(auditLogsTable).values({
    accountId,
    postId: post.id,
    action: "post_created",
    details: `Status: ${post.status}`,
    ipAddress: req.ip,
  });

  await db
    .update(accountsTable)
    .set({ postsCount: (account.postsCount ?? 0) + 1 })
    .where(eq(accountsTable.id, accountId));

  req.log.info({ postId: post.id }, "Post created");
  res.status(201).json({ ...post, account });
});

// GET /posts/calendar — MUST be before /:id
router.get("/posts/calendar", async (req, res): Promise<void> => {
  // Normalize dates — accept ISO strings or YYYY-MM-DD
  const raw = req.query as Record<string, string>;
  if (raw.startDate) raw.startDate = raw.startDate.split("T")[0];
  if (raw.endDate) raw.endDate = raw.endDate.split("T")[0];

  const query = GetCalendarQueryParams.safeParse(raw);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { startDate, endDate, accountId } = query.data;

  const conditions: ReturnType<typeof sql>[] = [
    sql`(
      (${postsTable.scheduledAt}::date >= ${startDate}::date AND ${postsTable.scheduledAt}::date <= ${endDate}::date)
      OR
      (${postsTable.publishedAt}::date >= ${startDate}::date AND ${postsTable.publishedAt}::date <= ${endDate}::date)
    )`,
  ];
  if (accountId) conditions.push(sql`${postsTable.accountId} = ${accountId}`);

  const posts = await db
    .select()
    .from(postsTable)
    .where(sql.join(conditions, sql` AND `));

  const accounts = await db.select().from(accountsTable);
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const grouped: Record<string, typeof posts> = {};
  for (const post of posts) {
    const d = (post.scheduledAt ?? post.publishedAt ?? post.createdAt).toISOString().split("T")[0];
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(post);
  }

  const calendar = Object.entries(grouped).map(([d, dayPosts]) => ({
    date: d,
    posts: dayPosts.map((p) => ({ ...p, account: accountMap[p.accountId] ?? null })),
  }));

  res.json(calendar);
});

// GET /posts/recent — MUST be before /:id
router.get("/posts/recent", async (req, res): Promise<void> => {
  const query = GetRecentPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const limit = query.data.limit ?? 10;
  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.status, "published"))
    .orderBy(desc(postsTable.publishedAt))
    .limit(limit);

  const enriched = await attachAccounts(posts);
  res.json(enriched);
});

// POST /posts/bulk-delete — MUST be before /:id
router.post("/posts/bulk-delete", async (req, res): Promise<void> => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array of integers" });
    return;
  }
  const validIds = ids.filter((id): id is number => Number.isInteger(id));
  if (validIds.length === 0) {
    res.status(400).json({ error: "No valid integer ids provided" });
    return;
  }

  const deleted = await db
    .delete(postsTable)
    .where(inArray(postsTable.id, validIds))
    .returning();

  req.log.info({ deleted: deleted.length, ids: validIds }, "Bulk post delete");
  res.json({ deleted: deleted.length });
});

// GET /posts/:id
router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, post.accountId));
  res.json({ ...post, account: account ?? null });
});

// PATCH /posts/:id
router.patch("/posts/:id", async (req, res): Promise<void> => {
  const params = UpdatePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdatePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const d = body.data;
  const updates: Partial<Post> = {};
  if (d.content != null) updates.content = d.content;
  if (d.mediaUrls != null) updates.mediaUrls = d.mediaUrls;
  if (d.status != null) updates.status = d.status as Post["status"];
  if (d.scheduledAt !== undefined) updates.scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : null;
  if (d.subreddit !== undefined) updates.subreddit = d.subreddit ?? null;
  if (d.postTitle !== undefined) updates.postTitle = d.postTitle ?? null;

  const [post] = await db
    .update(postsTable)
    .set(updates)
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    accountId: post.accountId,
    postId: post.id,
    action: "post_updated",
    details: `Updated: ${Object.keys(updates).join(", ")}`,
    ipAddress: req.ip,
  });

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, post.accountId));
  res.json({ ...post, account: account ?? null });
});

// DELETE /posts/:id
router.delete("/posts/:id", async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(postsTable)
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  req.log.info({ postId: params.data.id }, "Post deleted");
  res.status(204).send();
});

// POST /posts/:id/publish
router.post("/posts/:id/publish", async (req, res): Promise<void> => {
  const params = PublishPostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db
    .update(postsTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await db.update(accountsTable).set({ lastPostAt: new Date() }).where(eq(accountsTable.id, post.accountId));
  await db.insert(auditLogsTable).values({
    accountId: post.accountId,
    postId: post.id,
    action: "post_published",
    details: "Published immediately",
    ipAddress: req.ip,
  });

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, post.accountId));
  req.log.info({ postId: post.id }, "Post published");
  res.json({ ...post, account: account ?? null });
});

// POST /posts/:id/schedule
router.post("/posts/:id/schedule", async (req, res): Promise<void> => {
  const params = SchedulePostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SchedulePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  let scheduledAt = new Date(body.data.scheduledAt);
  const jitter = body.data.jitterMinutes ?? 0;
  if (jitter > 0) scheduledAt = new Date(scheduledAt.getTime() + Math.random() * jitter * 60_000);

  const [post] = await db
    .update(postsTable)
    .set({ status: "scheduled", scheduledAt })
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await db.insert(queueJobsTable).values({
    type: "post_publish",
    payload: { postId: post.id },
    scheduledFor: scheduledAt,
  });

  await db.insert(auditLogsTable).values({
    accountId: post.accountId,
    postId: post.id,
    action: "post_scheduled",
    details: `Scheduled for ${scheduledAt.toISOString()}`,
    ipAddress: req.ip,
  });

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, post.accountId));
  res.json({ ...post, account: account ?? null });
});

// POST /posts/:id/duplicate
router.post("/posts/:id/duplicate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [orig] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!orig) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [duped] = await db
    .insert(postsTable)
    .values({
      accountId: orig.accountId,
      content: orig.content,
      mediaUrls: orig.mediaUrls,
      status: "draft",
      subreddit: orig.subreddit,
      postTitle: orig.postTitle ? `${orig.postTitle} (copy)` : null,
      aiGenerated: orig.aiGenerated,
    })
    .returning();

  req.log.info({ originalId: id, newId: duped.id }, "Post duplicated");
  res.status(201).json(duped);
});

export default router;
