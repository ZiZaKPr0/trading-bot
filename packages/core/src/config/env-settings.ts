import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findMonorepoRoot } from './paths.js';

export type SettingType = 'string' | 'number' | 'boolean' | 'url' | 'password';

export interface SettingFieldMeta {
  key: string;
  label: string;
  section: string;
  type: SettingType;
  secret?: boolean;
  description?: string;
  restartRequired?: boolean;
}

export interface SettingFieldView extends SettingFieldMeta {
  value: string;
  hasValue: boolean;
  masked?: string;
}

export const ENV_SETTING_FIELDS: SettingFieldMeta[] = [
  // Wallet
  {
    key: 'POLYGON_PRIVATE_KEY',
    label: 'Private key Polygon',
    section: 'Wallet Polymarket',
    type: 'password',
    secret: true,
    description: 'Clave privada de la wallet (0x…)',
  },
  {
    key: 'POLYMARKET_FUNDER_ADDRESS',
    label: 'Funder address',
    section: 'Wallet Polymarket',
    type: 'string',
    description: 'Dirección del funder en Polymarket',
  },
  {
    key: 'POLYMARKET_SIGNATURE_TYPE',
    label: 'Signature type',
    section: 'Wallet Polymarket',
    type: 'number',
    description: 'Tipo de firma CLOB (normalmente 3)',
  },
  {
    key: 'POLYMARKET_API_KEY',
    label: 'API key CLOB',
    section: 'Wallet Polymarket',
    type: 'password',
    secret: true,
  },
  {
    key: 'POLYMARKET_API_SECRET',
    label: 'API secret CLOB',
    section: 'Wallet Polymarket',
    type: 'password',
    secret: true,
  },
  {
    key: 'POLYMARKET_API_PASSPHRASE',
    label: 'API passphrase CLOB',
    section: 'Wallet Polymarket',
    type: 'password',
    secret: true,
  },
  // APIs externas
  {
    key: 'ODDS_API_KEY',
    label: 'The Odds API key',
    section: 'APIs externas',
    type: 'password',
    secret: true,
    description: 'Para Liquidity Maker (feed de cuotas)',
  },
  {
    key: 'DUNE_API_KEY',
    label: 'Dune API key',
    section: 'APIs externas',
    type: 'password',
    secret: true,
  },
  {
    key: 'LLM_RESOLUTION_FILTER',
    label: 'Filtro LLM activo',
    section: 'APIs externas',
    type: 'boolean',
    description: 'Endgame Carry: filtrar resoluciones con LLM',
  },
  {
    key: 'LLM_API_URL',
    label: 'LLM API URL',
    section: 'APIs externas',
    type: 'url',
  },
  {
    key: 'LLM_API_KEY',
    label: 'LLM API key',
    section: 'APIs externas',
    type: 'password',
    secret: true,
  },
  {
    key: 'BUILDER_CODE',
    label: 'Builder code',
    section: 'APIs externas',
    type: 'string',
  },
  // Endpoints
  {
    key: 'CLOB_HOST',
    label: 'CLOB host',
    section: 'Endpoints',
    type: 'url',
  },
  {
    key: 'GAMMA_HOST',
    label: 'Gamma host',
    section: 'Endpoints',
    type: 'url',
  },
  {
    key: 'DATA_HOST',
    label: 'Data API host',
    section: 'Endpoints',
    type: 'url',
  },
  {
    key: 'RELAYER_HOST',
    label: 'Relayer host',
    section: 'Endpoints',
    type: 'url',
  },
  {
    key: 'WS_MARKET',
    label: 'WebSocket market',
    section: 'Endpoints',
    type: 'string',
  },
  {
    key: 'WS_USER',
    label: 'WebSocket user',
    section: 'Endpoints',
    type: 'string',
  },
  // Sistema
  {
    key: 'DB_PATH',
    label: 'Ruta SQLite',
    section: 'Sistema',
    type: 'string',
    restartRequired: true,
  },
  {
    key: 'LOG_LEVEL',
    label: 'Nivel de log',
    section: 'Sistema',
    type: 'string',
    description: 'debug | info | warn | error',
  },
  {
    key: 'PAPER_MODE',
    label: 'Modo paper',
    section: 'Sistema',
    type: 'boolean',
    description: 'Simular operaciones sin dinero real',
  },
  // Riesgo
  {
    key: 'MAX_POSITION_USD',
    label: 'Máx. posición (USD)',
    section: 'Riesgo',
    type: 'number',
  },
  {
    key: 'MAX_TOTAL_EXPOSURE_USD',
    label: 'Máx. exposición total (USD)',
    section: 'Riesgo',
    type: 'number',
  },
  {
    key: 'MAX_DAILY_LOSS_USD',
    label: 'Máx. pérdida diaria (USD)',
    section: 'Riesgo',
    type: 'number',
  },
  {
    key: 'MIN_EDGE_PCT',
    label: 'Edge mínimo (%)',
    section: 'Riesgo',
    type: 'number',
  },
  {
    key: 'DEPTH_SIZING_FACTOR',
    label: 'Factor depth sizing',
    section: 'Riesgo',
    type: 'number',
  },
  {
    key: 'MAX_SLIPPAGE_CENTS',
    label: 'Slippage máx. (¢)',
    section: 'Riesgo',
    type: 'number',
  },
  // Bots
  {
    key: 'BOT_CESTA_TOPK_ENABLED',
    label: 'Cesta Top-K',
    section: 'Bots',
    type: 'boolean',
    restartRequired: true,
  },
  {
    key: 'BOT_LIQUIDITY_MAKER_ENABLED',
    label: 'Liquidity Maker',
    section: 'Bots',
    type: 'boolean',
    restartRequired: true,
  },
  {
    key: 'BOT_ENDGAME_CARRY_ENABLED',
    label: 'Endgame Carry',
    section: 'Bots',
    type: 'boolean',
    restartRequired: true,
  },
  {
    key: 'BOT_ESPEJO_SMART_ENABLED',
    label: 'Espejo Smart',
    section: 'Bots',
    type: 'boolean',
    restartRequired: true,
  },
  // Liquidity Maker
  {
    key: 'LM_MAX_MARKETS',
    label: 'Máx. mercados',
    section: 'Liquidity Maker',
    type: 'number',
  },
  {
    key: 'LM_QUOTE_INTERVAL_MS',
    label: 'Intervalo quote (ms)',
    section: 'Liquidity Maker',
    type: 'number',
  },
  {
    key: 'LM_GAMMA',
    label: 'Gamma (spread)',
    section: 'Liquidity Maker',
    type: 'number',
  },
  {
    key: 'LM_SIGMA_FALLBACK',
    label: 'Sigma fallback',
    section: 'Liquidity Maker',
    type: 'number',
  },
  {
    key: 'LM_MID_MOVE_BPS_KILL',
    label: 'Mid move kill (bps)',
    section: 'Liquidity Maker',
    type: 'number',
  },
  {
    key: 'LM_MID_MOVE_WINDOW_SEC',
    label: 'Ventana mid move (s)',
    section: 'Liquidity Maker',
    type: 'number',
  },
  // Endgame Carry
  {
    key: 'CARRY_MIN_PRICE',
    label: 'Precio mínimo',
    section: 'Endgame Carry',
    type: 'number',
  },
  {
    key: 'CARRY_MAX_PRICE',
    label: 'Precio máximo',
    section: 'Endgame Carry',
    type: 'number',
  },
  {
    key: 'CARRY_MAX_POSITIONS',
    label: 'Máx. posiciones',
    section: 'Endgame Carry',
    type: 'number',
  },
  {
    key: 'CARRY_POSITION_SIZE_USD',
    label: 'Tamaño posición (USD)',
    section: 'Endgame Carry',
    type: 'number',
  },
  // Espejo Smart
  {
    key: 'ESPEJO_MIN_ROI',
    label: 'ROI mínimo (%)',
    section: 'Espejo Smart',
    type: 'number',
  },
  {
    key: 'ESPEJO_MIN_TRADES',
    label: 'Trades mínimos',
    section: 'Espejo Smart',
    type: 'number',
  },
  {
    key: 'ESPEJO_MIN_COPY_USD',
    label: 'Copy mínimo (USD)',
    section: 'Espejo Smart',
    type: 'number',
  },
  {
    key: 'ESPEJO_MAX_MARKET_VOL',
    label: 'Vol. máx. mercado',
    section: 'Espejo Smart',
    type: 'number',
  },
  {
    key: 'ESPEJO_MAX_COPY_EXPOSURE_PCT',
    label: 'Exposición copy máx. (%)',
    section: 'Espejo Smart',
    type: 'number',
  },
  {
    key: 'ESPEJO_DRY_RUN',
    label: 'Dry run',
    section: 'Espejo Smart',
    type: 'boolean',
  },
  {
    key: 'ESPEJO_WATCHLIST_SIZE',
    label: 'Tamaño watchlist',
    section: 'Espejo Smart',
    type: 'number',
  },
  {
    key: 'ESPEJO_SCORE_INTERVAL_MS',
    label: 'Intervalo scoring (ms)',
    section: 'Espejo Smart',
    type: 'number',
  },
  // Dashboard
  {
    key: 'DASHBOARD_API_PORT',
    label: 'Puerto API',
    section: 'Dashboard',
    type: 'number',
    restartRequired: true,
  },
  {
    key: 'DASHBOARD_UI_PORT',
    label: 'Puerto UI',
    section: 'Dashboard',
    type: 'number',
    restartRequired: true,
  },
  {
    key: 'DASHBOARD_AUTH_ENABLED',
    label: 'Auth activa',
    section: 'Dashboard',
    type: 'boolean',
    restartRequired: true,
  },
  {
    key: 'DASHBOARD_USERNAME',
    label: 'Usuario',
    section: 'Dashboard',
    type: 'string',
  },
  {
    key: 'DASHBOARD_PASSWORD',
    label: 'Contraseña',
    section: 'Dashboard',
    type: 'password',
    secret: true,
    restartRequired: true,
  },
  {
    key: 'DASHBOARD_SESSION_SECRET',
    label: 'Session secret',
    section: 'Dashboard',
    type: 'password',
    secret: true,
    description: 'Mín. 32 caracteres (openssl rand -hex 32)',
    restartRequired: true,
  },
  {
    key: 'DASHBOARD_COOKIE_SECURE',
    label: 'Cookie secure (HTTPS)',
    section: 'Dashboard',
    type: 'boolean',
    restartRequired: true,
  },
  {
    key: 'DASHBOARD_TRUSTED_ORIGINS',
    label: 'Orígenes CORS',
    section: 'Dashboard',
    type: 'string',
    description: 'Separados por coma, ej. https://tudominio.com',
    restartRequired: true,
  },
];

