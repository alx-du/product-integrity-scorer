/**
 * buildReports.js — pipeline output → demo-ready reports, ranked by evidence
 *
 * Two jobs:
 *
 *   1. Convert every product record in output/products/ into the exact shape
 *      extension/scoring/pillars.js expects, and run it through the REAL
 *      engine — not a reimplementation of it. Whatever gating, coverage, and
 *      confidence rules the extension/server use in production are exactly
 *      what generates these reports, so a report can never silently diverge
 *      from what the shipped code would say about the same evidence.
 *
 *   2. Rank every product by how much independently checkable information
 *      exists for it — which is the input to "which products have enough
 *      evidence to be worth a full demo report."
 *
 * Run: node src/buildReports.js
 * Reads:  output/products/*.json   (pipeline's own record format)
 * Writes: output/reports/<slug>.json   (one per product, engine-native shape)
 *         output/coverage-report.json  (full ranked data)
 *         output/coverage-report.md    (human-readable leaderboard)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The engine is CommonJS; pull it in directly rather than re-deriving its
// rules here. If pillars.js changes, this script's output changes with it —
// that's the point.
const scoring = require('../../extension/scoring/pillars.js');

const PRODUCTS_DIR = path.join(__dirname, '..', 'output', 'products');
const REPORTS_DIR  = path.join(__dirname, '..', 'output', 'reports');
const COVERAGE_JSON = path.join(__dirname, '..', 'output', 'coverage-report.json');
const COVERAGE_MD   = path.join(__dirname, '..', 'output', 'coverage-report.md');

// ─── Vocabulary mapping ─────────────────────────────────────────────────────
// The pipeline and the engine independently describe the same thing in
// different words. This is the single place that translation happens.

/** Pipeline's dimension key -> engine's dimension key. */
const DIMENSION_MAP = {
  planet: 'planet',
  people_supply_chain: 'people',
  quality: 'quality',
  value: 'value',
  transparency: 'transparency'
};

/**
 * Pipeline's evidence_kind -> engine's source tier (CLAUDE.md source tiers:
 * 1 regulatory, 2 independent testing, 3 journalism/citation, 4 trade/
 * uncredentialed, 5 the seller). Matches the confidence-cap table the
 * pipeline already documents in Source-Pipeline.html and its own README.
 */
const EVIDENCE_KIND_TO_TIER = {
  tested: scoring.SOURCE_TIER.INDEPENDENT_TEST,   // 2
  cited_third_party: scoring.SOURCE_TIER.JOURNALISM, // 3
  brand_claim_repeated: scoring.SOURCE_TIER.SELLER,  // 5
  anecdotal: scoring.SOURCE_TIER.TRADE            // 4
};

/**
 * PLACEHOLDER ANCHOR SCHEME — read before changing scores.
 *
 * Every claim is gated at anchor 3 (the pass threshold), never anywhere else
 * on the 0-5 scale. This is deliberate, not a shortcut taken by accident:
 * the pipeline has no per-category indicator rubric yet (that's D1 in
 * BACKLOG.md — what a 4 or a 5 actually requires, per product category).
 * Inventing finer-grained anchors here would fabricate precision the
 * evidence doesn't support, which is exactly what the framework exists to
 * refuse to do.
 *
 * The result is honest but coarse: a dimension gates at 3 ("clears the pass
 * threshold") if every claim reaching it is substantiated, or 0 ("assessed
 * and adverse") if any claim reaching it is explicitly contradicted — never
 * a 1, 2, 4, or 5. Replace this the moment D1 exists.
 */
const PLACEHOLDER_ANCHOR = 3;

// ─── Load ───────────────────────────────────────────────────────────────────

function loadProductRecords() {
  return readdirSync(PRODUCTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(PRODUCTS_DIR, f), 'utf8')));
}

/**
 * Group source-level records by the product they describe, so a second
 * source added for a product already in the pilot set merges into one
 * report instead of producing a second, competing one.
 * @param {object[]} records
 * @returns {Map<string, object[]>}
 */
