import { loadConfig } from '../config/index.js';
import { createRateLimitedClient, httpGet } from './http.js';
import { createLogger } from '../logger.js';

const log = createLogger('clob');

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  min_order_size?: string;
  tick_size?: string;
}

let clobClient: ReturnType<typeof createRateLimitedClient> | null = null;

function getClobHttp() {
  if (!clobClient) {
    clobClient = createRateLimitedClient(loadConfig().CLOB_HOST, 'clob');
  }
  return clobClient;
}

export async function getServerTime(): Promise<number> {
  const client = getClobHttp();
  const data = await httpGet<{ timestamp?: number; time?: number }>(
    client,
    '/time',
  );
  return data.timestamp ?? data.time ?? Date.now();
}

export async function getOrderBook(tokenId: string): Promise<OrderBook> {
  const client = getClobHttp();
  return httpGet<OrderBook>(client, '/book', { params: { token_id: tokenId } });
}

export function parseBestAsk(book: OrderBook): number | null {
  if (!book.asks?.length) return null;
  return Math.min(...book.asks.map((a) => parseFloat(a.price)));
}

export function parseBestBid(book: OrderBook): number | null {
  if (!book.bids?.length) return null;
  return Math.max(...book.bids.map((b) => parseFloat(b.price)));
}

export function parseAskDepthUsd(book: OrderBook, maxLevels = 5): number {
  let depth = 0;
  const sorted = [...(book.asks ?? [])]
    .map((a) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
    .sort((a, b) => a.price - b.price)
    .slice(0, maxLevels);
  for (const level of sorted) {
    depth += level.price * level.size;
  }
  return depth;
}

export async function smokeTestOrderBook(tokenId: string) {
  log.info({ tokenId }, 'Smoke test: fetching order book');
  const book = await getOrderBook(tokenId);
  log.info(
    {
      tokenId,
      bestBid: parseBestBid(book),
      bestAsk: parseBestAsk(book),
      tick: book.tick_size,
    },
    'Order book fetched',
  );
  return book;
}

// ClobClient L2 wrapper — initialized when credentials present
export async function createClobClient() {
  const cfg = loadConfig();
  if (!cfg.POLYGON_PRIVATE_KEY || !cfg.POLYMARKET_FUNDER_ADDRESS) {
    throw new Error('Missing POLYGON_PRIVATE_KEY or POLYMARKET_FUNDER_ADDRESS');
  }

  const { ClobClient } = await import('@polymarket/clob-client-v2');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { createWalletClient, http } = await import('viem');
  const { polygon } = await import('viem/chains');

  const account = privateKeyToAccount(cfg.POLYGON_PRIVATE_KEY as `0x${string}`);
  const signer = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });

  const tempClient = new ClobClient({
    host: cfg.CLOB_HOST,
    chain: polygon.id,
    signer,
  });

  let apiCreds: { key: string; secret: string; passphrase: string };

  if (cfg.POLYMARKET_API_KEY && cfg.POLYMARKET_API_SECRET && cfg.POLYMARKET_API_PASSPHRASE) {
    apiCreds = {
      key: cfg.POLYMARKET_API_KEY,
      secret: cfg.POLYMARKET_API_SECRET,
      passphrase: cfg.POLYMARKET_API_PASSPHRASE,
    };
  } else {
    log.info('Deriving L2 API credentials...');
    apiCreds = await tempClient.createOrDeriveApiKey();
    log.info(
      { apiKey: apiCreds.key.slice(0, 8) },
      'L2 credentials derived — save to .env',
    );
  }

  const client = new ClobClient({
    host: cfg.CLOB_HOST,
    chain: polygon.id,
    signer,
    creds: apiCreds,
    signatureType: cfg.POLYMARKET_SIGNATURE_TYPE,
    funderAddress: cfg.POLYMARKET_FUNDER_ADDRESS,
  });

  return client;
}

export async function postHeartbeat(heartbeatId?: string): Promise<string> {
  const client = await createClobClient();
  const result = await client.postHeartbeat(heartbeatId);
  return result.heartbeat_id ?? '';
}

export async function cancelAllOrders() {
  const client = await createClobClient();
  return client.cancelAll();
}
