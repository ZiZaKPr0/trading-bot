import WebSocket from 'ws';
import { createLogger } from '../logger.js';

const log = createLogger('ws-base');

export type WsMessageHandler = (data: unknown) => void;

export interface ReconnectingWsOptions {
  url: string;
  name: string;
  onMessage: WsMessageHandler;
  onOpen?: () => void;
  maxBackoffMs?: number;
}

export class ReconnectingWs {
  private ws: WebSocket | null = null;
  private stopped = false;
  private backoffMs = 1000;
  private readonly maxBackoffMs: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: ReconnectingWsOptions) {
    this.maxBackoffMs = opts.maxBackoffMs ?? 30_000;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.stopped) return;

    this.ws = new WebSocket(this.opts.url);

    this.ws.on('open', () => {
      this.backoffMs = 1000;
      log.info({ name: this.opts.name }, 'WebSocket connected');
      this.opts.onOpen?.();
    });

    this.ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        this.opts.onMessage(data);
      } catch {
        log.debug({ name: this.opts.name }, 'Non-JSON WS message ignored');
      }
    });

    this.ws.on('close', () => {
      if (!this.stopped) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      log.warn({ name: this.opts.name, err: err.message }, 'WebSocket error');
    });
  }

  private scheduleReconnect() {
    const delay = this.backoffMs + Math.random() * 500;
    log.info({ name: this.opts.name, delayMs: Math.round(delay) }, 'Reconnecting WS');
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.connect();
    }, delay);
  }
}
