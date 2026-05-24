#!/usr/bin/env tsx
/**
 * Setup inicial: geofence, DB, derivación L2 API keys
 */
import {
  assertGeoblockAllowed,
  createClobClient,
  getDb,
  getServerTime,
  loadConfig,
} from '@bot-trading/core';

async function main() {
  console.log('=== Bot Trading Setup ===\n');

  const cfg = loadConfig();
  console.log('Config loaded');
  console.log(`  DB: ${cfg.DB_PATH}`);
  console.log(`  Paper mode: ${cfg.PAPER_MODE}`);
  console.log(`  Max exposure: $${cfg.MAX_TOTAL_EXPOSURE_USD}`);

  getDb();
  console.log('\n✓ SQLite initialized (WAL)');

  await assertGeoblockAllowed();
  console.log('✓ Geofence check passed');

  const serverTime = await getServerTime();
  console.log(`✓ CLOB reachable (server time: ${serverTime})`);

  if (!cfg.POLYGON_PRIVATE_KEY || !cfg.POLYMARKET_FUNDER_ADDRESS) {
    console.log('\n⚠ Missing POLYGON_PRIVATE_KEY or POLYMARKET_FUNDER_ADDRESS');
    console.log('  Copy .env.example → .env and fill wallet credentials.');
    process.exit(1);
  }

  const client = await createClobClient();
  console.log('✓ ClobClient initialized');

  if (!cfg.POLYMARKET_API_KEY) {
    console.log('\n→ L2 credentials were derived. Add these to your .env:');
    console.log('  POLYMARKET_API_KEY=...');
    console.log('  POLYMARKET_API_SECRET=...');
    console.log('  POLYMARKET_API_PASSPHRASE=...');
  }

  void client;
  console.log('\n=== Setup complete ===');
  console.log('Next: npm run build && npm run pm2:start');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
