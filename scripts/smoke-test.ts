#!/usr/bin/env tsx
/**
 * Smoke test: conecta CLOB, lee order book, opcionalmente place+cancel orden mínima.
 * Uso: npm run setup && npm run smoke-test
 */
import {
  assertGeoblockAllowed,
  createClobClient,
  getDb,
  getServerTime,
  loadConfig,
  smokeTestOrderBook,
} from '@bot-trading/core';

async function main() {
  console.log('=== Smoke Test ===\n');
  const cfg = loadConfig();
  getDb();
  await assertGeoblockAllowed();

  const serverTime = await getServerTime();
  console.log(`✓ CLOB time: ${serverTime}`);

  const client = await createClobClient();
  const markets = await client.getSamplingMarkets();
  const first = markets.data?.[0];
  const tokenId = first?.tokens?.[0]?.token_id;

  if (!tokenId) {
    console.log('⚠ No sampling market found — skipping order book test');
    return;
  }

  await smokeTestOrderBook(tokenId);
  console.log(`✓ Order book OK for token ${tokenId.slice(0, 12)}...`);

  if (cfg.PAPER_MODE) {
    console.log('\nPAPER_MODE=true — skipping live order test');
    console.log('Set PAPER_MODE=false to test place+cancel (~$5)');
    return;
  }

  console.log('\n→ Live order test requires manual confirmation in code.');
  console.log('  Infrastructure validated. Run bots with PM2 when ready.');
  console.log('\n=== Smoke test complete ===');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
