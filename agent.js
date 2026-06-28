/**
 * HAVEN AI Twitter Agent
 * - Posts tweets at random times throughout the day
 * - Replies to popular #Solana tweets
 * - Likes Solana/gaming posts
 * - Follows Solana influencers
 *
 * Local:    node --env-file=.env agent.js --post|--reply|--like|--follow
 * Railway:  node server.js  (runs 24/7 with random scheduling)
 */

import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const SESSION = path.join(__dir, "session.json");
const QUEUE   = path.join(__dir, "queue.json");
const LOG     = path.join(__dir, "agent.log");

export const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch {}
}

// ── Queue ─────────────────────────────────────────────────────────────────────
export function loadQueue() {
  if (fs.existsSync(QUEUE)) {
    return JSON.parse(fs.readFileSync(QUEUE, "utf-8"));
  }
  const txt = path.join(__dir, "tweets30.txt");
  if (!fs.existsSync(txt)) { log("Run generate30.js first"); process.exit(1); }
  const tweets = fs.readFileSync(txt, "utf-8")
    .split(/\n(?=\d+\. )/)
    .map(t => t.replace(/^\d+\. /, "").trim())
    .filter(Boolean);
  const q = { tweets, index: 0, posted: 0 };
  fs.writeFileSync(QUEUE, JSON.stringify(q, null, 2));
  log(`Queue created with ${tweets.length} tweets`);
  return q;
}
export function saveQueue(q) { fs.writeFileSync(QUEUE, JSON.stringify(q, null, 2)); }

// ── Browser ───────────────────────────────────────────────────────────────────
export async function openBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  const ctx = await browser.newContext({
    storageState: fs.existsSync(SESSION) ? SESSION : undefined,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  return { browser, ctx };
}

// ── Post tweet ────────────────────────────────────────────────────────────────
export async function postTweet(text) {
  log(`Posting tweet (${text.length} chars)...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto("https://x.com/home", { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  if (page.url().includes("login")) {
    log("Session expired — need to re-export cookies");
    await browser.close(); return false;
  }

  const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
  await composeBtn.waitFor({ timeout: 10000 });
  await composeBtn.click();
  await page.waitForTimeout(2000);

  const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
  await editor.waitFor({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type(text, { delay: 25 });
  await page.waitForTimeout(1500);

  await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-testid="tweetButton"]')?.click());
  await page.waitForTimeout(4000);
  await browser.close();
  log("✅ Tweet posted!");
  return true;
}

// ── Reply to popular Solana tweets ────────────────────────────────────────────
export async function replyToTrending() {
  log("Looking for popular #Solana tweets to reply...");
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto("https://x.com/search?q=%23Solana%20OR%20%23SolanaGaming&f=top", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const tweets = await page.locator('[data-testid="tweet"]').all();
  if (tweets.length === 0) { await browser.close(); return; }

  const pick = tweets[Math.floor(Math.random() * Math.min(6, tweets.length))];
  const tweetText = await pick.locator('[data-testid="tweetText"]').first().textContent().catch(() => "");
  if (!tweetText) { await browser.close(); return; }

  const msg = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [{
      role: "user",
      content: `You are the Twitter account @havenempiresol — a Web3 idle castle-building game on Solana.
Reply to this tweet in 1-2 short sentences: "${tweetText.slice(0, 200)}"
Rules: max 180 chars, friendly, only mention havenempire.xyz if it's very natural, sound like a real person NOT a bot. Output only the reply.`,
    }],
  });
  const reply = msg.content[0].text.trim();

  const replyBtn = pick.locator('[data-testid="reply"]').first();
  await replyBtn.click();
  await page.waitForTimeout(2000);

  const editor = page.locator('[data-testid="tweetTextarea_0"]').last();
  await editor.waitFor({ timeout: 8000 });
  await editor.click();
  await page.keyboard.type(reply, { delay: 28 });
  await page.waitForTimeout(1000);

  await page.evaluate(() => document.querySelector('[data-testid="tweetButton"]')?.click());
  await page.waitForTimeout(3000);
  await browser.close();
  log(`✅ Replied: ${reply}`);
}

// ── Like Solana tweets ────────────────────────────────────────────────────────
export async function likeTweets() {
  log("Liking Solana/gaming tweets...");
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  const queries = [
    "https://x.com/search?q=%23Solana%20game&f=live",
    "https://x.com/search?q=%23SolanaGaming&f=live",
    "https://x.com/search?q=Solana%20Web3%20game&f=live",
    "https://x.com/search?q=%23HAVEN%20Solana&f=live",
  ];
  await page.goto(queries[Math.floor(Math.random() * queries.length)], { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const tweets = await page.locator('[data-testid="tweet"]').all();
  const count  = Math.min(Math.floor(Math.random() * 4) + 2, tweets.length);

  for (let i = 0; i < count; i++) {
    try {
      await tweets[i].locator('[data-testid="like"]').first().click();
      await page.waitForTimeout(1500 + Math.random() * 1500);
      log(`  ♥ liked tweet ${i + 1}`);
    } catch {}
  }

  await browser.close();
  log(`✅ Liked ${count} tweets`);
}

// ── Follow Solana influencers ─────────────────────────────────────────────────
const SOLANA_ACCOUNTS = [
  "solana", "aeyakovenko", "rajgokal", "Mert_Mumtaz", "0xMert_",
  "brian_friel", "therealchaseeb", "KyleSamani", "solanafloor",
  "heliuslabs", "JupiterExchange", "pumpdotfun", "SolanaLegend",
  "DegenPoet", "solanaFndn", "SolanaSun", "blknoiz06", "armaniferrante",
];

export async function followInfluencers() {
  log("Following Solana influencers...");
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  const picks = [...SOLANA_ACCOUNTS].sort(() => 0.5 - Math.random()).slice(0, 3);

  for (const handle of picks) {
    try {
      await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);

      const followBtn = page.locator('[data-testid="placementTracking"]').first();
      const btnText = await followBtn.textContent().catch(() => "");

      if (btnText?.toLowerCase().includes("follow") && !btnText?.toLowerCase().includes("following")) {
        await followBtn.click();
        await page.waitForTimeout(2000);
        log(`  ✅ Followed @${handle}`);
      } else {
        log(`  — already following @${handle}`);
      }
    } catch (e) {
      log(`  ⚠️ @${handle}: ${e.message.slice(0, 60)}`);
    }
    await page.waitForTimeout(1000);
  }

  await browser.close();
}

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  const run = async () => {
    if (action === "--post") {
      const q = loadQueue();
      const tweet = q.tweets[q.index];
      if (!tweet) { log("All tweets posted!"); return; }
      const ok = await postTweet(tweet);
      if (ok) { q.index++; q.posted++; saveQueue(q); }
    } else if (action === "--reply")  { await replyToTrending(); }
    else if (action === "--like")    { await likeTweets(); }
    else if (action === "--follow")  { await followInfluencers(); }
    else { log("Usage: agent.js --post | --reply | --like | --follow"); }
  };
  run().catch(e => { log(`ERROR: ${e.message}`); process.exit(1); });
}
