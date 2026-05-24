import {
  cancelAllOrders,
  createClobClient,
  getOrderBook,
  loadConfig,
  logTrade,
  parseBestAsk,
  parseBestBid,
  recordMidPrice,
} from '@bot-trading/core';
import { computeLasQuote, computeSigmaL } from './las-model.js';
import type { RewardMarket } from './market-selector.js';
import { fetchPinnacleImplied, oddsDeviationCents } from './odds-feed.js';

interface QuotedMarket {
  market: RewardMarket;
  lastMid: number;
  midHistory: { mid: number; at: number }[];
  inventory: number;
  activeOrderIds: string[];
}

export class LiquidityQuoter {
  private markets = new Map<string, QuotedMarket>();
  private paused = false;

  setMarkets(markets: RewardMarket[]) {
    for (const m of markets) {
      if (!this.markets.has(m.conditionId)) {
        this.markets.set(m.conditionId, {
          market: m,
          lastMid: 0.5,
          midHistory: [],
          inventory: 0,
          activeOrderIds: [],
        });
      } else {
        this.markets.get(m.conditionId)!.market = m;
      }
    }
  }

  isPaused() {
    return this.paused;
  }

  async quoteAll(
    paperMode: boolean,
    log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void },
  ) {
    const cfg = loadConfig();

    for (const [, qm] of this.markets) {
      await this.quoteMarket(qm, paperMode, cfg, log);
    }
  }

  private async quoteMarket(
    qm: QuotedMarket,
    paperMode: boolean,
    cfg: ReturnType<typeof loadConfig>,
    log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void },
  ) {
    const book = await getOrderBook(qm.market.tokenId);
    const bestBid = parseBestBid(book);
    const bestAsk = parseBestAsk(book);
    if (bestBid === null || bestAsk === null) return;

    const mid = (bestBid + bestAsk) / 2;
    recordMidPrice(qm.market.tokenId, mid, qm.market.conditionId);

    qm.midHistory.push({ mid, at: Date.now() });
    qm.midHistory = qm.midHistory.filter(
      (h) => h.at > Date.now() - cfg.LM_MID_MOVE_WINDOW_SEC * 1000,
    );

    if (qm.midHistory.length >= 2) {
      const oldest = qm.midHistory[0].mid;
      const moveBps = Math.abs((mid - oldest) / oldest) * 10_000;
      if (moveBps > cfg.LM_MID_MOVE_BPS_KILL) {
        log.warn({ conditionId: qm.market.conditionId, moveBps }, 'Mid moved fast — kill switch');
        await this.killSwitch(paperMode, log);
        return;
      }
    }

    const odds = await fetchPinnacleImplied('soccer_epl', qm.market.question);
    if (odds?.homeProb !== undefined) {
      const dev = oddsDeviationCents(mid, odds.homeProb);
      if (dev > 2) {
        log.warn({ dev, mid, ref: odds.homeProb }, 'Odds API deviation >2¢ — pausing');
        this.paused = true;
        await this.killSwitch(paperMode, log);
        return;
      }
    }

    const sigmaL = computeSigmaL(qm.market.tokenId, cfg.LM_SIGMA_FALLBACK);
    const quote = computeLasQuote({
      mid,
      inventory: qm.inventory,
      gamma: cfg.LM_GAMMA,
      sigmaL,
      tEffHours: 24,
      minSpread: Math.min(qm.market.maxIncentiveSpread, 0.04),
    });

    qm.lastMid = mid;

    if (paperMode) {
      log.info(
        {
          conditionId: qm.market.conditionId,
          bid: quote.bid,
          ask: quote.ask,
          mid,
          sigmaL,
        },
        'PAPER: LAS quote',
      );
      logTrade('liquidity-maker', 'paper_quote', {
        conditionId: qm.market.conditionId,
        bid: quote.bid,
        ask: quote.ask,
        mid,
      });
      return;
    }

    const client = await createClobClient();
    const { Side } = await import('@polymarket/clob-client-v2');

    if (qm.activeOrderIds.length > 0) {
      await client.cancelAll();
      qm.activeOrderIds = [];
    }

    const size = Math.max(qm.market.minIncentiveSize, 10);

    const bidResult = await client.createAndPostOrder(
      { tokenID: qm.market.tokenId, price: quote.bid, size, side: Side.BUY },
      { negRisk: false },
    );
    const askResult = await client.createAndPostOrder(
      { tokenID: qm.market.tokenId, price: quote.ask, size, side: Side.SELL },
      { negRisk: false },
    );

    if (bidResult?.orderID) qm.activeOrderIds.push(bidResult.orderID);
    if (askResult?.orderID) qm.activeOrderIds.push(askResult.orderID);

    logTrade('liquidity-maker', 'quote_posted', {
      conditionId: qm.market.conditionId,
      bid: quote.bid,
      ask: quote.ask,
      size,
    });
  }

  async killSwitch(
    paperMode: boolean,
    log: { info: (o: object, m?: string) => void },
  ) {
    if (paperMode) {
      log.info({}, 'PAPER: kill switch cancelAll');
      return;
    }
    await cancelAllOrders();
    for (const [, qm] of this.markets) {
      qm.activeOrderIds = [];
    }
    this.paused = true;
    log.info({}, 'Kill switch: all orders cancelled');
  }

  resume() {
    this.paused = false;
  }
}
