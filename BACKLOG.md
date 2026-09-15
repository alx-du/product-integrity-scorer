# ClearCart — Team Backlog

**Goal:** a working product we can demo live.
**Team:** 3 engineers · 2–3 UX/strategy · 1 researcher · Alex (product + framework)
**Status:** draft v1 · 15 September 2026

> Assumes a **3-sprint runway**. If the date is tighter, §9 has the cut line. Companion docs: [VISION.md](VISION.md) for why this exists, [CAPSTONE.md](CAPSTONE.md) for the specification.

---

## 1. Read this first — the product just changed shape

The team notes describe a **different surface** than the repo has been building, and the notes are right.

| | Repo has been building | Notes describe |
|---|---|---|
| Surface | Browser extension overlaying retailer pages | **Web app. You type a product name, an agent answers.** |
| Extension | The MVP | Tier 2, "nice to have" |
| Interaction | Passive badge on a product card | Conversational — "Let's look at a product together" |

**Adopt the notes' ordering.** Not just because the team wrote them, but because the web-first surface is a better fit for what our research actually found.

Here is why that matters more than it sounds. Our audit of six goods found that for most products there is **no independent evidence at all** on Planet and People & Supply Chain. A badge crammed onto a retailer's product card has roughly forty pixels to explain "nobody will tell you, and here is who isn't saying." A conversational surface has a paragraph. **The honest answer needs room, and the chat UI is the one that has it.** The extension was the harder surface for our hardest problem.

This also settles the open question in [VISION.md §8.2](VISION.md). Web app first. Extension after.

---

## 2. Two corrections to the notes and the mockup

Both are small to fix now and expensive to fix after the design is built.

### 2.1 The mockup shows a composite score. It has to go.

Kai's Frame 2 renders the iPhone card with `Overall Composite Score: ~0.71`, and gives all five pillars a star rating. Both are pulled from [iphone15pro-analysis.html](iphone15pro-analysis.html), which predates the framework and averages eleven dimensions — including a Geekbench score and an NPS figure — into one number.

We removed that model from the codebase two weeks ago. It cannot come back through the design.

- **No composite.** There is no overall number, no "0.71", no single verdict line. Five dimensions, reported separately. The engine has no function that returns one, and [`assertNoComposite()`](extension/scoring/pillars.js) throws if anyone tries.
- **Stars can't show absence.** Five stars have six states (0–5). Our scale has **ten**: six scores, plus Claimed, plus Unknown, each of which carries *no number at all*. If the demo shows ★★ on Planet for a product where nothing has been established, we are fabricating — on stage, in a product whose entire pitch is that it doesn't fabricate.

This is the single highest-risk item in the whole plan and it is a design problem, not an engineering one. It is **C1**, and it starts day one.

### 2.2 Value is not "similar to quality"

The notes ask "Value (Similar to quality maybe?)". Understandable, but no — and the difference is load-bearing for the research.

**Value is not whether the buyer got a good deal.** It is **where the money goes**: upstream, whether the price paid is consistent with a living wage; downstream, how much of the price is production and craftsmanship versus brand rent and marketing. A $900 phone and a $90 phone can both score well or badly. Asking "did the purchaser transact favourably" is a welfare claim about one party to a sale, and no rights claim follows from it.

[CAPSTONE.md §3.9 and Appendix C](CAPSTONE.md) carry the full argument. Researcher owns propagating this into the indicator sets (**D1**).

---

## 3. What "ready to present" means

A live demo, on a real product, that a hostile expert in the room cannot take apart.

**The bar:** someone types a product we did not pre-load. The agent returns five dimensions. At least two say **Unknown** — and the room understands that as the product's most interesting finding, not as our tool failing.

That last clause is the whole thing. Any competent team can demo five green checkmarks. Nobody else can demo an honest "we don't know, and here's the named company that won't say."

Three things must be true:
1. **It works on unseen input.** A hardcoded demo path gets caught in Q&A.
2. **Every claim is clickable to a source.** "View Sources & Explanations" opens and shows real URLs.
3. **Unknown reads as informative, not broken.** See C1.

---

## 4. Who owns what

