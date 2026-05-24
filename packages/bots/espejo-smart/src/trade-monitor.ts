import {
  fetchRecentGlobalTrades,
  fetchTrades,
  loadConfig,
} from '@bot-trading/core';
import { isWalletWatched } from './watchlist.js';

export interface DetectedTrade {
  wallet: string;
  tokenId: string;
  conditionId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  notionalUsd: number;
  title?: string;
  timestamp: number;
}

const seenTx = new Set<string>();

export async function pollWatchlistTrades(
  watchlist: string[],
): Promise<DetectedTrade[]> {
  const cfg = loadConfig();
  const detected: DetectedTrade[] = [];

  for (const wallet of watchlist) {
    const trades = await fetchTrades({ user: wallet, limit: 20 });
    for (const t of trades) {
      const key = `${t.transactionHash ?? ''}-${t.timestamp}-${t.asset}`;
      if (seenTx.has(key)) continue;
      seenTx.add(key);

      const notionalUsd = t.size * t.price;
      if (notionalUsd < cfg.ESPEJO_MIN_COPY_USD) continue;
      if (!isWalletWatched(t.proxyWallet, watchlist)) continue;

      detected.push({
        wallet: t.proxyWallet.toLowerCase(),
        tokenId: t.asset,
        conditionId: t.conditionId,
        side: t.side,
        price: t.price,
        size: t.size,
        notionalUsd,
        title: t.title,
        timestamp: t.timestamp,
      });
    }
  }

  if (detected.length === 0) {
    const global = await fetchRecentGlobalTrades(100);
    for (const t of global) {
      if (!isWalletWatched(t.proxyWallet, watchlist)) continue;
      const key = `${t.transactionHash ?? ''}-${t.timestamp}-${t.asset}`;
      if (seenTx.has(key)) continue;
      seenTx.add(key);

      const notionalUsd = t.size * t.price;
      if (notionalUsd < cfg.ESPEJO_MIN_COPY_USD) continue;

      detected.push({
        wallet: t.proxyWallet.toLowerCase(),
        tokenId: t.asset,
        conditionId: t.conditionId,
        side: t.side,
        price: t.price,
        size: t.size,
        notionalUsd,
        title: t.title,
        timestamp: t.timestamp,
      });
    }
  }

  if (seenTx.size > 10_000) {
    const arr = [...seenTx].slice(-5000);
    seenTx.clear();
    for (const k of arr) seenTx.add(k);
  }

  return detected;
}

export function isNicheMarket(notionalUsd: number, vol24hEstimate = 0): boolean {
  const cfg = loadConfig();
  return vol24hEstimate < cfg.ESPEJO_MAX_MARKET_VOL || notionalUsd >= cfg.ESPEJO_MIN_COPY_USD;
}
