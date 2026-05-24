import { getDb } from '../persistence/db.js';
import type { BotStatus, StrategyId } from '../config/index.js';

export function setBotStatus(
  strategyId: StrategyId,
  status: BotStatus,
  message?: string,
) {
  const db = getDb();
  db.prepare(
    `UPDATE bot_status SET status = ?, message = ?, updated_at = ? WHERE strategy_id = ?`,
  ).run(status, message ?? null, new Date().toISOString(), strategyId);
}

export function incrementOpsToday(strategyId: StrategyId) {
  const db = getDb();
  db.prepare(
    `UPDATE bot_status SET ops_today = ops_today + 1, updated_at = ? WHERE strategy_id = ?`,
  ).run(new Date().toISOString(), strategyId);
}

export function getAllBotStatus() {
  const db = getDb();
  return db.prepare(`SELECT * FROM bot_status ORDER BY strategy_id`).all();
}

export function logTrade(
  strategyId: StrategyId,
  action: string,
  details: Record<string, unknown>,
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO trades_log (strategy_id, action, details_json, created_at) VALUES (?, ?, ?, ?)`,
  ).run(
    strategyId,
    action,
    JSON.stringify(details),
    new Date().toISOString(),
  );
}

export function saveOpportunity(
  strategyId: StrategyId,
  eventId: string,
  edgePct: number,
  details: Record<string, unknown>,
  executed = false,
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO opportunities (strategy_id, event_id, edge_pct, executed, details_json, detected_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    strategyId,
    eventId,
    edgePct,
    executed ? 1 : 0,
    JSON.stringify(details),
    new Date().toISOString(),
  );
}

export function saveBookSnapshot(data: {
  tokenId: string;
  conditionId?: string;
  strategyId?: StrategyId;
  bestBid?: number;
  bestAsk?: number;
  mid?: number;
  bidDepth?: number;
  askDepth?: number;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO book_snapshots
     (token_id, condition_id, strategy_id, best_bid, best_ask, mid, bid_depth, ask_depth, snapshot_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    data.tokenId,
    data.conditionId ?? null,
    data.strategyId ?? null,
    data.bestBid ?? null,
    data.bestAsk ?? null,
    data.mid ?? null,
    data.bidDepth ?? null,
    data.askDepth ?? null,
    new Date().toISOString(),
  );
}

export function getRecentTrades(limit = 20, strategyId?: StrategyId) {
  const db = getDb();
  if (strategyId) {
    return db
      .prepare(
        `SELECT * FROM trades_log WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(strategyId, limit);
  }
  return db
    .prepare(`SELECT * FROM trades_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
}

export function getRecentAlerts(limit = 10) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM alerts WHERE acknowledged = 0 ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit);
}

export function getRecentOpportunities(strategyId: StrategyId, limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM opportunities WHERE strategy_id = ? ORDER BY detected_at DESC LIMIT ?`,
    )
    .all(strategyId, limit);
}

