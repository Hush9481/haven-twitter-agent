/**
 * HAVEN Twitter Auto-Scheduler
 * Posts 1 tweet per day from tweets30.txt automatically
 * Run once: node --env-file=.env scheduler.js --login   (saves session)
 * Daily:    node --env-file=.env scheduler.js           (posts next tweet)
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dir, "session.json");
const QUEUE_FILE   = path.join(__dir, "queue.json");
const TWEETS_FILE  = path.join(__dir, "tweets30.txt");
const LOGIN_MODE   = process.argv.includes("--login");

// ── Load tweet queue ──────────────────────────────────────────────────────────
function loadQueue() {
  if (fs.existsSync(QUEUE_FILE)) {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
  }
  // First run: parse tweets30.txt → queue
  const raw = fs.readFileSync(TWEETS_FILE, "utf-8");
  const tweets = raw
    .split(/\n(?=\d+\. )/)
    .map(t => t.replace(/^\d+\. /, "").trim())
    .filter(Boolean);

  const queue = { tweets, index: 0, posted: 0 };
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  console.log(`[Queue] Loaded ${tweets.length} tweets`);
  return queue;
}

function saveQueue(q) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
}

// ── Browser post ──────────────────────────────────────────────────────────────
async function postTweet(text) {
  const browser = await chromium.launch({ headless: !LOGIN_MODE });
  const ctx = await browser.newContext({
    storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  if (LOGIN_MODE) {
    console.log("[Login] Opening Twitter — log in manually, then press Enter here...");
    await page.goto("https://x.com/login");
    await page.waitForTimeout(3000);
    // Wait for user to log in manually
    await new Promise(resolve => {
      process.stdin.once("data", resolve);
      console.log("[Login] Press Enter after you logged in...");
    });
    await ctx.storageState({ path: SESSION_FILE });
    console.log("[Login] Session saved to session.json ✅");
    await browser.close();
    return;
  }

  // Post tweet
  await page.goto("https://x.com/compose/tweet");
  await page.waitForTimeout(2000);

  // Check if redirected to login
  if (page.url().includes("/login")) {
    console.error("[Error] Session expired. Run: node --env-file=.env scheduler.js --login");
    await browser.close();
    process.exit(1);
  }

  const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
  await editor.waitFor({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type(text, { delay: 20 });
  await page.waitForTimeout(1000);

  const btn = page.locator('[data-testid="tweetButtonInline"]').first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(3000);

  await browser.close();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (LOGIN_MODE) {
    await postTweet(null);
    return;
  }

  const queue = loadQueue();

  if (queue.index >= queue.tweets.length) {
    console.log("[Done] All 30 tweets posted! Run generate30.js for a new batch.");
    return;
  }

  const tweet = queue.tweets[queue.index];
  console.log(`[Post] Tweet ${queue.index + 1}/${queue.tweets.length}:`);
  console.log(tweet);

  await postTweet(tweet);

  queue.index++;
  queue.posted++;
  saveQueue(queue);
  console.log(`[Done] Posted! ${queue.tweets.length - queue.index} tweets remaining.`);
}

main().catch(e => { console.error("[Error]", e.message); process.exit(1); });
