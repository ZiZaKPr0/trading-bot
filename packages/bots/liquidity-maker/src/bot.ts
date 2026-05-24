import {
  BotRunner,
  loadConfig,
  startBookSnapshotJob,
  startTimeSync,
} from '@bot-trading/core';
import { refreshMarketsIfNeeded } from './market-selector.js';
import { LiquidityQuoter } from './quoter.js';
import { trackDailyRewards } from './rewards-tracker.js';
import type { RewardMarket } from './market-selector.js';

export class LiquidityMakerBot extends BotRunner {
  private quoter = new LiquidityQuoter();
  private markets: RewardMarket[] = [];
  private lastMarketRefresh = 0;
  private lastQuoteAt = 0;
  private lastRewardsTrack = 0;
  private stopJobs: (() => void)[] = [];

  constructor() {
    super('liquidity-maker');
  }

  protected async onStart() {
    this.stopJobs.push(startTimeSync());
    this.stopJobs.push(startBookSnapshotJob(30_000));
    const { markets } = await refreshMarketsIfNeeded([], 0);
    this.markets = markets;
    this.quoter.setMarkets(markets);
    this.lastMarketRefresh = Date.now();
    this.ctx.log.info({ markets: markets.length }, 'Liquidity Maker ready (LAS + rewards)');
  }

  protected async tick() {
    const cfg = loadConfig();
    const now = Date.now();

    const { markets, refreshed } = await refreshMarketsIfNeeded(
      this.markets,
      this.lastMarketRefresh,
    );
    if (refreshed) {
      this.markets = markets;
      this.quoter.setMarkets(markets);
      this.lastMarketRefresh = now;
    }

    if (now - this.lastRewardsTrack > 3_600_000) {
      const rewards = await trackDailyRewards('liquidity-maker');
      this.ctx.log.info(rewards, 'Daily rewards tracked');
      this.lastRewardsTrack = now;
    }

    if (this.quoter.isPaused()) return;

    if (now - this.lastQuoteAt >= cfg.LM_QUOTE_INTERVAL_MS) {
      this.lastQuoteAt = now;
      await this.quoter.quoteAll(this.ctx.paperMode, this.ctx.log);
    }
  }

  stop() {
    for (const fn of this.stopJobs) fn();
    void this.quoter.killSwitch(this.ctx.paperMode, this.ctx.log);
    super.stop();
  }
}
