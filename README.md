# ClearCart — Product Integrity Scorer

> 🌐 **[clearcart site →](https://alx-du.github.io/product-integrity-scorer/)** — the framework, the category rubrics, the Sayari supply-chain demo, and the worked product analyses, all readable in the browser.
>
> 📄 **[Read the capstone paper](CAPSTONE.md)** — "Human Rights Due Diligence, Information Asymmetry, and the Limits of Good-Level Transparency in Global Value Chains" (NYU M.S. Global Affairs, Summer 2026). **This is the specification.** Where this README, the code, or anything else disagrees with it, the paper wins.
>
> 🧭 **[Read the vision](VISION.md)** — where the product goes from here, what launch-ready means, and how to contribute.

A browser extension that shows what is — and is not — known about a product, at the moment you are deciding whether to buy it.

## What it does

Five dimensions, assessed independently on every good. No composite, no averaging, no single badge.

| Dimension | What it measures |
|---|---|
| 🌱 **Planet** | Environmental impact across sourcing, land use, material throughput, packaging, emissions |
| 🤝 **People & Supply Chain** | Labour conditions in production, and whether material origin is disclosed at a level permitting assessment |
| ⭐ **Quality** | How buyer specification and price pressure shape conditions upstream. Durability as a denominator, not a virtue |
| 💰 **Value** | Where value accrues along the chain — living-wage consistency upstream, brand rent versus production inputs downstream |
| 🔍 **Transparency** | Whether claims rest on evidence someone outside the company can check |

## The part that makes this different

Most of the time, for most products, the honest answer is **we don't know** — and this tool says so instead of guessing.

Each dimension carries three outputs, reported separately:

**Score** — 0 to 5. `0` means assessed and adverse. `3.0` is the pass threshold.

**Confidence** — high, medium or low. This describes the *independence of the source*, not the strength of the finding. It is reported alongside the score and **never multiplied into it**.

**Coverage** — whether the dimension was assessable at all:

| State | Meaning | Carries a number? |
|---|---|---|
| `scored` | A tier 1 or 2 source addresses this dimension for the good itself | Yes |
| `inferred` | Entity- or category-level evidence reaches the good by a stated assumption, at capped confidence | Yes |
| `claimed` | Only the selling company's own material addresses it | **No** |
| `unknown` | No source addresses it at any level | **No** |

### Absence is not a zero

A dimension with no evidence returns `unknown` and **no number** — off the scale, not low on it. A zero means evidence existed, someone examined it, and the good performs badly.

Under the UN Guiding Principles these are separate failures. A bad finding points to conduct requiring mitigation. An absence points to a communication failure under Principle 21 — the company has not given anyone enough information to judge it. A framework that renders the two alike cannot support due diligence, and blames a product for the information environment around it.

`claimed` is kept apart from both for the same reason: counting a company's unverified claim as evidence adopts the concealment, counting it as nothing loses the fact that a claim was made. `unknown` asks a company to disclose; `claimed` asks it to substantiate.

### Why no single number

Every dimension rests on different sources of different quality. A composite rolls them into one number and hides that unevenness — and lets a well-evidenced commercial dimension mask an unevidenced rights dimension.

It is also arithmetically unavailable: `claimed` and `unknown` carry no number, and in the paper's audit of six goods, at least one rights-bearing dimension sat in one of those states for **every good assessed**. There is no `assessGood().overall`, and [`assertNoComposite()`](extension/scoring/pillars.js) exists to make that omission deliberate rather than accidental.

## Findings that shape the product

From the audit in [CAPSTONE.md](CAPSTONE.md) §4:

- No source covered more than **three of five** dimensions.
- On Planet and People & Supply Chain — the two rights-bearing dimensions — **not one of six goods carried a single independently evidenced claim.**
- A commercial supply-chain intelligence platform, run against the good chosen to favour it, covered two dimensions — and not the same two the public sources covered.
- The binding constraint is **entity resolution**, not disclosure. The raw inputs are largely public; what is proprietary is the join.

## Tech stack

- **Extension:** Manifest V3 (vanilla JS)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL via Supabase (7-day assessment cache)
- **ORM:** Prisma
- **Evidence gathering:** Anthropic API — the model finds and types evidence; it does **not** produce scores. Gating is deterministic, in [`extension/scoring/pillars.js`](extension/scoring/pillars.js)
- **Deployment:** Railway / Render

## Project structure

```
extension/          Chrome extension (Manifest V3)
  scoring/          Gating engine — the framework in code
server/             Express API + Prisma
  db/               schema.prisma
clearcart-source-pipeline/  Evidence pipeline: review source → typed, attributed claims
  output/           The pilot set — 6 goods, 3 sources, coded to the four coverage states
data/legacy/        Retired data from superseded models. Do not load.
CAPSTONE.md         The specification
VISION.md           Where this goes next
```

## Getting started

### Prerequisites
Node.js 18+ · Supabase account (free tier) · Anthropic API key

```bash
git clone https://github.com/alx-du/product-integrity-scorer.git
cd product-integrity-scorer
npm install

cp .env.example .env     # add ANTHROPIC_API_KEY and DATABASE_URL

npm run db:generate
npm run db:migrate
npm run dev
```

### Load the extension
1. Chrome → `chrome://extensions` → enable Developer Mode
2. "Load unpacked" → select `extension/`
3. Browse traderjoes.com

> ⚠️ **The extension does not currently load.** `manifest.json` references `background.js`, `content.css` and `icons/` that do not exist yet, and `.env.example` has not been written. See [VISION.md §6](VISION.md) for the full gap list — this is Stage 1 work and it is not hard, just unfinished.

## Pilot data

[`clearcart-source-pipeline/output/products/`](clearcart-source-pipeline/output/products/) — six goods across three review sources: a clad frying pan, a carbon steel pan, a mattress, a laundry powder, a smart lock, and a down comforter. Each record carries per-claim evidence typing, confidence ceilings, explicit gap markers, and source attribution.

This is the set that produced Table 1 of the paper. The four Trader Joe's egg products that previously served as the pilot have been [retired](data/legacy/README.md) — they were scored under the superseded model.

## Contributing

Read [VISION.md](VISION.md). It has six independent tracks with one-day deliverables, and states the five rules that are not open to a vote.

## Roadmap

- [x] Framework specification + audit of six goods
- [x] Evidence pipeline with three ingested sources
- [x] Commercial supply-chain retrieval, proven once (Sayari)
- [x] Capstone paper
- [x] Code brought in line with the specification
- [ ] Extension that loads and renders the four coverage states
- [ ] Public evidence record pages
- [ ] Free-source entity resolution test
- [ ] Display-architecture experiment

---

*Public repository — active development. For inquiries contact alex_x_du@outlook.com*
