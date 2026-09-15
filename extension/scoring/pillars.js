/**
 * pillars.js — ClearCart assessment engine
 *
 * Implements the framework specified in CAPSTONE.md §3.1 (framework
 * specification), §3.3 (source credibility and confidence tiering) and
 * §3.5 (aggregation and the qualification standard).
 *
 * Vocabulary: the paper says "dimension", the UI says "pillar". They are the
 * same five things. The code uses "dimension" to match the specification it
 * implements; "pillar" survives only in display strings and this filename.
 *
 * Each of the five dimensions yields THREE independent outputs. Folding them
 * into one number discards the distinctions the whole framework rests on:
 *
 *   1. score      0–5, or null. 0 means "assessed and adverse".
 *   2. confidence high | medium | low — the INDEPENDENCE of the verifying
 *                 source, not the strength of the finding.
 *   3. coverage   scored | inferred | claimed | unknown — whether the
 *                 dimension was assessable at all.
 *
 * Four rules are load-bearing. Breaking any of them breaks the paper's
 * central claim, so each is enforced in code rather than left to convention:
 *
 *   - No composite. Dimensions are never averaged, weighted or summed with
 *     one another. There is deliberately no function here that returns an
 *     overall number, and `assertNoComposite` exists to make the omission
 *     explicit to anyone tempted to add one.
 *   - Absence is not a zero. A dimension with no evidence returns coverage
 *     'unknown' and score `null` — off the scale, not low on it. A zero means
 *     evidence existed, someone examined it, and the good performs badly.
 *     Under the UNGPs these are separate failures (§3.1, "Absence is not a
 *     score"): a bad finding points to conduct requiring mitigation, an
 *     absence points to a communication failure under Principle 21.
 *   - Confidence is reported, never applied. It is returned alongside the
 *     score. It is never multiplied into it. A confidence-weighted number is
 *     a composite of evidence quality and performance wearing one hat.
 *   - Indicators gate, they do not average. A dimension score is the highest
 *     anchor whose evidentiary requirements are met. A strong secondary
 *     indicator does not substitute for a missing primary one.
 */

'use strict';

// ─── Coverage states (§3.1, "When coverage is adequate") ───────────────────
// Operational definitions. The boundaries here determine how many goods fail
// on coverage rather than on performance, so they are part of the spec.
const COVERAGE = {
  /** At least one tier 1 or tier 2 source addresses the dimension for the good itself. */
  SCORED: 'scored',
  /** Evidence at entity or category level reaches the good through a stated assumption, at capped confidence. */
  INFERRED: 'inferred',
  /** The only material addressing the dimension comes from the enterprise selling the good. */
  CLAIMED: 'claimed',
  /** No source addresses the dimension at any level. */
  UNKNOWN: 'unknown'
};

// Coverage states that carry a number. Claimed and Unknown carry none, so no
// average across dimensions can be calculated when either appears.
const NUMERIC_COVERAGE = [COVERAGE.SCORED, COVERAGE.INFERRED];

// ─── Confidence tiers (§3.3) ───────────────────────────────────────────────
// Reflects the independence of the verifying source, NOT the strength of the
// finding. A high-confidence 1 is a well-evidenced bad result.
const CONFIDENCE = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

// ─── Source tiers (§3.3) ───────────────────────────────────────────────────
// Tier determines how close a source sits to independent verification.
//   1  regulatory filing, enforcement record, accredited third-party audit
//   2  independent instrumented testing, peer-reviewed research
//   3  journalism, NGO research, third-party citation without primary access
//   4  trade press, aggregators, uncredentialed review
//   5  the selling enterprise's own material
const SOURCE_TIER = { REGULATORY: 1, INDEPENDENT_TEST: 2, JOURNALISM: 3, TRADE: 4, SELLER: 5 };

// Scope: what the evidence actually attaches to. This is the attribution
// problem of §6.1 made explicit at ingestion — evidence about a legal entity
// is not evidence about a good, and must be labelled as such downstream.
const SOURCE_SCOPE = { GOOD: 'good', ENTITY: 'entity', CATEGORY: 'category' };

