import { createClobClient } from '../clients/clob.js';
import { loadConfig } from '../config/index.js';
import { createLogger } from '../logger.js';
import { ReconnectingWs } from './ws-base.js';

const log = createLogger('ws-user');

export type UserFillHandler = (fill: {
  orderId?: string;
  tokenId?: string;
  side?: string;
  price?: number;
  size?: number;
  eventType: string;
}) => void;

export class UserWsFeed {
  private ws: ReconnectingWs | null = null;
  private handler: UserFillHandler;
  private conditionIds: string[] = [];

  constructor(handler: UserFillHandler) {
    this.handler = handler;
  }

  async start(conditionIds: string[] = []) {
    this.conditionIds = conditionIds;
    const cfg = loadConfig();

    let auth: Record<string, string> | undefined;
    try {
      const client = await createClobClient();
      const creds = client.creds;
      if (creds) {
        auth = {
          apiKey: creds.key,
          secret: creds.secret,
          passphrase: creds.passphrase,
        };
      }
    } catch (err) {
      log.warn({ err }, 'User WS: no L2 creds, skipping auth');
    }

    const authPayload = auth;

    this.ws = new ReconnectingWs({
      url: cfg.WS_USER,
      name: 'user',
      onOpen: () => {
        this.ws?.send({
          type: 'user',
          markets: this.conditionIds,
          auth: authPayload,
        });
      },
      onMessage: (data) => this.handleMessage(data),
    });
    this.ws.start();
  }

  stop() {
    this.ws?.stop();
    this.ws = null;
  }

  updateMarkets(conditionIds: string[]) {
    this.conditionIds = conditionIds;
    if (this.ws?.isConnected()) {
      this.ws.send({ type: 'user', markets: conditionIds });
    }
  }

  private handleMessage(data: unknown) {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;
    const eventType = String(msg.event_type ?? msg.type ?? 'unknown');

    this.handler({
      orderId: msg.order_id ? String(msg.order_id) : undefined,
      tokenId: msg.asset_id ? String(msg.asset_id) : undefined,
      side: msg.side ? String(msg.side) : undefined,
      price: msg.price ? parseFloat(String(msg.price)) : undefined,
      size: msg.size ? parseFloat(String(msg.size)) : undefined,
      eventType,
    });
  }
}
