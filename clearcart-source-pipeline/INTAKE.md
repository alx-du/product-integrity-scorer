# Intake & reports — adding products and finding out which ones are demo-ready

This is the input/output structure behind the "Demo version — no live APIs" flow: pre-cached
reports, generated ahead of time, that a report generator can read without calling any live
service. Two intake paths feed the same store; one script turns that store into ranked,
scored reports.

```
add a source ──┬── automated: data/sources.json + node run.js       ──┐
                └── manual: templates/product-intake.template.json  ──┤
                                                                       ▼
                                              output/products/*.json  (the store — already exists)
                                                                       │
                                                          npm run reports  (or: node src/buildReports.js)
                                                                       │
                                                                       ▼
                              output/reports/<slug>.json  ×N   +   output/coverage-report.{json,md}
                                        (pre-cached, engine-scored)      (which products are demo-ready)
```

## What's already there

Three sources, six products, already profiled and extracted — this is the reviewer data and
methodology from before; nothing here replaces it:

- `output/sources/` — one file per reviewer: their methodology, monetization, conflicts of
  interest, and which of the five dimensions they tend to cover
- `output/products/` — one file per product-per-source: individual claims, each typed by
  evidence kind (`tested` / `cited_third_party` / `brand_claim_repeated` / `anecdotal`), with
  every uncovered dimension recorded as an explicit gap rather than left blank

That format hasn't changed. What's new is a way to turn it into scored reports and to rank
products by how much evidence actually exists for them.

## Two ways to add a product

### 1. Automated — for anything the pipeline can fetch itself

Add an entry to `data/sources.json` (or a new source there) and run:

```bash
node run.js <slug>
```

This is the existing path — ordinary webpages, JS-rendered tables, and YouTube transcripts all
already work this way. Use it whenever a website you're pointing at is fetchable.

### 2. Manual — for a PDF, a paywalled page, a screenshot, or your own notes

Copy `templates/product-intake.template.json` into `output/products/`, name it
`<source-slug>--<product-slug>.json`, and fill it in. The template is the *same shape* the
automated path produces — same `status` values, same `evidence_kind` values, same
`attribution` block — so once it's saved, it is indistinguishable from an automated record.
Both `npm run preview` and the report builder below treat it identically.

**The one rule that matters more than any field:** don't write a score anywhere in this file.
Write claims and cite where they came from; the scoring engine turns that into a score later,
the same way for every product. A number typed into an intake file is a number nothing checked.

## Turning the store into reports

```bash
npm run reports
# or: node src/buildReports.js
```

This reads every file in `output/products/`, groups them by product (so a second source added
later for a product you already have *merges into* its existing report rather than competing
with it), and runs each one through **the real scoring engine** —
`extension/scoring/pillars.js`, imported directly, not reimplemented. Whatever gating and
coverage rules the extension and server use in production are exactly what generate these
reports. A report can't quietly drift from what the shipped code would say about the same
evidence, because it's the same code.

It writes:

- **`output/reports/<slug>.json`** — one fully scored report per product: five dimensions,
  each with `score`, `confidence`, `coverage`, the indicators behind it, and source
  attribution. This is the pre-cached report the demo's report generator reads from — see
  *Feeding the demo*, below.
- **`output/coverage-report.json`** and **`output/coverage-report.md`** — every product ranked
  by how much independently checkable information exists for it. This is *"find out what
  products have the most amount of information."*

### Reading the leaderboard

```
  Product                                        Dims  Rights  Claims  Sources
  Naturepedic EOS Classic Mattress               4/5   1/2     8       clarity-insight
  de Buyer Mineral B Pro Carbon Steel            3/5   1/2     6       clarity-insight
  AspenClean Laundry Powder + Booster            3/5   1/2     3       clarity-insight
  Made In Stainless Clad Frying Pan              3/5   0/2     8       prudent-reviews
  Schlage Encode Plus Smart Lock                 2/5   0/2     5       clarity-insight
  Feathered Friends Bavarian 850 Fill Comforter  1/5   0/2     1       fineas-jackson
```

- **Dims** — how many of the five dimensions have *any* independent evidence (Scored or
  Inferred coverage), out of 5. This is the primary sort key: more populated dimensions means a
  richer report.
