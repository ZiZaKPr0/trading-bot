import { BotRunner, startBookSnapshotJob, startTimeSync } from '@bot-trading/core';
import { executeBasket } from './executor.js';
import { discoverWatchlist, scanEventById, scanNegRiskBaskets } from './scanner.js';
import { CestaWatchlist } from './watchlist.js';

const DISCOVERY_INTERVAL_MS = 180_000;
const SCAN_INTERVAL_MS = 30_000;

export class CestaTopKBot extends BotRunner {
  private watchlist: CestaWatchlist;
  private lastDiscoveryAt = 0;
  private lastScanAt = 0;
  private pendingWsScan = new Set<string>();
  private stopJobs: (() => void)[] = [];

  constructor() {
    super('cesta-topk');
    this.watchlist = new CestaWatchlist((tokenId, bestAsk) => {
      if (bestAsk !== undefined) {
        for (const entry of this.watchlist.getEntries()) {
          if (entry.tokenIds.includes(tokenId)) {
            this.pendingWsScan.add(entry.eventId);
          }
        }
      }
    });
  }

  protected async onStart() {
    this.stopJobs.push(startTimeSync());
    this.stopJobs.push(startBookSnapshotJob(30_000));
    this.watchlist.startWs();
    await this.refreshWatchlist();
    this.ctx.log.info('Cesta Top-K ready (NegRisk top-K, WS + poll)');
  }

  protected async tick() {
    const now = Date.now();

    if (now - this.lastDiscoveryAt >= DISCOVERY_INTERVAL_MS) {
      await this.refreshWatchlist();
      this.lastDiscoveryAt = now;
    }

    if (this.pendingWsScan.size > 0) {
      for (const eventId of this.pendingWsScan) {
        const entry = this.watchlist.getEvent(eventId);
        if (!entry) continue;
        const opp = await scanEventById(
          entry.eventId,
          entry.eventTitle,
          entry.tokenIds,
          entry.k,
          this.ctx.log,
        );
        if (opp) await executeBasket(opp, this.ctx.paperMode, this.ctx.log);
      }
      this.pendingWsScan.clear();
    }

    if (now - this.lastScanAt < SCAN_INTERVAL_MS) return;
    this.lastScanAt = now;

    const opportunities = await scanNegRiskBaskets(this.ctx.log);
    if (opportunities.length === 0) return;

    await executeBasket(opportunities[0], this.ctx.paperMode, this.ctx.log);
  }

  stop() {
    this.watchlist.stopWs();
    for (const fn of this.stopJobs) fn();
    super.stop();
  }

  private async refreshWatchlist() {
    const entries = await discoverWatchlist();
    this.watchlist.update(entries);
    this.ctx.log.info({ events: entries.length }, 'Watchlist refreshed');
  }
}
