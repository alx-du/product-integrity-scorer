/**
 * pillars.js — Scoring logic for the 5 independent display pillars
 *
 * Architecture:
 *   5 front-end pillars (what users see) → 8 back-end categories
 *   Each pillar score is INDEPENDENT — no composite/weighted average
 *
 * Pillars:
 *   🌱 Planet        ← Environmental Sustainability
 *   🤝 People        ← Labor & Ethical Sourcing + Sourcing Transparency
 *   ⭐ Quality       ← Product Quality & Durability
 *   💰 Value         ← Pricing Fairness + Corporate Ownership
 *   🔍 Transparency  ← Claim Credibility + Consumer Education
 */

'use strict';

// ─── Confidence weights ────────────────────────────────────────────────────
// Evidence quality modifies indicator scores
const CONFIDENCE_MULTIPLIER = {
  high: 1.0,   // independently verified (3rd party cert, regulatory filing)
  medium: 0.6, // brand claim with supporting evidence
  low: 0.2     // inferred or unverifiable
};

/**
 * Score a single indicator
 * @param {number} basePoints - max points this indicator is worth
 * @param {'high'|'medium'|'low'} confidence
 * @param {boolean} present - whether the indicator is present/true
 * @returns {number} actual points earned
 */
function scoreIndicator(basePoints, confidence, present) {
  if (!present) return 0;
  return Math.round(basePoints * CONFIDENCE_MULTIPLIER[confidence]);
}

// ─── Planet pillar ─────────────────────────────────────────────────────────
/**
 * Environmental Sustainability score (0-100)
 * @param {object} product - product data object
 * @returns {{ score: number, indicators: object[], confidence: string }}
 */
function scorePlanet(product) {
  const indicators = [];
  let total = 0;
  let maxTotal = 0;

  const checks = [
    { label: 'Organic certification', points: 30, confidence: 'high',
      present: !!product.certifications?.includes('USDA Organic'), source: 'USDA' },
    { label: 'Pasture-raised / high welfare land use', points: 25, confidence: product.pastureRaisedVerified ? 'high' : 'medium',
      present: !!product.pastureRaised, source: product.pastureRaisedVerified ? 'Certified Humane' : 'Brand claim' },
    { label: 'No synthetic pesticides claim', points: 20, confidence: 'medium',
      present: !!product.noSyntheticPesticides, source: 'Brand claim' },
    { label: 'Carbon footprint disclosure', points: 15, confidence: 'high',
      present: !!product.carbonDisclosure, source: product.carbonSource || 'Brand' },
    { label: 'Recyclable / minimal packaging', points: 10, confidence: 'medium',
      present: !!product.sustainablePackaging, source: 'Brand claim' }
  ];

  checks.forEach(c => {
    maxTotal += c.points;
    const earned = scoreIndicator(c.points, c.confidence, c.present);
    total += earned;
    indicators.push({ ...c, earned });
  });

  return {
    score: Math.round((total / maxTotal) * 100),
    indicators,
    confidence: computeOverallConfidence(indicators)
  };
}

// ─── People pillar ─────────────────────────────────────────────────────────
/**
 * People & Supply Chain score (0-100)
 * Combines Labor & Ethical Sourcing (60%) + Sourcing Transparency (40%)
 * @param {object} product
 * @returns {{ score: number, labor: object, sourcing: object }}
 */
function scorePeople(product) {
  const labor = scoreLaborEthics(product);
  const sourcing = scoreSourcingTransparency(product);

  // Weighted within pillar: Labor 60%, Sourcing 40%
  const combined = Math.round((labor.score * 0.6) + (sourcing.score * 0.4));

  return {
    score: combined,
    labor,
    sourcing
  };
}