// ─── The five dimensions (§3.1) ────────────────────────────────────────────
// The dimensions are fixed across every product category. The INDICATORS
// inside them vary by category — the risks attached to an egg, a smart lock
// and a shirt differ in kind, not just degree. Fixed dimensions keep goods
// comparable; variable indicators keep the measures relevant.
const DIMENSIONS = {
  planet: {
    label: 'Planet',
    // Rights-bearing per §2.1, working through the right to a clean, healthy
    // and sustainable environment.
    rightsBearing: true,
    description: 'Environmental impact across sourcing, land use, material throughput, packaging and emissions.'
  },
  people: {
    label: 'People & Supply Chain',
    rightsBearing: true,
    description: 'Labour conditions in production, and whether the origin of materials is disclosed at a level permitting assessment.'
  },
  quality: {
    label: 'Quality',
    rightsBearing: false,
    description: 'How the buyer\'s specification and price pressure shape conditions upstream. Durability as a denominator, not a virtue.'
  },
  value: {
    label: 'Value',
    rightsBearing: false,
    description: 'Where value accrues along the chain: living-wage consistency upstream, brand rent versus production inputs downstream.'
  },
  transparency: {
    label: 'Transparency',
    rightsBearing: false,
    description: 'Whether claims rest on evidence someone outside the company can check, and how specific that evidence is.'
  }
};

const DIMENSION_KEYS = Object.keys(DIMENSIONS);

// ─── The qualification standard (§3.1, §3.5) ───────────────────────────────
// 3.0 is the point the scale marks as acceptable. The screen is CONJUNCTIVE:
// a good must clear the threshold on every dimension independently. Strength
// on one dimension cannot compensate for failure on another, because the
// dimensions concern non-substitutable rights and interests.
const PASS_THRESHOLD = 3;

// Generic anchors, held constant across dimensions. Each product category
// illustrates what these require in practice — a 5 on labour in apparel needs
// third-party factory certification and a public supplier list; a 5 on
// ingredient transparency in personal care needs a full INCI list, allergen
// reporting and third-party verification.
const ANCHORS = {
  0: 'Assessed and adverse',
  1: 'Very poor',
  2: 'Poor',
  3: 'Acceptable',
  4: 'Strong',
  5: 'Best-in-class, independently verified'
};

// ═══════════════════════════════════════════════════════════════════════════
// Assessment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assess one dimension from its indicator set.
 *
 * An indicator describes one evidentiary requirement and what was found for
 * it. Indicators are declared per product category (see
 * Product_Assessment_Framework.html for the twelve category rubrics).
 *
 * @param {string} dimensionKey - one of DIMENSION_KEYS
 * @param {Array<{
 *   label: string,
 *   anchor: number,              // the 0–5 anchor this indicator gates
 *   met: boolean|null,           // true | false | null (nothing addresses it)
 *   sourceTier: number|null,     // SOURCE_TIER value backing the finding
 *   sourceScope: string|null,    // SOURCE_SCOPE value — what it attaches to
 *   source?: string,
 *   sourceUrl?: string,
 *   assumption?: string          // required when sourceScope is not GOOD
 * }>} indicators
 * @returns {{
 *   dimension: string,
 *   label: string,
 *   rightsBearing: boolean,
 *   score: number|null,
 *   confidence: string|null,
 *   coverage: string,
 *   passes: boolean,
 *   indicators: object[],
 *   note: string
 * }}
 */
function assessDimension(dimensionKey, indicators) {
  const dimension = DIMENSIONS[dimensionKey];
  if (!dimension) throw new Error(`Unknown dimension: ${dimensionKey}`);

  const declared = Array.isArray(indicators) ? indicators : [];

  // An indicator only contributes if something actually addressed it. An
  // indicator with met === null was never reached by any source, which is
  // different from having been checked and found absent.
  const addressed = declared.filter((i) => i.met !== null && i.met !== undefined);

  const coverage = deriveCoverage(addressed);

  // Claimed and Unknown carry no number. Returning early is what stops an
  // absence from being rendered as a low score anywhere downstream.
  if (!NUMERIC_COVERAGE.includes(coverage)) {
    return {
      dimension: dimensionKey,
      label: dimension.label,
      rightsBearing: dimension.rightsBearing,
      score: null,
      confidence: null,
      coverage,
      passes: false, // neither state satisfies the conjunctive screen
      indicators: declared,
      note: coverage === COVERAGE.CLAIMED
        ? 'Only the seller\'s own material addresses this. Asks the enterprise to substantiate.'
        : 'No source addresses this dimension at any level. Asks the enterprise to disclose.'
    };
  }

  const score = gateScore(addressed);
  const confidence = deriveConfidence(addressed, coverage);

  return {
    dimension: dimensionKey,
    label: dimension.label,
    rightsBearing: dimension.rightsBearing,
    score,
    confidence,
    coverage,
    passes: score >= PASS_THRESHOLD,
    indicators: declared,
    note: ANCHORS[score]
  };
}

