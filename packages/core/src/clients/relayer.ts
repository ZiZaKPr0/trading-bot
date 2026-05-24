import { loadConfig } from '../config/index.js';
import { createLogger } from '../logger.js';

const log = createLogger('relayer');

export interface SplitMergeRequest {
  conditionId: string;
  amount: number;
  action: 'split' | 'merge';
}

/**
 * Gasless split/merge via Polymarket Builder Relayer.
 * Requires builder profile + relayer client credentials.
 */
export async function requestSplitMerge(
  req: SplitMergeRequest,
  paperMode: boolean,
): Promise<{ success: boolean; txHash?: string }> {
  const cfg = loadConfig();

  if (paperMode) {
    log.info({ req }, 'PAPER: relayer split/merge skipped');
    return { success: true };
  }

  if (!cfg.POLYGON_PRIVATE_KEY || !cfg.POLYMARKET_FUNDER_ADDRESS) {
    throw new Error('Relayer requires wallet credentials');
  }

  log.info(
    { action: req.action, conditionId: req.conditionId, amount: req.amount },
    'Relayer request queued (integrate @polymarket/builder-relayer-client for live)',
  );

  // Placeholder: production wiring uses @polymarket/builder-relayer-client
  // POST to RELAYER_HOST with signed payload from funder wallet
  return { success: false };
}
