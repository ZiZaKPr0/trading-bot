import { loadConfig } from '../config/index.js';
import { createRateLimitedClient, httpGet } from './http.js';

export interface DataTrade {
  proxyWallet: string;
  side: 'BUY' | 'SELL';
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
  transactionHash?: string;
}

export interface DataPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  title?: string;
  outcome?: string;
}

export interface LeaderboardEntry {
  proxyWallet: string;
  pnl?: number;
  vol?: number;
  rank?: number;
}

let dataClient: ReturnType<typeof createRateLimitedClient> | null = null;

function getDataClient() {
  if (!dataClient) {
    dataClient = createRateLimitedClient(loadConfig().DATA_HOST, 'data');
  }
  return dataClient;
}

export async function fetchTrades(params: {
  user?: string;
  market?: string[];
  limit?: number;
  offset?: number;
  side?: 'BUY' | 'SELL';
  takerOnly?: boolean;
}): Promise<DataTrade[]> {
  const client = getDataClient();
  return httpGet<DataTrade[]>(client, '/trades', {
    params: {
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      takerOnly: params.takerOnly ?? true,
      user: params.user,
      side: params.side,
      market: params.market?.join(','),
    },
  });
}

export async function fetchPositions(user: string): Promise<DataPosition[]> {
  const client = getDataClient();
  return httpGet<DataPosition[]>(client, '/positions', {
    params: { user, sizeThreshold: 0.01 },
  });
}

export async function fetchLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const client = getDataClient();
  try {
    return await httpGet<LeaderboardEntry[]>(client, '/v1/leaderboard', {
      params: { limit },
    });
  } catch {
    return [];
  }
}

export async function fetchRecentGlobalTrades(limit = 200): Promise<DataTrade[]> {
  return fetchTrades({ limit, takerOnly: false });
}
