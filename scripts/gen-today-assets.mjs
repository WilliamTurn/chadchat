#!/usr/bin/env node
// DSH-16 — batch driver: generates every /today dashboard asset into public/today/.
//
// Re-runnable + self-documenting (this manifest IS the spec for what gets generated).
// Phase 4 (DSH-18) consumes these. To regenerate one asset after tweaking its prompt:
//   node scripts/gen-today-assets.mjs --only hero
//   node scripts/gen-today-assets.mjs --only goal-fat-loss
// No arg = generate the whole set (sequential; ~30-60s each at high quality).
//
// Brand: blood-red (#a4161a) on near-black ink/charcoal. Color is an accent, not a wash.
//
// TRANSPARENCY: gpt-image-2 won't emit alpha directly (the `background:transparent`
// param 400s). So the figure assets (`key:true`) are generated on a flat CHROMA-GREEN
// background and then cut to true-alpha PNGs by scripts/remove-bg.py (edge flood-fill).
// Food photos sit on dark backdrops and need no cut, so they're written straight.

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { generateImage } from "./gen-image.mjs";

const OUT = "public/today";
const RAW = `${OUT}/raw`; // pre-cut figures on green (kept for re-keying without re-paying)

// Chroma-green keys cleanly out of charcoal/blood-red/metal subjects (no green in them);
// baked into every figure prompt so remove-bg.py can flood-fill it to transparency.
const GREEN_BG =
  "Isolated on a solid flat chroma-key green background (pure #00ff00), the subject " +
  "fills the frame with a generous even margin on all four sides, nothing touches the " +
  "edges, no green spill or reflection on the subject, no shadow on the ground, " +
  "no text, no logo. ";

// Shared base so the four goal body diagrams read as ONE consistent figure, varied
// only by build + which muscles the blood-red glow emphasizes. Rim-lit + mid-tone so
// the cutout stays legible on the app's dark cards.
const GOAL_BASE =
  "Front-facing full-body anatomical fitness body-map figure: a sculpted gunmetal-grey " +
  "male physique with crisp blood-red rim lighting along the silhouette, clean even " +
  "studio render, standing relaxed symmetrical pose, arms slightly away from the torso, " +
  "head plain and featureless (no face), fitness-app body-diagram style, sharp edges. " +
  GREEN_BG;

// DSH-21 — gender hero silhouettes. The original photographic `hero-figure`
// read as a stock "random guy"; these replace it with a clean near-black
// silhouette traced in blood-red rim light (one consistent style, varied by
// build/sex). A near-black + red subject contains no green, so it keys cleanly.
const HERO_SIL_BASE =
  "A full-body dramatic athletic SILHOUETTE: a near-black charcoal body shape " +
  "with almost no interior detail, traced by an intense glowing blood-red (#a4161a) " +
  "rim light running along the entire contour of the figure, confident powerful " +
  "heroic three-quarter standing stance, head plain and faceless, premium cinematic " +
  "fitness-brand hero aesthetic, dark and moody, high contrast. ";

