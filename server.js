/**
 * HAVEN Twitter Agent — Railway server
 * Daily activity target:
 *   - 1-2 tweets (with images)
 *   - 5-8 reply sessions (~8-12 replies/day)
 *   - 6-8 like sessions (~40-60 likes/day)
 *   - 3-4 follow sessions (~15-20 follows/day)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log, loadQueue, saveQueue, postTweet, replyToTrending, likeTweets, followInfluencers } from "./agent.js";

const SESSION = path.join(path.dirname(fileURLToPath(import.meta.url)), "session.json");
if (process.env.SESSION_B64 && !fs.existsSync(SESSION)) {
  fs.writeFileSync(SESSION, Buffer.from(process.env.SESSION_B64, "base64").toString("utf-8"));
  log("Session restored from SESSION_B64");
}

// Random delay helpers
const hrs  = (min, max) => (min + Math.random() * (max - min)) * 3600000;
const mins = (min, max) => (min + Math.random() * (max - min)) * 60000;

function schedule(label, delayMs, fn) {
  const at = new Date(Date.now() + delayMs).toISOString().slice(11, 19);
  log(`Scheduled "${label}" at ~${at} UTC`);
  setTimeout(async () => {
    log(`▶ Running: ${label}`);
    try { await fn(); } catch (e) { log(`ERROR in "${label}": ${e.message}`); }
  }, delayMs);
}

async function planDay() {
  log("=== Planning activity for the next 24h ===");

  // ── TWEETS (1-2/day) ────────────────────────────────────────────────────────
  schedule("tweet-1", hrs(0.5, 3), async () => {
    const q = loadQueue();
    if (q.index >= q.tweets.length) { log("Queue empty — need new tweets"); return; }
    const ok = await postTweet(q.tweets[q.index], true);
    if (ok) { q.index++; q.posted++; saveQueue(q); }
  });

  if (Math.random() > 0.35) {
    schedule("tweet-2", hrs(8, 14), async () => {
      const q = loadQueue();
      if (q.index >= q.tweets.length) return;
      const ok = await postTweet(q.tweets[q.index], true);
      if (ok) { q.index++; q.posted++; saveQueue(q); }
    });
  }

  // ── REPLIES (5-8 sessions/day) ───────────────────────────────────────────────
  const replySessions = Math.floor(Math.random() * 4) + 5; // 5-8
  for (let i = 0; i < replySessions; i++) {
    schedule(`reply-${i + 1}`, hrs(i * 2.5 + Math.random() * 1.5, i * 2.5 + 2.5), replyToTrending);
  }

  // ── LIKES (6-8 sessions, 5-10 likes each = ~40-60/day) ──────────────────────
  const likeSessions = Math.floor(Math.random() * 3) + 6; // 6-8
  for (let i = 0; i < likeSessions; i++) {
    schedule(`like-${i + 1}`, hrs(i * 2.8 + Math.random() * 1.5, i * 2.8 + 3), likeTweets);
  }

  // ── FOLLOWS (3-4 sessions, 4-6 follows each = ~15-20/day) ───────────────────
  const followSessions = Math.floor(Math.random() * 2) + 3; // 3-4
  for (let i = 0; i < followSessions; i++) {
    schedule(`follow-${i + 1}`, hrs(i * 5 + Math.random() * 2, i * 5 + 5), followInfluencers);
  }

  // ── Next day ─────────────────────────────────────────────────────────────────
  const nextDay = hrs(23, 25);
  log(`Next daily plan in ~${Math.round(nextDay / 3600000)}h`);
  setTimeout(planDay, nextDay);
}

log("=== HAVEN Twitter Agent starting on Railway ===");

// Small initial delay to let container fully start
setTimeout(planDay, 5000);
