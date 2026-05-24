import { loadConfig } from '../config/index.js';
import { createRateLimitedClient, httpGet } from './http.js';

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  negRisk?: boolean;
  enableNegRisk?: boolean;
  markets?: GammaMarket[];
}

export interface GammaMarket {
  id: string;
  conditionId: string;
  question: string;
  clobTokenIds?: string;
  enableOrderBook?: boolean;
  negRisk?: boolean;
  slug?: string;
  outcomePrices?: string;
  volume24hr?: number;
  volumeNum?: number;
  endDate?: string;
  description?: string;
}

let gammaClient: ReturnType<typeof createRateLimitedClient> | null = null;

function getGammaClient() {
  if (!gammaClient) {
    gammaClient = createRateLimitedClient(loadConfig().GAMMA_HOST, 'gamma');
  }
  return gammaClient;
}

export async function fetchActiveNegRiskEvents(limit = 100): Promise<GammaEvent[]> {
  const client = getGammaClient();
  const events = await httpGet<GammaEvent[]>(client, '/events', {
    params: {
      active: true,
      closed: false,
      limit,
      order: 'volume_24hr',
    },
  });
  return events.filter((e) => e.negRisk === true || e.enableNegRisk === true);
}

export async function fetchEventBySlug(slug: string): Promise<GammaEvent> {
  const client = getGammaClient();
  return httpGet<GammaEvent>(client, `/events/slug/${slug}`);
}

export async function fetchMarkets(params: Record<string, unknown> = {}) {
  const client = getGammaClient();
  return httpGet<GammaMarket[]>(client, '/markets', { params });
}
