import {
  fetchMarkets,
  getOrderBook,
  loadConfig,
  parseBestAsk,
  saveOpportunity,
  watchToken,
  type GammaMarket,
} from '@bot-trading/core';
import { assessUmaRisk, isWithinCarryRange } from './uma-risk.js';
import { assessResolutionRules } from './resolution-llm.js';

export interface TailCandidate {
  marketId: string;
  conditionId: string;
  tokenId: string;
  question: string;
  bestAsk: number;
  impliedApy: number;
  sizeUsd: number;
}

function parseTokenIds(market: GammaMarket): string[] {
  if (!market.clobTokenIds) return [];
  try {
    const parsed = JSON.parse(market.clobTokenIds);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return market.clobTokenIds.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function estimateApy(price: number, daysToResolve = 14): number {
  const gain = (1 - price) / price;
  return (gain / Math.max(daysToResolve, 1)) * 365 * 100;
}

export async function scanTailMarkets(
  log: { info: (o: object, m?: string) => void; debug: (o: object, m?: string) => void },
): Promise<TailCandidate[]> {
  const cfg = loadConfig();
  const markets = await fetchMarkets({ active: true, closed: false, limit: 100 });
  const candidates: TailCandidate[] = [];

  for (const market of markets) {
    if (market.enableOrderBook === false) continue;

    const uma = assessUmaRisk(market.question, (market as { slug?: string }).slug);
    if (!uma.allowed) {
      log.debug({ question: market.question, reasons: uma.reasons }, 'UMA risk skip');
      continue;
    }

    const resolution = await assessResolutionRules(market.question);
    if (!resolution.allowed) {
      log.debug({ question: market.question, reason: resolution.reason }, 'Resolution filter skip');
      continue;
    }

    const tokenIds = parseTokenIds(market);
    if (!tokenIds[0]) continue;

    const book = await getOrderBook(tokenIds[0]);
    const bestAsk = parseBestAsk(book);
    if (bestAsk === null || !isWithinCarryRange(bestAsk)) continue;

    watchToken(tokenIds[0], {
      conditionId: market.conditionId,
      strategyId: 'endgame-carry',
    });

    const sizeUsd = cfg.CARRY_POSITION_SIZE_USD;
    const impliedApy = estimateApy(bestAsk);

    candidates.push({
      marketId: market.id,
      conditionId: market.conditionId,
      tokenId: tokenIds[0],
      question: market.question,
      bestAsk,
      impliedApy,
      sizeUsd,
    });

    saveOpportunity('endgame-carry', market.id, impliedApy, {
      question: market.question,
      bestAsk,
      impliedApy,
    });
  }

  return candidates.sort((a, b) => b.impliedApy - a.impliedApy);
}
