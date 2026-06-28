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

const HF_TOKEN = process.env.HF_API_TOKEN;
const MODEL    = "black-forest-labs/FLUX.1-schnell";

const PROMPTS = [
  "epic dark fantasy castle on a cliff at sunset, glowing purple crystals, mystical fog, digital art style, game concept art",
  "ancient stone fortress surrounded by mountains, golden hour lighting, fantasy RPG art style, cinematic",
  "medieval castle towers with Solana blockchain purple glow effects, futuristic fantasy hybrid, dramatic sky",
  "knights and wizards defending a massive fortress, dark fantasy, Solana purple energy beams, concept art",
  "bird eye view of vast fantasy kingdom with multiple castles, resource mines, dark forest, game map art",
  "glowing purple portal inside a medieval throne room, mystical runes, dark fantasy atmosphere, 4K",
  "fantasy blacksmith forging glowing weapons, iron and stone resources, warm forge lighting, game art",
  "massive dark fantasy tower piercing through storm clouds, lightning, purple energy, ominous sky",
  "solana logo merged with medieval castle silhouette, purple gradients, crypto art, minimalist",
  "fantasy gold coins and gems spilling from a treasure chest, dark dungeon, dramatic lighting, game UI art",
  "aerial view of HAVEN empire with farmlands, mines, forests, rivers, fantasy game world map",
  "dark knight on horseback overlooking glowing magical kingdom at night, stars, digital painting",
  "epic fantasy battle scene at castle gates, purple magic explosions, siege weapons, concept art",
  "cozy medieval tavern inside a castle, warm candles, adventurers, fantasy RPG vibe, detailed art",
  "Solana-powered futuristic castle floating in the sky, neon purple energy fields, sci-fi fantasy",
];

async function generateImage(prompt, index) {
  const file = path.join(OUT, `haven_${String(index).padStart(2, "0")}.jpg`);
  if (fs.existsSync(file)) { console.log(`  skip ${index} (exists)`); return; }

  const headers = { "Content-Type": "application/json" };
  if (HF_TOKEN) headers["Authorization"] = `Bearer ${HF_TOKEN}`;

  const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ inputs: prompt, parameters: { width: 768, height: 512 } }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Model loading — retry once after delay
    if (err.includes("loading") || res.status === 503) {
      console.log(`  Model loading, waiting 20s...`);
      await new Promise(r => setTimeout(r, 20000));
      return generateImage(prompt, index);
    }
    console.log(`  ❌ ${index}: ${res.status} — ${err.slice(0, 100)}`);
    return;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buffer);
  console.log(`  ✅ Saved: haven_${String(index).padStart(2, "0")}.jpg`);
}

async function main() {
  console.log(`Generating ${PROMPTS.length} HAVEN images...`);
  console.log(`Model: ${MODEL}\n`);

  for (let i = 0; i < PROMPTS.length; i++) {
    console.log(`[${i + 1}/${PROMPTS.length}] ${PROMPTS[i].slice(0, 60)}...`);
    await generateImage(PROMPTS[i], i + 1);
    await new Promise(r => setTimeout(r, 3000)); // rate limit
  }

  const files = fs.readdirSync(OUT).filter(f => f.endsWith(".jpg"));
  console.log(`\nDone! ${files.length} images in ./images/`);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
