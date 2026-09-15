# ClearCart — Vision

**Status:** working draft, v0.2 · **Owner:** Alex Du · **Last updated:** 14 September 2026
**Audience:** collaborators deciding whether to build this with me.

> This document is deliberately *ahead* of the repo. Everything in `/CAPSTONE.md`, `/Product_Assessment_Framework.html`, and `/clearcart-source-pipeline/` is research that is finished and defensible. This document is about the product that research says should exist — and that does not exist yet.

---

## 1. One paragraph

Somewhere upstream of almost everything you buy, there is a factory, a farm, a mine, and a set of working conditions. That information exists. Customs authorities have it, compliance vendors sell it, enforcement agencies act on it. It does not reach the one moment where money actually changes hands. **ClearCart is infrastructure for moving evidence to the point of purchase — and, when there is no evidence, for saying so out loud instead of guessing.** It ships as a browser extension that sits on a retailer's product page, but the extension is the smallest part. The product is an evidence pipeline, a public record of what is and isn't known about individual traded goods, and an open standard for scoring them without lying about confidence.

---

## 2. Where we actually are (read this before you pitch me anything)

| Asset | State | Where |
|---|---|---|
| Research thesis + audit of 6 goods | **Done.** ~78k words, defended, cited | [CAPSTONE.md](CAPSTONE.md) |
| 5-dimension framework, 12 product categories | **Done.** Reusable rubric | [Product_Assessment_Framework.html](Product_Assessment_Framework.html) |
| Evidence pipeline (creator reviews → typed claims) | **Working.** 3 sources, 6 goods | [clearcart-source-pipeline/](clearcart-source-pipeline/) |
| Commercial supply-chain retrieval (Sayari) | **Proven once.** 1 good, depth-3 traversal | [sayari-demo.html](sayari-demo.html) |
| Public site / explainers | **Done, static** | [index.html](index.html) |
| Chrome extension | **Scaffold. Assessment logic now to spec; still does not load** | [extension/](extension/) |
| Backend API | **Scaffold only. Never deployed.** | [server/](server/) |
| Database | **Schema to spec, never migrated** | [server/db/schema.prisma](server/db/schema.prisma) |
| Tests, CI, lint config | **None** | — |

**The honest summary: the paper shipped, the product didn't.** The original roadmap targeted MVP launch alongside the white paper in mid-August. The white paper landed. The extension is a directory of files that reference four other files that were never written.

That is not a failure state — it's the normal shape of research-first work, and it means the hard part (knowing what is true and what can be claimed) is behind us. What's left is engineering and design, which is why it's worth putting in front of a room of builders.

---

## 3. The finding that defines the product

This is the part most people get wrong when they first hear the pitch, so it's worth being blunt.

We audited six consumer goods across five dimensions, using the best sources a normal person could consult, plus a commercial supply-chain intelligence platform most companies can't afford. Result:

- **No source covered more than three of five dimensions.**
- **On the two dimensions that carry actual human rights weight — environment and labor — not one of the six goods had a single independently evidenced claim.** Not a bad score. *No evidence at all.*
- The commercial platform, run against the good deliberately chosen to favor it, covered two dimensions — and not the same two the public sources covered.
- The binding constraint isn't disclosure. The raw inputs are mostly public — securities filings, bills of lading, sanctions lists, the UFLPA Entity List. What's proprietary is **entity resolution**: turning 554 name candidates into one legal entity and walking the graph across tiers and jurisdictions.

**So the honest answer for most products, today, is "unknown."**

Every competitor resolves this by guessing — averaging a sustainability claim against a durability review against a brand's own PDF, and printing a single confident number. That number is the product category's original sin. It converts an absence of evidence into a middling score, which reads to a shopper as "eh, fine," when the truthful reading is "nobody will tell you."

**ClearCart's central product bet: a tool that says "we don't know, and here's exactly who isn't saying" is more useful, more defensible, and more interesting than a tool that makes something up.**

That bet is also the hardest design problem in the project, and it is unsolved. See §7, Track A.

---

## 4. Non-negotiables