/**
 * Determine the dimension score by gating, not averaging (§3.1).
 *
 * Walks the anchors upward from 1 and stops at the last level whose
 * requirements are fully met. A missing requirement at level 3 caps the
 * dimension at 2 no matter how many level-4 and level-5 indicators are
 * satisfied — which is the point. A strong secondary indicator does not
 * substitute for a missing primary one.
 *
 * Returns 0 when indicators were assessed and the good failed the lowest
 * anchor: assessed and adverse.
 *
 * @param {object[]} addressed - indicators that at least one source reached
 * @returns {number} 0–5
 */
function gateScore(addressed) {
  let attained = 0;

  for (let level = 1; level <= 5; level++) {
    const atLevel = addressed.filter((i) => i.anchor === level);

    // No indicator declared at this level: nothing to prove, carry on upward.
    // A category rubric that skips a level is saying that level adds no
    // requirement, not that the requirement is waived.
    if (atLevel.length === 0) continue;

    // Every requirement at this level must be met to reach it.
    if (!atLevel.every((i) => i.met === true)) break;

    attained = level;
  }

  return attained;
}

/**
 * Derive the coverage state from what the sources actually reached (§3.1).
 *
 * The boundary is set by source TIER and SCOPE, never by volume — a large
 * body of tier 4 material stays Inferred, so quantity cannot substitute for
 * proximity to the good.
 *
 * @param {object[]} addressed
 * @returns {string} COVERAGE value
 */
function deriveCoverage(addressed) {
  if (addressed.length === 0) return COVERAGE.UNKNOWN;

  const independent = addressed.filter((i) => i.sourceTier && i.sourceTier < SOURCE_TIER.SELLER);

  // Only the selling enterprise speaks to this. Kept apart from Unknown
  // because the two ask for different things, and kept apart from evidence
  // because counting a claim as evidence adopts the concealment (§2.3).
  if (independent.length === 0) return COVERAGE.CLAIMED;

  const scoredGrade = independent.some(
    (i) => i.sourceTier <= SOURCE_TIER.INDEPENDENT_TEST && i.sourceScope === SOURCE_SCOPE.GOOD
  );

  // Inferred is a coverage state, not a confidence tier. A dimension can be
  // Inferred at high confidence and still not be Scored — the evidence is
  // solid, it just reaches the good through a stated assumption (§6.1).
  return scoredGrade ? COVERAGE.SCORED : COVERAGE.INFERRED;
}

/**
 * Derive confidence from the independence of the sources carrying the score.
 *
 * Confidence is the weakest link among contributing sources rather than the
 * best available one: a dimension is only as checkable as its softest
 * load-bearing evidence.
 *
 * @param {object[]} addressed
 * @param {string} coverage
 * @returns {string} CONFIDENCE value
 */
function deriveConfidence(addressed, coverage) {
  const ranks = addressed
    .filter((i) => i.met === true && i.sourceTier)
    .map((i) => confidenceForTier(i.sourceTier));

  let confidence = ranks.length
    ? ranks.reduce((weakest, c) => (CONFIDENCE_RANK[c] < CONFIDENCE_RANK[weakest] ? c : weakest))
    : CONFIDENCE.LOW;

  // Evidence that reaches the good through an assumption is capped at Medium
  // regardless of how good the underlying source is (§3.1). Relationship
  // evidence across tiers is not conduct evidence about the good.
  if (coverage === COVERAGE.INFERRED && confidence === CONFIDENCE.HIGH) {
    confidence = CONFIDENCE.MEDIUM;
  }

  return confidence;
}

/**
 * Map a source tier to the confidence it can support (§3.3).
 * @param {number} tier
 * @returns {string} CONFIDENCE value
 */
