/**
 * server/index.js — ClearCart API
 *
 * Endpoints:
 *   POST /api/assess  - assess a product (checks cache first)
 *   GET  /api/health  - health check
 *
 * Stack: Node.js + Express + Prisma + Supabase PostgreSQL
 *
 * ── Why the model does not score ───────────────────────────────────────────
 * An earlier version of this file asked Claude to return a 0–100 number per
 * dimension. That is the failure mode the whole framework exists to reject:
 * a model asked for a score will always produce one, including for dimensions
 * where no evidence exists, and an invented number is indistinguishable from
 * an evidenced one once it reaches the page.
 *
 * So the division of labour here is strict:
 *
 *   The model  finds and types evidence. Per indicator it reports whether a
 *              source addresses it, what that source is, and what tier and
 *              scope the source has. It may answer "nothing addresses this",
 *              and that answer is a result, not a failure.
 *   The engine turns findings into a score, by the deterministic gating rules
 *              in extension/scoring/pillars.js. Coverage and confidence fall
 *              out of the sources; nothing is averaged; absence stays absent.
 *
 * This mirrors the pipeline's own property (CAPSTONE.md §4.5): it structures
 * and attributes what a source contains, it does not verify what a source
 * claims.
 */

'use strict';

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');

const scoring = require('../extension/scoring/pillars');

const app = express();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PORT = process.env.PORT || 3000;
const CACHE_TTL_DAYS = 7;

// Model is pinned by project convention (CLAUDE.md).
const MODEL = 'claude-sonnet-4-6';

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'chrome-extension://*',
    'http://localhost:*'
  ]
}));
app.use(express.json());

// ─── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/assess
 * Body: { productName: string, productUrl?: string, retailer: string }
 * Returns: {
 *   dimensions: { planet, people, quality, value, transparency },
 *   screen: { qualifies, failedOnEvidence, failedOnPerformance, reason },
 *   cached: boolean
 * }
 *
 * Each dimension carries { score: number|null, confidence, coverage, ... }.
 * There is no overall number in the response and there must never be one.
 */
app.post('/api/assess', async (req, res) => {
  const { productName, productUrl, retailer } = req.body;

  if (!productName || !retailer) {
    return res.status(400).json({ error: 'productName and retailer are required' });
  }

  try {
    // 1. Check cache (7-day TTL)
    const cached = await getCachedAssessment(productName, retailer);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // 2. Gather evidence, then gate it deterministically
    const findings = await gatherEvidence(productName, productUrl, retailer);
    const assessment = scoring.assessGood(findings);

    // 3. Refuse to serve anything that breaks the framework's own rules
    const violations = Object.values(assessment.dimensions)
      .flatMap((d) => scoring.validateAssessment(d));

    if (violations.length) {
      console.error('[API] Assessment violated framework rules:', violations);
      return res.status(500).json({ error: 'Assessment failed validation', violations });
    }

    // 4. Persist
    await persistAssessment(productName, productUrl, retailer, assessment);

    return res.json({ ...assessment, cached: false });

  } catch (err) {
    console.error('[API] Assessment error:', err);
    return res.status(500).json({ error: 'Assessment failed', details: err.message });
  }
});

// ─── Cache ─────────────────────────────────────────────────────────────────

/**
 * Return a cached assessment when all five dimensions are present and fresh.
 * @param {string} productName
 * @param {string} retailer
 * @returns {Promise<object|null>}
 */
async function getCachedAssessment(productName, retailer) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);

  const product = await prisma.product.findFirst({
    where: { name: { contains: productName }, retailer },
    include: {
      assessments: { where: { assessedAt: { gte: cutoff } } }
    }
  });

  if (!product || product.assessments.length < scoring.DIMENSION_KEYS.length) return null;

  const dimensions = {};
  product.assessments.forEach((a) => {
    dimensions[a.dimension] = {
      dimension: a.dimension,
      label: scoring.DIMENSIONS[a.dimension].label,
      rightsBearing: scoring.DIMENSIONS[a.dimension].rightsBearing,
      // Null score is meaningful and must survive the round trip intact.
      score: a.score,
      confidence: a.confidence,
      coverage: a.coverage,
      assumption: a.assumption,
      passes: a.score !== null && a.score >= scoring.PASS_THRESHOLD
    };
  });

  return { dimensions, screen: scoring.screenGood(dimensions) };
}

// ─── Evidence gathering ────────────────────────────────────────────────────

/**
 * Ask the model what evidence exists for each indicator. It returns findings,
 * never scores.
 *
 * @param {string} productName
 * @param {string} productUrl
 * @param {string} retailer
 * @returns {Promise<Object<string, object[]>>} indicators keyed by dimension
 */
async function gatherEvidence(productName, productUrl, retailer) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: EVIDENCE_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Product: "${productName}"\nRetailer: ${retailer}\nURL: ${productUrl || '(not supplied)'}`
    }]
  });

  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseFindings(text);
}

// The prompt's whole job is to make "nothing addresses this" an acceptable,
// expected answer. A model that feels obliged to fill every field is the
// mechanism by which absence silently becomes a number.
const EVIDENCE_SYSTEM_PROMPT = `You gather evidence for the ClearCart product assessment framework.