These come out of the research. They are not stylistic preferences and they are not up for a vote at a hackathon. Anything built here has to hold all five.

1. **No composite score. Ever.** Five dimensions, reported separately. You may not average Planet against Value. They measure non-substitutable things and rest on evidence of wildly different quality.
2. **Absence is not a zero.** A dimension with no evidence returns **Unknown** — off the scale, not low on it. A zero means "we looked and it's bad." Those demand different responses from the company and must never render alike.
3. **A company's own claim is its own category.** Not evidence (that adopts the concealment), not nothing (a claim was made, and it can be held against them). It's **Claimed**, and it fails the screen.
4. **Confidence is reported, not baked in.** Confidence (High/Medium/Low) describes the independence of the source. It does not get multiplied into the score to produce one blended number.
5. **Faithful ≠ honest.** Compliance-grade data shown to a non-expert can imply harm it does not establish. "Tier-2 supplier appears in a network with a flagged entity" is a research lead, not an accusation. We hold things back on purpose, and entity-level evidence is labeled as entity-level. **An instrument that generates unfounded attribution creates an adverse impact of its own.**

---

## 5. The product, beyond the repo

Five bets. None are built. Roughly in order of how much they change the project.

### Bet 1 — The Unknown is the feature, not the failure

Turn the null result into the interaction. Every `Unknown` is, under UN Guiding Principle 21, a *communication failure by a named company* — a company that has not given anyone enough information to judge it. So name it:

> **People & Supply Chain — Unknown.** Trader Joe's does not disclose the producer for this item. Journalists identified it as Pete & Gerry's; the retailer has never confirmed it. **147 shoppers have asked them to.** → *Add your name*

This converts a dead end into a counter, a mechanic, and a mailing list. It also gives us something no competitor has: a ranked, public, per-product ledger of **what companies refuse to say**, growing by itself. That ledger is arguably a more durable asset than any score we could compute.

### Bet 2 — Product pages as public record, not just an overlay

The extension reaches people already shopping. A public, permanent, citable evidence record per good reaches everyone else: journalists, procurement officers, NGO researchers, students, and search engines. `clearcart.org/g/schlage-encode-plus` — every claim, its source, its evidence kind, its confidence ceiling, its date, and every explicit gap. Versioned, so you can cite it and it won't move under you.

This is the growth engine *and* the credibility engine, and it's a better fit for the underlying data than a popup is.

### Bet 3 — Public-infrastructure entity resolution

The moat and the bottleneck are the same thing: resolving names to entities and walking the supply graph. Sayari does it and charges for it. **We cannot redistribute a commercial vendor's data through a free consumer product** — so as long as the pipeline depends on one, the product cannot actually launch at scale. That constraint is not a footnote, it's the roadmap.

The open question — posed in the paper, untested: **how much of that resolution can be rebuilt from free public inputs?** If the answer is "a meaningful share," the story changes from *the data is locked behind a vendor* to *this is public infrastructure that nobody has bothered to build.* Bills of lading, SEC filings, sanctions and forced-labor lists, corporate registries. Fuzzy matching, graph traversal, confidence-scored joins.

This is the most technically ambitious thing here and the piece most likely to outlive the consumer product.

### Bet 4 — An open, forkable rubric with real coders behind it

Dimensions are fixed; indicators vary by category — an egg, a smart lock, and a shirt carry different risks. Twelve category rubrics exist as prose today. They should be **versioned open data that anyone can fork, and that we can be argued out of in public.**

Then close the loop the paper flags as its own weakness: nobody has independently applied the rubric, so replicability is unverified. Build second-coder review *into the product* — multiple coders score the same good, disagreements surface as data, inter-coder agreement gets published per category. Community contribution as the answer to an academic limitation, rather than a growth hack bolted on afterward.

### Bet 5 — The experiment nobody has run

The labeling literature compares *labels vs. no labels*. It has never tested whether **the architecture of disclosure** changes decisions — whether five separated, confidence-tiered dimensions produce different choices than one composite number. Nobody has run it because nobody had a working non-compensatory instrument to run it with.