export function saveOrder(data: {
  id: string;
  strategyId: StrategyId;
  marketId?: string;
  tokenId: string;
  side: string;
  price: number;
  size: number;
  status: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO orders (id, strategy_id, market_id, token_id, side, price, size, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
  ).run(
    data.id,
    data.strategyId,
    data.marketId ?? null,
    data.tokenId,
    data.side,
    data.price,
    data.size,
    data.status,
    now,
    now,
  );
}

export function saveFill(data: {
  orderId?: string;
  strategyId: StrategyId;
  marketId?: string;
  tokenId: string;
  side: string;
  price: number;
  size: number;
  fee?: number;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO fills (order_id, strategy_id, market_id, token_id, side, price, size, fee, filled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    data.orderId ?? null,
    data.strategyId,
    data.marketId ?? null,
    data.tokenId,
    data.side,
    data.price,
    data.size,
    data.fee ?? 0,
    new Date().toISOString(),
  );
}

export function openPosition(data: {
  strategyId: StrategyId;
  conditionId: string;
  tokenId: string;
  side: string;
  size: number;
  avgPrice: number;
  costUsd: number;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO open_positions
     (strategy_id, condition_id, token_id, side, size, avg_price, cost_usd, metadata_json, opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    data.strategyId,
    data.conditionId,
    data.tokenId,
    data.side,
    data.size,
    data.avgPrice,
    data.costUsd,
    data.metadata ? JSON.stringify(data.metadata) : null,
    new Date().toISOString(),
  );
}

export function getOpenPositions(strategyId: StrategyId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM open_positions WHERE strategy_id = ? AND status = 'open' ORDER BY opened_at DESC`,
    )
    .all(strategyId);
}

export function countOpenPositions(strategyId: StrategyId) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM open_positions WHERE strategy_id = ? AND status = 'open'`,
    )
    .get(strategyId) as { c: number };
  return row.c;
}

export function saveWalletScore(data: {
  walletAddress: string;
  roi?: number;
  winRate?: number;
  tradeCount?: number;
  washFlag?: boolean;
  score?: number;
  details?: Record<string, unknown>;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO watchlist_wallets
     (wallet_address, roi, win_rate, trade_count, wash_flag, score, details_json, updated_at, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(wallet_address) DO UPDATE SET
       roi = excluded.roi,
       win_rate = excluded.win_rate,
       trade_count = excluded.trade_count,
       wash_flag = excluded.wash_flag,
       score = excluded.score,
       details_json = excluded.details_json,
       updated_at = excluded.updated_at`,
  ).run(
    data.walletAddress.toLowerCase(),
    data.roi ?? null,
    data.winRate ?? null,
    data.tradeCount ?? null,
    data.washFlag ? 1 : 0,
    data.score ?? null,
    data.details ? JSON.stringify(data.details) : null,
    new Date().toISOString(),
  );
}

export function getWatchlistWallets(activeOnly = true, limit = 20) {
  const db = getDb();
  if (activeOnly) {
    return db
      .prepare(
        `SELECT * FROM watchlist_wallets WHERE active = 1 ORDER BY score DESC LIMIT ?`,
      )
      .all(limit);
  }
  return db
    .prepare(`SELECT * FROM watchlist_wallets ORDER BY score DESC LIMIT ?`)
    .all(limit);
}

export function saveCopiedTrade(data: {
  strategyId: StrategyId;
  sourceWallet: string;
  tokenId: string;
  conditionId?: string;
  sourcePrice: number;
  copyPrice: number;
  slippageCents: number;
  size: number;
  costUsd: number;
  status: string;
  details?: Record<string, unknown>;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO copied_trades
     (strategy_id, source_wallet, token_id, condition_id, source_price, copy_price, slippage_cents, size, cost_usd, status, details_json, copied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    data.strategyId,
    data.sourceWallet.toLowerCase(),
    data.tokenId,
    data.conditionId ?? null,
    data.sourcePrice,
    data.copyPrice,
    data.slippageCents,
    data.size,
    data.costUsd,
    data.status,
    data.details ? JSON.stringify(data.details) : null,
    new Date().toISOString(),
  );
}

export function getCopiedTrades(strategyId: StrategyId, limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM copied_trades WHERE strategy_id = ? ORDER BY copied_at DESC LIMIT ?`,
    )
    .all(strategyId, limit);
}

export function saveRewardsDaily(data: {
  strategyId: StrategyId;
  conditionId?: string;
  date: string;
  liquidityRewards?: number;
  makerRebates?: number;
  holdingRewards?: number;
  details?: Record<string, unknown>;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO rewards_daily
     (strategy_id, condition_id, date, liquidity_rewards, maker_rebates, holding_rewards, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(strategy_id, condition_id, date) DO UPDATE SET
       liquidity_rewards = excluded.liquidity_rewards,
       maker_rebates = excluded.maker_rebates,
       holding_rewards = excluded.holding_rewards,
       details_json = excluded.details_json`,
  ).run(
    data.strategyId,
    data.conditionId ?? '',
    data.date,
    data.liquidityRewards ?? 0,
    data.makerRebates ?? 0,
    data.holdingRewards ?? 0,
    data.details ? JSON.stringify(data.details) : null,
  );
}

export function getRewardsDaily(strategyId: StrategyId, days = 7) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM rewards_daily WHERE strategy_id = ? ORDER BY date DESC LIMIT ?`,
    )
    .all(strategyId, days);
}

export function recordMidPrice(tokenId: string, mid: number, conditionId?: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO mid_price_history (token_id, condition_id, mid, recorded_at) VALUES (?, ?, ?, ?)`,
  ).run(tokenId, conditionId ?? null, mid, new Date().toISOString());
}

export function getMidPriceHistory(tokenId: string, sinceIso: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT mid, recorded_at FROM mid_price_history
       WHERE token_id = ? AND recorded_at >= ? ORDER BY recorded_at ASC`,
    )
    .all(tokenId, sinceIso);
}

export function getBookSnapshotsForToken(tokenId: string, sinceIso: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT mid, best_bid, best_ask, snapshot_at FROM book_snapshots
       WHERE token_id = ? AND snapshot_at >= ? ORDER BY snapshot_at ASC`,
    )
    .all(tokenId, sinceIso);
}

export function getOpportunityStats(strategyId: StrategyId) {
  const db = getDb();
  const total = db
    .prepare(`SELECT COUNT(*) as c FROM opportunities WHERE strategy_id = ?`)
    .get(strategyId) as { c: number };
  const executed = db
    .prepare(
      `SELECT COUNT(*) as c FROM opportunities WHERE strategy_id = ? AND executed = 1`,
    )
    .get(strategyId) as { c: number };
  const avgEdge = db
    .prepare(
      `SELECT AVG(edge_pct) as avg FROM opportunities WHERE strategy_id = ? AND executed = 1`,
    )
    .get(strategyId) as { avg: number | null };
  return {
    total: total.c,
    executed: executed.c,
    hitRate: total.c > 0 ? executed.c / total.c : 0,
    avgEdge: avgEdge.avg ?? 0,
  };
}
