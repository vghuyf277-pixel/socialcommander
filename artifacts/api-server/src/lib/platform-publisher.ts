/**
 * platform-publisher.ts
 * Handles real posting to Twitter/X (OAuth 1.0a) and Reddit (password flow).
 * Credentials are stored per-account in the database as a JSON blob — nothing
 * is gitignored and they persist across all Replit actions/restarts.
 */

import { TwitterApi } from "twitter-api-v2";
import { logger } from "./logger.js";

// ── Twitter / X ───────────────────────────────────────────────────────────────

export interface TwitterCredentials {
  /** Consumer Key from Twitter Developer Portal */
  apiKey: string;
  /** Consumer Secret from Twitter Developer Portal */
  apiSecret: string;
  /** OAuth 1.0a access token for this account */
  accessToken: string;
  /** OAuth 1.0a access token secret for this account */
  accessSecret: string;
}

export interface PostContent {
  content: string;
  postTitle?: string | null;
  subreddit?: string | null;
  mediaUrls?: string[];
}

export async function publishToTwitter(
  creds: TwitterCredentials,
  post: PostContent
): Promise<{ tweetId: string }> {
  const client = new TwitterApi({
    appKey: creds.apiKey,
    appSecret: creds.apiSecret,
    accessToken: creds.accessToken,
    accessSecret: creds.accessSecret,
  });

  const tweet = await client.v2.tweet(post.content);
  logger.info({ tweetId: tweet.data.id }, "Tweet published successfully");
  return { tweetId: tweet.data.id };
}

// ── Reddit ────────────────────────────────────────────────────────────────────

export interface RedditCredentials {
  /** script-app client ID from Reddit Developer Portal */
  clientId: string;
  /** script-app client secret */
  clientSecret: string;
  /** Reddit account username (no /u/) */
  username: string;
  /** Reddit account password */
  password: string;
}

export async function publishToReddit(
  creds: RedditCredentials,
  post: PostContent
): Promise<{ postId: string; permalink: string }> {
  // Step 1: Obtain access token via password grant (script app)
  const authHeader = `Basic ${Buffer.from(
    `${creds.clientId}:${creds.clientSecret}`
  ).toString("base64")}`;

  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SocialCommander/1.0 (by SocialCommanderApp)",
    },
    body: `grant_type=password&username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`,
  });

  if (!tokenRes.ok) {
    throw new Error(`Reddit auth failed with HTTP ${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (tokenData.error || !tokenData.access_token) {
    throw new Error(`Reddit auth error: ${tokenData.error ?? "no token returned"}`);
  }

  // Step 2: Submit the post
  const subreddit = post.subreddit?.replace(/^r\//, "") || "test";
  const title = post.postTitle || post.content.slice(0, 100);

  const submitRes = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SocialCommander/1.0 (by SocialCommanderApp)",
    },
    body: new URLSearchParams({
      api_type: "json",
      kind: "self",
      title,
      text: post.content,
      sr: subreddit,
    }).toString(),
  });

  const submitData = (await submitRes.json()) as {
    json?: {
      data?: { id: string; url: string };
      errors?: string[][];
    };
  };

  if (submitData.json?.errors?.length) {
    throw new Error(
      `Reddit submit error: ${submitData.json.errors.map((e) => e.join(": ")).join(", ")}`
    );
  }

  const postId = submitData.json?.data?.id ?? "unknown";
  const permalink = submitData.json?.data?.url ?? "";
  logger.info({ postId, subreddit }, "Reddit post published successfully");
  return { postId, permalink };
}

/**
 * Check if a credentials JSON string has all required fields for the given platform.
 */
export function hasValidCredentials(
  platform: "twitter" | "reddit",
  credentialsJson: string | null | undefined
): boolean {
  if (!credentialsJson) return false;
  try {
    const c = JSON.parse(credentialsJson) as Record<string, unknown>;
    if (platform === "twitter") {
      return !!(c.apiKey && c.apiSecret && c.accessToken && c.accessSecret);
    }
    if (platform === "reddit") {
      return !!(c.clientId && c.clientSecret && c.username && c.password);
    }
    return false;
  } catch {
    return false;
  }
}