function scoreLaborEthics(product) {
  const indicators = [];
  let total = 0;
  let maxTotal = 0;

  const checks = [
    { label: 'Fair Trade certified', points: 35, confidence: 'high',
      present: !!product.certifications?.includes('Fairtrade'), source: 'Fairtrade Int'l' },
    { label: 'Certified Humane / welfare standard', points: 25, confidence: 'high',
      present: !!product.certifications?.includes('Certified Humane'), source: 'HFAC' },
    { label: 'Living wage commitment', points: 25, confidence: 'medium',
      present: !!product.livingWageClaim, source: 'Brand claim' },
    { label: 'B Corp certification', points: 15, confidence: 'high',
      present: !!product.certifications?.includes('B Corp'), source: 'B Lab' }
  ];

  checks.forEach(c => {
    maxTotal += c.points;
    const earned = scoreIndicator(c.points, c.confidence, c.present);
    total += earned;
    indicators.push({ ...c, earned });
  });

  return { score: Math.round((total / maxTotal) * 100), indicators };
}

function scoreSourcingTransparency(product) {
  const indicators = [];
  let total = 0;
  let maxTotal = 0;

  const checks = [
    { label: 'Farm / country of origin disclosed', points: 40, confidence: 'high',
      present: !!product.originDisclosed, source: product.originSource || 'Brand' },
    { label: 'Named supplier / farm published', points: 35, confidence: 'high',
      present: !!product.namedSupplier, source: product.supplierSource || 'Brand' },
    { label: 'Ingredient traceability info available', points: 25, confidence: 'medium',
      present: !!product.traceability, source: 'Brand claim' }
  ];

  checks.forEach(c => {
    maxTotal += c.points;
    const earned = scoreIndicator(c.points, c.confidence, c.present);
    total += earned;
    indicators.push({ ...c, earned });
  });

  return { score: Math.round((total / maxTotal) * 100), indicators };
}

// ─── Quality pillar ────────────────────────────────────────────────────────
/**
 * Product Quality & Durability score (0-100)
 * @param {object} product
 */
function scoreQuality(product) {
  const indicators = [];
  let total = 0;
  let maxTotal = 0;

  const checks = [
    { label: 'Grade A / premium product tier', points: 30, confidence: 'high',
      present: !!product.premiumGrade, source: 'USDA Grade' },
    { label: 'No artificial additives', points: 25, confidence: product.noAdditivesVerified ? 'high' : 'medium',
      present: !!product.noArtificialAdditives, source: 'Label' },
    { label: 'Non-GMO certified', points: 25, confidence: 'high',
      present: !!product.certifications?.includes('Non-GMO Project'), source: 'Non-GMO Project' },
    { label: 'Customer rating >= 4/5', points: 20, confidence: 'medium',
      present: (product.avgRating || 0) >= 4, source: 'Retailer reviews' }
  ];

  checks.forEach(c => {
    maxTotal += c.points;
    const earned = scoreIndicator(c.points, c.confidence, c.present);
    total += earned;
    indicators.push({ ...c, earned });
  });

  return {
    score: Math.round((total / maxTotal) * 100),
    indicators,
    confidence: computeOverallConfidence(indicators)
  };
}

// ─── Value pillar ──────────────────────────────────────────────────────────
/**
 * Value score: Pricing Fairness + Corporate Ownership (0-100)
 * @param {object} product
 */
function scoreValue(product) {
  const indicators = [];
  let total = 0;
  let maxTotal = 0;

  const checks = [
    { label: 'Price competitive vs. comparable products', points: 35, confidence: 'medium',
      present: product.pricePercentile !== undefined ? product.pricePercentile <= 50 : false,
      source: 'Market comparison' },
    { label: 'Independent brand (not PE-owned conglomerate)', points: 35, confidence: 'high',
      present: !!product.independentBrand, source: 'Corporate filings' },
    { label: 'Price per unit disclosed', points: 30, confidence: 'high',
      present: !!product.pricePerUnit, source: 'Retailer listing' }
  ];

  checks.forEach(c => {
    maxTotal += c.points;
    const earned = scoreIndicator(c.points, c.confidence, c.present);
    total += earned;
    indicators.push({ ...c, earned });
  });

  return {
    score: Math.round((total / maxTotal) * 100),
    indicators,
    confidence: computeOverallConfidence(indicators)
  };
}

// ─── Transparency pillar ───────────────────────────────────────────────────
/**
 * Transparency score: Claim Credibility + Consumer Education (0-100)
 * @param {object} product
 */
function scoreTransparency(product) {
  const indicators = [];
  let total = 0;
  let maxTotal = 0;

  const checks = [
    { label: 'Claims backed by 3rd party certification', points: 40, confidence: 'high',
      present: (product.certifications || []).length > 0, source: 'Cert bodies' },
    { label: 'No greenwashing flags detected', points: 30, confidence: 'medium',
      present: !product.greenwashingFlags, source: 'FTC/analysis' },
    { label: 'Full ingredient / sourcing list available', points: 30, confidence: 'high',
      present: !!product.fullIngredientList, source: 'Label / brand site' }
  ];

  checks.forEach(c => {
    maxTotal += c.points;
    const earned = scoreIndicator(c.points, c.confidence, c.present);
    total += earned;
    indicators.push({ ...c, earned });
  });

  return {
    score: Math.round((total / maxTotal) * 100),
    indicators,
    confidence: computeOverallConfidence(indicators)
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
/**
 * Derive overall confidence from a set of indicators
 * @param {object[]} indicators
 * @returns {'high'|'medium'|'low'}
 */
function computeOverallConfidence(indicators) {
  const confidenceCounts = { high: 0, medium: 0, low: 0 };
  indicators.forEach(i => { if (i.confidence) confidenceCounts[i.confidence]++; });
  if (confidenceCounts.high >= indicators.length * 0.6) return 'high';
  if (confidenceCounts.low >= indicators.length * 0.6) return 'low';
  return 'medium';
}

/**
 * Score all 5 pillars for a product
 * @param {object} product
 * @returns {{ planet, people, quality, value, transparency }}
 */
function scoreAllPillars(product) {
  return {
    planet: scorePlanet(product),
    people: scorePeople(product),
    quality: scoreQuality(product),
    value: scoreValue(product),
    transparency: scoreTransparency(product)
  };
}

// Export for Node.js (server) and browser (via bundler or import)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scoreAllPillars, scorePlanet, scorePeople, scoreQuality, scoreValue, scoreTransparency };
}
