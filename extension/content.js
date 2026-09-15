/**
 * content.js — ClearCart
 * Injected into supported retailer pages. Detects product cards and overlays
 * the five dimension assessments.
 *
 * Rendering rule (CAPSTONE.md §3.8): faithful display and honest display are
 * not the same thing. Two consequences are enforced here:
 *
 *   - An absence never renders like a bad score. Unknown and Claimed get their
 *     own neutral treatment and carry no number. Painting an absence red says
 *     "this product is bad" when the truth is "nobody will tell you".
 *   - Entity-level evidence is labelled as entity-level in the tooltip, so a
 *     finding about a parent company is never read as a finding about the good.
 *
 * Keep this file under 200 lines — logic belongs in scoring/.
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const SUPPORTED_RETAILERS = {
    'traderjoes.com': {
      productSelector: '[class*="Product_card"]',
      nameSelector: '[class*="Product_title"]'
    }
  };

  const API_BASE = 'http://localhost:3000'; // TODO: point at the deployed API

  const DIMENSIONS = [
    { key: 'planet', label: 'Planet', emoji: '🌱' },
    { key: 'people', label: 'People & Supply Chain', emoji: '🤝' },
    { key: 'quality', label: 'Quality', emoji: '⭐' },
    { key: 'value', label: 'Value', emoji: '💰' },
    { key: 'transparency', label: 'Transparency', emoji: '🔍' }
  ];

  // What each coverage state shows where a number would otherwise sit.
  // '?' and '—' are deliberately not digits: a glyph cannot be mistaken for a
  // low score, and cannot be averaged by anyone reading the page.
  const COVERAGE_GLYPH = { unknown: '?', claimed: '—' };

  const COVERAGE_EXPLAINER = {
    unknown: 'No source addresses this. The seller has not disclosed it.',
    claimed: 'Only the seller says so. No independent source verifies it.',
    inferred: 'Evidence reaches this product indirectly, at capped confidence.',
    scored: 'Independently evidenced for this product.'
  };

  // ─── Main ──────────────────────────────────────────────────────────────────
  function init() {
    const retailer = detectRetailer();
    if (!retailer) return;
    observeProductCards(retailer);
  }

  /**
   * Detect which retailer we're on
   * @returns {object|null} retailer config or null
   */
  function detectRetailer() {
    const hostname = window.location.hostname;
    for (const [domain, config] of Object.entries(SUPPORTED_RETAILERS)) {
      if (hostname.includes(domain)) return { domain, ...config };
    }
    return null;
  }

  /**
   * Watch for product cards appearing in the DOM (handles lazy loading)
   * @param {object} retailer - retailer config
   */
  function observeProductCards(retailer) {
    const observer = new MutationObserver(() => injectBadgesOnPage(retailer));
    observer.observe(document.body, { childList: true, subtree: true });
    injectBadgesOnPage(retailer); // initial pass
  }

  /**
   * Find all un-assessed product cards and inject badges
   * @param {object} retailer
   */
  function injectBadgesOnPage(retailer) {
    document.querySelectorAll(retailer.productSelector).forEach((card) => {
      if (card.dataset.ccAssessed) return;
      card.dataset.ccAssessed = 'pending';

      const productName = extractProductName(card, retailer);
      if (productName) {
        fetchAndInjectBadge(card, productName, extractProductUrl(card));
      }
    });
  }

  /**
   * @param {Element} card
   * @param {object} retailer
   * @returns {string|null}
   */
  function extractProductName(card, retailer) {
    const el = card.querySelector(retailer.nameSelector);
    return el ? el.textContent.trim() : null;
  }

  /**
   * @param {Element} card
   * @returns {string|null}
   */
  function extractProductUrl(card) {
    const link = card.querySelector('a[href]');
    return link ? link.href : null;
  }

  /**
   * Fetch the assessment and inject a badge onto the card
   * @param {Element} card
   * @param {string} productName
   * @param {string|null} productUrl
   */
  async function fetchAndInjectBadge(card, productName, productUrl) {
    try {
      const assessment = await fetchAssessment(productName, productUrl);
      if (!assessment || !assessment.dimensions) return;

      card.style.position = 'relative';
      card.appendChild(createBadge(assessment));
      card.dataset.ccAssessed = 'done';
    } catch (err) {
      console.warn('[ClearCart] Assessment failed for', productName, err);
      card.dataset.ccAssessed = 'error';
    }
  }

  /**
   * @param {string} productName
   * @param {string|null} productUrl
   * @returns {Promise<object|null>}
   */
  async function fetchAssessment(productName, productUrl) {
    const response = await fetch(`${API_BASE}/api/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, productUrl, retailer: 'traderjoes' })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Build the badge: one pill per dimension, no overall verdict.
   * @param {object} assessment - { dimensions, screen }
   * @returns {Element}
   */
  function createBadge(assessment) {
    const badge = document.createElement('div');
    badge.className = 'cc-badge';
    badge.setAttribute('aria-label', 'ClearCart assessment — five independent dimensions');

    DIMENSIONS.forEach(({ key, label, emoji }) => {
      badge.appendChild(createPill(assessment.dimensions[key], label, emoji));
    });

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openPanel', assessment });
    });

    return badge;
  }

  /**
   * One dimension pill. Carries a number only when evidence exists.
   * @param {object|undefined} dimension
   * @param {string} label
   * @param {string} emoji
   * @returns {Element}
   */
  function createPill(dimension, label, emoji) {
    const pill = document.createElement('span');
    const coverage = dimension ? dimension.coverage : 'unknown';
    const hasScore = dimension && dimension.score !== null && dimension.score !== undefined;

    // The modifier is the coverage state, never the score. CSS keys colour off
    // this, so an absence can never be styled as a failing grade.
    pill.className = `cc-pill cc-pill--${coverage}`;
    if (hasScore) pill.classList.add(dimension.passes ? 'cc-pill--pass' : 'cc-pill--below');

    const value = hasScore ? `${dimension.score}/5` : COVERAGE_GLYPH[coverage] || '?';
    pill.textContent = `${emoji} ${value}`;
    pill.title = buildTooltip(dimension, label, coverage, hasScore);

    return pill;
  }

  /**
   * @param {object|undefined} dimension
   * @param {string} label
   * @param {string} coverage
   * @param {boolean} hasScore
   * @returns {string}
   */
  function buildTooltip(dimension, label, coverage, hasScore) {
    const lines = [`${label} — ${coverage}`, COVERAGE_EXPLAINER[coverage]];

    if (hasScore) {
      lines.push(`Score ${dimension.score}/5 · ${dimension.confidence} confidence`);
    }
    // §6.1: evidence about a company is not evidence about a product, and has
    // to say so wherever it is shown.
    if (dimension && dimension.assumption) {
      lines.push(`Reaches this product by assumption: ${dimension.assumption}`);
    }

    return lines.join('\n');
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
