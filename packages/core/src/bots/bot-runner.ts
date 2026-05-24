import type { StrategyId } from '../config/index.js';
import { isBotEnabled, loadConfig } from '../config/index.js';
import { assertGeoblockAllowed, startGeofenceMonitor } from '../core/geofence.js';
import { createLogger } from '../logger.js';
import { getDb } from '../persistence/db.js';
import { setBotStatus, logTrade } from '../persistence/repository.js';
import {
  checkDailyLossLimit,
  insertAlert,
} from '../risk/exposure.js';

export interface BotContext {
  strategyId: StrategyId;
  log: ReturnType<typeof createLogger>;
  paperMode: boolean;
}

export abstract class BotRunner {
  protected ctx: BotContext;
  private running = false;
  private geofenceTimer: ReturnType<typeof setInterval> | null = null;

  constructor(protected strategyId: StrategyId) {
    this.ctx = {
      strategyId,
      log: createLogger(`bot:${strategyId}`),
      paperMode: loadConfig().PAPER_MODE,
    };
  }

  async start() {
    if (!isBotEnabled(this.strategyId)) {
      this.ctx.log.info('Bot disabled via env — exiting');
      setBotStatus(this.strategyId, 'OFF', 'Disabled in .env');
      return;
    }

    getDb();
    await assertGeoblockAllowed();
    this.geofenceTimer = startGeofenceMonitor();

    if (!checkDailyLossLimit()) {
      setBotStatus(this.strategyId, 'KILLED', 'Daily loss limit reached');
      insertAlert('error', 'Daily loss limit reached', this.strategyId);
      return;
    }

    this.running = true;
    setBotStatus(this.strategyId, 'RUNNING');
    logTrade(this.strategyId, 'bot_start', {});

    this.ctx.log.info({ paper: this.ctx.paperMode }, 'Bot starting');

    try {
      await this.onStart();
      await this.runLoop();
    } catch (err) {
      this.ctx.log.error({ err }, 'Bot error');
      setBotStatus(
        this.strategyId,
        'ERROR',
        err instanceof Error ? err.message : String(err),
      );
      insertAlert(
        'error',
        err instanceof Error ? err.message : String(err),
        this.strategyId,
      );
    }
  }

  stop() {
    this.running = false;
    if (this.geofenceTimer) clearInterval(this.geofenceTimer);
    setBotStatus(this.strategyId, 'STOPPED');
    logTrade(this.strategyId, 'bot_stop', {});
  }

  protected abstract onStart(): Promise<void>;
  protected abstract tick(): Promise<void>;

  private async runLoop() {
    while (this.running) {
      if (!checkDailyLossLimit()) {
        this.ctx.log.warn('Daily loss limit — stopping');
        setBotStatus(this.strategyId, 'KILLED', 'Daily loss limit');
        this.running = false;
        break;
      }
      await this.tick();
      await sleep(1000);
    }
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
