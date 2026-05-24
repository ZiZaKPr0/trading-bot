import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STRATEGY_META,
  cancelAllOrders,
  getAllBotStatus,
  getCopiedTrades,
  getDailyPnl,
  getDb,
  getOpenPositions,
  getOpportunityStats,
  getRecentAlerts,
  getRecentOpportunities,
  getRecentTrades,
  getRewardsDaily,
  getTotalExposure,
  getWatchlistWallets,
  loadConfig,
  setBotStatus,
} from '@bot-trading/core';
import type { StrategyId } from '@bot-trading/core';
import { isAuthEnabled, registerAuth, verifyRequest } from './auth.js';
import { registerSettingsRoutes } from './settings.js';

const cfg = loadConfig();
const app = Fastify({ logger: true });
const __dirname = dirname(fileURLToPath(import.meta.url));

const trustedOrigins = cfg.DASHBOARD_TRUSTED_ORIGINS
  ? cfg.DASHBOARD_TRUSTED_ORIGINS.split(',').map((o) => o.trim())
  : true;

await app.register(cors, {
  origin: trustedOrigins,
  credentials: true,
});

await registerAuth(app);
await registerSettingsRoutes(app);

function snapshot() {
  getDb();
  const bots = getAllBotStatus();
  const exposure = getTotalExposure();
  const dailyPnl = getDailyPnl();
  const alerts = getRecentAlerts(20);
  const trades = getRecentTrades(30);

  const strategyStats: Record<string, unknown> = {};
  for (const id of Object.keys(STRATEGY_META) as StrategyId[]) {
    strategyStats[id] = {
      opportunities: getOpportunityStats(id),
      openPositions: getOpenPositions(id).length,
      rewards: getRewardsDaily(id, 7),
      watchlist: id === 'espejo-smart' ? getWatchlistWallets(true, 10) : undefined,
      copiedTrades: id === 'espejo-smart' ? getCopiedTrades(id, 10) : undefined,
    };
  }

  return {
    bots,
    exposure,
    dailyPnl,
    alerts,
    trades,
    strategies: STRATEGY_META,
    strategyStats,
    paperMode: loadConfig().PAPER_MODE,
    authEnabled: isAuthEnabled(),
    updatedAt: new Date().toISOString(),
  };
}

app.get('/api/health', async () => ({ ok: true, auth: isAuthEnabled() }));

app.get('/api/dashboard', async () => snapshot());

app.get<{ Params: { id: string } }>('/api/bots/:id', async (req) => {
  const id = req.params.id as StrategyId;
  getDb();
  const bots = getAllBotStatus();
  const bot = bots.find((b) => (b as { strategy_id: string }).strategy_id === id);
  return {
    bot,
    trades: getRecentTrades(50, id),
    opportunities: getRecentOpportunities(id, 50),
    dailyPnl: getDailyPnl(id),
    stats: getOpportunityStats(id),
    openPositions: getOpenPositions(id),
    rewards: getRewardsDaily(id, 14),
    watchlist: id === 'espejo-smart' ? getWatchlistWallets(true, 20) : undefined,
    copiedTrades: id === 'espejo-smart' ? getCopiedTrades(id, 30) : undefined,
  };
});

app.post<{ Params: { id: string } }>('/api/bots/:id/stop', async (req) => {
  const id = req.params.id as StrategyId;
  setBotStatus(id, 'STOPPED', 'Stopped via dashboard');
  return { ok: true };
});

app.post<{ Params: { id: string } }>('/api/bots/:id/kill', async (req) => {
  const id = req.params.id as StrategyId;
  await cancelAllOrders();
  setBotStatus(id, 'KILLED', 'Kill switch via dashboard');
  return { ok: true };
});

app.get('/api/stream', async (req, reply) => {
  if (!(await verifyRequest(req))) {
    return reply.code(401).send({ error: 'No autenticado' });
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = () => {
    try {
      reply.raw.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    } catch {
      clearInterval(interval);
    }
  };

  send();
  const interval = setInterval(send, 2000);

  req.raw.on('close', () => {
    clearInterval(interval);
  });
});

const uiDistCandidates = [
  join(__dirname, '../ui/dist'),
  join(__dirname, '../../ui/dist'),
  resolve(process.cwd(), 'packages/dashboard/ui/dist'),
];

const uiDist = uiDistCandidates.find((p) => existsSync(join(p, 'index.html')));

if (uiDist && process.env.NODE_ENV === 'production') {
  await app.register(fastifyStatic, {
    root: uiDist,
    prefix: '/',
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  app.log.info({ uiDist }, 'Serving dashboard UI (production)');
}

const port = cfg.DASHBOARD_API_PORT;
await app.listen({ port, host: '0.0.0.0' });
console.log(`Dashboard API on http://localhost:${port}`);
