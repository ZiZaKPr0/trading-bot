-- Bot trading SQLite schema (WAL mode enabled at runtime)

CREATE TABLE IF NOT EXISTS bot_status (
  strategy_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'OFF',
  message TEXT,
  pnl_today REAL DEFAULT 0,
  pnl_total REAL DEFAULT 0,
  ops_today INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_heartbeat (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_heartbeat_at TEXT,
  heartbeat_id TEXT,
  status TEXT DEFAULT 'ok'
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  tokens REAL NOT NULL,
  last_refill_ms INTEGER NOT NULL,
  max_tokens REAL NOT NULL,
  refill_per_ms REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS exposure_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  market_id TEXT,
  amount_usd REAL NOT NULL,
  reserved_at TEXT NOT NULL,
  released_at TEXT
);

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  condition_id TEXT,
  question TEXT,
  strategy_id TEXT,
  metadata_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  condition_id TEXT,
  strategy_id TEXT,
  best_bid REAL,
  best_ask REAL,
  mid REAL,
  bid_depth REAL,
  ask_depth REAL,
  snapshot_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_book_snapshots_token_time ON book_snapshots(token_id, snapshot_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  market_id TEXT,
  token_id TEXT,
  side TEXT,
  price REAL,
  size REAL,
  status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT,
  strategy_id TEXT NOT NULL,
  market_id TEXT,
  token_id TEXT,
  side TEXT,
  price REAL,
  size REAL,
  fee REAL DEFAULT 0,
  filled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  event_id TEXT,
  edge_pct REAL,
  executed INTEGER DEFAULT 0,
  details_json TEXT,
  detected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pnl_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  date TEXT NOT NULL,
  pnl REAL DEFAULT 0,
  UNIQUE(strategy_id, date)
);

CREATE TABLE IF NOT EXISTS wallet_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL,
  roi REAL,
  win_rate REAL,
  trade_count INTEGER,
  wash_flag INTEGER DEFAULT 0,
  score REAL,
  scored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rewards_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  condition_id TEXT,
  date TEXT NOT NULL,
  liquidity_rewards REAL DEFAULT 0,
  maker_rebates REAL DEFAULT 0,
  holding_rewards REAL DEFAULT 0,
  details_json TEXT,
  UNIQUE(strategy_id, condition_id, date)
);

CREATE TABLE IF NOT EXISTS open_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  condition_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  avg_price REAL NOT NULL,
  cost_usd REAL NOT NULL,
  status TEXT DEFAULT 'open',
  metadata_json TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_open_positions_strategy ON open_positions(strategy_id, status);

CREATE TABLE IF NOT EXISTS watchlist_wallets (
  wallet_address TEXT PRIMARY KEY,
  score REAL,
  roi REAL,
  win_rate REAL,
  trade_count INTEGER,
  wash_flag INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  details_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS copied_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  source_wallet TEXT NOT NULL,
  token_id TEXT NOT NULL,
  condition_id TEXT,
  source_price REAL,
  copy_price REAL,
  slippage_cents REAL,
  size REAL,
  cost_usd REAL,
  status TEXT,
  details_json TEXT,
  copied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mid_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  condition_id TEXT,
  mid REAL NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mid_price_token_time ON mid_price_history(token_id, recorded_at);
