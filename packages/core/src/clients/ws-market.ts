import { loadConfig } from '../config/index.js';
import { createLogger } from '../logger.js';
import { ReconnectingWs } from './ws-base.js';

const log = createLogger('ws-market');

export type PriceUpdateHandler = (update: {
  tokenId: string;
  bestBid?: number;
  bestAsk?: number;
  price?: number;
  eventType: string;
}) => void;

export class MarketWsFeed {
  private ws: ReconnectingWs | null = null;
  private subscribed = new Set<string>();
  private handler: PriceUpdateHandler;

  constructor(handler: PriceUpdateHandler) {
    this.handler = handler;
  }

  start() {
    const cfg = loadConfig();
    this.ws = new ReconnectingWs({
      url: cfg.WS_MARKET,
      name: 'market',
      onOpen: () => this.resubscribe(),
      onMessage: (data) => this.handleMessage(data),
    });
    this.ws.start();
  }

  stop() {
    this.ws?.stop();
    this.ws = null;
  }

  subscribe(tokenIds: string[]) {
    for (const id of tokenIds) this.subscribed.add(id);
    if (this.ws?.isConnected()) this.sendSubscribe(tokenIds);
  }

  unsubscribe(tokenIds: string[]) {
    for (const id of tokenIds) this.subscribed.delete(id);
  }

  private resubscribe() {
    if (this.subscribed.size > 0) {
      this.sendSubscribe([...this.subscribed]);
    }
  }

  private sendSubscribe(tokenIds: string[]) {
    this.ws?.send({
      assets_ids: tokenIds,
      type: 'market',
    });
    log.debug({ count: tokenIds.length }, 'Subscribed market WS tokens');
  }

  private handleMessage(data: unknown) {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;
    const eventType = String(msg.event_type ?? msg.type ?? 'unknown');

    if (eventType === 'price_change' && Array.isArray(msg.price_changes)) {
      for (const pc of msg.price_changes as Record<string, unknown>[]) {
        const tokenId = String(pc.asset_id ?? pc.token_id ?? '');
        if (!tokenId) continue;
        this.handler({
          tokenId,
          bestBid: pc.best_bid ? parseFloat(String(pc.best_bid)) : undefined,
          bestAsk: pc.best_ask ? parseFloat(String(pc.best_ask)) : undefined,
          price: pc.price ? parseFloat(String(pc.price)) : undefined,
          eventType,
        });
      }
      return;
    }

    const tokenId = String(msg.asset_id ?? msg.token_id ?? '');
    if (!tokenId) return;

    const bids = msg.bids as { price: string }[] | undefined;
    const asks = msg.asks as { price: string }[] | undefined;

    this.handler({
      tokenId,
      bestBid: bids?.length ? parseFloat(bids[0].price) : undefined,
      bestAsk: asks?.length ? parseFloat(asks[0].price) : undefined,
      eventType,
    });
  }
}
