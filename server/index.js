/**
 * server/index.js — Product Integrity Scorer API
 *
 * Endpoints:
 *   POST /api/score   - score a product (checks Supabase cache first)
 *   GET  /api/health  - health check
 *
 * Stack: Node.js + Express + Prisma + Supabase PostgreSQL
 */

'use strict';

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PORT = process.env.PORT || 3000;
const CACHE_TTL_DAYS = 7;

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'chrome-extension://*',
    'http://localhost:*'
  ]
}));
app.use(express.json());

// ─── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/score
 * Body: { productName: string, productUrl?: string, retailer: string }
 * Returns: { planet, people, quality, value, transparency, cached: boolean }
 */
app.post('/api/score', async (req, res) => {
  const { productName, productUrl, retailer } = req.body;

  if (!productName || !retailer) {
    return res.status(400).json({ error: 'productName and retailer are required' });
  }

  try {
    // 1. Check cache (7-day TTL)
    const cached = await getCachedScores(productName, retailer);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // 2. Score with AI pipeline
    const scores = await scoreWithAI(productName, productUrl, retailer);

    // 3. Persist to database
    await persistScores(productName, productUrl, retailer, scores);

    return res.json({ ...scores, cached: false });

  } catch (err) {
    console.error('[API] Score error:', err);
    return res.status(500).json({ error: 'Scoring failed', details: err.message });
  }
});

// ─── Cache logic ───────────────────────────────────────────────────────────

async function getCachedScores(productName, retailer) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);

  const product = await prisma.product.findFirst({
    where: { name: { contains: productName }, retailer },
    include: {
      pillarScores: {
        where: { scoredAt: { gte: cutoff } }
      }
    }
  });

  if (!product || product.pillarScores.length < 5) return null;

  const scores = {};
  product.pillarScores.forEach(ps => {
    scores[ps.pillar] = {
      score: ps.score,
      confidence: ps.confidence
    };
  });

  return scores;
}

// ─── AI scoring pipeline ───────────────────────────────────────────────────

async function scoreWithAI(productName, productUrl, retailer) {
  const prompt = buildScoringPrompt(productName, retailer);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const responseText = message.content[0].text;
  return parseScoresFromResponse(responseText);
}

function buildScoringPrompt(productName, retailer) {
  return `You are scoring a product using the Product Integrity framework.

Product: "${productName}"
Retailer: ${retailer}

Score this product on each of the 5 pillars (0-100) based on publicly available information.
Also provide a confidence level (high/medium/low) for each score.

Pillars:
- planet: Environmental sustainability (organic certs, land use, packaging)
- people: Labor ethics + supply chain transparency (Fair Trade, factory disclosure, B Corp)
- quality: Product quality and authenticity (grade, ingredients, certifications)
- value: Pricing fairness and corporate ownership (price vs. market, brand independence)
- transparency: Claim credibility (third-party verified claims, greenwashing flags)

Respond ONLY with valid JSON in this exact format:
{
  "planet": { "score": 75, "confidence": "high" },
  "people": { "score": 64, "confidence": "medium" },
  "quality": { "score": 80, "confidence": "high" },
  "value": { "score": 70, "confidence": "medium" },
  "transparency": { "score": 55, "confidence": "medium" }
}`;
}

function parseScoresFromResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in response');
    return JSON.parse(match[0]);
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err.message}`);
  }
}

// ─── Persistence ───────────────────────────────────────────────────────────

async function persistScores(productName, productUrl, retailer, scores) {
  const product = await prisma.product.upsert({
    where: { productUrl: productUrl || `${retailer}:${productName}` },
    update: { name: productName, updatedAt: new Date() },
    create: {
      name: productName,
      retailer,
      productUrl: productUrl || `${retailer}:${productName}`
    }
  });

  const pillarEntries = Object.entries(scores).map(([pillar, data]) => ({
    productId: product.id,
    pillar,
    score: data.score,
    confidence: data.confidence,
    scoredBy: 'ai'
  }));

  await prisma.pillarScore.createMany({ data: pillarEntries });
}

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Product Integrity Scorer API running on port ${PORT}`);
});

module.exports = app;
