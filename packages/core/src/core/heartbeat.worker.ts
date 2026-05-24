import { parentPort, workerData } from 'node:worker_threads';

const intervalMs = (workerData as { intervalMs: number }).intervalMs ?? 5000;
let heartbeatId: string | undefined;
let stopped = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function tick() {
  if (stopped) return;
  try {
    const { postHeartbeat } = await import('../clients/clob.js');
    heartbeatId = await postHeartbeat(heartbeatId);
    parentPort?.postMessage({ type: 'heartbeat', heartbeatId });
  } catch (err) {
    parentPort?.postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

parentPort?.on('message', (msg: { type: string }) => {
  if (msg.type === 'stop') {
    stopped = true;
    if (timer) clearInterval(timer);
  }
});

void tick();
timer = setInterval(() => void tick(), intervalMs);
