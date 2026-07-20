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
