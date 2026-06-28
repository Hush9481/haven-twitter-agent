/**
 * HAVEN AI Twitter Agent
 * - Posts tweets (with optional images) at random times
 * - Replies to Solana/gaming tweets
 * - Likes 30-50 posts/day
 * - Follows 10-15 Solana accounts/day
 */

import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dir   = path.dirname(fileURLToPath(import.meta.url));
const SESSION  = path.join(__dir, "session.json");
const QUEUE    = path.join(__dir, "queue.json");
const LOG      = path.join(__dir, "agent.log");
const IMG_DIR  = path.join(__dir, "images");

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

// ── Random image picker ───────────────────────────────────────────────────────
function randomImage() {
  if (!fs.existsSync(IMG_DIR)) return null;
  const files = fs.readdirSync(IMG_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (!files.length) return null;
  return path.join(IMG_DIR, files[Math.floor(Math.random() * files.length)]);
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
  log(`Posting tweet (${text.length} chars)...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto("https://x.com/home", { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (page.url().includes("login")) { log("Session expired"); await browser.close(); return false; }

  const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
  await composeBtn.waitFor({ timeout: 10000 });
  await composeBtn.click();
  await page.waitForTimeout(2000);

  // Attach image (70% of tweets)
  if (useImage && Math.random() < 0.7) {
    const img = randomImage();
    if (img) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(img);
        await page.waitForTimeout(3000);
        log(`  📷 Attached image: ${path.basename(img)}`);
      } catch (e) { log(`  ⚠️ Image attach failed: ${e.message.slice(0, 60)}`); }
    }
  }

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

// ── Reply to Solana tweets ────────────────────────────────────────────────────
const REPLY_QUERIES = [
  "https://x.com/search?q=%23Solana&f=top",
  "https://x.com/search?q=%23SolanaGaming&f=live",
  "https://x.com/search?q=Solana%20game%20Web3&f=top",
  "https://x.com/search?q=%23SolanaNFT&f=live",
  "https://x.com/search?q=Solana%20airdrop&f=top",
  "https://x.com/search?q=%23crypto%20game%20Solana&f=live",
];

export async function replyToTrending() {
  const query = REPLY_QUERIES[Math.floor(Math.random() * REPLY_QUERIES.length)];
  log(`Replying to tweets: ${query.split("q=")[1]?.split("&")[0]}...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto(query, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const tweets = await page.locator('[data-testid="tweet"]').all();
  if (!tweets.length) { await browser.close(); return; }

  // Reply to 1-2 tweets per session
  const count = Math.min(Math.floor(Math.random() * 2) + 1, tweets.length);
  for (let i = 0; i < count; i++) {
    const pick = tweets[Math.floor(Math.random() * Math.min(8, tweets.length))];
    const tweetText = await pick.locator('[data-testid="tweetText"]').first().textContent().catch(() => "");
    if (!tweetText) continue;

    const msg = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `You are @havenempiresol — a Web3 idle castle game on Solana. Reply to: "${tweetText.slice(0, 200)}"
Write 1 short sentence, max 160 chars, sound like a real person in the Solana community (not a bot), friendly and engaging. Only mention havenempire.xyz if it fits naturally. Output only the reply.`,
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
      log(`  ✅ Replied: ${reply.slice(0, 80)}...`);
    } catch (e) { log(`  ⚠️ Reply failed: ${e.message.slice(0, 60)}`); }

    await page.waitForTimeout(5000 + Math.random() * 5000);
  }

  await browser.close();
}

// ── Like tweets (high volume) ─────────────────────────────────────────────────
const LIKE_QUERIES = [
  "https://x.com/search?q=%23Solana&f=live",
  "https://x.com/search?q=%23SolanaGaming&f=live",
  "https://x.com/search?q=Solana%20Web3&f=live",
  "https://x.com/search?q=%23SolanaNFT&f=live",
  "https://x.com/search?q=Solana%20game&f=live",
  "https://x.com/search?q=%23Solana%20token&f=live",
  "https://x.com/search?q=crypto%20gaming%202026&f=live",
  "https://x.com/search?q=%23defi%20Solana&f=live",
];

export async function likeTweets() {
  const query = LIKE_QUERIES[Math.floor(Math.random() * LIKE_QUERIES.length)];
  log(`Liking tweets: ${query.split("q=")[1]?.split("&")[0]}...`);
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  await page.goto(query, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Scroll to load more tweets
  for (let s = 0; s < 3; s++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);
  }

  const tweets = await page.locator('[data-testid="tweet"]').all();
  const count  = Math.min(Math.floor(Math.random() * 6) + 5, tweets.length); // 5-10 per session

  let liked = 0;
  for (let i = 0; i < count; i++) {
    try {
      const likeBtn = tweets[i].locator('[data-testid="like"]').first();
      const btnText = await likeBtn.getAttribute("aria-label").catch(() => "");
      if (btnText?.toLowerCase().includes("liked")) continue; // already liked
      await likeBtn.click();
      liked++;
      await page.waitForTimeout(1200 + Math.random() * 1800);
    } catch {}
  }

  await browser.close();
  log(`✅ Liked ${liked} tweets`);
  return liked;
}

// ── Follow Solana influencers ─────────────────────────────────────────────────
const SOLANA_ACCOUNTS = [
  // Core Solana
  "solana", "aeyakovenko", "rajgokal", "Mert_Mumtaz", "0xMert_",
  "brian_friel", "therealchaseeb", "armaniferrante", "blknoiz06",
  // Solana ecosystem
  "heliuslabs", "JupiterExchange", "pumpdotfun", "solanaFndn",
  "solanafloor", "MagicEden", "tensor_hq", "DriftProtocol",
  "MarinadeFinance", "SolanaLegend", "SolanaSun",
  // Crypto/gaming
  "KyleSamani", "DegenPoet", "cobie", "inversebrah",
  "CryptoKaleo", "Pentosh1", "notthreadguy",
  "NFT_GOD", "iamDCinvestor", "CryptoGodJohn",
];

export async function followInfluencers() {
  log("Following Solana accounts...");
  const { browser, ctx } = await openBrowser(true);
  const page = await ctx.newPage();

  // Pick 4-6 random accounts per session
  const picks = [...SOLANA_ACCOUNTS].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 4);
  let followed = 0;

  for (const handle of picks) {
    try {
      await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Try multiple selectors for follow button
      const btns = await page.locator('[data-testid="placementTracking"]').all();
      let didFollow = false;
      for (const btn of btns) {
        const txt = await btn.textContent().catch(() => "");
        if (txt?.toLowerCase().includes("follow") && !txt?.toLowerCase().includes("following")) {
          await btn.click();
          await page.waitForTimeout(1500);
          followed++;
          didFollow = true;
          break;
        }
      }
      log(`  ${didFollow ? "✅ Followed" : "— already following"} @${handle}`);
    } catch (e) {
      log(`  ⚠️ @${handle}: ${e.message.slice(0, 50)}`);
    }
    await page.waitForTimeout(2000 + Math.random() * 2000);
  }

  await browser.close();
  log(`✅ Followed ${followed} new accounts`);
  return followed;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  const run = async () => {
    if (action === "--post") {
      const q = loadQueue();
      if (q.index >= q.tweets.length) { log("All tweets posted!"); return; }
      const ok = await postTweet(q.tweets[q.index]);
      if (ok) { q.index++; q.posted++; saveQueue(q); }
    }
    else if (action === "--reply")  await replyToTrending();
    else if (action === "--like")   await likeTweets();
    else if (action === "--follow") await followInfluencers();
    else log("Usage: agent.js --post | --reply | --like | --follow");
  };
  run().catch(e => { log(`ERROR: ${e.message}`); process.exit(1); });
}