| Role | Owns | Success = |
|---|---|---|
| **SWE-1** — Evidence & assessment | Resolution, orchestration, assessment API, cache | An unseen product name returns a correct, sourced, gated assessment |
| **SWE-2** — Web app | Chat shell, result card, disclosure layers, history | The mockup, working, on real data |
| **SWE-3** — Data & infrastructure | Record format, adapters, store, eval harness, telemetry | Anyone can add a new evidence source without touching the engine |
| **UX-1** — Evidence rendering | The four coverage states × three confidence tiers | Unknown reads as a finding, and never as an accusation or a bad score |
| **UX-2** — Conversational IA | Flow, agent voice, progressive disclosure, sidebar | A non-expert gets it in ten seconds; a journalist can get to sources in three clicks |
| **UX-3** *(if we have one)* | Design system, deck, demo polish | One visual language across app, site, and slides |
| **Researcher** | Indicator sets, source tiers, hand-assessed demo corpus | 15 products assessed to spec, every claim traceable |
| **Alex** | Framework, narrative, spec decisions, demo | Nothing ships that contradicts the paper |

Small team, so pair the boundaries: **UX-1 + SWE-2** ship the card together, **Researcher + SWE-1** shape the evidence contract together.

---

## 5. The backlog

`P0` = demo cannot happen without it · `P1` = demo is materially better with it · `P2` = after.

### Workstream A — Evidence & assessment · *SWE-1, Researcher*

| ID | Item | P | Notes |
|---|---|---|---|
| A1 | **Product resolution.** Free-text name → canonical product, brand, category | P0 | The notes' MVP is "user enters the name." Typos, generic names ("olive oil"), and brand-only inputs all have to land somewhere. Start with fuzzy match over the demo catalog + a clarifying question when ambiguous |
| A2 | **Assessment API.** `POST /api/assess` → five dimensions with score, confidence, coverage, sources | P0 | Engine exists in [pillars.js](extension/scoring/pillars.js); wrap it, don't rewrite it |
| A3 | **Evidence orchestration.** Tavily search → typed findings → deterministic gating | P0 | The model finds and types evidence; **it never produces a score.** That split is already built in [server/index.js](server/index.js) — preserve it |
| A4 | **Golden-set eval.** The six audited goods must reproduce Table 1 of the paper | P0 | Regression guard. Runs on every engine change. Cheap now, impossible to retrofit trust later |
| A5 | **Cache + freshness.** 7-day TTL, provenance preserved on read | P0 | Demo can't wait 40s for a cold lookup |
| A6 | **Clarifying-question path.** Agent asks when a name is ambiguous instead of guessing | P1 | Notes' tier 2: "recommend brand names if the user only provides a generic product name" |
| A7 | **Alternatives.** Higher-scoring similar products | P1 | Notes' tier 2. **Constraint:** only suggest among goods we have actually assessed. Never generate a recommendation we can't evidence |
| A8 | **Free-source resolution spike.** How much of the Sayari retrieval rebuilds from public data? | P2 | The strategic one — see §7 |

### Workstream B — Web app · *SWE-2*

| ID | Item | P | Notes |
|---|---|---|---|
| B1 | **Chat shell.** Input, message thread, sidebar (About / Capstone / Technical Overview / Previous Carts) | P0 | Kai's Frame 1 + 2 |
| B2 | **Result card, all four coverage states** | P0 | Blocked on C1. Do not build against stars |
| B3 | **"View Sources & Explanations"** expand → indicators, confidence, source links | P0 | Layers 2 and 3 of the disclosure model |
| B4 | **Previous Carts.** Session history | P0 | `localStorage` is fine for the demo |
| B5 | **Streaming results.** Show progress while the agent works | P1 | A 20-second silent spinner reads as broken on stage |
| B6 | **Permalink per assessment** | P1 | Becomes the public record page — see §7 |
| B7 | **Browser extension** | P2 | Tier 2 per the notes. The engine is shared, so this is mostly a rendering job later |

### Workstream C — Design · *UX-1, UX-2, UX-3*

| ID | Item | P | Notes |
|---|---|---|---|
| C1 | **Render the four coverage states.** Scored / Inferred / Claimed / Unknown, × High / Medium / Low confidence | **P0 — start here** | The hardest and most valuable problem on the board. Constraints: absence must never look like a low score; an entity-level finding must never read as an accusation; legible in under two seconds |
| C2 | **Replace the star scale** with one that can show "no value at all" | P0 | See §2.1. Deliver 3 competing directions, pick one by end of sprint 1 |
| C3 | **Agent voice.** What it says when it finds nothing — the exact sentence | P0 | This is copywriting doing the heaviest lifting in the product. "Trader Joe's does not disclose the producer for this item" beats a grey dash |
| C4 | **Disclosure IA.** How Layer 1 → 2 → 3 unfolds without burying sources | P0 | Everyday shopper, conscious shopper, and journalist all use the same screen |
| C5 | **Design system.** Tokens shared with the existing site | P1 | The [site](index.html) already has a palette — extend it, don't restart |
| C6 | **Presentation deck** | P1 | Owned with Alex |
| C7 | **Pillar weighting / onboarding** | P2 | From [Behavioral-Change-Backlog.html](Behavioral-Change-Backlog.html) Lever 03 |

