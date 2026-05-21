/**
 * content.js — Product Integrity Scorer
 * Injected into supported retailer pages (Trader Joe's, Amazon)
 * Detects product pages and overlays pillar score badges
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const SUPPORTED_RETAILERS = {
    'traderjoes.com': {
      productSelector: '[class*="Product_card"]',
      nameSelector: '[class*="Product_title"]',
      urlPattern: //products//
    }
  };

  const API_BASE = 'https://your-api.railway.app'; // replace with deployed URL

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
      if (hostname.includes(domain)) {
        return { domain, ...config };
      }
    }
    return null;
  }

  /**
   * Watch for product cards appearing in the DOM (handles lazy loading)
   * @param {object} retailer - retailer config
   */
  function observeProductCards(retailer) {
    const observer = new MutationObserver(() => {
      injectBadgesOnPage(retailer);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    injectBadgesOnPage(retailer); // initial pass
  }

  /**
   * Find all un-scored product cards and inject badges
   * @param {object} retailer
   */
  function injectBadgesOnPage(retailer) {
    const cards = document.querySelectorAll(retailer.productSelector);
    cards.forEach(card => {
      if (card.dataset.pisScored) return; // already processed
      card.dataset.pisScored = 'pending';

      const productName = extractProductName(card, retailer);
      const productUrl = extractProductUrl(card);

      if (productName) {
        fetchAndInjectBadge(card, productName, productUrl);
      }
    });
  }

  /**
   * Extract product name from a card element
   * @param {Element} card
   * @param {object} retailer
   * @returns {string|null}
   */
  function extractProductName(card, retailer) {
    const el = card.querySelector(retailer.nameSelector);
    return el ? el.textContent.trim() : null;
  }

  /**
   * Extract product URL from a card element
   * @param {Element} card
   * @returns {string|null}
   */
  function extractProductUrl(card) {
    const link = card.querySelector('a[href]');
    return link ? link.href : null;
  }

  /**
   * Fetch scores from API and inject badge onto card
   * @param {Element} card
   * @param {string} productName
   * @param {string|null} productUrl
   */
  async function fetchAndInjectBadge(card, productName, productUrl) {
    try {
      const scores = await fetchScores(productName, productUrl);
      if (scores) {
        const badge = createBadge(scores);
        card.style.position = 'relative';
        card.appendChild(badge);
        card.dataset.pisScored = 'done';
      }
    } catch (err) {
      console.warn('[PIS] Failed to fetch scores for', productName, err);
      card.dataset.pisScored = 'error';
    }
  }

  /**
   * Fetch pillar scores from the backend API
   * Checks cache first (7-day TTL in backend)
   * @param {string} productName
   * @param {string|null} productUrl
   * @returns {Promise<object|null>} pillar scores
   */
  async function fetchScores(productName, productUrl) {
    const response = await fetch(`${API_BASE}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, productUrl, retailer: 'traderjoes' })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Create the score badge element (5 pillar pills)
   * @param {object} scores - { planet, people, quality, value, transparency }
   * @returns {Element}
   */
  function createBadge(scores) {
    const badge = document.createElement('div');
    badge.className = 'pis-badge';
    badge.setAttribute('aria-label', 'Product Integrity Scores');

    const pillars = [
      { key: 'planet', label: 'Planet', emoji: '🌱' },
      { key: 'people', label: 'People', emoji: '🤝' },
      { key: 'quality', label: 'Quality', emoji: '⭐' },
      { key: 'value', label: 'Value', emoji: '💰' },
      { key: 'transparency', label: 'Transparency', emoji: '🔍' }
    ];

    pillars.forEach(({ key, label, emoji }) => {
      const score = scores[key];
      const pill = document.createElement('span');
      pill.className = `pis-pill pis-pill--${getScoreTier(score)}`;
      pill.title = `${label}: ${score}/100`;
      pill.textContent = `${emoji} ${score}`;
      badge.appendChild(pill);
    });

    // Click to open side panel
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'openPanel', scores });
    });

    return badge;
  }

  /**
   * Map score to tier for CSS color coding
   * @param {number} score
   * @returns {'high'|'mid'|'low'}
   */
  function getScoreTier(score) {
    if (score >= 70) return 'high';
    if (score >= 45) return 'mid';
    return 'low';
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