function confidenceForTier(tier) {
  if (tier <= SOURCE_TIER.INDEPENDENT_TEST) return CONFIDENCE.HIGH;
  if (tier === SOURCE_TIER.JOURNALISM) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

// ═══════════════════════════════════════════════════════════════════════════
// Whole-good assessment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assess a good across all five dimensions.
 *
 * Returns five independent assessments and a conjunctive screen result. It
 * deliberately does NOT return an overall score — see `assertNoComposite`.
 *
 * @param {Object<string, object[]>} indicatorsByDimension
 * @returns {{ dimensions: Object<string, object>, screen: object }}
 */
function assessGood(indicatorsByDimension = {}) {
  const dimensions = {};

  for (const key of DIMENSION_KEYS) {
    dimensions[key] = assessDimension(key, indicatorsByDimension[key] || []);
  }

  return { dimensions, screen: screenGood(dimensions) };
}

/**
 * Apply the conjunctive screen (§3.1, §3.5).
 *
 * A good qualifies only by clearing the threshold on EVERY dimension. Failure
 * is reported with its reason, because failing on evidence and failing on
 * performance are different findings and the framework exists to tell them
 * apart. In the audit of §4, every good failed on evidence — none was
 * disqualified for how it performed.
 *
 * @param {Object<string, object>} dimensions
 * @returns {{ qualifies: boolean, failedOnEvidence: string[], failedOnPerformance: string[], reason: string }}
 */
function screenGood(dimensions) {
  const failedOnEvidence = [];
  const failedOnPerformance = [];

  for (const key of DIMENSION_KEYS) {
    const d = dimensions[key];
    if (!NUMERIC_COVERAGE.includes(d.coverage)) {
      failedOnEvidence.push(key);
    } else if (d.score < PASS_THRESHOLD) {
      failedOnPerformance.push(key);
    }
  }

  const qualifies = failedOnEvidence.length === 0 && failedOnPerformance.length === 0;

  let reason;
  if (qualifies) {
    reason = 'Clears the threshold on all five dimensions.';
  } else if (failedOnEvidence.length && !failedOnPerformance.length) {
    reason = 'Fails on evidence, not on performance. Nothing establishes how this good performs on '
      + failedOnEvidence.map((k) => DIMENSIONS[k].label).join(', ') + '.';
  } else if (failedOnPerformance.length && !failedOnEvidence.length) {
    reason = 'Assessed below threshold on '
      + failedOnPerformance.map((k) => DIMENSIONS[k].label).join(', ') + '.';
  } else {
    reason = 'Fails on evidence for '
      + failedOnEvidence.map((k) => DIMENSIONS[k].label).join(', ')
      + '; assessed below threshold on '
      + failedOnPerformance.map((k) => DIMENSIONS[k].label).join(', ') + '.';
  }

  return { qualifies, failedOnEvidence, failedOnPerformance, reason };
}

// ═══════════════════════════════════════════════════════════════════════════
// Guards
// ═══════════════════════════════════════════════════════════════════════════

/**
 * There is no overall score, and this function is why.
 *
 * Every dimension rests on different sources of different quality. A
 * composite rolls them into one number and hides the unevenness (P3). It also
 * lets a strong commercial dimension mask an unevidenced rights dimension,
 * which is the exact failure mode the framework was built to prevent.
 *
 * Beyond the argument of principle, the composite is arithmetically
 * unavailable in practice: Claimed and Unknown carry no number, and in the
 * audit of §4 at least one rights-bearing dimension sat in one of those states
 * for every good assessed.
 *
 * Call this from any code path that looks like it is about to aggregate.
 *
 * @throws {Error} always
 */
function assertNoComposite() {
  throw new Error(
    'ClearCart does not compute a composite score. Dimensions rest on '
    + 'different evidence of different quality and are reported independently '
    + '(CAPSTONE.md §3.5). Use screenGood() for a conjunctive pass/fail.'
  );
}

/**
 * Validate an assessment against the framework's load-bearing rules.
 *
 * Intended for tests and for the ingestion boundary, so a malformed record
 * fails loudly at the edge instead of rendering as a plausible number.
 *
 * @param {object} assessment - output of assessDimension
 * @returns {string[]} violations, empty when valid
 */
function validateAssessment(assessment) {
  const violations = [];
  const { score, coverage, confidence, dimension } = assessment;

  if (!Object.values(COVERAGE).includes(coverage)) {
    violations.push(`${dimension}: unrecognised coverage state "${coverage}"`);
  }

  if (!NUMERIC_COVERAGE.includes(coverage) && score !== null) {
    violations.push(
      `${dimension}: coverage is "${coverage}" but carries score ${score}. `
      + 'Absence is not a score.'
    );
  }

  if (NUMERIC_COVERAGE.includes(coverage)) {
    if (!Number.isInteger(score) || score < 0 || score > 5) {
      violations.push(`${dimension}: score must be an integer 0–5, got ${score}`);
    }
    if (!Object.values(CONFIDENCE).includes(confidence)) {
      violations.push(`${dimension}: scored dimension must carry a confidence tier`);
    }
  }

  if (coverage === COVERAGE.INFERRED && confidence === CONFIDENCE.HIGH) {
    violations.push(`${dimension}: inferred evidence is capped at medium confidence`);
  }

  return violations;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

const ClearCartScoring = {
  COVERAGE,
  CONFIDENCE,
  SOURCE_TIER,
  SOURCE_SCOPE,
  DIMENSIONS,
  DIMENSION_KEYS,
  ANCHORS,
  PASS_THRESHOLD,
  assessDimension,
  assessGood,
  screenGood,
  gateScore,
  deriveCoverage,
  deriveConfidence,
  validateAssessment,
  assertNoComposite
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClearCartScoring;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ClearCartScoring = ClearCartScoring;
}
