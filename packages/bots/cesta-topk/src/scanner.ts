import {
  fetchActiveNegRiskEvents,
  getOrderBook,
  loadConfig,
  parseAskDepthUsd,
  parseBestAsk,
  saveBookSnapshot,
  saveOpportunity,
  watchToken,
  type GammaEvent,
  type GammaMarket,
} from '@bot-trading/core';
import {
  classifyOutcomeSpace,
  computeEdgePct,
  isTradeableTopK,
  parseTokenIds,
} from './outcome-space.js';
import type { BasketLeg, BasketOpportunity } from './types.js';
import type { WatchlistEntry } from './watchlist.js';

async function buildLeg(
  market: GammaMarket,
  tokenId: string,
): Promise<BasketLeg | null> {
  const book = await getOrderBook(tokenId);
  const bestAsk = parseBestAsk(book);
  if (bestAsk === null) return null;

  const askDepthUsd = parseAskDepthUsd(book);
  watchToken(tokenId, { conditionId: market.conditionId, strategyId: 'cesta-topk' });
  saveBookSnapshot({
    tokenId,
    conditionId: market.conditionId,
    strategyId: 'cesta-topk',
    bestAsk,
    askDepth: askDepthUsd,
  });

  return {
    tokenId,
    conditionId: market.conditionId,
    question: market.question,
    bestAsk,
    askDepthUsd,
    tickSize: book.tick_size ?? '0.01',
  };
}

export async function discoverWatchlist(): Promise<WatchlistEntry[]> {
  const events = await fetchActiveNegRiskEvents(100);
  const entries: WatchlistEntry[] = [];

  for (const event of events) {
    const cls = classifyOutcomeSpace(event);
    if (!isTradeableTopK(cls)) continue;

    const markets = (event.markets ?? []).filter((m) => m.enableOrderBook !== false);
    const tokenIds: string[] = [];
    for (const m of markets) {
      const ids = parseTokenIds(m);
      if (ids[0]) tokenIds.push(ids[0]);
    }
    if (tokenIds.length >= 2) {
      entries.push({
        eventId: event.id,
        eventTitle: event.title,
        tokenIds,
        k: cls.k,
      });
    }
  }

  return entries;
}

export async function scanNegRiskBaskets(
  log: { info: (obj: object, msg?: string) => void; debug: (obj: object, msg?: string) => void },
  events?: GammaEvent[],
): Promise<BasketOpportunity[]> {
  const cfg = loadConfig();
  const source = events ?? (await fetchActiveNegRiskEvents(50));
  const opportunities: BasketOpportunity[] = [];

  for (const event of source) {
    const opp = await scanEvent(event, cfg.MIN_EDGE_PCT, cfg.DEPTH_SIZING_FACTOR, log);
    if (opp) {
      opportunities.push(opp);
      saveOpportunity('cesta-topk', event.id, opp.edgePct, {
        title: opp.eventTitle,
        sumAsks: opp.sumAsks,
        k: opp.k,
        legs: opp.legs.length,
        maxSizeUsd: opp.maxSizeUsd,
      });
    }
  }

  return opportunities.sort((a, b) => b.edgePct - a.edgePct);
}

export async function scanEventById(
  eventId: string,
  eventTitle: string,
  tokenIds: string[],
  k: number,
  log: { info: (obj: object, msg?: string) => void; debug: (obj: object, msg?: string) => void },
): Promise<BasketOpportunity | null> {
  const cfg = loadConfig();
  const legs: BasketLeg[] = [];

  for (const tokenId of tokenIds) {
    const book = await getOrderBook(tokenId);
    const bestAsk = parseBestAsk(book);
    if (bestAsk === null) return null;
    const askDepthUsd = parseAskDepthUsd(book);
    legs.push({
      tokenId,
      conditionId: '',
      question: tokenId,
      bestAsk,
      askDepthUsd,
      tickSize: book.tick_size ?? '0.01',
    });
  }

  const sumAsks = legs.reduce((s, l) => s + l.bestAsk, 0);
  const edgePct = computeEdgePct(sumAsks, k);
  if (edgePct < cfg.MIN_EDGE_PCT) return null;

  const maxSizeUsd = Math.min(
    ...legs.map((l) => l.askDepthUsd * cfg.DEPTH_SIZING_FACTOR),
    cfg.MAX_POSITION_USD,
  );
  if (maxSizeUsd < 5) return null;

  log.info({ eventId, sumAsks, k, edgePct }, 'WS-triggered basket opportunity');
  return { eventId, eventTitle, legs, sumAsks, edgePct, maxSizeUsd, k };
}

async function scanEvent(
  event: GammaEvent,
  minEdgePct: number,
  depthFactor: number,
  log: { info: (obj: object, msg?: string) => void; debug: (obj: object, msg?: string) => void },
): Promise<BasketOpportunity | null> {
  const cls = classifyOutcomeSpace(event);
  if (!isTradeableTopK(cls)) {
    log.debug({ eventId: event.id, type: cls.type }, 'Skipping non-top-K event');
    return null;
  }

  const markets = (event.markets ?? []).filter((m) => m.enableOrderBook !== false);
  const legs: BasketLeg[] = [];

  for (const market of markets) {
    const tokenIds = parseTokenIds(market);
    if (tokenIds.length === 0) continue;
    const leg = await buildLeg(market, tokenIds[0]);
    if (!leg) return null;
    legs.push(leg);
  }

  if (legs.length < 2) return null;

  const k = cls.k;
  const sumAsks = legs.reduce((s, l) => s + l.bestAsk, 0);
  const edgePct = computeEdgePct(sumAsks, k);

  if (edgePct < minEdgePct) {
    log.debug({ eventId: event.id, sumAsks, k, edgePct }, 'Edge below threshold');
    return null;
  }

  const maxSizeUsd = Math.min(
    ...legs.map((l) => l.askDepthUsd * depthFactor),
    loadConfig().MAX_POSITION_USD,
  );

  if (maxSizeUsd < 5) return null;

  log.info(
    { eventId: event.id, title: event.title, sumAsks, k, edgePct, maxSizeUsd },
    'NegRisk basket opportunity',
  );

  return {
    eventId: event.id,
    eventTitle: event.title,
    legs,
    sumAsks,
    edgePct,
    maxSizeUsd,
    k,
  };
}
