// Local live preview: reads everything in output/ fresh on every request
// and renders it as a dashboard. No build step — add/edit files in
// output/sources or output/products, then refresh (the page also
// auto-refreshes itself every few seconds).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 5050;
const SOURCES_DIR = path.resolve("output/sources");
const PRODUCTS_DIR = path.resolve("output/products");

const PILLARS = [
  ["planet", "Planet"],
  ["people_supply_chain", "People & Supply Chain"],
  ["quality", "Quality"],
  ["value", "Value"],
  ["transparency", "Transparency"],
];

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch (e) {
        return { _parseError: `${f}: ${e.message}` };
      }
    });
}

function loadAll() {
  const sources = readJsonDir(SOURCES_DIR).sort((a, b) =>
    (a.source_name || "").localeCompare(b.source_name || "")
  );
  const products = readJsonDir(PRODUCTS_DIR);
  const productsBySlug = new Map();
  for (const p of products) {
    const key = p.source_slug || "_unknown";
    if (!productsBySlug.has(key)) productsBySlug.set(key, []);
    productsBySlug.get(key).push(p);
  }
  return { sources, productsBySlug };
}

function esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function badge(text, variant) {
  return `<span class="badge badge-${variant}">${esc(text)}</span>`;
}

function trustVariant(tier) {
  return { high: "good", medium: "mid", low: "bad" }[tier] || "neutral";
}
function coverageVariant(coverage) {
  return { strong: "good", partial: "mid", absent: "bad" }[coverage] || "neutral";
}
function statusVariant(status) {
  return { evidenced: "good", brand_claim_only: "mid", gap: "bad" }[status] || "neutral";
}
function confidenceVariant(confidence) {
  return { high: "good", medium: "mid", low: "neutral" }[confidence] || "neutral";
}
function evidenceVariant(kind) {
  return { tested: "good", cited_third_party: "mid", brand_claim_repeated: "mid", anecdotal: "neutral", none: "neutral" }[
    kind
  ] || "neutral";
}

