import type { GammaEvent, GammaMarket } from '@bot-trading/core';

export type OutcomeSpaceType = 'TOP_K' | 'WINNER_TAKE_ALL' | 'OPEN';

export interface OutcomeClassification {
  type: OutcomeSpaceType;
  k: number;
  reason: string;
}

const OPEN_KEYWORDS = [
  'other',
  'field',
  'anyone else',
  'someone else',
  'not listed',
  'none of the above',
];

export function classifyOutcomeSpace(event: GammaEvent): OutcomeClassification {
  const markets = (event.markets ?? []).filter((m) => m.enableOrderBook !== false);
  const k = markets.length;

  if (k < 2) {
    return { type: 'OPEN', k, reason: 'Fewer than 2 markets' };
  }

  const titleLower = (event.title ?? '').toLowerCase();
  const slugLower = (event.slug ?? '').toLowerCase();

  for (const kw of OPEN_KEYWORDS) {
    if (titleLower.includes(kw) || slugLower.includes(kw)) {
      return { type: 'OPEN', k, reason: `Open field keyword: ${kw}` };
    }
  }

  for (const m of markets) {
    const q = (m.question ?? '').toLowerCase();
    for (const kw of OPEN_KEYWORDS) {
      if (q.includes(kw)) {
        return { type: 'OPEN', k, reason: `Market has open outcome: ${m.question}` };
      }
    }
  }

  const isTopK =
    /top\s*\d+/i.test(event.title ?? '') ||
    /top\s*\d+/i.test(event.slug ?? '') ||
    (event.negRisk === true && k >= 2 && k <= 10);

  if (isTopK) {
    return { type: 'TOP_K', k, reason: `Closed top-K with ${k} outcomes` };
  }

  if (k === 2) {
    return { type: 'WINNER_TAKE_ALL', k, reason: 'Binary winner-take-all' };
  }

  if (k <= 6 && event.negRisk) {
    return { type: 'TOP_K', k, reason: `NegRisk closed set (${k} outcomes)` };
  }

  return { type: 'OPEN', k, reason: 'Unclassified — treat as open field' };
}

export function isTradeableTopK(classification: OutcomeClassification): boolean {
  return classification.type === 'TOP_K' && classification.k >= 2;
}

export function parseTokenIds(market: GammaMarket): string[] {
  if (!market.clobTokenIds) return [];
  try {
    const parsed = JSON.parse(market.clobTokenIds);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return market.clobTokenIds.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

export function computeEdgePct(sumAsks: number, k: number): number {
  if (sumAsks <= 0 || k <= 0) return 0;
  return ((k - sumAsks) / sumAsks) * 100;
}