We'd have one. Ship the extension with a consented A/B — composite view vs. dimensional view — and ClearCart becomes the apparatus for a genuinely novel study. That's a publication, a grant application, and a press story that isn't "here's another shopping app."

---

## 6. What "launch-ready" actually means

### Stage 0 — Make it true ✅ *done*

The code used to implement an **earlier, abandoned version of the framework**, and contradicted the paper on every point that mattered. That has been fixed:

| Was in code | Now |
|---|---|
| 0–100 scores | 0–5, with explicit anchors |
| `labor × 0.6 + sourcing × 0.4` | Gating — highest anchor whose evidence requirements are met; never averaging |
| Confidence multiplied into points (`×1.0 / ×0.6 / ×0.2`) | Confidence reported as its own axis |
| No way to express "Unknown" | Four coverage states: Scored / Inferred / Claimed / Unknown |
| `PillarScore.score` a non-null `Int` | `DimensionAssessment.score` nullable, with `coverage` alongside |
| The model asked to return a score per dimension | The model returns typed evidence; gating is deterministic |
| Every pilot product scored on every dimension | TJ's eggs retired to `data/legacy/`; the six audited goods are the pilot |

What remains from this stage: **the tests that keep it true.** There is no test suite, so nothing currently stops the next contributor from reintroducing an average. That is Track F.

### Stage 1 — Make it run

The extension does not currently load in Chrome. `manifest.json` references `background.js`, `content.css`, and `icons/` — none of which exist, so `popup.js` and the side panel have nothing behind them either. The README's setup instructions reference a `.env.example` that isn't there. There are no tests, no lint config, and no migrations. The pipeline is an untracked nested git repo that a collaborator can't cleanly check out.

None of this is hard. All of it is blocking.

### Stage 2 — Make it honest (the real design work)

Render four coverage states × three confidence tiers, on a crowded retail page, to someone who is not reading carefully — without implying an accusation and without being so hedged that it's useless. Nobody has solved this. It's Track A.

### Stage 3 — Make it defensible

Chrome Web Store review. A published rendering standard for what we will and won't say about a named company. Rate limits and cost ceilings on the scoring pipeline. A correction and right-of-reply process for companies. Retailer DOM changes breaking selectors silently — with monitoring so we find out before users do.

### Stage 4 — Make it spread

Public record pages, the disclosure-request ledger, the open rubric, the display experiment.

**Definition of "launched":** a person installs it, shops for something real, and sees an assessment they could defend in an argument — including, most of the time, an honest *"nobody will tell you, and here's who."*

---

## 7. Hackathon tracks — pick one

Each track is independently valuable. None blocks another. Everything you need to know for yours is in this doc plus one linked file — you do **not** need to read the thesis.

### Track A — "Unknown" as an interface *(design, front-end)*
**The hardest and most interesting problem here.** Design the rendering of four coverage states × three confidence tiers on a live retailer page. Constraints: it must never read as an accusation; it must never let absence look like a bad score; it must be legible in under two seconds.
**By end of day:** three competing static mockups on a real Trader Joe's or Amazon page, and an argument for which one you'd defend.
**Read:** §4 above.

### Track B — Make the extension real *(JS, Chrome)*
Get a Manifest V3 extension actually loading and rendering the six already-scored goods from the pipeline's output. Missing files, real selectors, real DOM injection, `MutationObserver` for infinite scroll.
**By end of day:** it loads unpacked and puts a correct badge on a real product page.
**Read:** [extension/](extension/), [clearcart-source-pipeline/output/](clearcart-source-pipeline/output/).

### Track C — Rebuild resolution from free sources *(data, Python/graph)*
Take one product. Try to reach its manufacturer and one upstream tier using only free public data — bills of lading, corporate registries, SEC filings, UFLPA/TVPRA lists. Compare against what the commercial retrieval returned.
**By end of day:** an honest percentage, and a written account of exactly where free data ran out.
**Read:** [sayari-demo.html](sayari-demo.html), §4.3 and Appendix B of [CAPSTONE.md](CAPSTONE.md).

