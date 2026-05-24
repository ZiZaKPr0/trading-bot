import { getDb } from '../persistence/db.js';
import { loadConfig } from '../config/index.js';
import type { StrategyId } from '../config/index.js';

export class ExposureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExposureError';
  }
}

export function getTotalExposure(): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd), 0) as total
       FROM exposure_reservations WHERE released_at IS NULL`,
    )
    .get() as { total: number };
  return row.total;
}

export function getStrategyExposure(strategyId: StrategyId): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_usd), 0) as total
       FROM exposure_reservations
       WHERE strategy_id = ? AND released_at IS NULL`,
    )
    .get(strategyId) as { total: number };
  return row.total;
}

export function reserveExposure(
  strategyId: StrategyId,
  amountUsd: number,
  marketId?: string,
): number {
  const cfg = loadConfig();
  const db = getDb();

  const run = db.transaction(() => {
    const total = getTotalExposure();
    if (total + amountUsd > cfg.MAX_TOTAL_EXPOSURE_USD) {
      throw new ExposureError(
        `Total exposure ${total + amountUsd} exceeds max ${cfg.MAX_TOTAL_EXPOSURE_USD}`,
      );
    }

    if (amountUsd > cfg.MAX_POSITION_USD) {
      throw new ExposureError(
        `Position ${amountUsd} exceeds max ${cfg.MAX_POSITION_USD}`,
      );
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO exposure_reservations (strategy_id, market_id, amount_usd, reserved_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(strategyId, marketId ?? null, amountUsd, now);

    return Number(result.lastInsertRowid);
  });

  return run();
}

export function releaseExposure(reservationId: number) {
  const db = getDb();
  db.prepare(
    `UPDATE exposure_reservations SET released_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), reservationId);
}

export function getDailyPnl(strategyId?: StrategyId): number {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  if (strategyId) {
    const row = db
      .prepare(
        `SELECT COALESCE(pnl, 0) as pnl FROM pnl_daily WHERE strategy_id = ? AND date = ?`,
      )
      .get(strategyId, today) as { pnl: number } | undefined;
    return row?.pnl ?? 0;
  }
  const row = db
    .prepare(`SELECT COALESCE(SUM(pnl), 0) as pnl FROM pnl_daily WHERE date = ?`)
    .get(today) as { pnl: number };
  return row.pnl;
}

export function checkDailyLossLimit(): boolean {
  const cfg = loadConfig();
  const pnl = getDailyPnl();
  return pnl >= -cfg.MAX_DAILY_LOSS_USD;
}

export function recordPnl(strategyId: StrategyId, delta: number) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO pnl_daily (strategy_id, date, pnl) VALUES (?, ?, ?)
     ON CONFLICT(strategy_id, date) DO UPDATE SET pnl = pnl + excluded.pnl`,
  ).run(strategyId, today, delta);

  db.prepare(
    `UPDATE bot_status SET pnl_today = pnl_today + ?, pnl_total = pnl_total + ?, updated_at = ?
     WHERE strategy_id = ?`,
  ).run(delta, delta, new Date().toISOString(), strategyId);
}

export function insertAlert(
  level: 'info' | 'warn' | 'error',
  message: string,
  strategyId?: StrategyId,
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO alerts (strategy_id, level, message, created_at) VALUES (?, ?, ?, ?)`,
  ).run(strategyId ?? null, level, message, new Date().toISOString());
}
