# Product Integrity Scorer

A Chrome browser extension that overlays product integrity scores on e-commerce product pages, helping consumers make informed purchasing decisions.

## What it does

When you browse supported retailers (starting with Trader Joe's), the extension displays **5 independent pillar scores** directly on product cards — no composite, no averaging, no hidden tradeoffs.

| Pillar | What it measures |
|---|---|
| 🌱 **Planet** | Environmental sustainability, certifications, land use |
| 🤝 **People** | Labor ethics, supply chain transparency, fair trade |
| ⭐ **Quality** | Product quality, ingredient integrity, certifications |
| 💰 **Value** | Pricing fairness, corporate ownership structure |
| 🔍 **Transparency** | Claim credibility, greenwashing detection |

Each score is backed by a three-tier confidence system (High/Medium/Low) showing *how* we know what we know.

## Why independent scores instead of one rating?

A product scoring **85 on Planet but 40 on Labor** tells a more truthful story than a blended 62. Existing tools like Good On You collapse everything into a single badge — hiding tradeoffs that matter. This framework is a deliberate departure from that approach.

## Tech stack

- **Extension:** Manifest V3 Chrome extension (Vanilla JS)
- **Backend:** Node.js + Express API
- **Database:** PostgreSQL via Supabase (7-day score caching)
- **ORM:** Prisma
- **AI scoring:** Anthropic API (claude-sonnet-4-6)
- **Deployment:** Railway / Render

## Project structure

```
extension/        Chrome extension (Manifest V3)
  scoring/        5-pillar scoring logic
server/           Express API + Prisma
  db/             schema.prisma + migrations
data/products/    Pilot scored product datasets
white-paper/      Methodology documentation
.github/          Claude AI workflow integration
```

## Getting started

### Prerequisites
- Node.js 18+
- Supabase account (free tier)
- Anthropic API key

### Setup

```bash
# Clone and install
git clone https://github.com/alx-du/product-integrity-scorer.git
cd product-integrity-scorer
npm install

# Configure environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY and DATABASE_URL

# Set up database
npm run db:generate
npm run db:migrate

# Start server
npm run dev
```

### Load the extension
1. Open Chrome → `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" → select the `extension/` folder
4. Navigate to traderjoes.com and browse products

## Claude Code integration

This project uses Claude Code for AI-assisted development. The `CLAUDE.md` file defines project standards and context.

```bash
# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Start an AI-assisted coding session
cd product-integrity-scorer
claude

# Set up GitHub integration (enables @claude in PRs/issues)
/install-github-app
```

## Pilot data

The `data/products/trader-joes-eggs.json` file contains fully scored data for all four Trader Joe's egg options — a concrete test case showing the framework in action, including the pasture-raised label disambiguation and B Corp sourcing context.

## White paper

Methodology documentation is in `white-paper/methodology.md`. This feeds the academic white paper, which will be published alongside the MVP launch (target: mid-August 2026).

## Roadmap

- [ ] Extension scaffold with hardcoded scores (Week 1)
- [ ] Supabase database connection (Week 2)
- [ ] AI scoring pipeline (Week 3)
- [ ] Score caching + Localize farm integration (Week 4+)
- [ ] White paper draft (parallel)
- [ ] MVP launch + white paper (mid-August 2026)

---

*Private repository — active development. For inquiries contact alex_x_du@outlook.com*