### Track D — More sources into the pipeline *(JS, LLM plumbing)*
The pipeline reads a review source, profiles its methodology and monetization into a trust tier, types every claim by evidence kind, and records uncovered dimensions as explicit gaps. It handles three sources. Add more — or write a new adapter type (a certification body, a regulatory feed, a testing lab) into the same record format.
**By end of day:** two new sources ingested, gaps recorded, attribution intact.
**Read:** [clearcart-source-pipeline/README.md](clearcart-source-pipeline/README.md).

### Track E — The public record *(full-stack, SEO)*
Build `/g/<product>` — a permanent, citable, versioned evidence page per good, generated from pipeline output. Static generation is fine and probably correct.
**By end of day:** six live pages, one per audited good, that a journalist would cite.
**Read:** Bet 2 above, [clearcart-source-pipeline/output/products/](clearcart-source-pipeline/output/products/).

### Track F — Lock the engine down *(JS, careful thinking)*
[extension/scoring/pillars.js](extension/scoring/pillars.js) now implements the spec — 0–5, gating not averaging, coverage as a first-class state, confidence as its own axis. Nothing enforces it. Write the test suite that makes the non-negotiables in §4 mechanically impossible to break, and feed the six audited goods through the engine to check it reproduces Table 1 of the paper.
**By end of day:** a test that fails loudly if anyone ever averages two dimensions again, and a passing reproduction of Table 1.
**Read:** §6 above, §3.1 and §3.5 of [CAPSTONE.md](CAPSTONE.md).

---

## 8. Open decisions — I need to make these calls

Flagged honestly rather than papered over. If you have a strong view, that's a useful conversation to have.

1. **Public-interest infrastructure or venture?** The entity-resolution work (Bet 3) has a natural home as a public good, possibly grant-funded. The extension has a natural home as a product. These imply different licenses, different funders, and different governance. *Leaning: open-source the rubric, the record format, and the resolution layer; keep the consumer surface as the venture. Not yet decided.*
2. **Which surface launches first — extension or public record?** The extension is what the research describes and what the pitch promises. The record pages are cheaper, more durable, and reach more people. *Leaning: record pages first, extension second, and say so plainly.*
3. **How much do we depend on Sayari?** It works, it's proven, and it makes a free consumer product legally impossible at scale. The paper's own future-research agenda says test the free-source rebuild. *Leaning: treat commercial data as research-only until Track C returns a number.*
4. ~~**Do we score, or do we only show evidence?**~~ **Settled:** 0–5 with anchors, because a screen you can't sort is a screen nobody uses. The evidence-only version stays available as a fallback if Track A finds the numbers can't be rendered honestly. Also settled: the product is **ClearCart — Product Integrity Scorer**, ClearCart in running prose.
5. **Category focus.** Food is where the pilot data is. Cookware, electronics, and textiles are where the audit data is. *Leaning: follow the audit — those goods are already assessed.*

---

## 9. What could kill this

- **The honest answer is boring.** If the product says "unknown" for nine products out of ten, people uninstall it. Bet 1 exists to make that outcome *useful*, but it is a bet, and it is unproven.
- **Defamation and attribution risk.** We name companies in connection with labor risk. The rendering rule in §4.5 is the whole defense, and it is currently enforced by judgment rather than by code. It should be enforced by code.
- **Vendor dependency.** Covered above. A free product cannot redistribute paid intelligence.
- **Scraping fragility.** Retailer DOM changes break the overlay silently. Needs monitoring from day one, not day ninety.
- **Scope collapse into a shopping app.** The pull toward "just show a green badge" is enormous and comes from everyone, always. §4 exists to make that pull resistible.

---

## 10. Twenty-minute orientation

1. This document.
2. [clearcart-source-pipeline/README.md](clearcart-source-pipeline/README.md) — what the machine actually does today.
3. One record in [clearcart-source-pipeline/output/products/](clearcart-source-pipeline/output/products/) — what a typed, attributed, gap-marked claim looks like.
4. §3.1 and §4 of [CAPSTONE.md](CAPSTONE.md) — the framework specification and the findings. ~15 pages. Skip everything else unless you're on Track C or F.

---

*Questions, disagreements, or a track you want to claim: alex_x_du@outlook.com*
