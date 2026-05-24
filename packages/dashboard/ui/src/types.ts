export interface BotRow {
  strategy_id: string;
  status: string;
  message?: string;
  pnl_today: number;
  pnl_total: number;
  ops_today: number;
  updated_at: string;
}

export interface TradeRow {
  id: number;
  strategy_id: string;
  action: string;
  details_json?: string;
  created_at: string;
}

export interface AlertRow {
  id: number;
  strategy_id?: string;
  level: string;
  message: string;
  created_at: string;
}

export interface StrategyStats {
  opportunities?: { total: number; executed: number; hitRate: number; avgEdge: number };
  openPositions?: number;
  rewards?: Array<{ date: string; liquidity_rewards: number }>;
  watchlist?: Array<{ wallet_address: string; score: number; roi: number }>;
  copiedTrades?: Array<{ source_wallet: string; slippage_cents: number; status: string }>;
}

export interface DashboardData {
  bots: BotRow[];
  exposure: number;
  dailyPnl: number;
  alerts: AlertRow[];
  trades: TradeRow[];
  paperMode: boolean;
  updatedAt: string;
  strategies: Record<string, { name: string; label: string }>;
  strategyStats?: Record<string, StrategyStats>;
}
