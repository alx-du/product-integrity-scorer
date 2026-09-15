# ClearCart — Product Integrity Scorer

## What this is
A Chrome browser extension that shows what is and is not known about a product across five independent dimensions, at the point of purchase. Starting with Trader Joe's, expanding to Amazon and other retailers.

## The specification
**[CAPSTONE.md](CAPSTONE.md) is the specification.** Where any file — this one included — disagrees with it, the paper wins. [VISION.md](VISION.md) covers product direction and open questions.

The repo previously drifted from the paper because `white-paper/methodology.md` duplicated the spec and aged separately. That file is deleted. Do not recreate a second source of truth: extend CAPSTONE.md, or write operational detail directly next to the code it governs.

## Non-negotiables
These come from the research. Breaking any of them breaks the paper's central claim. They are enforced in code, not left to convention.

1. **No composite score.** Dimensions are never averaged, weighted or summed with one another. There is no overall number and there must never be one. `assertNoComposite()` in `extension/scoring/pillars.js` exists to make that explicit.
2. **Absence is not a zero.** No evidence returns coverage `unknown` and score `null` — off the scale, not low on it. Never render an absence like a bad score.
3. **A company's claim is its own category** — `claimed`, carrying no number. Not evidence, not nothing.
4. **Confidence is reported, never applied.** It describes source independence. It is never multiplied into a score.
5. **Indicators gate, they do not average.** A dimension score is the highest anchor whose evidentiary requirements are met. A strong secondary indicator does not substitute for a missing primary one.
6. **Faithful ≠ honest.** Entity-level evidence is labelled as entity-level wherever shown. The tool must not generate unfounded attribution of harm — an instrument that does creates an adverse impact of its own.

## The model
Five fixed dimensions; indicators inside them vary by product category.

| Dimension | Key | Rights-bearing |
|---|---|---|
| Planet | `planet` | yes |
| People & Supply Chain | `people` | yes |
| Quality | `quality` | no |
| Value | `value` | no |
| Transparency | `transparency` | no |

Each yields three independent outputs:

- **Score** — integer 0–5, or `null`. `0` = assessed and adverse. Pass threshold 3.0, applied conjunctively across all five.
- **Confidence** — `high` | `medium` | `low`. Source independence. `null` wherever score is `null`.
- **Coverage** — `scored` | `inferred` | `claimed` | `unknown`. Only the first two carry a number. `inferred` caps confidence at `medium`.

Vocabulary: the paper says **dimension**, the UI says **pillar**. Same five things. Code uses "dimension"; "pillar" survives only in display strings and the `pillars.js` filename.

## Tech stack
- Manifest V3 Chrome extension
- Vanilla JS + HTML/CSS for content scripts and popup
- Anthropic API (claude-sonnet-4-6) for evidence gathering — **the model finds and types evidence, it never produces scores.** Gating is deterministic in `extension/scoring/pillars.js`. A model asked for a score will always produce one, including where no evidence exists.
- Node.js + Express for backend API
- PostgreSQL via Supabase for caching and product database
- Prisma ORM for all database queries
- No build step required for MVP extension

## Project structure
```
extension/
  manifest.json
  content.js
  popup.html
  popup.js          (not yet written)
  background.js     (not yet written)
  content.css       (not yet written)
  scoring/
    pillars.js      the gating engine
server/
  index.js
  db/schema.prisma
clearcart-source-pipeline/
  output/products/  the pilot set — 6 goods, coded to the four coverage states
  output/sources/   source profiles and trust tiers
data/legacy/        retired data from superseded models — do not load
CAPSTONE.md         the specification
VISION.md           product direction
```

## Database
- PostgreSQL via Supabase; schema in `/server/db/schema.prisma`
- `DimensionAssessment.score` is **nullable by design** — a non-null column would make `unknown` unrepresentable and force every absence to be written as a number. Do not "fix" it.
- Gaps are stored as rows, not as missing data. Absence is first-class.
- Prisma ORM for all queries
- Never hardcode DB credentials — use environment variables
- Cache duration: 7 days per product

## Coding standards
- Comment scoring logic thoroughly — this feeds the research
- Every assessment carries a coverage state and, where scored, a confidence tier
- No hardcoded API keys — `chrome.storage` for the extension, env vars for the server
- Keep `content.js` under 200 lines; extract logic to modules
- JSDoc on all scoring functions

## After making changes
1. `npm run lint`
2. `npm test`
3. Claude creates PRs — never pushes directly to main
4. At least one human approval before merging

## Key integrations
- Tavily API for deep product research
- Sayari for supply-chain intelligence — **research-only.** A free consumer product cannot redistribute paid intelligence; see VISION.md §8.3
- Localize (localizefood.app) for local farm alternatives
- Supabase for caching and product database
- Anthropic API for evidence gathering

## Pilot products
The six goods in `clearcart-source-pipeline/output/products/`: Made In clad frying pan, de Buyer carbon steel pan, Naturepedic EOS mattress, AspenClean laundry powder, Schlage Encode Plus smart lock, Feathered Friends comforter.

The Trader Joe's eggs that previously served as the pilot are retired in `data/legacy/` — scored under the superseded model.

## Target users
1. **Everyday purchasers** — five dimension states on product cards
2. **Conscious shoppers** — expand for indicators and sources
3. **Researchers and journalists** — full indicator, confidence, scope and source view

Rights-holders are **not** an end-user. The framework does not serve affected workers and communities directly; its service to them is indirect and contingent.
