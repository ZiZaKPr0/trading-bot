import { MarketWsFeed } from '@bot-trading/core';

export interface WatchlistEntry {
  eventId: string;
  eventTitle: string;
  tokenIds: string[];
  k: number;
}

export class CestaWatchlist {
  private entries = new Map<string, WatchlistEntry>();
  private ws: MarketWsFeed | null = null;
  private onPriceUpdate: (tokenId: string, bestAsk?: number) => void;

  constructor(onPriceUpdate: (tokenId: string, bestAsk?: number) => void) {
    this.onPriceUpdate = onPriceUpdate;
  }

  startWs() {
    this.ws = new MarketWsFeed(({ tokenId, bestAsk }) => {
      this.onPriceUpdate(tokenId, bestAsk);
    });
    this.ws.start();
    const allTokens = [...this.entries.values()].flatMap((e) => e.tokenIds);
    if (allTokens.length) this.ws.subscribe(allTokens);
  }

  stopWs() {
    this.ws?.stop();
    this.ws = null;
  }

  update(entries: WatchlistEntry[]) {
    this.entries.clear();
    for (const e of entries) this.entries.set(e.eventId, e);
    const tokens = entries.flatMap((e) => e.tokenIds);
    if (this.ws) this.ws.subscribe(tokens);
  }

  getEntries() {
    return [...this.entries.values()];
  }

  getEvent(eventId: string) {
    return this.entries.get(eventId);
  }
}
