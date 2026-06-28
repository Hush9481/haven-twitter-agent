/**
 * Generates HAVEN-themed images using Hugging Face free API
 * Run once: node --env-file=.env generate_images.js
 * Creates images/ folder with 15 castle/Solana themed images
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT   = path.join(__dir, "images");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

// Pollinations.ai — free, no API key needed
const STYLE = "16-bit pixel art style, retro RPG game, dark fantasy, limited color palette, crisp pixels, no blur, SNES era aesthetic";

const PROMPTS = [
  `massive dark fantasy castle on a cliff at night, glowing purple windows, pixel art, ${STYLE}`,
  `medieval stone fortress with watchtowers, moonlight, purple crystals, ${STYLE}`,
  `fantasy kingdom map with castle, forest, mountains, river, top-down view, ${STYLE}`,
  `blacksmith shop interior with glowing forge, iron ingots, stone blocks, ${STYLE}`,
  `dark knight standing before castle gates, dramatic silhouette, ${STYLE}`,
  `treasure room with gold coins, gems, glowing artifacts, dungeon, ${STYLE}`,
  `castle throne room with purple magical portal, runes on floor, ${STYLE}`,
  `wizard tower at night with stars, purple lightning, mystical, ${STYLE}`,
  `fantasy village at the base of a massive castle, lanterns, ${STYLE}`,
  `underground mine with iron ore, workers, torches, deep cave, ${STYLE}`,
  `aerial view of a fantasy empire, multiple buildings, farms, roads, ${STYLE}`,
  `castle under siege, catapults, purple explosions, epic battle, ${STYLE}`,
  `dark forest with glowing purple mushrooms leading to a castle, ${STYLE}`,
  `hero character leveling up, purple aura, stat screen UI overlay, ${STYLE}`,
  `solana purple coin with castle emblem, floating magic gems, ${STYLE}`,
];

async function generateImage(prompt, index) {
  const file = path.join(OUT, `haven_${String(index).padStart(2, "0")}.jpg`);
  if (fs.existsSync(file)) { console.log(`  skip ${index} (exists)`); return; }

  // Pollinations.ai — free, no auth needed
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&nologo=true&seed=${index * 42}`;

  const res = await fetch(url).catch(e => { throw new Error(`Network: ${e.message}`); });

  if (!res.ok) {
    console.log(`  ❌ ${index}: ${res.status}`);
    return;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buffer);
  console.log(`  ✅ Saved: haven_${String(index).padStart(2, "0")}.jpg`);
}

async function main() {
  console.log(`Generating ${PROMPTS.length} HAVEN images...`);
  console.log(`Service: Pollinations.ai (free)\n`);

  for (let i = 0; i < PROMPTS.length; i++) {
    console.log(`[${i + 1}/${PROMPTS.length}] ${PROMPTS[i].slice(0, 60)}...`);
    await generateImage(PROMPTS[i], i + 1);
    await new Promise(r => setTimeout(r, 3000)); // rate limit
  }

  const files = fs.readdirSync(OUT).filter(f => f.endsWith(".jpg"));
  console.log(`\nDone! ${files.length} images in ./images/`);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
