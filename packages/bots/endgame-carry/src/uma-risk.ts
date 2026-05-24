import { loadConfig } from '@bot-trading/core';

const UMA_DISPUTE_KEYWORDS = [
  'subjective',
  'interpretation',
  'discretion',
  'consensus of',
  'generally considered',
  'widely regarded',
  'consensus among',
];

const POLITICS_KEYWORDS = [
  'president',
  'election',
  'congress',
  'senate',
  'fed ',
  'federal reserve',
  'impeach',
  'ukraine',
  'geopolit',
  'war ',
  'invasion',
];

const SAFE_CATEGORIES = [
  'sport',
  'nba',
  'nfl',
  'mlb',
  'soccer',
  'football',
  'tennis',
  'ufc',
  'f1',
  'cricket',
  'score',
  'win ',
  'champion',
];

export interface UmaRiskAssessment {
  allowed: boolean;
  riskScore: number;
  reasons: string[];
}

export function assessUmaRisk(question: string, slug?: string): UmaRiskAssessment {
  const text = `${question} ${slug ?? ''}`.toLowerCase();
  const reasons: string[] = [];
  let riskScore = 0;

  for (const kw of UMA_DISPUTE_KEYWORDS) {
    if (text.includes(kw)) {
      reasons.push(`Subjective: ${kw}`);
      riskScore += 30;
    }
  }

  for (const kw of POLITICS_KEYWORDS) {
    if (text.includes(kw)) {
      reasons.push(`Politics/geopolitics: ${kw}`);
      riskScore += 40;
    }
  }

  const isSafe = SAFE_CATEGORIES.some((c) => text.includes(c));
  if (!isSafe) {
    reasons.push('Not in safe category list');
    riskScore += 20;
  }

  return {
    allowed: riskScore < 40,
    riskScore,
    reasons,
  };
}

export function isWithinCarryRange(price: number): boolean {
  const cfg = loadConfig();
  return price >= cfg.CARRY_MIN_PRICE && price <= cfg.CARRY_MAX_PRICE;
}
