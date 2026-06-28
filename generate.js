import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchStats() {
  try {
    const res = await fetch(`${process.env.HAVEN_API_URL}/api/stats/public`);
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

const TWEET_TYPES = ["hype", "feature", "community", "stats", "alpha", "tokenomics"];

const prompts = {
  hype:       "Write an exciting tweet about HAVEN — a browser Web3 idle game on Solana where you build a castle empire. Dark fantasy vibe.",
  feature:    "Write a tweet highlighting one HAVEN game feature: tap castle to farm resources (Wood, Stone, Iron, Energy, Gold), buy lands, build structures, earn daily rewards, 3-level referral system. Pick one.",
  community:  "Write a tweet inviting people to join HAVEN game on Solana. Free to play (connect Solana wallet), earn points for upcoming airdrop. Create FOMO.",
  stats:      "Write a tweet sharing game stats for HAVEN on Solana. Make it sound impressive and growing.",
  alpha:      "Write an alpha tip for HAVEN players: daily login streak = bonus points, referrals = 3-level rewards, tap castle to farm, higher lands = more slots. Pick one tip.",
  tokenomics: "Write a tweet about $HAVEN token on Solana. Early players earn airdrop points. Contract: HdQ9gGJx1EeC3oBk8PCDRNWYumBgmy4KrvZvDbkNpump.",
};

async function main() {
  const stats = await fetchStats();
  const statsText = stats ? `Current stats: ${stats.totalUsers} players, ${stats.totalLands} lands.` : "";

  console.log("\n═══════════════════════════════════════");
  console.log("  HAVEN Twitter Agent — Ready to post");
  console.log("═══════════════════════════════════════\n");

  for (const type of TWEET_TYPES) {
    const msg = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `${prompts[type]} ${statsText} Include havenempire.xyz. Rules: max 240 chars, 1-2 emojis, max 2 hashtags (#HAVEN #Solana), natural tone, English only. Output ONLY the tweet text.`,
      }],
    });

    const tweet = msg.content[0].text.trim();
    console.log(`📌 [${type.toUpperCase()}] (${tweet.length} chars)`);
    console.log(`${tweet}`);
    console.log("───────────────────────────────────────\n");
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
