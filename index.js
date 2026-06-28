import Anthropic from "@anthropic-ai/sdk";
import { TwitterApi } from "twitter-api-v2";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Clients ──────────────────────────────────────────────────────────────────
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const twitter = new TwitterApi({
  appKey:        process.env.TWITTER_APP_KEY,
  appSecret:     process.env.TWITTER_APP_SECRET,
  accessToken:   process.env.TWITTER_ACCESS_TOKEN,
  accessSecret:  process.env.TWITTER_ACCESS_SECRET,
});

// ── Fetch game stats ──────────────────────────────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch(`${process.env.HAVEN_API_URL}/api/stats/public`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// ── Tweet types ───────────────────────────────────────────────────────────────
const TWEET_TYPES = [
  "hype",         // general hype about the game
  "feature",      // highlight a game feature
  "community",    // call to join, referral push
  "stats",        // game stats (players, resources)
  "alpha",        // "alpha" tips for players
  "tokenomics",   // HAVEN token info
];

function pickType() {
  return TWEET_TYPES[Math.floor(Math.random() * TWEET_TYPES.length)];
}

// ── Generate tweet with Claude ────────────────────────────────────────────────
async function generateTweet(type, stats) {
  const statsText = stats
    ? `Current game stats: ${stats.totalUsers} players, ${stats.totalLands} lands owned.`
    : "";

  const prompts = {
    hype: `Write an exciting tweet about HAVEN — a browser Web3 idle game on Solana where you build a castle empire. Dark fantasy vibe. Include havenempire.xyz. ${statsText}`,

    feature: `Write a tweet highlighting one of these HAVEN game features: tap your castle to farm resources (Wood, Stone, Iron, Energy, Gold), buy lands, build structures, earn daily rewards, referral system with 3 levels. Pick one feature. Include havenempire.xyz.`,

    community: `Write a tweet inviting people to join HAVEN game on Solana. Mention it's free to play (just connect Solana wallet), you earn points for an upcoming airdrop. Include havenempire.xyz. Create FOMO.`,

    stats: `Write a tweet sharing game stats for HAVEN on Solana. ${statsText} Make it sound impressive and growing. Include havenempire.xyz.`,

    alpha: `Write an "alpha" tip tweet for HAVEN game players. Tips: daily login = streak bonus points, referrals = 3-level rewards, tap the castle to farm resources, higher lands = more resource slots. Pick one tip. Include havenempire.xyz.`,

    tokenomics: `Write a tweet about HAVEN token ($HAVEN) on Solana. It's used to buy lands in the game. Contract: HdQ9gGJx1EeC3oBk8PCDRNWYumBgmy4KrvZvDbkNpump. Early players earn airdrop points. Include havenempire.xyz.`,
  };

  const message = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `${prompts[type]}

Rules:
- Max 240 characters
- Crypto/gaming Twitter style
- Use 1-2 relevant emojis
- No hashtag spam (max 2 hashtags: #HAVEN #Solana)
- Sound natural, not like a bot
- English only
- Output ONLY the tweet text, nothing else`,
    }],
  });

  return message.content[0].text.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[HAVEN Agent] Starting${DRY_RUN ? " (DRY RUN)" : ""}...`);

  const stats  = await fetchStats();
  const type   = pickType();
  const tweet  = await generateTweet(type, stats);

  console.log(`[HAVEN Agent] Type: ${type}`);
  console.log(`[HAVEN Agent] Tweet (${tweet.length} chars):\n${tweet}`);

  if (DRY_RUN) {
    console.log("[HAVEN Agent] Dry run — not posting.");
    return;
  }

  const result = await twitter.v2.tweet(tweet);
  console.log(`[HAVEN Agent] Posted! ID: ${result.data.id}`);
}

main().catch((e) => { console.error("[HAVEN Agent] Error:", e.message); process.exit(1); });
