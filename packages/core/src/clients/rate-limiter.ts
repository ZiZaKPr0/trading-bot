import { getDb } from '../persistence/db.js';

export type RateLimitBucket = 'clob' | 'gamma' | 'data';

/**
 * Cross-process token bucket via SQLite atomic UPDATE.
 * Blocks briefly until a token is available.
 */
export async function acquireRateLimitToken(
  bucket: RateLimitBucket,
  cost = 1,
  maxWaitMs = 30_000,
): Promise<void> {
  const db = getDb();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const allowed = db.transaction(() => {
      const row = db
        .prepare(
          `SELECT bucket_key, tokens, last_refill_ms, max_tokens, refill_per_ms
           FROM rate_limit_buckets WHERE bucket_key = ?`,
        )
        .get(bucket) as
        | {
            tokens: number;
            last_refill_ms: number;
            max_tokens: number;
            refill_per_ms: number;
          }
        | undefined;

      if (!row) return false;

      const now = Date.now();
      const elapsed = now - row.last_refill_ms;
      let tokens = Math.min(
        row.max_tokens,
        row.tokens + elapsed * row.refill_per_ms,
      );

      if (tokens < cost) {
        db.prepare(
          `UPDATE rate_limit_buckets SET tokens = ?, last_refill_ms = ? WHERE bucket_key = ?`,
        ).run(tokens, now, bucket);
        return false;
      }

      tokens -= cost;
      db.prepare(
        `UPDATE rate_limit_buckets SET tokens = ?, last_refill_ms = ? WHERE bucket_key = ?`,
      ).run(tokens, now, bucket);
      return true;
    })();

    if (allowed) return;
    await sleep(25);
  }

  throw new Error(`Rate limit timeout for bucket ${bucket}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
