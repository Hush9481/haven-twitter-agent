/**
 * HAVEN Agent — Max Growth Mode
 * Daily targets:
 *   Tweets:     2-3 (with images)
 *   Hot takes:  6-8 replies to big accounts
 *   Replies:    8-10 to trending
 *   Likes:      80-120/day
 *   Follows:    25-35/day
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  log, loadQueue, saveQueue,
  postTweet, replyToBigAccount, replyToTrending,
  likeTweets, followUsers,
} from "./agent.js";

const SESSION = path.join(path.dirname(fileURLToPath(import.meta.url)), "session.json");
if (process.env.SESSION_B64 && !fs.existsSync(SESSION)) {
  fs.writeFileSync(SESSION, Buffer.from(process.env.SESSION_B64, "base64").toString("utf-8"));
  log("Session restored from SESSION_B64");
}

const hrs  = (min, max) => (min + Math.random() * (max - min)) * 3600000;
const mins = (min, max) => (min + Math.random() * (max - min)) * 60000;

function schedule(label, delayMs, fn) {
  const at = new Date(Date.now() + delayMs).toISOString().slice(11, 16);
  log(`  scheduled "${label}" ~${at} UTC`);
  setTimeout(async () => {
    log(`▶ ${label}`);
    try { await fn(); } catch (e) { log(`  ERROR: ${e.message.slice(0, 100)}`); }
  }, delayMs);
}

async function planDay() {
  log("=== NEW DAY — Max Growth Plan ===");

  // ── TWEETS 2-3/day ──────────────────────────────────────────────────────────
  schedule("tweet-morning", hrs(0.3, 2), async () => {
    const q = loadQueue();
    if (q.index >= q.tweets.length) return;
    if (await postTweet(q.tweets[q.index])) { q.index++; q.posted++; saveQueue(q); }
  });
  schedule("tweet-evening", hrs(9, 14), async () => {
    const q = loadQueue();
    if (q.index >= q.tweets.length) return;
    if (await postTweet(q.tweets[q.index])) { q.index++; q.posted++; saveQueue(q); }
  });
  if (Math.random() > 0.5) {
    schedule("tweet-night", hrs(16, 21), async () => {
      const q = loadQueue();
      if (q.index >= q.tweets.length) return;
      if (await postTweet(q.tweets[q.index])) { q.index++; q.posted++; saveQueue(q); }
    });
  }

  // ── HOT TAKES to big accounts (6-8/day) ─────────────────────────────────────
  const hotTakes = Math.floor(Math.random() * 3) + 6;
  for (let i = 0; i < hotTakes; i++) {
    schedule(`hottake-${i + 1}`, hrs(i * 2.5 + Math.random(), i * 2.5 + 2), replyToBigAccount);
  }

  // ── TRENDING replies (8-10/day) ─────────────────────────────────────────────
  const replies = Math.floor(Math.random() * 3) + 8;
  for (let i = 0; i < replies; i++) {
    schedule(`reply-${i + 1}`, hrs(i * 2 + Math.random() * 0.8, i * 2 + 2), replyToTrending);
  }

  // ── LIKES — 10 sessions × 8-12 = ~80-120/day ────────────────────────────────
  const likeSessions = 10;
  for (let i = 0; i < likeSessions; i++) {
    schedule(`like-${i + 1}`, hrs(i * 2.2 + Math.random(), i * 2.2 + 2), likeTweets);
  }

  // ── FOLLOW — 5 sessions × 5-9 = ~25-45/day ──────────────────────────────────
  const followSessions = 5;
  for (let i = 0; i < followSessions; i++) {
    schedule(`follow-${i + 1}`, hrs(i * 4 + Math.random() * 1.5, i * 4 + 4), followUsers);
  }

  // ── Next day ────────────────────────────────────────────────────────────────
  setTimeout(planDay, hrs(23, 25));
  log(`Next plan in ~24h`);
}

// ── Manual HTTP trigger ───────────────────────────────────────────────────────
import http from "http";

const PORT = process.env.PORT || 3000;
let posting = false;

http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/post-now") {
    if (posting) {
      res.writeHead(429); res.end("Already posting, wait...");
      return;
    }
    posting = true;
    res.writeHead(200); res.end("Posting next tweet now...");
    try {
      const q = loadQueue();
      if (q.index >= q.tweets.length) { log("Queue empty!"); posting = false; return; }
      const ok = await postTweet(q.tweets[q.index], true);
      if (ok) { q.index++; q.posted++; saveQueue(q); }
    } catch (e) { log(`Manual post error: ${e.message}`); }
    posting = false;
  } else if (req.method === "GET" && req.url === "/status") {
    const q = loadQueue();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ index: q.index, total: q.tweets.length, remaining: q.tweets.length - q.index }));
  } else {
    res.writeHead(200); res.end("HAVEN Agent running");
  }
}).listen(PORT, () => log(`HTTP trigger ready on :${PORT} — /post-now | /status`));

log("=== HAVEN Agent — Max Growth Mode ===");
setTimeout(planDay, 5000);