const ASSETS = [
  {
    id: "hero-male",
    file: `${OUT}/hero-male.png`,
    size: "1024x1536",
    key: true,
    prompt:
      HERO_SIL_BASE +
      "Subject: a powerful broad-shouldered muscular male athlete with a strong " +
      "V-taper physique. " +
      GREEN_BG,
  },
  {
    id: "hero-female",
    file: `${OUT}/hero-female.png`,
    size: "1024x1536",
    key: true,
    prompt:
      HERO_SIL_BASE +
      "Subject: a strong toned athletic female with a fit feminine physique and a " +
      "high ponytail. " +
      GREEN_BG,
  },
  {
    id: "hero-figure",
    file: `${OUT}/hero-figure.png`,
    size: "1024x1536",
    key: true,
    prompt:
      "A powerful lean muscular male athlete in a confident heroic three-quarter " +
      "stance, dramatic blood-red rim lighting raking across the shoulders and arms, " +
      "sculpted gunmetal tone, premium cinematic fitness-brand hero figure, " +
      "photographic, high contrast. " +
      GREEN_BG,
  },
  {
    id: "goal-fat-loss",
    file: `${OUT}/goal-fat-loss.png`,
    size: "1024x1536",
    key: true,
    prompt:
      GOAL_BASE +
      "Build: lean and cut, low body fat, visibly defined abdominals and a tight " +
      "waist. The blood-red glow concentrates on the core and midsection.",
  },
  {
    id: "goal-muscle-gain",
    file: `${OUT}/goal-muscle-gain.png`,
    size: "1024x1536",
    key: true,
    prompt:
      GOAL_BASE +
      "Build: large and powerful bodybuilder mass, broad shoulders, thick chest and " +
      "big arms. The blood-red glow concentrates on the chest, shoulders and arms.",
  },
  {
    id: "goal-recomp",
    file: `${OUT}/goal-recomp.png`,
    size: "1024x1536",
    key: true,
    prompt:
      GOAL_BASE +
      "Build: balanced athletic recomposition physique, moderately muscular and lean " +
      "at once. The blood-red glow is distributed evenly across chest, arms and core.",
  },
  {
    id: "goal-maintenance",
    file: `${OUT}/goal-maintenance.png`,
    size: "1024x1536",
    key: true,
    prompt:
      GOAL_BASE +
      "Build: steady healthy fit athletic physique, neither bulking nor cutting. " +
      "A soft even blood-red rim glow over the whole figure, balanced and stable.",
  },
  {
    id: "food-balanced-plate",
    file: `${OUT}/food-balanced-plate.png`,
    size: "1536x1024",
    prompt:
      "Overhead premium food photography of a balanced high-protein meal — grilled " +
      "chicken breast, jasmine rice and roasted broccoli — plated on a dark slate " +
      "dish, moody low-key studio lighting with a subtle blood-red ambient accent, " +
      "Michelin-quality, ultra sharp, shallow depth of field, no text.",
  },
  {
    id: "food-protein-breakfast",
    file: `${OUT}/food-protein-breakfast.png`,
    size: "1536x1024",
    prompt:
      "Premium food photography of a protein-rich breakfast — soft poached eggs, " +
      "sliced avocado and smoked salmon on dark stoneware — moody low-key studio " +
      "lighting with a faint blood-red ambient accent, ultra sharp, appetizing, no text.",
  },
  {
    id: "food-salmon-bowl",
    file: `${OUT}/food-salmon-bowl.png`,
    size: "1536x1024",
    prompt:
      "Premium food photography of a seared salmon fillet over quinoa with greens and " +
      "cherry tomatoes in a dark ceramic bowl, moody low-key studio lighting with a " +
      "subtle blood-red ambient accent, glistening, ultra sharp, appetizing, no text.",
  },
];

const onlyIdx = process.argv.indexOf("--only");
const filter = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
const preview = process.argv.includes("--preview");

const queue = filter ? ASSETS.filter((a) => a.id.includes(filter)) : ASSETS;

if (queue.length === 0) {
  console.error(`No asset matches --only "${filter}". Ids:`);
  console.error(ASSETS.map((a) => "  " + a.id).join("\n"));
  process.exit(1);
}

mkdirSync(RAW, { recursive: true });
console.log(`Generating ${queue.length} asset(s) → ${OUT}/\n`);

let ok = 0;
for (const a of queue) {
  try {
    // Figures: generate on green into raw/, then key to transparent PNG in OUT.
    // Food: write straight to OUT.
    const genPath = a.key ? `${RAW}/${a.id}.png` : a.file;
    await generateImage({
      prompt: a.prompt,
      outPath: genPath,
      size: a.size || "1024x1024",
      quality: a.quality || "high",
    });

    if (a.key) {
      // Global green key (tol 130): subject is gunmetal+blood-red, contains no green,
      // so this clears the backdrop AND pockets trapped between fingers/limbs while
      // staying well clear of the subject (grey is ~200 from green in RGB space).
      const kArgs = ["scripts/remove-bg.py", genPath, a.file, "130", "--global"];
      if (preview) kArgs.push("--preview");
      const r = spawnSync("py", kArgs, { encoding: "utf8" });
      const out = (r.stdout || "") + (r.stderr || "");
      if (r.status !== 0) throw new Error(`remove-bg.py failed:\n${out}`);
      process.stdout.write("  " + out.trim() + "\n");
    }
    ok++;
  } catch (err) {
    console.error(`✗ ${a.id}: ${String(err.message || err)}`);
  }
  console.log("");
}

console.log(`Done: ${ok}/${queue.length} generated.`);
if (ok !== queue.length) process.exit(1);
