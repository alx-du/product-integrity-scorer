// All extraction prompts live here so you can iterate on them without touching code.

export const PILLARS = ["planet", "people_supply_chain", "quality", "value", "transparency"];

// Stage 1 — profile the source itself: methodology, monetization, trust tier
export function sourceProfilePrompt(name, pages) {
  return `You are a research analyst for ClearCart, a consumer-transparency project that evaluates products against five pillars: Planet (environmental impact), People & Supply Chain (labor/sourcing ethics), Quality (performance & durability), Value (price vs. what you get), and Transparency (honesty of claims, certifications, disclosure).

Analyze this content-creator / review source and return ONLY valid JSON (no markdown fences, no preamble) with this exact shape:

{
  "source_name": string,
  "evidence_type": one of ["hands_on_testing", "desk_research", "certification_analysis", "expert_interviews", "aggregation", "opinion", "mixed"],
  "methodology_summary": string (2-3 sentences, your own words),
  "monetization": string[] (e.g. "amazon_affiliate", "consulting_services", "sponsorships", "newsletter", "none_disclosed"),
  "conflict_of_interest_notes": string,
  "pillar_coverage": { one key per pillar from [${PILLARS.map((p) => `"${p}"`).join(", ")}], each with { "coverage": "strong"|"partial"|"absent", "note": string } },
  "trust_tier": "high"|"medium"|"low",
  "trust_tier_rationale": string,
  "verifiability": string (can a third party check their claims? how?)
}

Rules:
- Base every field only on the provided content. If information is missing, say so in the note rather than guessing.
- Marketing claims about the source's own rigor are claims, not evidence; weigh what they demonstrably show (published test data, named certifications, footage) over what they assert.

SOURCE: ${name}

CONTENT:
${pages.map((p) => `--- PAGE: ${p.url} ---\n${p.text}`).join("\n\n")}`;
}

// Stage 2 — extract one reviewed product and score its evidence against the pillars
export function productExtractionPrompt(sourceName, page) {
  return `You are a research analyst for ClearCart. From this product review, extract the primary product reviewed and assess what evidence the reviewer provides for each of ClearCart's five pillars.

Return ONLY valid JSON (no markdown fences) with this exact shape:

{
  "product_name": string,
  "brand": string,
  "category": string (e.g. "cookware", "laundry_detergent", "dishwasher"),
  "reviewer_verdict": string (1-2 sentences, paraphrased in your own words — do NOT quote the review),
  "pillars": {
    ${PILLARS.map(
      (p) => `"${p}": {
      "status": "evidenced" | "brand_claim_only" | "gap",
      "claims": [ { "claim": string (paraphrased), "evidence_kind": "tested" | "cited_third_party" | "brand_claim_repeated" | "anecdotal" | "none", "confidence": "high" | "medium" | "low" } ],
      "gap_note": string (if status is "gap": what ClearCart must source independently to fill it, e.g. "LCA data", "labor audit", "energy-efficiency dataset")
    }`
    ).join(",\n    ")}
  },
  "notable_signals": string[] (anything methodologically interesting, e.g. novel tests worth adopting)
}

Rules:
- Paraphrase everything; never copy sentences from the source.
- "evidenced" requires the reviewer's own testing or a named third-party dataset. A repeated manufacturer claim is "brand_claim_only".
- Confidence: "high" only for instrumented/repeatable tests; anecdotal experience caps at "low"; cited third-party data is "medium" until independently verified.
- If the review says nothing about a pillar, status is "gap" — do not infer.

SOURCE: ${sourceName}
PAGE: ${page.url}

CONTENT:
${page.text}`;
}

// Stage 0 — resolve an unstructured user query into one specific, checkable
// product name, or a short list to disambiguate. This is the "iphone 15" ->
// "iPhone 15 Pro 64GB" step: an unstructured string almost never names an
// assessable product on its own, and guessing silently would mean showing a
// report for a product the user never actually asked about.
//
// `searchResults` is raw text handed in by the caller (a web search, a
// Tavily call, a catalog lookup — whatever the resolution step is backed
// by). This prompt does not search the internet itself; it grounds a name
// only in what it's given, the same way sourceProfilePrompt and
// productExtractionPrompt only ever see fetched page text. Wiring an actual
// search call in front of this is a separate, still-open piece of work —
// see BACKLOG.md A1.
export function productResolutionPrompt(userQuery, searchResults) {
  return `You are resolving a shopper's product search into one specific, checkable product for ClearCart.

The shopper typed: "${userQuery}"

This is almost never enough on its own — "iphone 15" could mean the base model, the Plus, the Pro, the Pro Max, any storage tier, any color. Your job is to find the SPECIFIC product the search results below actually describe, not to guess the most popular one.

Return ONLY valid JSON (no markdown fences) with this exact shape:

{
  "status": "resolved" | "ambiguous" | "not_found",
  "resolved_name": string | null (the full specific product name, e.g. "iPhone 15 Pro, 64GB, Titanium" — null unless status is "resolved"),
  "brand": string | null,
  "category": string | null,
  "confirmation_question": string | null (only when status is "ambiguous" or "resolved" and confirmation is warranted, e.g. "Did you mean the iPhone 15 Pro 64GB?"),
  "candidates": string[] (when status is "ambiguous": the specific product names the query could plausibly mean, most likely first; empty otherwise),
  "reasoning": string (1-2 sentences: what in the search results justified this, or why it couldn't be resolved)
}

Rules:
- "resolved" requires the search results to name one specific product clearly enough that a reasonable shopper would recognize it as "the one." A single plausible-sounding guess with no support in the results is NOT resolved — it's "ambiguous" or "not_found."
- Never invent a variant, SKU, or spec that doesn't appear in the search results. If the results don't distinguish storage size or color, say so in reasoning and leave that detail out of resolved_name rather than picking one.
- "not_found" is a correct, useful answer when the query doesn't match anything in the results. Do not force a match.
- This step never scores or assesses the product. It only identifies which product is being asked about.

USER QUERY: ${userQuery}

SEARCH RESULTS:
${searchResults}`;
}

