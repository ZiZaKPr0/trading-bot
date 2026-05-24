import { getOrderBook, parseBestAsk, parseBestBid } from '../clients/clob.js';
import { createLogger } from '../logger.js';
import { saveBookSnapshot } from '../persistence/repository.js';
import type { StrategyId } from '../config/index.js';

const log = createLogger('book-snapshots');

const watchedTokens = new Map<string, { conditionId?: string; strategyId?: StrategyId }>();
let timer: ReturnType<typeof setInterval> | null = null;

export function watchToken(
  tokenId: string,
  meta: { conditionId?: string; strategyId?: StrategyId },
) {
  watchedTokens.set(tokenId, meta);
}

export function unwatchToken(tokenId: string) {
  watchedTokens.delete(tokenId);
}

export function startBookSnapshotJob(intervalMs = 30_000) {
  const tick = async () => {
    if (watchedTokens.size === 0) return;
    for (const [tokenId, meta] of watchedTokens) {
      try {
        const book = await getOrderBook(tokenId);
        const bestBid = parseBestBid(book);
        const bestAsk = parseBestAsk(book);
        const mid =
          bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : undefined;
        saveBookSnapshot({
          tokenId,
          conditionId: meta.conditionId,
          strategyId: meta.strategyId,
          bestBid: bestBid ?? undefined,
          bestAsk: bestAsk ?? undefined,
          mid,
        });
      } catch (err) {
        log.debug({ tokenId, err }, 'Book snapshot failed');
      }
    }
  };

  void tick();
  timer = setInterval(() => void tick(), intervalMs);
  log.info({ intervalMs }, 'Book snapshot job started');
  return () => {
    if (timer) clearInterval(timer);
  };
}
