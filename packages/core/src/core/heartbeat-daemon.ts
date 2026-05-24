import { Worker } from 'node:worker_threads';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../logger.js';
import { getDb } from '../persistence/db.js';

const log = createLogger('heartbeat-daemon');
const __dirname = dirname(fileURLToPath(import.meta.url));

export function startHeartbeatDaemon() {
  const workerPath = join(__dirname, 'heartbeat.worker.js');
  let heartbeatId: string | undefined;

  const worker = new Worker(workerPath, {
    workerData: { intervalMs: 5000 },
  });

  worker.on('message', (msg: { type: string; heartbeatId?: string; error?: string }) => {
    if (msg.type === 'heartbeat') {
      heartbeatId = msg.heartbeatId;
      const db = getDb();
      db.prepare(
        `INSERT INTO bot_heartbeat (id, last_heartbeat_at, heartbeat_id, status)
         VALUES (1, ?, ?, 'ok')
         ON CONFLICT(id) DO UPDATE SET
           last_heartbeat_at = excluded.last_heartbeat_at,
           heartbeat_id = excluded.heartbeat_id,
           status = 'ok'`,
      ).run(new Date().toISOString(), heartbeatId ?? null);
    } else if (msg.type === 'error') {
      log.error({ error: msg.error }, 'Heartbeat worker error');
      const db = getDb();
      db.prepare(`UPDATE bot_heartbeat SET status = 'error' WHERE id = 1`).run();
    }
  });

  worker.on('error', (err) => {
    log.error({ err }, 'Heartbeat worker crashed');
  });

  worker.on('exit', (code) => {
    if (code !== 0) log.error({ code }, 'Heartbeat worker exited');
  });

  log.info('Heartbeat daemon started (worker_threads)');

  return () => {
    worker.postMessage({ type: 'stop' });
    void worker.terminate();
  };
}
