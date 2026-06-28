/**
 * HAVEN Twitter Agent — Railway server
 * Runs 24/7, schedules all actions at random times each day
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log, loadQueue, saveQueue, postTweet, replyToTrending, likeTweets, followInfluencers } from "./agent.js";

// On Railway: restore session.json from SESSION_B64 env var
const SESSION = path.join(path.dirname(fileURLToPath(import.meta.url)), "session.json");
if (process.env.SESSION_B64 && !fs.existsSync(SESSION)) {
  fs.writeFileSync(SESSION, Buffer.from(process.env.SESSION_B64, "base64").toString("utf-8"));
  log("Session restored from SESSION_B64 env var");
}

// Random ms between minH and maxH hours from now
function hoursMs(minH, maxH) {
  return (minH + Math.random() * (maxH - minH)) * 3600 * 1000;
}
// Random ms between minM and maxM minutes
function minsMs(minM, maxM) {
  return (minM + Math.random() * (maxM - minM)) * 60 * 1000;
}

function scheduleOnce(label, delayMs, fn) {
  const at = new Date(Date.now() + delayMs);
  log(`Scheduled "${label}" at ${at.toISOString()}`);
  setTimeout(async () => {
    log(`Running "${label}"...`);
    try { await fn(); } catch (e) { log(`ERROR in "${label}": ${e.message}`); }
  }, delayMs);
}

async function planDay() {
  log("=== Planning new day of activity ===");

  // 1-2 tweets per day at random times (morning/afternoon)
  scheduleOnce("post-tweet-1", hoursMs(1, 4), async () => {
    const q = loadQueue();
    if (q.index >= q.tweets.length) { log("Queue empty!"); return; }
    const ok = await postTweet(q.tweets[q.index]);
    if (ok) { q.index++; q.posted++; saveQueue(q); }
  });

  // Sometimes post a second tweet in the evening
  if (Math.random() > 0.4) {
    scheduleOnce("post-tweet-2", hoursMs(7, 12), async () => {
      const q = loadQueue();
      if (q.index >= q.tweets.length) return;
      const ok = await postTweet(q.tweets[q.index]);
      if (ok) { q.index++; q.posted++; saveQueue(q); }
    });
  }

  // Reply to trending 1-2x per day
  scheduleOnce("reply-1", hoursMs(2, 6), replyToTrending);
  if (Math.random() > 0.5) {
    scheduleOnce("reply-2", hoursMs(9, 14), replyToTrending);
  }

  // Like tweets 2x per day
  scheduleOnce("like-1", minsMs(20, 90), likeTweets);
  scheduleOnce("like-2", hoursMs(5, 10), likeTweets);

  // Follow influencers once per day (not every day)
  if (Math.random() > 0.3) {
    scheduleOnce("follow", hoursMs(3, 8), followInfluencers);
  }

  // Schedule next day's plan in ~24h (with small random offset)
  const nextDay = hoursMs(23, 25);
  log(`Next day plan in ${Math.round(nextDay / 3600000)}h`);
  setTimeout(planDay, nextDay);
}

log("=== HAVEN Agent starting on Railway ===");
planDay();
