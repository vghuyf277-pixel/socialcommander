import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
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

// Helper: fetch post with account
async function getPostWithAccount(id: number) {
  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, id));
  if (!posts[0]) return null;
  const post = posts[0];
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, post.accountId));
  return { ...post, account: account ?? null };
}

// GET /posts
router.get("/posts", async (req, res): Promise<void> => {
  const query = ListPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, status, platform, limit = 50, offset = 0 } = query.data;

  // Build filters
  const conditions: ReturnType<typeof sql>[] = [];
  if (accountId) conditions.push(sql`${postsTable.accountId} = ${accountId}`);
  if (status && status !== "all") conditions.push(sql`${postsTable.status} = ${status}`);
  if (platform && platform !== "all") {
    // filter by account platform
  }

  const allPosts = await db
    .select()
    .from(postsTable)
    .orderBy(desc(postsTable.createdAt));

  let filtered = allPosts;
  if (accountId) filtered = filtered.filter((p) => p.accountId === accountId);
  if (status && status !== "all") filtered = filtered.filter((p) => p.status === status);

  // Attach accounts
  const accountIds = [...new Set(filtered.map((p) => p.accountId))];
  const accounts = accountIds.length > 0
    ? await db.select().from(accountsTable).where(sql`${accountsTable.id} = ANY(ARRAY[${sql.join(accountIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
    : [];

  if (platform && platform !== "all") {
    filtered = filtered.filter((p) => {
      const acc = accounts.find((a) => a.id === p.accountId);
      return acc?.platform === platform;
    });
  }

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const posts = page.map((p) => ({ ...p, account: accountMap[p.accountId] ?? null }));

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

  // Update account post count
  await db
    .update(accountsTable)
    .set({ postsCount: (account.postsCount ?? 0) + 1 })
    .where(eq(accountsTable.id, accountId));

  req.log.info({ postId: post.id }, "Post created");
  res.status(201).json({ ...post, account });
});

// GET /posts/calendar  (must be before /:id)
router.get("/posts/calendar", async (req, res): Promise<void> => {
  const query = GetCalendarQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { startDate, endDate, accountId } = query.data;

  let posts = await db
    .select()
    .from(postsTable)
    .where(
      sql`(${postsTable.scheduledAt} >= ${startDate}::date OR ${postsTable.publishedAt} >= ${startDate}::date)
          AND (${postsTable.scheduledAt} <= ${endDate}::date + interval '1 day' OR ${postsTable.publishedAt} <= ${endDate}::date + interval '1 day')`
    );

  if (accountId) posts = posts.filter((p) => p.accountId === accountId);

  // Group by date
  const grouped: Record<string, typeof posts> = {};
  for (const post of posts) {
    const d = (post.scheduledAt ?? post.publishedAt ?? post.createdAt)
      .toISOString()
      .split("T")[0];
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(post);
  }

  const accounts = await db.select().from(accountsTable);
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const calendar = Object.entries(grouped).map(([d, dayPosts]) => ({
    date: d,
    posts: dayPosts.map((p) => ({ ...p, account: accountMap[p.accountId] ?? null })),
  }));

  res.json(calendar);
});

// GET /posts/recent  (must be before /:id)
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
    .where(sql`${postsTable.status} = 'published'`)
    .orderBy(desc(postsTable.publishedAt))
    .limit(limit);

  const accounts = await db.select().from(accountsTable);
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const result = posts.map((p) => ({ ...p, account: accountMap[p.accountId] ?? null }));

  res.json(result);
});

// GET /posts/:id
router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const post = await getPostWithAccount(params.data.id);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(post);
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

  // Update account last post time
  await db
    .update(accountsTable)
    .set({ lastPostAt: new Date() })
    .where(eq(accountsTable.id, post.accountId));

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
  if (jitter > 0) {
    scheduledAt = new Date(scheduledAt.getTime() + Math.random() * jitter * 60 * 1000);
  }

  const [post] = await db
    .update(postsTable)
    .set({ status: "scheduled", scheduledAt })
    .where(eq(postsTable.id, params.data.id))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  // Queue the publish job
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

// POST /posts/:id/duplicate — clone as draft for a fresh edit
router.post("/:id/duplicate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [orig] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!orig) { res.status(404).json({ error: "Post not found" }); return; }

  const [duped] = await db.insert(postsTable).values({
    accountId: orig.accountId,
    content: orig.content,
    mediaUrls: orig.mediaUrls,
    status: "draft",
    subreddit: orig.subreddit,
    postTitle: orig.postTitle ? `${orig.postTitle} (copy)` : null,
    aiGenerated: orig.aiGenerated,
  }).returning();

  res.status(201).json(duped);
});

export default router;
