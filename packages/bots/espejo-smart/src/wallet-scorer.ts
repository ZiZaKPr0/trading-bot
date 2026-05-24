import {
  fetchLeaderboard,
  fetchTrades,
  loadConfig,
  saveWalletScore,
} from '@bot-trading/core';

export interface WalletScoreResult {
  walletAddress: string;
  roi: number;
  winRate: number;
  tradeCount: number;
  washFlag: boolean;
  score: number;
}

export async function scoreWalletFromTrades(
  walletAddress: string,
): Promise<WalletScoreResult | null> {
  const trades = await fetchTrades({ user: walletAddress, limit: 200 });
  if (trades.length < 10) return null;

  let wins = 0;
  let totalCost = 0;
  let totalReturn = 0;
  const uniqueMarkets = new Set<string>();
  let buyCount = 0;
  let sellCount = 0;

  for (const t of trades) {
    uniqueMarkets.add(t.conditionId);
    const notional = t.size * t.price;
    if (t.side === 'BUY') {
      buyCount++;
      totalCost += notional;
    } else {
      sellCount++;
      totalReturn += notional;
    }
    if (t.price >= 0.5 && t.side === 'BUY') wins++;
    if (t.price <= 0.5 && t.side === 'SELL') wins++;
  }

  const tradeCount = trades.length;
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
  const roi = totalCost > 0 ? ((totalReturn - totalCost) / totalCost) * 100 : 0;

  const makerTakerRatio = sellCount > 0 ? buyCount / sellCount : buyCount;
  const washFlag =
    uniqueMarkets.size < 3 && tradeCount > 50 ||
    makerTakerRatio > 10 ||
    makerTakerRatio < 0.1;

  const score =
    roi * 0.5 +
    winRate * 0.3 +
    Math.min(tradeCount, 200) * 0.1 -
    (washFlag ? 50 : 0);

  return {
    walletAddress: walletAddress.toLowerCase(),
    roi,
    winRate,
    tradeCount,
    washFlag,
    score,
  };
}

export async function fetchDuneTopWallets(): Promise<string[]> {
  const cfg = loadConfig();
  if (!cfg.DUNE_API_KEY) return [];

  try {
    const res = await fetch('https://api.dune.com/api/v1/query/4849755/results', {
      headers: { 'X-Dune-API-Key': cfg.DUNE_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { result?: { rows?: Array<{ wallet?: string; proxy_wallet?: string }> } };
    const rows = data?.result?.rows ?? [];
    return rows
      .map((r: { wallet?: string; proxy_wallet?: string }) =>
        String(r.wallet ?? r.proxy_wallet ?? '').toLowerCase(),
      )
      .filter((w: string) => w.startsWith('0x'));
  } catch {
    return [];
  }
}

export async function runWalletScoring(
  log: { info: (o: object, m?: string) => void },
): Promise<WalletScoreResult[]> {
  const cfg = loadConfig();
  const candidates = new Set<string>();

  const leaderboard = await fetchLeaderboard(100);
  for (const entry of leaderboard) {
    if (entry.proxyWallet) candidates.add(entry.proxyWallet.toLowerCase());
  }

  const duneWallets = await fetchDuneTopWallets();
  for (const w of duneWallets) candidates.add(w);

  const scored: WalletScoreResult[] = [];

  for (const wallet of candidates) {
    const result = await scoreWalletFromTrades(wallet);
    if (!result) continue;
    if (result.tradeCount < cfg.ESPEJO_MIN_TRADES) continue;
    if (result.roi < cfg.ESPEJO_MIN_ROI) continue;
    if (result.washFlag) continue;

    saveWalletScore({
      walletAddress: result.walletAddress,
      roi: result.roi,
      winRate: result.winRate,
      tradeCount: result.tradeCount,
      washFlag: result.washFlag,
      score: result.score,
    });
    scored.push(result);
  }

  scored.sort((a, b) => b.score - a.score);
  log.info({ scored: scored.length, top: scored[0]?.walletAddress?.slice(0, 10) }, 'Wallet scoring complete');
  return scored.slice(0, cfg.ESPEJO_WATCHLIST_SIZE);
}
