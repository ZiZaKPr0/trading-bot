import { BotRunner, loadConfig, startBookSnapshotJob } from '@bot-trading/core';
import { executeTailBuy } from './executor.js';
import { scanTailMarkets } from './scanner.js';

const SCAN_INTERVAL_MS = 300_000;

export class EndgameCarryBot extends BotRunner {
  private lastScanAt = 0;
  private stopJob: (() => void) | null = null;

  constructor() {
    super('endgame-carry');
  }

  protected async onStart() {
    const cfg = loadConfig();
    this.stopJob = startBookSnapshotJob(30_000);
    this.ctx.log.info(
      {
        range: `${cfg.CARRY_MIN_PRICE}-${cfg.CARRY_MAX_PRICE}`,
        maxPositions: cfg.CARRY_MAX_POSITIONS,
        llm: cfg.LLM_RESOLUTION_FILTER,
      },
      'Endgame Carry ready',
    );
  }

  protected async tick() {
    const now = Date.now();
    if (now - this.lastScanAt < SCAN_INTERVAL_MS) return;
    this.lastScanAt = now;

    const candidates = await scanTailMarkets(this.ctx.log);
    if (candidates.length === 0) return;

    await executeTailBuy(candidates[0], this.ctx.paperMode, this.ctx.log);
  }

  stop() {
    this.stopJob?.();
    super.stop();
  }
}
