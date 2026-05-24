import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findMonorepoRoot } from './paths.js';

let dotenvLoaded = false;

function ensureDotenv() {
  if (dotenvLoaded) return;
  dotenvLoaded = true;

  const root = findMonorepoRoot();
  const paths = [
    root ? join(root, '.env') : null,
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ].filter(Boolean) as string[];

  for (const p of paths) {
    if (existsSync(p)) loadDotenv({ path: p });
  }
}

export const StrategyId = z.enum([
  'cesta-topk',
  'liquidity-maker',
  'endgame-carry',
  'espejo-smart',
]);
export type StrategyId = z.infer<typeof StrategyId>;

export const BotStatus = z.enum(['RUNNING', 'STOPPED', 'ERROR', 'KILLED', 'OFF']);
export type BotStatus = z.infer<typeof BotStatus>;

export const STRATEGY_META: Record<
  StrategyId,
  { name: string; label: string; enabledEnv: string }
> = {
  'cesta-topk': {
    name: 'Cesta Top-K',
    label: 'Cesta Top-K',
    enabledEnv: 'BOT_CESTA_TOPK_ENABLED',
  },
  'liquidity-maker': {
    name: 'Liquidity Maker',
    label: 'Liquidity Maker',
    enabledEnv: 'BOT_LIQUIDITY_MAKER_ENABLED',
  },
  'endgame-carry': {
    name: 'Endgame Carry',
    label: 'Endgame Carry',
    enabledEnv: 'BOT_ENDGAME_CARRY_ENABLED',
  },
  'espejo-smart': {
    name: 'Espejo Smart',
    label: 'Espejo Smart',
    enabledEnv: 'BOT_ESPEJO_SMART_ENABLED',
  },
};

const boolFromEnv = (defaultValue: boolean) =>
  z
    .union([z.string(), z.undefined()])
    .transform((v) => (v === undefined ? defaultValue : v === 'true'));

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v === '' || v === undefined ? undefined : v))
  .pipe(z.string().url().optional());