### Workstream D — Research · *Researcher, Alex*

| ID | Item | P | Notes |
|---|---|---|---|
| D1 | **Indicator sets for 3–4 demo categories.** What each 0–5 anchor requires | P0 | [Product_Assessment_Framework.html](Product_Assessment_Framework.html) has 12 categories in prose — convert the demo ones to structured, gateable indicators. Fix the Value definition here (§2.2) |
| D2 | **Hand-assess 15 demo products to spec** | P0 | The demo corpus. Every claim needs a source URL and a tier. **Expect most to return Unknown on the rights dimensions — that is the correct result, not a shortfall** |
| D3 | **Source tier decisions.** Which sources are tier 1 / 2 / 3, written down | P0 | Feeds A3 and the adapter config |
| D4 | **Second-coder pass.** Someone other than the author re-codes 5 goods; report agreement | P1 | Closes the paper's own stated limitation (§6.2, "no second coder") and is a real credibility line in the talk |
| D5 | **Display-experiment protocol.** Composite vs dimensional | P1 | See §7. Design it now, run it after launch |

### Workstream E — Alex

| ID | Item | P | Notes |
|---|---|---|---|
| E1 | **Framework guardianship.** Review every PR against the six non-negotiables | P0 | Ongoing. The failure mode here is drift-by-a-thousand-reasonable-decisions — it already happened once to this repo |
| E2 | **Demo script + narrative** | P0 | §8 |
| E3 | **Settle [VISION.md §8](VISION.md) open questions** | P0 | Especially Sayari dependency — it blocks any public launch |
| E4 | **Category + product picks for the demo** | P0 | Sprint 1, day 1. Everything downstream depends on it |

---

## 6. Infrastructure to build now

Cheap this month, painful in three. In dependency order.

**1. The evidence record format, versioned.**
One JSON shape every source speaks. It mostly exists — [the pipeline](clearcart-source-pipeline/output/products/) already emits per-claim records with evidence typing, confidence, gap markers, and attribution. **But it uses a different vocabulary than the engine:** records say `status: gap | brand_claim_only | evidenced`, the engine says `coverage: unknown | claimed | inferred | scored`. Unify them, version the schema, and make it the contract. *Owner: SWE-3. Do this first — everything else plugs into it.*

**2. Assessment engine as a shared package, with tests.**
The engine is correct to spec today and **nothing enforces it**. `npm test` runs nothing. Ten behaviours need locking down: absence returns null, seller-only is Claimed, gating never averages, confidence never multiplies into score, entity scope caps at medium, and so on. One afternoon. *Owner: SWE-3.*

**3. Golden-set eval harness.**
The six audited goods, their expected coverage states, run on every change. This is what lets five people move fast without quietly breaking the claim the whole project rests on. *Owner: SWE-3 with Researcher.*

**4. Source adapter interface.**
Two ingestion paths already exist (creator reviews, Sayari). Formalize the seam so adding a certification registry or a regulatory feed is a new file, not a refactor. *Owner: SWE-3.*

**5. Evidence store with gaps as rows.**
Schema is drafted in [schema.prisma](server/db/schema.prisma) — never migrated. Note the two deliberate choices: `score` is **nullable** (so Unknown is representable), and `Gap` is its own table (absence is data, not a missing row). That Gap table is the asset in §7. *Owner: SWE-1.*

**6. Product catalog + resolution.**
Even a crude one. This is the bottleneck the paper identifies at global scale, and it is also the thing that breaks the demo when someone types "iphone" instead of "iPhone 15 Pro." *Owner: SWE-1.*

**7. Event log, from day one.**
`query_submitted`, `assessment_shown`, `sources_expanded`, `alternative_clicked`. Cheap now, impossible to reconstruct later, and it is the dataset that makes the §7 experiment possible. *Owner: SWE-3.*

