import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const prompts = [
  // HYPE (6)
  "Write a hype tweet about HAVEN — a Web3 idle castle game on Solana. Build your empire, earn $HAVEN airdrop. Dark fantasy vibe. Include havenempire.xyz",
  "Write an exciting launch tweet for HAVEN game on Solana. Early players get the biggest airdrop allocation. Include havenempire.xyz",
  "Write a FOMO tweet about getting into HAVEN early on Solana. The earlier you join the more $HAVEN tokens you earn. Include havenempire.xyz",
  "Write a tweet comparing HAVEN to other idle games — but this one is on Solana and rewards you with crypto. Include havenempire.xyz",
  "Write a motivational tweet about building your empire in HAVEN. While others sleep, your castle generates resources. Include havenempire.xyz",
  "Write a tweet about why HAVEN is the next big idle game on Solana. Real ownership, real rewards. Include havenempire.xyz",

  // FEATURE (6)
  "Tweet about the resource farming mechanic in HAVEN: tap your castle to collect Wood, Stone, Iron, Energy, Gold. Include havenempire.xyz",
  "Tweet about land ownership in HAVEN game on Solana. Own lands, earn more resources, grow your empire. Include havenempire.xyz",
  "Tweet about the daily login streak bonus in HAVEN. Log in every day = more points = bigger airdrop. Include havenempire.xyz",
  "Tweet about building structures in HAVEN castle game. Upgrade your kingdom from wood huts to iron fortresses. Include havenempire.xyz",
  "Tweet about the energy system in HAVEN — tap to farm, energy refills every hour, never stop growing. Include havenempire.xyz",
  "Tweet about the points system in HAVEN — every action earns points, points = future $HAVEN token airdrop. Include havenempire.xyz",

  // COMMUNITY (5)
  "Tweet inviting Solana gamers to join HAVEN. Free to play, just connect wallet. Include havenempire.xyz",
  "Tweet asking who else is building their empire in HAVEN. Tag a friend who would love a castle idle game on Solana. Include havenempire.xyz",
  "Tweet about the HAVEN referral system — invite friends, earn 3 levels of rewards. Include havenempire.xyz",
  "Tweet to the Solana community about HAVEN — a new idle game where you actually own your assets. Include havenempire.xyz",
  "Tweet welcoming new players to HAVEN empire. The gates are open, come build your kingdom. Include havenempire.xyz",

  // ALPHA (5)
  "Alpha tip: in HAVEN, never break your login streak — the bonus points stack exponentially. Include havenempire.xyz",
  "Alpha tip: in HAVEN, referrals pay 3 levels deep. Your friends' friends also earn you rewards. Include havenempire.xyz",
  "Alpha tip: HAVEN lands give you more resource slots. Buy lands early before prices rise. Include havenempire.xyz",
  "Alpha tip: in HAVEN, Gold is the rarest resource drop — save it for the best upgrades. Include havenempire.xyz",
  "Alpha tip: HAVEN players who joined early will get the largest $HAVEN token airdrop. The window is now. Include havenempire.xyz",

  // TOKENOMICS (4)
  "Tweet about $HAVEN token on Solana. Play the game, earn points, get airdrop. Contract: HdQ9gGJx1EeC3oBk8PCDRNWYumBgmy4KrvZvDbkNpump. Include havenempire.xyz",
  "Tweet about the $HAVEN airdrop coming for active players. The points you earn now = tokens later. Include havenempire.xyz",
  "Tweet about $HAVEN token utility: buy new lands, upgrade buildings, stake for rewards. Include havenempire.xyz",
  "Tweet about why $HAVEN tokenomics are built for long-term — game utility drives real demand. Include havenempire.xyz",

  // MEME/RELATABLE (4)
  "Write a relatable gamer meme tweet about HAVEN: your castle is farming resources even while you're at work. Include havenempire.xyz",
  "Write a funny tweet about HAVEN: other people have hobbies, you have a Solana castle empire to manage. Include havenempire.xyz",
  "Write a 'this is fine' style tweet about neglecting real life because your HAVEN castle needs attention. Funny tone. Include havenempire.xyz",
  "Write a tweet in the style of 'POV: you just discovered HAVEN on Solana and now you can't stop building'. Include havenempire.xyz",
];

async function generateTweet(prompt) {
  const msg = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 280,
    messages: [{
      role: "user",
      content: `${prompt}\n\nRules: max 240 chars, 1-2 emojis max, max 2 hashtags (#HAVEN #Solana), natural crypto Twitter tone, English only. Output ONLY the tweet text, nothing else.`,
    }],
  });
  return msg.content[0].text.trim();
}

async function main() {
  console.log("Generating 30 tweets for @havenempiresol...\n");

  const tweets = [];
  for (let i = 0; i < prompts.length; i++) {
    process.stdout.write(`[${i + 1}/30] generating...`);
    const tweet = await generateTweet(prompts[i]);
    tweets.push(tweet);
    process.stdout.write(` done (${tweet.length} chars)\n`);
  }

  // Save to file
  const lines = tweets.map((t, i) => `${i + 1}. ${t}`).join("\n\n");
  const fs = await import("fs");
  fs.default.writeFileSync("tweets30.txt", lines, "utf-8");

  console.log("\n✅ Saved to tweets30.txt\n");
  console.log("═══════════════════════════════════════════════\n");
  tweets.forEach((t, i) => {
    console.log(`${i + 1}. ${t}`);
    console.log("───────────────────────────────────────────────\n");
  });
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
