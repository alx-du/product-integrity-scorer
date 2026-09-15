// ClearCart source-evaluation pipeline
// Usage:
//   node run.js                     -> process every source in data/sources.json
//   node run.js prudent-reviews     -> process one source by slug
//   node run.js --customize cookware -> stage 3: propose category pillar criteria
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fetchPage } from "./src/fetchPage.js";
import { fetchTranscript, isYouTubeUrl } from "./src/fetchTranscript.js";
import { askClaudeJSON } from "./src/claude.js";
import {
  sourceProfilePrompt,
  productExtractionPrompt,
  pillarCustomizationPrompt,
} from "./src/prompts.js";

const DATA = path.resolve("data/sources.json");
const OUT_SOURCES = path.resolve("output/sources");
const OUT_PRODUCTS = path.resolve("output/products");

const sources = JSON.parse(fs.readFileSync(DATA, "utf8"));

// Routes YouTube URLs through yt-dlp transcript extraction and everything
// else through the plain HTML fetcher — video-based creators mix into
// sources.json alongside website-based ones with no schema change.
function fetchAny(url) {
  return isYouTubeUrl(url) ? fetchTranscript(url) : fetchPage(url);
}

function save(dir, name, obj) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  console.log(`  saved -> ${path.relative(process.cwd(), file)}`);
}

async function processSource(src) {
  console.log(`\n== ${src.name} ==`);

  // Stage 1: source profile (homepage + methodology page)
  console.log("Stage 1: profiling source methodology...");
  const pages = [];
  for (const url of [src.homepage, src.methodology_url].filter(Boolean)) {
    try {
      pages.push(await fetchAny(url));
    } catch (e) {
      console.warn(`  skip ${url}: ${e.message}`);
    }
  }
  if (pages.length === 0) {
    console.warn("  no pages fetched; skipping source");
    return;
  }
  const profile = await askClaudeJSON(sourceProfilePrompt(src.name, pages));
  profile.slug = src.slug;
  profile.fetched_at = new Date().toISOString();
  profile.attribution = { name: src.name, url: src.homepage };
  save(OUT_SOURCES, src.slug, profile);

  // Stage 2: per-product extraction
  for (const url of src.product_urls || []) {
    console.log(`Stage 2: extracting product from ${url}`);
    try {
      const page = await fetchAny(url);
      const record = await askClaudeJSON(productExtractionPrompt(src.name, page));
      record.source_slug = src.slug;
      record.source_trust_tier = profile.trust_tier;
      record.source_url = url;
      record.fetched_at = new Date().toISOString();
      record.attribution = {
        reviewer: src.name,
        review_url: url,
        note: "Assessment derived from this reviewer's published work; see review_url for their full analysis.",
      };
      const productSlug = `${src.slug}--${record.product_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60)}`;
      save(OUT_PRODUCTS, productSlug, record);
    } catch (e) {
      console.warn(`  failed ${url}: ${e.message}`);
    }
  }
}

async function customizePillars(category) {
  console.log(`\nStage 3: proposing pillar criteria for category "${category}"`);
  const records = fs
    .readdirSync(OUT_PRODUCTS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUT_PRODUCTS, f), "utf8")))
    .filter((r) => r.category === category);
  if (records.length === 0) {
    console.error(`No product records with category "${category}" yet. Run stage 2 first.`);
    process.exit(1);
  }
  const proposal = await askClaudeJSON(pillarCustomizationPrompt(category, records), {
    maxTokens: 6000,
  });
  save(path.resolve("output"), `pillar-criteria--${category}`, proposal);
}

// ---- entrypoint ----
const args = process.argv.slice(2);
if (args[0] === "--customize") {
  if (!args[1]) {
    console.error("Usage: node run.js --customize <category>");
    process.exit(1);
  }
  await customizePillars(args[1]);
} else {
  const targets = args.length ? sources.filter((s) => args.includes(s.slug)) : sources;
  if (targets.length === 0) {
    console.error(`No matching source slug. Available: ${sources.map((s) => s.slug).join(", ")}`);
    process.exit(1);
  }
  for (const src of targets) await processSource(src);
  console.log("\nDone. Records are in output/ — ready to load into your dashboard.");
}
