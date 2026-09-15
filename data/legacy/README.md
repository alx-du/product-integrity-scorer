# Legacy data — retired, do not load

Files here were produced under an earlier scoring model that the research
superseded. They are kept for provenance and must not be read by the
extension, the API, or the pipeline.

## trader-joes-eggs.json

Four Trader Joe's egg products, hand-scored 0–100 per dimension in May 2026.

**Why it was retired.** It predates the framework specified in
[CAPSTONE.md](../../CAPSTONE.md) §3.1 and contradicts it in three ways:

1. **Every dimension carries a number.** Under the current model, a dimension
   with no independent source returns `Unknown` and carries no number at all.
   The egg file scores all five dimensions for all four products, which asserts
   evidence that was never found.
2. **Sourcing transparency is scored, not flagged.** All four products come
   from Pete & Gerry's, established by journalist investigation rather than by
   any Trader Joe's disclosure. Under §3.1 that is `Inferred` at capped
   confidence for the supplier-linked findings, and the retailer's own silence
   on origin is `Unknown` — a Principle 21 communication failure, not a 54.
3. **Scores were composed by weighted averaging** of sub-categories
   (`labor × 0.6 + sourcing × 0.4`), which §3.5 rejects.

**What replaced it.** The six goods in
[clearcart-source-pipeline/output/products/](../../clearcart-source-pipeline/output/products/),
which are coded to the four coverage states and carry per-claim attribution.
Those are the pilot set.

**If you want the egg case back.** The underlying indicator data is still
sound and eggs are one of the rare categories where good-level third-party
evidence genuinely exists (USDA Organic, Certified Humane). Re-scoring it to
spec is real work with real judgment calls — it needs a human deciding what
each indicator gates, not a mechanical conversion of the old numbers.