You do NOT score products. You report what evidence exists and where it came from.
A deterministic engine turns your findings into scores. If you invent a finding,
the engine will convert it into a score that looks exactly as credible as a real
one, so do not invent findings.

For each indicator you are given, report:
  met         true if a source establishes the requirement is satisfied,
              false if a source establishes it is NOT satisfied,
              null if no source addresses it at all.
  sourceTier  1 regulatory filing, enforcement record, or accredited third-party audit
              2 independent instrumented testing or peer-reviewed research
              3 journalism or NGO research
              4 trade press, aggregators, uncredentialed review
              5 the selling company's own material (its site, packaging, marketing)
              null if met is null
  sourceScope "good"     the source addresses this specific product
              "entity"   the source addresses the company, not the product
              "category" the source addresses the product category generally
  source      short name of the source
  sourceUrl   URL if you have one, otherwise null

Rules that matter more than completeness:

1. null is a correct and common answer. Most products have no independent
   evidence on environmental or labour conditions. Reporting null for those is
   accurate reporting, not a failure to search.
2. Never record a company's claim about itself as tier 1-4. A brand saying it
   is sustainable is tier 5, no matter how specific the claim.
3. Never upgrade scope. Evidence about a parent company is "entity", even when
   it is the only evidence you have about the product.
4. Do not guess a source. If you cannot name it, met is null.

Respond ONLY with valid JSON:
{
  "planet":       [{ "label": "...", "anchor": 3, "met": null, "sourceTier": null, "sourceScope": null, "source": null, "sourceUrl": null }],
  "people":       [...],
  "quality":      [...],
  "value":        [...],
  "transparency": [...]
}`;

/**
 * Parse the model's findings.
 *
 * Anything malformed becomes Unknown rather than being dropped or guessed at:
 * a parse failure is an absence of evidence, and the framework already has a
 * correct way to represent that.
 *
 * TODO: replace with structured outputs (output_config.format) so the shape is
 * enforced by the API rather than by this parser.
 *
 * @param {string} text
 * @returns {Object<string, object[]>}
 */
function parseFindings(text) {
  const empty = Object.fromEntries(scoring.DIMENSION_KEYS.map((k) => [k, []]));

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return empty;

    const parsed = JSON.parse(match[0]);
    const findings = {};

    for (const key of scoring.DIMENSION_KEYS) {
      findings[key] = Array.isArray(parsed[key]) ? parsed[key].map(normalizeFinding) : [];
    }
    return findings;

  } catch (err) {
    console.warn('[API] Could not parse findings, returning Unknown for all dimensions:', err.message);
    return empty;
  }
}

/**
 * Coerce one finding into the shape the engine expects, and enforce at the
 * ingestion boundary the two rules a model is most likely to bend.
 * @param {object} raw
 * @returns {object}
 */
function normalizeFinding(raw) {
  const met = raw.met === true || raw.met === false ? raw.met : null;

  // A finding with no source is not a finding.
  const sourceTier = met === null ? null : (Number.isInteger(raw.sourceTier) ? raw.sourceTier : null);

  return {
    label: String(raw.label || 'unlabelled indicator'),
    anchor: Number.isInteger(raw.anchor) ? raw.anchor : 3,
    met: sourceTier === null ? null : met,
    sourceTier,
    sourceScope: raw.sourceScope || null,
    source: raw.source || null,
    sourceUrl: raw.sourceUrl || null
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────

/**
 * @param {string} productName
 * @param {string} productUrl
 * @param {string} retailer
 * @param {{dimensions: object}} assessment
 */
async function persistAssessment(productName, productUrl, retailer, assessment) {
  const product = await prisma.product.upsert({
    where: { productUrl: productUrl || `${retailer}:${productName}` },
    update: { name: productName, updatedAt: new Date() },
    create: {
      name: productName,
      retailer,
      productUrl: productUrl || `${retailer}:${productName}`
    }
  });

  const assessedAt = new Date();

  await prisma.dimensionAssessment.createMany({
    data: Object.values(assessment.dimensions).map((d) => ({
      productId: product.id,
      dimension: d.dimension,
      score: d.score,           // null for claimed / unknown, by design
      confidence: d.confidence, // null wherever score is null
      coverage: d.coverage,
      assessedAt,
      assessedBy: 'pipeline'
    }))
  });

  // Absence is recorded, not skipped. This is what the disclosure ledger and
  // Table 1 of the paper are read from.
  const gaps = Object.values(assessment.dimensions)
    .filter((d) => d.coverage === scoring.COVERAGE.UNKNOWN || d.coverage === scoring.COVERAGE.CLAIMED)
    .map((d) => ({
      productId: product.id,
      dimension: d.dimension,
      needs: d.note,
      responsible: retailer
    }));

  if (gaps.length) await prisma.gap.createMany({ data: gaps });
}

// ─── Start ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ClearCart API running on port ${PORT}`);
  });
}

module.exports = app;