function renderSourcePillarGrid(pillarCoverage) {
  if (!pillarCoverage) return "<p class='muted'>No pillar coverage data.</p>";
  return `<div class="pillar-grid">
    ${PILLARS.map(([key, label]) => {
      const p = pillarCoverage[key];
      if (!p) return `<div class="pillar-cell"><div class="pillar-label">${esc(label)}</div>${badge("n/a", "neutral")}</div>`;
      return `<div class="pillar-cell">
        <div class="pillar-label">${esc(label)}</div>
        ${badge(p.coverage, coverageVariant(p.coverage))}
        <div class="pillar-note">${esc(p.note)}</div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderClaim(c) {
  return `<li class="claim">
    <span class="claim-text">${esc(c.claim)}</span>
    ${badge(c.evidence_kind, evidenceVariant(c.evidence_kind))}
    ${badge(c.confidence, confidenceVariant(c.confidence))}
  </li>`;
}

function renderProductPillars(pillars) {
  if (!pillars) return "<p class='muted'>No pillar data.</p>";
  return `<div class="pillar-grid">
    ${PILLARS.map(([key, label]) => {
      const p = pillars[key];
      if (!p) return `<div class="pillar-cell"><div class="pillar-label">${esc(label)}</div>${badge("n/a", "neutral")}</div>`;
      return `<div class="pillar-cell">
        <div class="pillar-label">${esc(label)}</div>
        ${badge(p.status, statusVariant(p.status))}
        ${p.claims && p.claims.length ? `<ul class="claims">${p.claims.map(renderClaim).join("")}</ul>` : ""}
        ${p.gap_note ? `<div class="gap-note">${esc(p.gap_note)}</div>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function renderProduct(p) {
  return `<div class="product-card">
    <div class="product-header">
      <h3>${esc(p.product_name)}</h3>
      <div class="product-meta">${esc(p.brand)} &middot; ${esc(p.category)}</div>
    </div>
    <p class="verdict">${esc(p.reviewer_verdict)}</p>
    ${renderProductPillars(p.pillars)}
    ${
      p.notable_signals && p.notable_signals.length
        ? `<div class="signals"><div class="section-label">Notable signals</div><ul>${p.notable_signals
            .map((s) => `<li>${esc(s)}</li>`)
            .join("")}</ul></div>`
        : ""
    }
    <div class="attribution">
      Credit: ${esc(p.attribution?.reviewer)} &middot;
      <a href="${esc(p.attribution?.review_url)}" target="_blank" rel="noopener">source review</a>
    </div>
  </div>`;
}

function renderSource(src, products) {
  return `<section class="source-card">
    <header class="source-header">
      <h2>${esc(src.source_name)}</h2>
      <div class="badges">
        ${badge(`trust: ${src.trust_tier}`, trustVariant(src.trust_tier))}
        ${badge(src.evidence_type, "neutral")}
      </div>
    </header>
    <p class="methodology">${esc(src.methodology_summary)}</p>
    <div class="monetization">
      ${(src.monetization || []).map((m) => badge(m, "neutral")).join(" ")}
    </div>
    <p class="coi">${esc(src.conflict_of_interest_notes)}</p>
    ${renderSourcePillarGrid(src.pillar_coverage)}
    <details class="rationale">
      <summary>Trust tier rationale &amp; verifiability</summary>
      <p>${esc(src.trust_tier_rationale)}</p>
      <p>${esc(src.verifiability)}</p>
    </details>
    <div class="attribution">
      <a href="${esc(src.attribution?.url)}" target="_blank" rel="noopener">${esc(src.attribution?.name)}</a>
    </div>
    <div class="products-section">
      <div class="section-label">Products (${products.length})</div>
      ${products.length ? products.map(renderProduct).join("") : "<p class='muted'>No product records yet.</p>"}
    </div>
  </section>`;
}

const STYLE = `
:root {
  --bg: #f7f7f5; --card: #ffffff; --border: #e5e3de; --text: #1c1c1a; --muted: #6b6a66;
  --good-bg: #e3f5e6; --good-text: #1f7a3d;
  --mid-bg: #fdf1dc; --mid-text: #96650f;
  --bad-bg: #fbe7e7; --bad-text: #b3312c;
  --neutral-bg: #eeeeec; --neutral-text: #55534d;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16161a; --card: #201f24; --border: #33323a; --text: #eceae4; --muted: #a3a19a;
    --good-bg: #143d24; --good-text: #7fd99a;
    --mid-bg: #3d2f10; --mid-text: #e8b866;
    --bad-bg: #3d1918; --bad-text: #f19a96;
    --neutral-bg: #2b2a30; --neutral-text: #c2c0b8;
  }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
.page-header { max-width: 900px; margin: 0 auto 2rem; }
.page-header h1 { margin-bottom: 0.25rem; }
.page-header .sub { color: var(--muted); font-size: 0.9rem; }
main { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
.source-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
.source-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; }
.source-header h2 { margin: 0; }
.badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
.badge-good { background: var(--good-bg); color: var(--good-text); }
.badge-mid { background: var(--mid-bg); color: var(--mid-text); }
.badge-bad { background: var(--bad-bg); color: var(--bad-text); }
.badge-neutral { background: var(--neutral-bg); color: var(--neutral-text); }
.methodology { margin: 0.75rem 0; }
.monetization { margin-bottom: 0.5rem; }
.coi { font-size: 0.85rem; color: var(--muted); font-style: italic; }
.pillar-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
.pillar-cell { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; }
.pillar-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; color: var(--muted); margin-bottom: 0.35rem; }
.pillar-note, .gap-note { font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; }
.gap-note { color: var(--bad-text); }
.claims { list-style: none; margin: 0.4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.claim { font-size: 0.8rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.claim-text { display: block; width: 100%; }
.section-label { font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.02em; color: var(--muted); margin: 0.5rem 0; }
.rationale summary { cursor: pointer; font-size: 0.85rem; color: var(--muted); }
.rationale p { font-size: 0.85rem; }
.attribution { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }
.attribution a { color: inherit; }
.products-section { margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem; }
.product-card { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; }
.product-header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.4rem; }
.product-header h3 { margin: 0; }
.product-meta { font-size: 0.8rem; color: var(--muted); }
.verdict { font-size: 0.9rem; }
.signals ul { margin: 0.25rem 0 0; padding-left: 1.2rem; font-size: 0.85rem; }
.muted { color: var(--muted); font-size: 0.85rem; }
.empty-state { text-align: center; color: var(--muted); padding: 3rem 0; }
`;

function renderPage() {
  const { sources, productsBySlug } = loadAll();
  const body = sources.length
    ? sources.map((s) => renderSource(s, productsBySlug.get(s.slug) || [])).join("")
    : `<div class="empty-state">No sources in output/sources yet. Run <code>node run.js</code> or add records, then refresh.</div>`;

  const now = new Date().toLocaleTimeString();
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>ClearCart Source Pipeline — Preview</title>
<style>${STYLE}</style>
</head>
<body>
<div class="page-header">
  <h1>ClearCart Source Pipeline</h1>
  <div class="sub">Live from output/ &middot; last loaded ${esc(now)} &middot; auto-refreshes every 5s</div>
</div>
<main>${body}</main>
<script>setTimeout(() => location.reload(), 5000);</script>
</body>
</html>`;
}

http
  .createServer((req, res) => {
    if (req.url !== "/") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderPage());
  })
  .listen(PORT, () => {
    console.log(`Preview running at http://localhost:${PORT} (Ctrl+C to stop)`);
  });
