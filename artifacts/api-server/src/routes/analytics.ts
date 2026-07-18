import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, postsTable, accountsTable } from "@workspace/db";
import {
  GetAnalyticsOverviewQueryParams,
  GetAccountAnalyticsQueryParams,
  GetEngagementHeatmapQueryParams,
  GetAnalyticsTimeseriesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /analytics/overview
router.get("/analytics/overview", async (req, res): Promise<void> => {
  const query = GetAnalyticsOverviewQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const days = query.data.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const posts = await db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.status} = 'published' AND ${postsTable.publishedAt} >= ${since}`);

  const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const totalReposts = posts.reduce((s, p) => s + p.reposts, 0);

  const avgEngagementRate =
    posts.length > 0
      ? posts.reduce((s, p) => s + p.likes + p.comments + p.reposts, 0) / posts.length
      : 0;

  // Top account by total engagement
  const byAccount: Record<number, number> = {};
  for (const p of posts) {
    byAccount[p.accountId] = (byAccount[p.accountId] ?? 0) + p.likes + p.comments + p.reposts;
  }
  const topAccountId =
    Object.entries(byAccount).sort(([, a], [, b]) => b - a)[0]?.[0];
  let topAccount: string | null = null;
  if (topAccountId) {
    const [acc] = await db
      .select()
      .from(accountsTable)
      .where(sql`${accountsTable.id} = ${Number(topAccountId)}`);
    topAccount = acc ? acc.username : null;
  }

  // Simple growth rate: compare last 7 days vs prior 7 days
  const now = Date.now();
  const recentPosts = posts.filter(
    (p) => p.publishedAt && p.publishedAt.getTime() > now - 7 * 86400000
  );
  const olderPosts = posts.filter(
    (p) =>
      p.publishedAt &&
      p.publishedAt.getTime() <= now - 7 * 86400000 &&
      p.publishedAt.getTime() > now - 14 * 86400000
  );
  const recentEng = recentPosts.reduce((s, p) => s + p.likes + p.comments + p.reposts, 0);
  const olderEng = olderPosts.reduce((s, p) => s + p.likes + p.comments + p.reposts, 0);
  const growthRate = olderEng === 0 ? 0 : ((recentEng - olderEng) / olderEng) * 100;

  res.json({
    totalImpressions,
    totalLikes,
    totalComments,
    totalReposts,
    totalPosts: posts.length,
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    topAccount,
    growthRate: Math.round(growthRate * 10) / 10,
  });
});

// GET /analytics/account-metrics
router.get("/analytics/account-metrics", async (req, res): Promise<void> => {
  const query = GetAccountAnalyticsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, days = 30 } = query.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const posts = await db
    .select()
    .from(postsTable)
    .where(
      sql`${postsTable.accountId} = ${accountId} AND ${postsTable.status} = 'published' AND ${postsTable.publishedAt} >= ${since}`
    );

  const impressions = posts.reduce((s, p) => s + p.impressions, 0);
  const likes = posts.reduce((s, p) => s + p.likes, 0);
  const comments = posts.reduce((s, p) => s + p.comments, 0);
  const reposts = posts.reduce((s, p) => s + p.reposts, 0);
  const avgEngagement =
    posts.length > 0
      ? (likes + comments + reposts) / posts.length
      : 0;

  // Best day/hour by engagement
  const byDay: Record<number, number> = {};
  const byHour: Record<number, number> = {};
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const d = p.publishedAt.getDay();
    const h = p.publishedAt.getHours();
    byDay[d] = (byDay[d] ?? 0) + p.likes + p.comments + p.reposts;
    byHour[h] = (byHour[h] ?? 0) + p.likes + p.comments + p.reposts;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestDayNum = Object.entries(byDay).sort(([, a], [, b]) => b - a)[0]?.[0];
  const bestHourNum = Object.entries(byHour).sort(([, a], [, b]) => b - a)[0]?.[0];

  res.json({
    accountId,
    impressions,
    likes,
    comments,
    reposts,
    postsPublished: posts.length,
    avgEngagement: Math.round(avgEngagement * 100) / 100,
    bestDayOfWeek: bestDayNum ? dayNames[Number(bestDayNum)] : "Monday",
    bestHour: bestHourNum ? Number(bestHourNum) : 9,
  });
});

// GET /analytics/heatmap
router.get("/analytics/heatmap", async (req, res): Promise<void> => {
  const query = GetEngagementHeatmapQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, days = 90 } = query.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let postsQuery = db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.status} = 'published' AND ${postsTable.publishedAt} >= ${since}`);

  const posts = await postsQuery;
  const filtered = accountId ? posts.filter((p) => p.accountId === accountId) : posts;

  // Build 7x24 heatmap
  const heatmap: Record<string, { sum: number; count: number }> = {};
  for (const p of filtered) {
    if (!p.publishedAt) continue;
    const day = p.publishedAt.getDay();
    const hour = p.publishedAt.getHours();
    const key = `${day}:${hour}`;
    if (!heatmap[key]) heatmap[key] = { sum: 0, count: 0 };
    heatmap[key].sum += p.likes + p.comments + p.reposts;
    heatmap[key].count += 1;
  }

  // Fill all 168 cells
  const cells = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const key = `${d}:${h}`;
      const cell = heatmap[key];
      cells.push({
        dayOfWeek: d,
        hour: h,
        value: cell ? Math.round((cell.sum / cell.count) * 10) / 10 : 0,
      });
    }
  }

  res.json(cells);
});

// GET /analytics/timeseries
router.get("/analytics/timeseries", async (req, res): Promise<void> => {
  const query = GetAnalyticsTimeseriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, metric = "likes", days = 30 } = query.data;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const posts = await db
    .select()
    .from(postsTable)
    .where(sql`${postsTable.status} = 'published' AND ${postsTable.publishedAt} >= ${since}`);

  const filtered = accountId ? posts.filter((p) => p.accountId === accountId) : posts;

  // Aggregate by date
  const byDate: Record<string, number> = {};
  for (const p of filtered) {
    if (!p.publishedAt) continue;
    const d = p.publishedAt.toISOString().split("T")[0];
    const val =
      metric === "impressions"
        ? p.impressions
        : metric === "likes"
        ? p.likes
        : metric === "comments"
        ? p.comments
        : metric === "reposts"
        ? p.reposts
        : 0;
    byDate[d] = (byDate[d] ?? 0) + val;
  }

  // Fill in missing days
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    result.push({ date: d, value: byDate[d] ?? 0 });
  }

  res.json(result);
});

export default router;
