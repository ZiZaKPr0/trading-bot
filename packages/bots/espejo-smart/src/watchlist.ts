import { getWatchlistWallets } from '@bot-trading/core';

export function getActiveWatchlist(limit = 20): string[] {
  const rows = getWatchlistWallets(true, limit) as Array<{ wallet_address: string }>;
  return rows.map((r) => r.wallet_address);
}

export function isWalletWatched(wallet: string, watchlist: string[]): boolean {
  return watchlist.includes(wallet.toLowerCase());
}