const SECRET_PLACEHOLDER = '__UNCHANGED__';

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

function formatEnvValue(value: string): string {
  if (/[\s#"'\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function getEnvFilePath(): string {
  const root = findMonorepoRoot();
  const candidates = [
    root ? join(root, '.env') : null,
    join(process.cwd(), '.env'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return root ? join(root, '.env') : join(process.cwd(), '.env');
}

function readRawEnvValues(path: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;

  const content = readFileSync(path, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

export function getSettingsView(): {
  sections: string[];
  fields: SettingFieldView[];
  envPath: string;
} {
  const envPath = getEnvFilePath();
  const raw = readRawEnvValues(envPath);

  const fields: SettingFieldView[] = ENV_SETTING_FIELDS.map((meta) => {
    const fromFile = raw.get(meta.key);
    const fromProcess = process.env[meta.key];
    const value = fromFile ?? fromProcess ?? '';
    const hasValue = value.length > 0;

    return {
      ...meta,
      value: meta.secret && hasValue ? SECRET_PLACEHOLDER : value,
      hasValue,
      masked: meta.secret && hasValue ? maskSecret(value) : undefined,
    };
  });

  const sections = [...new Set(ENV_SETTING_FIELDS.map((f) => f.section))];
  return { sections, fields, envPath };
}

function validateField(meta: SettingFieldMeta, value: string): string | null {
  if (meta.type === 'boolean') {
    if (value !== 'true' && value !== 'false') return 'Debe ser true o false';
    return null;
  }
  if (meta.type === 'number' && value !== '' && Number.isNaN(Number(value))) {
    return 'Debe ser un número';
  }
  if (meta.type === 'url' && value !== '') {
    try {
      new URL(value);
    } catch {
      return 'URL inválida';
    }
  }
  if (meta.key === 'DASHBOARD_SESSION_SECRET' && value !== '' && value.length < 32) {
    return 'Mínimo 32 caracteres';
  }
  return null;
}

export function updateEnvSettings(
  updates: Record<string, string>,
): { ok: true; requiresRestart: boolean; warnings: string[] } {
  const envPath = getEnvFilePath();
  const raw = readRawEnvValues(envPath);
  const metaByKey = new Map(ENV_SETTING_FIELDS.map((m) => [m.key, m]));
  const warnings: string[] = [];
  let requiresRestart = false;

  const merged = new Map(raw);

  const keysToWrite = new Set<string>();

  for (const [key, incoming] of Object.entries(updates)) {
    const meta = metaByKey.get(key);
    if (!meta) {
      warnings.push(`Clave ignorada: ${key}`);
      continue;
    }

    let value = incoming.trim();

    if (meta.secret && (value === '' || value === SECRET_PLACEHOLDER)) {
      continue;
    }

    const err = validateField(meta, value);
    if (err) throw new Error(`${meta.label}: ${err}`);

    if (meta.type === 'boolean') {
      value = value === 'true' ? 'true' : 'false';
    }

    merged.set(key, value);
    process.env[key] = value;
    keysToWrite.add(key);

    if (meta.restartRequired) requiresRestart = true;
  }

  let lines = existsSync(envPath) ? readFileSync(envPath, 'utf-8').split(/\r?\n/) : [];
  const foundInFile = new Set<string>();

  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!keysToWrite.has(key) || !merged.has(key)) return line;
    foundInFile.add(key);
    return `${key}=${formatEnvValue(merged.get(key)!)}`;
  });

  for (const key of keysToWrite) {
    if (!foundInFile.has(key) && merged.has(key)) {
      lines.push(`${key}=${formatEnvValue(merged.get(key)!)}`);
    }
  }

  if (!existsSync(envPath) && lines.length === 0) {
    for (const meta of ENV_SETTING_FIELDS) {
      const val = merged.get(meta.key);
      if (val !== undefined) {
        lines.push(`${meta.key}=${formatEnvValue(val)}`);
      }
    }
  }

  writeFileSync(envPath, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf-8');
  return { ok: true, requiresRestart, warnings };
}

export { SECRET_PLACEHOLDER };
