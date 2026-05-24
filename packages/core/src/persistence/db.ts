import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/index.js';
import type { StrategyId } from '../config/index.js';
import { STRATEGY_META } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let dbInstance: Database.Database | null = null;

function resolveDbPath(dbPath: string): string {
  if (isAbsolute(dbPath)) return dbPath;

  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string };
        if (pkg.name === 'bot-trading') {
          return resolve(dir, dbPath);
        }
      } catch {
        /* ignore */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return resolve(process.cwd(), dbPath);
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const cfg = loadConfig();
  const dbPath = resolveDbPath(cfg.DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 5000');

  const schemaPaths = [
    join(__dirname, 'schema.sql'),
    join(__dirname, '../../src/persistence/schema.sql'),
    resolve(process.cwd(), 'packages/core/src/persistence/schema.sql'),
  ];
  const schemaPath = schemaPaths.find((p) => existsSync(p));
  if (!schemaPath) throw new Error('schema.sql not found');
  const schema = readFileSync(schemaPath, 'utf-8');
  dbInstance.exec(schema);

  initRateLimitBuckets(dbInstance);
  initBotStatusRows(dbInstance);

  return dbInstance;
}

function initRateLimitBuckets(db: Database.Database) {
  const buckets = [
    { key: 'clob', max: 80, refillPerSec: 80 },
    { key: 'gamma', max: 8, refillPerSec: 8 },
    { key: 'data', max: 15, refillPerSec: 15 },
  ];
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO rate_limit_buckets (bucket_key, tokens, last_refill_ms, max_tokens, refill_per_ms)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const b of buckets) {
    stmt.run(b.key, b.max, now, b.max, b.refillPerSec / 1000);
  }
}

function initBotStatusRows(db: Database.Database) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO bot_status (strategy_id, status, updated_at)
    VALUES (?, 'OFF', ?)
  `);
  for (const id of Object.keys(STRATEGY_META) as StrategyId[]) {
    stmt.run(id, now);
  }
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
