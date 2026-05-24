import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { startHeartbeatDaemon } from './core/heartbeat-daemon.js';
import { createLogger } from './logger.js';
import { getDb } from './persistence/db.js';
import { assertGeoblockAllowed } from './core/geofence.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv();

const log = createLogger('heartbeat-entry');

async function main() {
  getDb();
  await assertGeoblockAllowed();
  startHeartbeatDaemon();
  log.info('Heartbeat daemon running');
}

main().catch((err) => {
  log.error({ err }, 'Fatal');
  process.exit(1);
});
