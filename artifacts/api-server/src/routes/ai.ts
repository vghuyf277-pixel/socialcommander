import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable, postsTable } from "@workspace/db";
import {
  GenerateContentBody,
  GetOptimalPostingTimeBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const AI_API_KEY = process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY;

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!AI_API_KEY) {
    // Return a mock response when no AI key is configured
    return "No AI API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in your environment.";
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      max_tokens: 512,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "AI API error");
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "";
}

// POST /ai/generate
router.post("/ai/generate", async (req, res): Promise<void> => {
  const body = GenerateContentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { accountId, prompt, platform, tone, variants = 1 } = body.data;

  // Load account voice profile
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId));

  const voiceContext = account?.voiceProfile
    ? `\n\nAccount voice profile: ${account.voiceProfile}`
    : "";

  const platformInstructions =
    platform === "twitter"
      ? "Write for Twitter/X. Keep it under 280 characters. Make it punchy and shareable."
      : platform === "reddit"
      ? "Write for Reddit. Be conversational and add value. Include a title and body."
      : "Write for social media.";

  const toneMap: Record<string, string> = {
    professional: "Use a professional, authoritative tone.",
    casual: "Use a casual, friendly tone.",
    humorous: "Use humor and wit.",
    informative: "Be informative and educational.",
    promotional: "Be persuasive and promotional, but not spammy.",
  };

  const toneInstruction = tone ? toneMap[tone] ?? "" : "";

  const systemPrompt = `You are a social media content expert.${voiceContext}
${platformInstructions}
${toneInstruction}
Generate exactly ${variants} variant(s) of content for the following prompt.
Return them as a JSON array of strings: ["variant1", "variant2", ...]
Also suggest 3-5 relevant hashtags (without #) and estimate engagement score 0-100.
Return JSON: { "variants": [...], "suggestedHashtags": [...], "estimatedEngagement": number }`;

  try {
    const raw = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ]);

    let parsed: { variants: string[]; suggestedHashtags: string[]; estimatedEngagement: number };
    try {
      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { variants: [raw], suggestedHashtags: [], estimatedEngagement: 50 };
    } catch {
      parsed = { variants: [raw], suggestedHashtags: [], estimatedEngagement: 50 };
    }

    req.log.info({ accountId, variants }, "Content generated");
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "AI generation failed");
    // Return a graceful fallback
    res.json({
      variants: [`[AI unavailable] ${prompt}`],
      suggestedHashtags: [],
      estimatedEngagement: 0,
    });
  }
});

// POST /ai/optimize-time
router.post("/ai/optimize-time", async (req, res): Promise<void> => {
  const body = GetOptimalPostingTimeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { accountId } = body.data;

  // Analyze historical engagement patterns for this account
  const publishedPosts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.accountId, accountId));

  const engagementBySlot: Record<string, { sum: number; count: number }> = {};
  for (const post of publishedPosts) {
    if (!post.publishedAt) continue;
    const day = post.publishedAt.getDay();
    const hour = post.publishedAt.getHours();
    const key = `${day}:${hour}`;
    if (!engagementBySlot[key]) engagementBySlot[key] = { sum: 0, count: 0 };
    engagementBySlot[key].sum += post.likes + post.comments + post.reposts;
    engagementBySlot[key].count += 1;
  }

  // If no history, return research-based defaults
  const hasHistory = Object.keys(engagementBySlot).length > 0;

  let slots: Array<{ dayOfWeek: number; hour: number; score: number }> = [];

  if (hasHistory) {
    // Score each slot
    const maxEngagement = Math.max(
      ...Object.values(engagementBySlot).map((s) => s.count > 0 ? s.sum / s.count : 0),
      1
    );

    for (const [key, data] of Object.entries(engagementBySlot)) {
      const [day, hour] = key.split(":").map(Number);
      const avg = data.sum / data.count;
      const score = Math.round((avg / maxEngagement) * 100);
      slots.push({ dayOfWeek: day, hour, score });
    }
    slots.sort((a, b) => b.score - a.score);
    slots = slots.slice(0, 10);
  } else {
    // Research-based optimal times
    slots = [
      { dayOfWeek: 2, hour: 9, score: 95 },  // Tuesday 9am
      { dayOfWeek: 3, hour: 9, score: 92 },  // Wednesday 9am
      { dayOfWeek: 4, hour: 9, score: 90 },  // Thursday 9am
      { dayOfWeek: 2, hour: 12, score: 88 }, // Tuesday noon
      { dayOfWeek: 3, hour: 12, score: 85 }, // Wednesday noon
      { dayOfWeek: 1, hour: 9, score: 82 },  // Monday 9am
      { dayOfWeek: 4, hour: 15, score: 80 }, // Thursday 3pm
      { dayOfWeek: 5, hour: 9, score: 75 },  // Friday 9am
    ];
  }

  res.json({ accountId, slots });
});

export default router;