const envSchema = z.object({
  POLYGON_PRIVATE_KEY: z.string().optional(),
  POLYMARKET_FUNDER_ADDRESS: z.string().optional(),
  POLYMARKET_SIGNATURE_TYPE: z.coerce.number().default(3),
  POLYMARKET_API_KEY: z.string().optional(),
  POLYMARKET_API_SECRET: z.string().optional(),
  POLYMARKET_API_PASSPHRASE: z.string().optional(),
  CLOB_HOST: z.string().url().default('https://clob.polymarket.com'),
  GAMMA_HOST: z.string().url().default('https://gamma-api.polymarket.com'),
  DATA_HOST: z.string().url().default('https://data-api.polymarket.com'),
  RELAYER_HOST: z.string().url().default('https://relayer-v2.polymarket.com'),
  WS_MARKET: z
    .string()
    .default('wss://ws-subscriptions-clob.polymarket.com/ws/market'),
  WS_USER: z.string().default('wss://ws-subscriptions-clob.polymarket.com/ws/user'),
  DB_PATH: z.string().default('./data/bot-trading.db'),
  LOG_LEVEL: z.string().default('info'),
  PAPER_MODE: boolFromEnv(false),
  MAX_POSITION_USD: z.coerce.number().default(150),
  MAX_TOTAL_EXPOSURE_USD: z.coerce.number().default(1000),
  MAX_DAILY_LOSS_USD: z.coerce.number().default(75),
  MIN_EDGE_PCT: z.coerce.number().default(0.5),
  DEPTH_SIZING_FACTOR: z.coerce.number().default(0.8),
  MAX_SLIPPAGE_CENTS: z.coerce.number().default(1),
  BUILDER_CODE: z.string().optional(),
  BOT_CESTA_TOPK_ENABLED: boolFromEnv(true),
  BOT_LIQUIDITY_MAKER_ENABLED: boolFromEnv(false),
  BOT_ENDGAME_CARRY_ENABLED: boolFromEnv(false),
  BOT_ESPEJO_SMART_ENABLED: boolFromEnv(false),
  DASHBOARD_API_PORT: z.coerce.number().default(3001),
  DASHBOARD_UI_PORT: z.coerce.number().default(3000),
  DASHBOARD_AUTH_ENABLED: boolFromEnv(true),
  DASHBOARD_USERNAME: z.string().default('admin'),
  DASHBOARD_PASSWORD: z.string().optional(),
  DASHBOARD_SESSION_SECRET: z.string().optional(),
  DASHBOARD_COOKIE_SECURE: boolFromEnv(false),
  DASHBOARD_TRUSTED_ORIGINS: z.string().optional(),
  DUNE_API_KEY: z.string().optional(),
  ODDS_API_KEY: z.string().optional(),
  LLM_RESOLUTION_FILTER: boolFromEnv(false),
  LLM_API_URL: optionalUrl,
  LLM_API_KEY: z.string().optional(),
  LM_MAX_MARKETS: z.coerce.number().default(3),
  LM_QUOTE_INTERVAL_MS: z.coerce.number().default(2000),
  LM_GAMMA: z.coerce.number().default(0.1),
  LM_SIGMA_FALLBACK: z.coerce.number().default(0.05),
  LM_MID_MOVE_BPS_KILL: z.coerce.number().default(50),
  LM_MID_MOVE_WINDOW_SEC: z.coerce.number().default(10),
  CARRY_MIN_PRICE: z.coerce.number().default(0.95),
  CARRY_MAX_PRICE: z.coerce.number().default(0.99),
  CARRY_MAX_POSITIONS: z.coerce.number().default(50),
  CARRY_POSITION_SIZE_USD: z.coerce.number().default(30),
  ESPEJO_MIN_ROI: z.coerce.number().default(60),
  ESPEJO_MIN_TRADES: z.coerce.number().default(50),
  ESPEJO_MIN_COPY_USD: z.coerce.number().default(1000),
  ESPEJO_MAX_MARKET_VOL: z.coerce.number().default(500_000),
  ESPEJO_MAX_COPY_EXPOSURE_PCT: z.coerce.number().default(30),
  ESPEJO_DRY_RUN: boolFromEnv(true),
  ESPEJO_WATCHLIST_SIZE: z.coerce.number().default(20),
  ESPEJO_SCORE_INTERVAL_MS: z.coerce.number().default(86_400_000),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

function assertDashboardAuth(cfg: AppConfig) {
  if (!cfg.DASHBOARD_AUTH_ENABLED) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DASHBOARD_AUTH_ENABLED=false no está permitido en producción. Configura credenciales en .env.',
      );
    }
    return;
  }

  if (!cfg.DASHBOARD_PASSWORD?.trim()) {
    throw new Error(
      'DASHBOARD_PASSWORD es obligatorio con DASHBOARD_AUTH_ENABLED=true. Copia .env.example → .env y configúralo.',
    );
  }
  if (!cfg.DASHBOARD_SESSION_SECRET || cfg.DASHBOARD_SESSION_SECRET.length < 32) {
    throw new Error(
      'DASHBOARD_SESSION_SECRET es obligatorio (mín. 32 caracteres) con auth activa.',
    );
  }
}

export function isDashboardAuthEnabled(): boolean {
  return loadConfig().DASHBOARD_AUTH_ENABLED;
}

export function loadConfig(): AppConfig {
  if (cached) return cached;
  ensureDotenv();
  cached = envSchema.parse(process.env);
  assertDashboardAuth(cached);
  return cached;
}

export function reloadConfig(): AppConfig {
  cached = null;
  dotenvLoaded = false;
  const root = findMonorepoRoot();
  const envPath = root ? join(root, '.env') : resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: true });
  }
  return loadConfig();
}

export { findMonorepoRoot } from './paths.js';
export {
  ENV_SETTING_FIELDS,
  SECRET_PLACEHOLDER,
  getEnvFilePath,
  getSettingsView,
  updateEnvSettings,
} from './env-settings.js';
export type { SettingFieldMeta, SettingFieldView, SettingType } from './env-settings.js';

export function isBotEnabled(strategyId: StrategyId): boolean {
  const cfg = loadConfig();
  const map: Record<StrategyId, boolean> = {
    'cesta-topk': cfg.BOT_CESTA_TOPK_ENABLED,
    'liquidity-maker': cfg.BOT_LIQUIDITY_MAKER_ENABLED,
    'endgame-carry': cfg.BOT_ENDGAME_CARRY_ENABLED,
    'espejo-smart': cfg.BOT_ESPEJO_SMART_ENABLED,
  };
  return map[strategyId];
}
