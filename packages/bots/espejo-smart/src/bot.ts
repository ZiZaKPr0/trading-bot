import { BotRunner, loadConfig } from '@bot-trading/core';
import { copyTrade } from './copy-engine.js';
import { pollWatchlistTrades } from './trade-monitor.js';
import { getActiveWatchlist } from './watchlist.js';
import { runWalletScoring } from './wallet-scorer.js';

const MONITOR_INTERVAL_MS = 2_000;

export class EspejoSmartBot extends BotRunner {
  private watchlist: string[] = [];
  private lastScoreAt = 0;
  private lastMonitorAt = 0;

  constructor() {
    super('espejo-smart');
  }

  protected async onStart() {
    const cfg = loadConfig();
    await this.refreshWatchlist();
    this.ctx.log.info(
      {
        watchlist: this.watchlist.length,
        dryRun: cfg.ESPEJO_DRY_RUN,
        maxSlippageCents: cfg.MAX_SLIPPAGE_CENTS,
        delayMs: 0,
      },
      'Espejo Smart ready (copy instantáneo)',
    );
  }

  protected async tick() {
    const cfg = loadConfig();
    const now = Date.now();

    if (now - this.lastScoreAt >= cfg.ESPEJO_SCORE_INTERVAL_MS) {
      await this.refreshWatchlist();
      this.lastScoreAt = now;
    }

    if (now - this.lastMonitorAt < MONITOR_INTERVAL_MS) return;
    this.lastMonitorAt = now;

    if (this.watchlist.length === 0) return;

    const trades = await pollWatchlistTrades(this.watchlist);
    for (const trade of trades) {
      await copyTrade(trade, this.ctx.paperMode, cfg.ESPEJO_DRY_RUN, this.ctx.log);
    }
  }

  private async refreshWatchlist() {
    const scored = await runWalletScoring(this.ctx.log);
    this.watchlist = scored.map((s) => s.walletAddress);
    if (this.watchlist.length === 0) {
      this.watchlist = getActiveWatchlist();
    }
    this.ctx.log.info({ count: this.watchlist.length }, 'Watchlist updated');
  }
}