- **Rights** — of those, how many are Planet or People & Supply Chain specifically, out of 2.
  This is the secondary sort key on purpose. The capstone's central finding is that these two
  dimensions are where evidence is scarcest — a product with 3/5 populated but 0/2 on rights is
  a *less* interesting demo pick than one with 3/5 and 1/2, even at the same raw dimension
  count, because it doesn't demonstrate the tool's actual differentiator.
- **Claims** — total evidence items across all dimensions, tiebreaker only.
- **Qualifies** (in the JSON/MD, not the terminal table) — whether the product clears the
  conjunctive pass screen on all five dimensions. Expect this to read `no` for almost
  everything, almost always. That is the correct result, not a bug — see below.

**None of the six current products "qualifies."** That's not a shortfall in this tooling; it's
the paper's own finding reproducing itself on new data. Don't chase a `yes` by cherry-picking
easy categories — a leaderboard full of `no` next to well-populated evidence is the honest
story this product tells.

### What a report actually contains

One dimension from a real generated report, unedited:

```json
"people": {
  "dimension": "people",
  "label": "People & Supply Chain",
  "score": null,
  "confidence": null,
  "coverage": "claimed",
  "passes": false,
  "note": "Only the seller's own material addresses this. Asks the enterprise to substantiate."
}
```

```json
"planet": {
  "dimension": "planet",
  "score": 3,
  "confidence": "medium",
  "coverage": "inferred",
  "note": "Acceptable"
}
```

Same product, same run. People & Supply Chain has one claim, but it's the seller's own
material — Claimed, no number. Planet has one claim from a third-party certification citation —
Inferred, capped at medium confidence, scores 3. The engine drew that distinction without being
told to; it's just what falls out of the evidence.

## Feeding the demo

The flowchart's "Report Generator" reading "Pre-cached product reports" is exactly
`output/reports/*.json`. For a resolved product name, the demo backend reads
`output/reports/<slug>.json` and renders it — no live API call, which is what "Demo version —
no live APIs" requires. The unresolved-string → confirmation → specific-product-name steps in
the flow are product resolution (`A1` in `BACKLOG.md`) sitting in front of this store; that part
still needs building, but the store and the report format it reads from now exist and are real.

## One placeholder, flagged rather than hidden

Every claim currently gates at anchor 3 — the pass threshold — never anywhere else on the 0–5
scale. `buildReports.js` explains why in a comment: there's no per-category indicator rubric
yet (`BACKLOG.md` item **D1** — what a 4 or a 5 actually *requires*, per product category), and
inventing finer-grained anchors here would fabricate precision the evidence doesn't support.
So today a dimension is 3 ("clears the bar") or 0 ("assessed and adverse") — a real, correctly
gated result, just a coarse one. **Coverage and confidence are not placeholders** — those come
straight from the real engine and are exactly as trustworthy as anything else it produces.
Once D1 exists, only `buildReports.js`'s `claimToFinding()` needs to change to assign real
anchors; nothing about the intake format or the store changes.

## A modeling question worth knowing about, not glossing over

A claim citing a third party (`cited_third_party`, tier 3) about the product *itself* currently
comes out as **Inferred**, not **Scored** — because `deriveCoverage()` in the engine only grants
Scored to tier 1–2 evidence. Strictly, the paper's own definition of Inferred is evidence that
reaches the good *through an assumption* (entity- or category-level), which isn't quite what's
happening when a tier-3 citation is about the specific product in hand. The confidence cap
(Medium) this produces is directionally right — citation-tier evidence shouldn't be treated like
independent lab testing — but the coverage *label* is a simplification the engine currently
makes, not a settled part of the specification. Worth a decision from Alex or the researcher
track before it's load-bearing anywhere more visible than an internal report.

## Adding your next batch of sources

For each new site or PDF you're about to bring in:

1. Fetchable webpage or YouTube video → add it to `data/sources.json`, run
   `node run.js <slug>`.
2. Anything else → copy `templates/product-intake.template.json`, fill it in, save to
   `output/products/`.
3. Run `npm run reports`.
4. Check `output/coverage-report.md` — that's your answer to "which of these is worth a full
   demo report."

Six products today; the same four steps get you to ten.
