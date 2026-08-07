# Capstone Defense Deck

Single-file reveal.js presentation (`index.html`). No build step, no npm install — reveal.js loads from CDN.

## Run locally

Any static file server works, since the deck fetches reveal.js from a CDN and only needs `file://`-adjacent access to its own assets. Easiest option is the VS Code **Live Server** extension:

1. Open this `presentation/` folder (or the repo root) in VS Code.
2. Right-click `index.html` → **Open with Live Server**.
3. Use arrow keys / space to advance through the 13 slides.

Opening `index.html` directly via `file://` also works in most browsers, but a local server avoids any asset-loading quirks once a demo video is added to `assets/`.

## Speaker view

Press **S** while the deck is focused to open the speaker notes window in a new tab. It shows the current slide, the next slide, speaker notes, and pacing against the 15-minute cap (`totalTime: 900`, tracked via each slide's `data-timing` attribute).

## Export to PDF

1. Open the deck with `?print-pdf` appended to the URL, e.g. `index.html?print-pdf`.
2. Print from **Chrome** (`Cmd/Ctrl + P`).
3. Set **Destination** to "Save as PDF", **Layout** to Landscape, and turn off headers/footers and margins.
4. Verify all 13 slides render with no clipped text before submitting.

## Assets

Everything referenced by the deck (video, poster image, any images) goes in `presentation/assets/`. Commit the files directly — do not hotlink external URLs. Two files are referenced but not yet recorded:

- `assets/clearcart-demo.mp4`
- `assets/demo-poster.png`

Until those exist, slide 12 shows a placeholder block automatically (the `<video>` element's `onerror` handler swaps it in). Once both files are added to `assets/`, the video will play in their place — no code changes needed.
