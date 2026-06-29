/**
 * HAVEN AI Twitter Agent — Growth Mode
 * Goal: maximize followers and impressions
 * Tactics: hot-take replies, quote tweets, mass follow, engagement bursts
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
const IMG_DIR = path.join(__dir, "images");

export const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch {}
}

// ── Queue ─────────────────────────────────────────────────────────────────────
export function loadQueue() {
  if (fs.existsSync(QUEUE)) return JSON.parse(fs.readFileSync(QUEUE, "utf-8"));
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

function randomImage() {
  if (!fs.existsSync(IMG_DIR)) return null;
  const files = fs.readdirSync(IMG_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  return files.length ? path.join(IMG_DIR, files[Math.floor(Math.random() * files.length)]) : null;
}

// ── Browser ───────────────────────────────────────────────────────────────────
export async function openBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
           "--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    storageState: fs.existsSync(SESSION) ? SESSION : undefined,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  return { browser, ctx };
}

// ── Post tweet ────────────────────────────────────────────────────────────────
export async function postTweet(text, useImage = true) {
  log(`Posting: "${text.slice(0, 60)}..."`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();
  await page.goto("https://x.com/home", { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (page.url().includes("login")) { log("Session expired"); await browser.close(); return false; }

  const compose = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
  await compose.waitFor({ timeout: 10000 });
  await compose.click();
  await page.waitForTimeout(2000);

  if (useImage && Math.random() < 0.85) {
    const img = randomImage();
    if (img) {
      try {
        // Click the media/image button to activate file input
        const mediaBtn = page.locator('[data-testid="attachments"]').first();
        await mediaBtn.waitFor({ timeout: 5000 });
        await mediaBtn.click();
        await page.waitForTimeout(1000);
        await page.locator('input[type="file"]').first().setInputFiles(img);
        await page.waitForTimeout(4000);
        log(`  📷 Image: ${path.basename(img)}`);
      } catch {
        // Fallback: try direct file input without clicking media button
        try {
          await page.locator('input[type="file"]').first().setInputFiles(img);
          await page.waitForTimeout(4000);
          log(`  📷 Image (fallback): ${path.basename(img)}`);
        } catch {}
      }
    }
  }

  const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
  await editor.waitFor({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type(text, { delay: 22 });
  await page.waitForTimeout(1500);
  await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('[data-testid="tweetButton"]')?.click());
  await page.waitForTimeout(4000);
  await browser.close();
  log("✅ Posted!");
  return true;
}

// Returns true if tweet is recent (within last 30 days)
async function isTweetRecent(tweetEl) {
  try {
    const timeEl = await tweetEl.locator("time").first();
    const datetime = await timeEl.getAttribute("datetime").catch(() => null);
    if (!datetime) return true; // assume recent if no timestamp
    const age = Date.now() - new Date(datetime).getTime();
    return age < 30 * 24 * 3600 * 1000; // 30 days
  } catch { return true; }
}

// ── HOT TAKE reply (growth tactic #1) ────────────────────────────────────────
// Reply to big accounts with provocative takes to get visibility
const BIG_ACCOUNTS = [
  "aeyakovenko", "rajgokal", "0xMert_", "blknoiz06", "cobie",
  "inversebrah", "CryptoKaleo", "ansem", "Pentosh1", "notthreadguy",
  "pumpdotfun", "JupiterExchange", "heliuslabs",
];

export async function replyToBigAccount() {
  const handle = BIG_ACCOUNTS[Math.floor(Math.random() * BIG_ACCOUNTS.length)];
  log(`Hot-take reply to @${handle}...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const tweets = await page.locator('[data-testid="tweet"]').all();
  if (!tweets.length) { await browser.close(); return; }

  // Pick only from recent tweets (last 30 days)
  const recentTweets = [];
  for (const t of tweets.slice(0, 8)) {
    if (await isTweetRecent(t)) recentTweets.push(t);
  }
  if (!recentTweets.length) { log("  No recent tweets found"); await browser.close(); return; }

  const pick = recentTweets[Math.floor(Math.random() * Math.min(3, recentTweets.length))];
  const tweetText = await pick.locator('[data-testid="tweetText"]').first().textContent().catch(() => "");
  if (!tweetText) { await browser.close(); return; }

  const msg = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 140,
    messages: [{
      role: "user",
      content: `You are @havenempiresol — a Web3 idle castle game on Solana, building a community.
Reply to this tweet from a major Solana influencer: "${tweetText.slice(0, 250)}"

Write a short, ENGAGING reply (max 200 chars) that will get attention. Use one of these styles (pick what fits):
- Bold hot take / unpopular opinion
- Funny/witty observation
- Genuine insight that adds value
- Relatable reaction
- Interesting question that sparks debate

DO NOT sound like a bot or shill the game. Sound like a smart crypto degen. Output only the reply.`,
    }],
  });
  const reply = msg.content[0].text.trim();

  try {
    await pick.locator('[data-testid="reply"]').first().click();
    await page.waitForTimeout(2000);
    const editor = page.locator('[data-testid="tweetTextarea_0"]').last();
    await editor.waitFor({ timeout: 8000 });
    await editor.click();
    await page.keyboard.type(reply, { delay: 28 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelector('[data-testid="tweetButton"]')?.click());
    await page.waitForTimeout(3000);
    log(`  ✅ Replied to @${handle}: "${reply.slice(0, 80)}"`);
  } catch (e) { log(`  ⚠️ ${e.message.slice(0, 60)}`); }

  await browser.close();
}

// ── Trending reply (growth tactic #2) ────────────────────────────────────────
const TRENDING_QUERIES = [
  "https://x.com/search?q=%23Solana&f=top",
  "https://x.com/search?q=%23SolanaGaming&f=live",
  "https://x.com/search?q=Solana%20airdrop&f=top",
  "https://x.com/search?q=%23crypto%20game&f=top",
  "https://x.com/search?q=Web3%20gaming%202026&f=top",
  "https://x.com/search?q=%23BONK%20OR%20%23WIF%20Solana&f=top",
  "https://x.com/search?q=Solana%20pump&f=live",
];

export async function replyToTrending() {
  const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
  log(`Replying trending: ${decodeURIComponent(query.split("q=")[1]?.split("&")[0] ?? "")}...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto(query, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const tweets = await page.locator('[data-testid="tweet"]').all();
  if (!tweets.length) { await browser.close(); return; }

  // Filter to recent tweets only
  const recentTweets = [];
  for (const t of tweets.slice(0, 10)) {
    if (await isTweetRecent(t)) recentTweets.push(t);
  }
  if (!recentTweets.length) { await browser.close(); return; }

  const count = Math.min(2, recentTweets.length);
  for (let i = 0; i < count; i++) {
    const pick = recentTweets[Math.floor(Math.random() * recentTweets.length)];
    const tweetText = await pick.locator('[data-testid="tweetText"]').first().textContent().catch(() => "");
    if (!tweetText) continue;

    const msg = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 130,
      messages: [{
        role: "user",
        content: `You are @havenempiresol — crypto degen building HAVEN game on Solana.
Reply to: "${tweetText.slice(0, 200)}"
Be engaging, max 180 chars. Style: witty/relatable/insight. Mention havenempire.xyz only if very natural. Sound human. Output reply only.`,
      }],
    });
    const reply = msg.content[0].text.trim();

    try {
      await pick.locator('[data-testid="reply"]').first().click();
      await page.waitForTimeout(2000);
      const ed = page.locator('[data-testid="tweetTextarea_0"]').last();
      await ed.waitFor({ timeout: 8000 });
      await ed.click();
      await page.keyboard.type(reply, { delay: 28 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => document.querySelector('[data-testid="tweetButton"]')?.click());
      await page.waitForTimeout(4000);
      log(`  ✅ Reply: "${reply.slice(0, 70)}"`);
    } catch (e) { log(`  ⚠️ ${e.message.slice(0, 50)}`); }

    await page.waitForTimeout(4000 + Math.random() * 4000);
  }
  await browser.close();
}

// ── Mass like (growth tactic #3) ─────────────────────────────────────────────
const LIKE_QUERIES = [
  "https://x.com/search?q=%23Solana&f=live",
  "https://x.com/search?q=%23SolanaGaming&f=live",
  "https://x.com/search?q=Solana%20game&f=live",
  "https://x.com/search?q=%23SolanaNFT&f=live",
  "https://x.com/search?q=crypto%20gaming&f=live",
  "https://x.com/search?q=%23defi%20Solana&f=live",
  "https://x.com/search?q=Web3%20idle%20game&f=live",
  "https://x.com/search?q=%23HAVEN%20crypto&f=live",
];

export async function likeTweets() {
  const query = LIKE_QUERIES[Math.floor(Math.random() * LIKE_QUERIES.length)];
  log(`Liking: ${decodeURIComponent(query.split("q=")[1]?.split("&")[0] ?? "")}...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();
  await page.goto(query, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  for (let s = 0; s < 4; s++) {
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(1200);
  }

  const tweets = await page.locator('[data-testid="tweet"]').all();
  const count  = Math.min(Math.floor(Math.random() * 6) + 7, tweets.length); // 7-12 per session
  let liked = 0;

  for (let i = 0; i < count; i++) {
    try {
      const btn = tweets[i].locator('[data-testid="like"]').first();
      const label = await btn.getAttribute("aria-label").catch(() => "");
      if (label?.toLowerCase().includes("liked")) continue;
      await btn.click();
      liked++;
      await page.waitForTimeout(800 + Math.random() * 1200);
    } catch {}
  }
  await browser.close();
  log(`✅ Liked ${liked} tweets`);
  return liked;
}

// ── Mass follow (growth tactic #4) ───────────────────────────────────────────
// Follow followers of big accounts — they often follow back
const FOLLOW_SOURCES = [
  "solana", "pumpdotfun", "JupiterExchange", "aeyakovenko",
  "heliuslabs", "MagicEden", "tensor_hq", "blknoiz06",
];

const DIRECT_FOLLOW = [
  "solana", "aeyakovenko", "rajgokal", "Mert_Mumtaz", "0xMert_",
  "brian_friel", "therealchaseeb", "armaniferrante", "blknoiz06",
  "heliuslabs", "JupiterExchange", "pumpdotfun", "solanaFndn",
  "solanafloor", "MagicEden", "tensor_hq", "DriftProtocol",
  "KyleSamani", "DegenPoet", "cobie", "inversebrah",
  "CryptoKaleo", "Pentosh1", "notthreadguy", "ansem",
  "NFT_GOD", "iamDCinvestor", "CryptoGodJohn", "SolanaLegend",
];

export async function followUsers() {
  log("Mass follow session...");
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();
  let followed = 0;

  // Strategy A: follow followers of a big account
  if (Math.random() > 0.4) {
    const source = FOLLOW_SOURCES[Math.floor(Math.random() * FOLLOW_SOURCES.length)];
    await page.goto(`https://x.com/${source}/followers`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const followBtns = await page.locator('[data-testid="UserCell"] [data-testid="placementTracking"]').all();
    const count = Math.min(Math.floor(Math.random() * 5) + 5, followBtns.length); // 5-9

    for (let i = 0; i < count; i++) {
      try {
        const txt = await followBtns[i].textContent().catch(() => "");
        if (txt?.toLowerCase().includes("follow") && !txt?.toLowerCase().includes("following")) {
          await followBtns[i].click();
          followed++;
          await page.waitForTimeout(1500 + Math.random() * 1500);
        }
      } catch {}
    }
    log(`  Followed ${followed} followers of @${source}`);
  }

  // Strategy B: follow direct list
  const picks = [...DIRECT_FOLLOW].sort(() => 0.5 - Math.random()).slice(0, 4);
  for (const handle of picks) {
    try {
      await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
      const btns = await page.locator('[data-testid="placementTracking"]').all();
      for (const btn of btns) {
        const txt = await btn.textContent().catch(() => "");
        if (txt?.toLowerCase().includes("follow") && !txt?.toLowerCase().includes("following")) {
          await btn.click();
          followed++;
          await page.waitForTimeout(1500);
          break;
        }
      }
    } catch {}
    await page.waitForTimeout(1500 + Math.random() * 1500);
  }

  await browser.close();
  log(`✅ Total followed: ${followed}`);
  return followed;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  ({
    "--post":   async () => {
      const q = loadQueue();
      if (q.index >= q.tweets.length) { log("Queue empty!"); return; }
      const ok = await postTweet(q.tweets[q.index]);
      if (ok) { q.index++; q.posted++; saveQueue(q); }
    },
    "--reply":  replyToTrending,
    "--hottake": replyToBigAccount,
    "--like":   likeTweets,
    "--follow": followUsers,
  }[action] ?? (() => log("Usage: --post | --reply | --hottake | --like | --follow")))()
    .catch(e => { log(`ERROR: ${e.message}`); process.exit(1); });
}
