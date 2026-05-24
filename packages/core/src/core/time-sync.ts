import { getServerTime } from '../clients/clob.js';
import { createLogger } from '../logger.js';

const log = createLogger('time-sync');

let offsetMs = 0;
let timer: ReturnType<typeof setInterval> | null = null;

export function getSyncedNowMs() {
  return Date.now() + offsetMs;
}

export async function syncServerTime() {
  const serverTime = await getServerTime();
  offsetMs = serverTime - Date.now();
  log.debug({ offsetMs }, 'Time sync updated');
  return offsetMs;
}

export function startTimeSync(intervalMs = 60_000) {
  void syncServerTime();
  timer = setInterval(() => void syncServerTime(), intervalMs);
  return () => {
    if (timer) clearInterval(timer);
  };
}