**8. Static record pages from stored assessments.**
Every assessment permalinks to a citable page. The growth engine and the credibility engine, for roughly a day of work once the store exists. *Owner: SWE-2.*

---

## 7. Where this goes — inspiration for the roadmap

Four things we are unusually well-positioned to build. Each starts from something already in the repo.

### The Unknown ledger
Every `Unknown` is a **named company that has not disclosed something**, which under UN Guiding Principle 21 is a communication failure, not a neutral absence. So name it, count it, and let people pile on:

> **People & Supply Chain — Unknown.** Trader Joe's does not disclose the producer for this item. Journalists identified it as Pete & Gerry's; the retailer has never confirmed it. **147 shoppers have asked them to.** → *Add your name*

Turns our most common result from a dead end into a mechanic, a mailing list, and a growing public record of what companies refuse to say. That ledger may outlast any score we compute. *Starts from: the `Gap` table in infra #5.*

### Creator recs — already half-built
The notes list this as tier 2. **It exists.** [The source pipeline](clearcart-source-pipeline/) already profiles a reviewer's methodology and monetization into a trust tier, extracts their claims typed by evidence kind, maps them to the five dimensions, records what they *didn't* cover as explicit gaps, and credits them by name and URL. Three sources are profiled. This is further along than anything else in tier 2 and it is a genuine differentiator — nobody else ingests creator reviews with conflict-of-interest disclosure attached.

### Entity resolution as public infrastructure
The paper's finding: the binding constraint isn't disclosure, it's **entity resolution** — turning 554 name candidates into one legal entity and walking the supply graph. Sayari sells that. We cannot redistribute it in a free consumer product, so this blocks public launch, not just ambition.

The open question: how much rebuilds from free public inputs — bills of lading, SEC filings, corporate registries, the UFLPA and TVPRA lists? If a meaningful share does, the story changes from *locked behind a vendor* to *public infrastructure nobody built yet*. That is a grant application, not just a feature. *Starts from: A8.*

### The experiment nobody has run
The labeling literature compares labels against no labels. It has never tested whether the **architecture of disclosure** changes decisions — five separated confidence-tiered dimensions versus one composite number. Nobody ran it because nobody had a working non-compensatory instrument.

We will have one. Ship with a consented A/B and ClearCart becomes the apparatus for a novel study: a publication, a grant, and a press story that isn't "another shopping app." *Starts from: D5 + infra #7.*

---

## 8. Demo script — five minutes

1. **The problem, in one sentence.** "Somewhere upstream of everything you buy there's a factory and a set of working conditions. That information exists. It never reaches the moment you're deciding." *(20s)*
2. **Type a product.** Let it run. Narrate what the agent is doing. *(40s)*
3. **The result — and lead with the gap.** Don't apologize for Unknown, open with it. "Quality and Value are well evidenced. Planet and People are Unknown — and that's not our tool failing, that's the finding." *(60s)*
4. **Click through to sources.** Every claim, its origin, its confidence tier. *(45s)*
5. **The audit.** Six goods, five dimensions, best source covered three of five, and *zero* independently evidenced claims on the two rights dimensions. "This isn't a gap in our data. It's a gap in the world's." *(60s)*
6. **Take an unseen product from the room.** *(60s)*
7. **Where it goes.** The ledger, the public record, the experiment. *(35s)*

**Rehearse step 6 against genuinely unseen products.** It is the moment that makes the demo real, and the one most likely to break.

---

## 9. Risks and the cut line

| Risk | Mitigation |
|---|---|
| **Design defaults to stars and a composite creeps back** | C1/C2 land in sprint 1, before B2 is built. E1 reviews every PR |
| **Demo shows Unknown everywhere and reads as broken** | C3 — the agent's wording carries this. Test on someone outside the team before the talk |
| **Live lookup too slow or flaky on stage** | A5 caching + B5 streaming. Pre-warm the likely products; keep a recorded fallback |
| **Sayari data in a public demo** | E3. Treat as research-only until settled |
| **Researcher becomes the bottleneck** | D2 is 15 products of real work. Start day one; engineers build against 3 hand-written fixtures meanwhile |

**If the runway is shorter than three sprints, cut in this order:** B7 → A7 → C7 → D4 → B6 → A6 → B5.

**Never cut:** C1, A4, and the sources link in B3. Those three are the difference between a demo and a claim we can defend.

---

*Living document — update it here rather than in a copy. Questions: Alex.*