function groupByProduct(records) {
  const groups = new Map();
  for (const r of records) {
    const key = normalizeProductKey(r.brand, r.product_name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}

function normalizeProductKey(brand, name) {
  return `${brand}::${name}`.toLowerCase().trim().replace(/\s+/g, ' ');
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Convert ────────────────────────────────────────────────────────────────

/**
 * Turn one pipeline claim into an engine finding.
 * @param {object} claim - { claim, evidence_kind, confidence }
 * @param {object} record - the source record the claim came from, for attribution
 * @returns {object} an indicator per assessDimension()'s contract
 */
function claimToFinding(claim, record) {
  const sourceTier = EVIDENCE_KIND_TO_TIER[claim.evidence_kind] ?? null;
  return {
    label: claim.claim,
    anchor: PLACEHOLDER_ANCHOR,
    // A claim with no recognized evidence_kind can't be trusted with a tier,
    // so it's treated as unaddressed rather than guessed at.
    met: sourceTier === null ? null : true,
    sourceTier,
    // Pipeline claims are always about the reviewed product itself — it has
    // no notion yet of a claim that's really about the parent entity. See
    // buildReports's README note on known limitations.
    sourceScope: sourceTier === null ? null : scoring.SOURCE_SCOPE.GOOD,
    source: record.attribution?.reviewer ?? record.source_slug,
    sourceUrl: record.attribution?.review_url ?? record.source_url ?? null
  };
}

/**
 * Merge every source record for one product into the indicatorsByDimension
 * shape assessGood() expects, across all five engine dimensions.
 * @param {object[]} records - all pipeline records for one product
 * @returns {Object<string, object[]>}
 */
function buildIndicators(records) {
  const indicators = Object.fromEntries(scoring.DIMENSION_KEYS.map((k) => [k, []]));

  for (const record of records) {
    for (const [pipelineDim, engineDim] of Object.entries(DIMENSION_MAP)) {
      const pillar = record.pillars[pipelineDim];
      if (!pillar) continue;
      for (const claim of pillar.claims || []) {
        indicators[engineDim].push(claimToFinding(claim, record));
      }
    }
  }
  return indicators;
}

/**
 * Count populated dimensions and evidence density for one product — the
 * ranking signal for "which products have the most information."
 * @param {object} assessment - assessGood() output
 * @param {object[]} records - raw source records, for claim counts
 * @returns {object} ranking fields
 */
function scoreInformation(assessment, records) {
  const dims = Object.values(assessment.dimensions);
  const populated = dims.filter((d) =>
    d.coverage === scoring.COVERAGE.SCORED || d.coverage === scoring.COVERAGE.INFERRED
  );
  const rightsPopulated = dims.filter((d) => d.rightsBearing &&
    (d.coverage === scoring.COVERAGE.SCORED || d.coverage === scoring.COVERAGE.INFERRED)
  );
  const totalClaims = records.reduce(
    (sum, r) => sum + Object.values(r.pillars).reduce((s, p) => s + (p.claims?.length || 0), 0), 0
  );
  const sources = [...new Set(records.map((r) => r.source_slug))];

  return {
    populatedDimensions: populated.length,
    rightsBearingPopulated: rightsPopulated.length, // out of 2: planet, people
    totalClaims,
    sourceCount: sources.length,
    sources
  };
}

// ─── Run ────────────────────────────────────────────────────────────────────

function main() {
  const records = loadProductRecords();
  if (records.length === 0) {
    console.error(`No product records found in ${PRODUCTS_DIR}`);
    process.exit(1);
  }

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

  const groups = groupByProduct(records);
  const leaderboard = [];
  let violationCount = 0;

  for (const [key, groupRecords] of groups) {
    const first = groupRecords[0];
    const indicators = buildIndicators(groupRecords);
    const assessment = scoring.assessGood(indicators);

    // Safety net: if a conversion bug ever produced an assessment that
    // breaks the framework's own rules, fail loudly here rather than ship a
    // silently wrong report. See extension/scoring/pillars.js validateAssessment.
    const violations = Object.values(assessment.dimensions)
      .flatMap((d) => scoring.validateAssessment(d));
    if (violations.length) {
      violationCount += violations.length;
      console.error(`  VIOLATION in "${first.product_name}":`, violations);
    }

    const ranking = scoreInformation(assessment, groupRecords);
    // Several product names already include the brand ("Naturepedic EOS
    // Classic Mattress") — don't prepend it a second time, in the slug or
    // in display strings.
    const displayName = first.product_name.toLowerCase().startsWith(first.brand.toLowerCase())
      ? first.product_name
      : `${first.brand} ${first.product_name}`;
    const slug = slugify(displayName);

    const report = {
      product_name: first.product_name,
      brand: first.brand,
      category: first.category,
      slug,
      dimensions: assessment.dimensions,
      screen: assessment.screen,
      sources: groupRecords.map((r) => ({
        slug: r.source_slug,
        reviewer: r.attribution?.reviewer ?? r.source_slug,
        trust_tier: r.source_trust_tier,
        url: r.attribution?.review_url ?? r.source_url
      })),
      ranking,
      generated_at: new Date().toISOString(),
      generator_note: 'Scores use a placeholder single-anchor scheme (anchor 3 only) '
        + 'pending category-specific indicator rubrics (BACKLOG.md D1). Coverage and '
        + 'confidence are computed by the real scoring engine and are not placeholders.'
    };

    writeFileSync(path.join(REPORTS_DIR, `${slug}.json`), JSON.stringify(report, null, 2) + '\n');
    leaderboard.push({ key, slug, name: displayName, ...ranking, qualifies: assessment.screen.qualifies });
  }

  // Most populated dimensions first; the harder rights-bearing dimensions as
  // the tiebreaker, since that's the evidence gap the research says matters
  // most; then raw evidence density.
  leaderboard.sort((a, b) =>
    b.populatedDimensions - a.populatedDimensions
    || b.rightsBearingPopulated - a.rightsBearingPopulated
    || b.totalClaims - a.totalClaims
  );

  writeFileSync(COVERAGE_JSON, JSON.stringify(leaderboard, null, 2) + '\n');
  writeFileSync(COVERAGE_MD, renderMarkdown(leaderboard));

  printTable(leaderboard);
  console.log(`\n${groups.size} product report(s) written to output/reports/`);
  console.log(`Leaderboard written to output/coverage-report.json and output/coverage-report.md`);
  if (violationCount) {
    console.error(`\n${violationCount} framework-rule violation(s) found — see above. Reports were still written; fix the source data or the conversion mapping.`);
    process.exitCode = 1;
  }
}

function renderMarkdown(rows) {
  const header = '| # | Product | Populated dims | Rights-bearing (of 2) | Claims | Sources | Qualifies |\n'
    + '|---|---|---|---|---|---|---|\n';
  const body = rows.map((r, i) =>
    `| ${i + 1} | ${r.name} | ${r.populatedDimensions}/5 | ${r.rightsBearingPopulated}/2 | `
    + `${r.totalClaims} | ${r.sources.join(', ')} | ${r.qualifies ? 'yes' : 'no'} |`
  ).join('\n');
  return `# Coverage leaderboard\n\nGenerated by \`node src/buildReports.js\`. "Populated" means Scored or `
    + `Inferred coverage — evidence exists, whether or not the product ultimately passes. Ranked by total `
    + `populated dimensions, then rights-bearing coverage (Planet + People & Supply Chain), then raw claim count.\n\n`
    + header + body + '\n';
}

function printTable(rows) {
  console.log('\nCoverage leaderboard — most independently checkable information first\n');
  const w = Math.max(...rows.map((r) => r.name.length), 20);
  console.log(`  ${'Product'.padEnd(w)}  Dims  Rights  Claims  Sources`);
  rows.forEach((r) => {
    console.log(
      `  ${r.name.padEnd(w)}  ${String(r.populatedDimensions + '/5').padEnd(4)}  `
      + `${String(r.rightsBearingPopulated + '/2').padEnd(6)}  ${String(r.totalClaims).padEnd(6)}  ${r.sources.join(', ')}`
    );
  });
}

main();