// Stage 3 (optional) — suggest category-specific pillar customizations
export function pillarCustomizationPrompt(category, productRecords) {
  return `You are helping ClearCart adapt its five evaluation pillars (Planet, People & Supply Chain, Quality, Value, Transparency) into category-specific sub-criteria.

Category: ${category}

Below are extracted product assessments from independent reviewers in this category, including the tests and signals they used. Propose how each pillar should be operationalized FOR THIS CATEGORY, borrowing the strongest reviewer techniques and filling the gaps they leave.

Return ONLY valid JSON:
{
  "category": string,
  "pillar_criteria": { one key per pillar, each an array of { "criterion": string, "measurement": string (how to measure/score it), "data_source": string (where the data would come from), "borrowed_from": string|null (which reviewer technique inspired it, for credit) } },
  "known_gaps": string[] (pillar areas no current reviewer covers, which ClearCart must source itself)
}

PRODUCT ASSESSMENTS:
${JSON.stringify(productRecords, null, 2)}`;
}

// Stage 4 — turn a scored Report File (output/reports/<slug>.json, produced
// by buildReports.js from extension/scoring/pillars.js) into the
// consumer-facing write-up. This is the diagram's "Report File -> LLM ->
// Final product report" step.
//
// This prompt narrates; it does not assess. The score, confidence, and
// coverage for every dimension are already final by the time this runs —
// they came out of the real scoring engine, not this call. Re-deriving or
// adjusting any of them here would let a rendering step quietly override an
// assessment step, which is exactly the kind of drift CLAUDE.md's
// non-negotiables exist to prevent.
//
// The rule that matters most (CAPSTONE.md §3.8): faithful is not the same
// as honest. Compliance-grade findings shown to a non-expert reader can
// imply harm the evidence doesn't establish. This prompt's job is to
// describe exactly what was found — including "nothing was found" — without
// either inflating a Claimed/Unknown state into an accusation or flattening
// it into something that reads as a quiet failing grade.
export function reportNarrationPrompt(reportFile) {
  return `You are writing the final, consumer-facing product report for ClearCart from an already-scored Report File. You do not assess anything — every score, confidence level, and coverage state below is final. Your only job is to describe it clearly and honestly.

Return ONLY valid JSON (no markdown fences) with this exact shape:

{
  "product_name": string,
  "summary": string (2-3 sentences: what's actually known about this product, and what isn't — never a verdict, never a ranking, never a single number),
  "dimensions": {
    ${["planet", "people", "quality", "value", "transparency"].map(
      (d) => `"${d}": { "headline": string (one short line), "explanation": string (2-4 sentences) }`
    ).join(",\n    ")}
  }
}

Non-negotiable rules — breaking any of these produces an unusable report:

- NEVER combine, average, or rank the five dimensions against each other. No "overall," no "mostly good," no implied total. Each dimension stands completely alone.
- A dimension with coverage "unknown" gets ZERO score language. Do not say "low," "poor," or "weak." Say plainly that nothing addresses it, and — when the indicators name a specific company that could disclose but hasn't — say who. ("Unknown" is a Principle 21 communication failure by a named company, not a bad grade on the product.)
- A dimension with coverage "claimed" gets the seller's claim stated as a claim, explicitly attributed to the seller, never repeated as if it were independently established.
- A dimension with coverage "inferred" must say the evidence reaches this product through an assumption, not through the good itself — read the indicator's "assumption" field if present and say what the assumption is.
- Any indicator whose sourceScope is "entity" describes the COMPANY, not necessarily this specific product. Say so explicitly wherever it's the basis for a claim. Never let entity-level evidence read as if it were tested on this product.
- Do not add certainty the confidence level doesn't support. "High confidence" can be stated plainly; "low confidence" needs a hedge in the language itself ("a single, unverified report suggests...").
- Do not invent a source, a number, or a fact not present in the Report File below.

REPORT FILE:
${JSON.stringify(reportFile, null, 2)}`;
}
