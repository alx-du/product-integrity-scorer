# Product Integrity Scorer — Browser Extension

## What this is
A Chrome browser extension that overlays product integrity scores on e-commerce product pages (starting with Trader Joe's, expanding to Amazon and other retailers).

## Project goal
Launch MVP and publish white paper before mid-August. Supports EB-2 NIW petition through documented, actively developed venture.

## Tech stack
- Manifest V3 Chrome extension
- Vanilla JS + HTML/CSS for content scripts and popup
- Anthropic API (claude-sonnet-4-6) for AI scoring
- Node.js + Express for backend API
- PostgreSQL via Supabase for score caching and product database
- Prisma ORM for all database queries
- No build step required for MVP extension

## Project structure
extension/
  manifest.json
  content.js
  popup.html
  popup.js
  background.js
  scoring/
    pillars.js
    certifications.js
    confidence.js
server/
  index.js
  routes/score.js
  db/schema.prisma
data/
  certifications.json
  products/trader-joes-eggs.json
white-paper/
  methodology.md

## Scoring architecture
5 independent pillar scores (NOT a composite — each pillar stands alone):

| Display Pillar | Back-end categories |
|---|---|
| Planet | Environmental Sustainability |
| People and Supply Chain | Labor + Sourcing Transparency |
| Quality | Product Quality and Durability |
| Value | Pricing Fairness + Corporate Ownership |
| Transparency | Claim Credibility + Consumer Education |

### Three-tier confidence system
- High: independently verified (3rd party cert, regulatory filing, public record)
- Medium: brand claim with some supporting evidence  
- Low: inferred, estimated, or unverifiable

### Three-layer display
- Layer 1: 5 independent pillar scores (all users)
- Layer 2: Back-end category breakdown per pillar (tap to expand)
- Layer 3: Individual indicators + confidence tags + sources (researcher view)

## Database
- PostgreSQL via Supabase
- Schema lives in /server/db/schema.prisma
- Prisma ORM for all queries
- Never hardcode DB credentials — use environment variables
- Cache duration: 7 days per product
- Supabase REST API available for direct reads from extension

## Coding standards
- Comment scoring logic thoroughly — this feeds the white paper
- Every score must have a confidence level: high / medium / low
- No hardcoded API keys — use chrome.storage for extension, env vars for server
- Keep content.js under 200 lines, extract logic to modules
- Use JSDoc comments for all scoring functions

## After making changes
1. Run npm run lint to check formatting
2. Run npm test to detect breaking changes
3. Claude creates PRs — never pushes directly to main
4. At least one human approval required before merging

## Key integrations
- Tavily API for deep product research
- Localize (localizefood.app) for local farm alternatives
- Supabase for score caching and product database
- Anthropic API for AI scoring pipeline

## Pilot products
Starting with Trader Joe's egg options:
1. TJ's Cage-Free Large White Eggs
2. TJ's Free-Range Large Brown Eggs  
3. TJ's Organic Free-Range Eggs
4. TJ's Organic Pasture Raised Eggs

## Target users
1. Everyday consumers — see 5 pillar badges on product cards
2. Conscious shoppers — expand pillars for category detail
3. Researchers/journalists — full indicator + confidence + source view
