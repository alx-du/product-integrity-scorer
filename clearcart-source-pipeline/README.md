# ClearCart Source Pipeline

Turns content-creator review sites into structured, credited evidence for the ClearCart dashboard.

**Flow:** source URL → profile their methodology & trust tier → extract per-product claims mapped to the five pillars (Planet, People & Supply Chain, Quality, Value, Transparency) → flag gaps → optionally propose category-specific pillar criteria → JSON records with attribution, ready for the dashboard.

## Setup (one time)

1. Open this folder in VS Code (`File > Open Folder`)
2. In the VS Code terminal:
   ```
   npm install
   cp .env.example .env
   ```
3. Open `.env` and paste your Anthropic API key.

Requires Node 18+ (`node -v` to check).

For YouTube-based sources, also install `yt-dlp` (used to pull transcripts — YouTube's caption API is session-gated, so plain HTTP fetch can't reach it directly):
```
pip3 install --user yt-dlp
```

## Running it

```
node run.js                      # process every source in data/sources.json
node run.js prudent-reviews      # process one source by slug
node run.js --customize cookware # stage 3: propose pillar criteria for a category
```

## Adding a new creator source

Edit `data/sources.json` and add an entry:

```json
{
  "slug": "creator-slug",
  "name": "Creator Name",
  "homepage": "https://...",
  "methodology_url": "https://.../how-we-test/",
  "product_urls": ["https://.../some-product-review/"]
}
```

Then `node run.js creator-slug`.

**Video-based creators (no website):** use YouTube video URLs anywhere a URL is expected — `homepage`/`methodology_url`/`product_urls` all accept them alongside or instead of webpages. `run.js` auto-detects YouTube URLs and pulls a transcript via `yt-dlp` instead of fetching HTML. Point `methodology_url` at a video where the creator explains their evaluation approach (or the one that best demonstrates it), and `product_urls` at video reviews of individual products:

```json
{
  "slug": "creator-slug",
  "name": "Creator Name",
  "homepage": "https://www.youtube.com/@handle",
  "methodology_url": "https://www.youtube.com/watch?v=...",
  "product_urls": ["https://www.youtube.com/watch?v=..."]
}
```

Only English captions are fetched today; a video with no English captions (auto-generated or manual) will be skipped with a warning rather than failing the run.

## Output

- `output/sources/<slug>.json` — methodology summary, monetization, conflict-of-interest notes, pillar coverage, trust tier
- `output/products/<slug>--<product>.json` — per-pillar claims with evidence kind (`tested` / `cited_third_party` / `brand_claim_repeated` / `anecdotal`), confidence, explicit `gap` markers for pillars the reviewer doesn't cover, and an `attribution` block crediting the reviewer
- `output/pillar-criteria--<category>.json` — proposed category-specific sub-criteria, with `borrowed_from` credit lines

## Previewing output

```
npm run preview
```

Opens a live dashboard at `http://localhost:5050` — one card per source (trust tier, methodology, pillar coverage) with its product records nested underneath (claims, evidence kind, confidence, gaps). It re-reads everything in `output/` on every request, so there's no build step: run the pipeline or edit/add a JSON file, then refresh (the page also auto-refreshes itself every 5s). Leave it running while you work. Stop with Ctrl+C. Override the port with `PORT=5051 npm run preview`.

## Design decisions baked in

- **Claims, not scores, are ingested.** A reviewer's overall verdict is stored as context; what feeds the pillars is individual claims with evidence typing.
- **Gaps are first-class data.** Every pillar a reviewer skips is recorded as a gap with a note on what ClearCart must source independently — that's your differentiation story.
- **Attribution is mandatory.** Every record carries the reviewer's name and URL so the dashboard can credit them.
- **Confidence caps:** anecdotes cap at low, third-party citations at medium until you verify them, and only instrumented testing reaches high.

## Limits & notes

- JS-rendered databases (e.g. Clarity Insight's swaps table) won't fetch with plain HTTP. For those, save the page from your browser (`Cmd+S`) and point the pipeline at the local file, or copy the visible data into a text file — or extend `fetchPage.js` with Playwright later.
- Video-based creators: `src/fetchTranscript.js` pulls captions via `yt-dlp`, using the `android` player client to route around YouTube's session-gated caption API. This is inherently a bit fragile — YouTube changes this fairly often, so if fetches start failing, check for a `yt-dlp` update (`pip3 install --user -U yt-dlp`) first.
- Be a polite scraper: this fetches only pages/videos you explicitly list, one at a time.
- Affiliate-monetized sources should be disclosed in the dashboard UI when their assessments are shown (the `monetization` field gives you this).
