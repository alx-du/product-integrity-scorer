# Product Integrity Scorer — Scoring Methodology

**Version:** 1.0 (Draft)
**Last Updated:** May 2026
**Status:** Working document — feeds white paper

---

## Overview

The Product Integrity Scorer is a browser extension that overlays product integrity scores on e-commerce product pages. Unlike existing single-index tools (e.g. Good On You, DoneGood), this framework presents **5 independent pillar scores** — not a composite — to make tradeoffs visible rather than averaging them away.

**Core argument:** A product that scores 85 on Environmental but 40 on Labor tells a more truthful story than a blended 62. Tradeoffs should be visible, not hidden.

---

## Framework Architecture

### Front-end: 5 Independent Pillars

| Pillar | Emoji | What it measures |
|---|---|---|
| Planet | 🌱 | Environmental sustainability |
| People & Supply Chain | 🤝 | Labor ethics + sourcing transparency |
| Quality | ⭐ | Product quality and authenticity |
| Value | 💰 | Pricing fairness and corporate ownership |
| Transparency | 🔍 | Claim credibility and verifiability |

### Back-end: 8 Scored Categories

| Category | Display pillar | Notes |
|---|---|---|
| Environmental Sustainability | Planet | |
| Labor & Ethical Sourcing | People | Combined in display, separate in backend |
| Sourcing Transparency | People | |
| Product Quality & Durability | Quality | |
| Pricing Fairness | Value | |
| Corporate Ownership | Value | |
| Claim Credibility | Transparency | |
| Consumer Education | Transparency | |

**Design decision:** Labor & Ethical Sourcing and Sourcing Transparency are kept separate in backend scoring logic (measuring different things at different points in the supply chain) but presented combined as "People & Supply Chain" in the UI for everyday users.

---

## Three-Tier Confidence System

Every indicator is tagged with a confidence level that reflects evidence quality:

| Level | Symbol | Definition | Score multiplier |
|---|---|---|---|
| High | 🟢 | Independently verified (3rd party cert, regulatory filing, public record) | 1.0x |
| Medium | 🟡 | Brand claim with some supporting evidence | 0.6x |
| Low | 🔴 | Inferred, estimated, or unverifiable | 0.2x |

A product cannot score highly on unverified self-claims. Evidence quality directly adjusts the points earned per indicator.

**This addresses a core problem in existing tools:** a product claiming 15 sustainability attributes with no third-party verification should not score the same as a product with 5 independently verified ones.

---

## Three-Layer Display Model

The UI uses progressive disclosure — users see what's relevant to them without being overwhelmed:

**Layer 1 — Pillar scores (all users)**
Five independent scores. No composite. No explanation needed.

**Layer 2 — Category breakdown (tap to expand)**
The pillar expands to show the back-end categories. "People" expands to show Labor (35/60) and Sourcing Transparency (29/40).

**Layer 3 — Individual indicators + confidence + sources (researcher view)**
Each indicator shows: what was checked, whether it's present, confidence level, and data source.

---

## Pilot: Trader Joe's Egg Options

### Products scored
1. TJ's Cage-Free Large White Eggs ($3.49/dz)
2. TJ's Free-Range Large Brown Eggs ($4.49/dz)
3. TJ's Organic Free-Range Eggs ($5.49/dz)
4. TJ's Organic Pasture Raised Eggs ($6.99/dz)

### Key findings

**Sourcing transparency gap:** All four products source from Pete & Gerry's — but Trader Joe's does not publish this publicly. This information was confirmed through journalist investigation (The Kitchn). This is a concrete example of how sourcing transparency and environmental performance can diverge.

**Label interpretation:** "Pasture-raised" is not a regulated USDA term. The Certified Humane standard from HFAC (108 sq ft of outdoor space per bird) is what actually gives the Organic Pasture Raised option its credibility. Without this framework, a consumer cannot distinguish "pasture-raised" from a marketing claim.

**B Corp advantage:** Pete & Gerry's B Corp certification (B Impact Score: 90.4 vs. median 50.9) meaningfully lifts the People score across all four products — even the cheapest cage-free option. This demonstrates how supply chain transparency at the farm co-op level propagates upward to product scores.

### Score summary

| Product | 🌱 Planet | 🤝 People | ⭐ Quality | 💰 Value | 🔍 Transparency |
|---|---|---|---|---|---|
| Cage-Free | 52 | 68 | 71 | 82 | 54 |
| Free-Range | 60 | 70 | 74 | 75 | 57 |
| Organic Free-Range | 74 | 72 | 82 | 68 | 63 |
| Organic Pasture Raised | 86 | 79 | 90 | 58 | 72 |

---

## Methodological Contributions

1. **Independent pillars over composite scores** — departure from single-index tools; tradeoffs are visible not hidden
2. **Confidence-weighted scoring** — evidence quality adjusts score magnitude, not just label
3. **Label disambiguation** — the tool actively explains what a label means and where its credibility comes from (e.g. "pasture-raised" is only credible here because of Certified Humane, not the label itself)
4. **Progressive disclosure architecture** — three-layer display matches depth to user type without requiring three separate UIs

---

## Data Sources

- USDA Agricultural Marketing Service (organic, grade standards)
- HFAC / Certified Humane (animal welfare standards)
- B Lab (B Corp certification database)
- Fairtrade International
- Non-GMO Project
- FTC Guidance on Environmental Marketing Claims (Green Guides)
- SEC ESG disclosure filings
- EU Digital Product Passport regulations
- Pete & Gerry's public reports and B Impact assessment
- Retailer product listings and labeling

---

## Limitations and Future Work

- Current scoring is manually curated for the pilot product set. Scaled deployment requires AI-assisted scoring with human review.
- Labor scores for non-certified products rely heavily on brand claims (medium/low confidence). Access to factory disclosure databases would improve this.
- The "Value" pillar's corporate ownership dimension requires ongoing monitoring as brands are acquired.
- Localize (localizefood.app) integration planned to surface local farm alternatives alongside scores.

---

*This methodology document is a living document. Changes are tracked in the repository commit history.*
