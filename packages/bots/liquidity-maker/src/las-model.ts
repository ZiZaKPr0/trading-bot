import { getBookSnapshotsForToken } from '@bot-trading/core';

const MIN_SNAPSHOTS = 20;

export function priceToLogit(p: number): number {
  const clamped = Math.min(0.999, Math.max(0.001, p));
  return Math.log(clamped / (1 - clamped));
}

export function logitToPrice(l: number): number {
  const p = 1 / (1 + Math.exp(-l));
  return Math.min(0.99, Math.max(0.01, p));
}

export function computeSigmaL(tokenId: string, fallback = 0.05): number {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rows = getBookSnapshotsForToken(tokenId, since) as {
    mid: number | null;
    best_bid: number | null;
    best_ask: number | null;
  }[];

  const mids = rows
    .map((r) => r.mid ?? ((r.best_bid ?? 0) + (r.best_ask ?? 0)) / 2)
    .filter((m) => m > 0 && m < 1);

  if (mids.length < MIN_SNAPSHOTS) return fallback;

  const logits = mids.map(priceToLogit);
  const returns: number[] = [];
  for (let i = 1; i < logits.length; i++) {
    returns.push(logits[i] - logits[i - 1]);
  }

  if (returns.length < 2) return fallback;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

export interface LasQuote {
  bid: number;
  ask: number;
  reservation: number;
  spread: number;
}

export function computeLasQuote(params: {
  mid: number;
  inventory: number;
  gamma: number;
  sigmaL: number;
  tEffHours: number;
  minSpread?: number;
}): LasQuote {
  const { mid, inventory, gamma, sigmaL, tEffHours, minSpread = 0.02 } = params;
  const L = priceToLogit(mid);
  const tEff = Math.max(tEffHours / 24, 0.01);
  const reservation = L - inventory * gamma * sigmaL ** 2 * tEff;
  const halfSpread = Math.max(minSpread / 2, gamma * sigmaL ** 2 * tEff);

  const bid = logitToPrice(reservation - halfSpread);
  const ask = logitToPrice(reservation + halfSpread);

  return {
    bid: Math.round(bid * 100) / 100,
    ask: Math.round(ask * 100) / 100,
    reservation: logitToPrice(reservation),
    spread: ask - bid,
  };
}

export function inventorySkew(inventory: number, maxInventory: number): number {
  if (maxInventory <= 0) return 0;
  return Math.max(-1, Math.min(1, inventory / maxInventory));
}
