import { requestSplitMerge } from '../clients/relayer.js';
import { createLogger } from '../logger.js';

const log = createLogger('inventory');

export async function splitPosition(
  conditionId: string,
  amountUsd: number,
  paperMode: boolean,
) {
  log.info({ conditionId, amountUsd }, 'Split position');
  return requestSplitMerge({ conditionId, amount: amountUsd, action: 'split' }, paperMode);
}

export async function mergePosition(
  conditionId: string,
  amountUsd: number,
  paperMode: boolean,
) {
  log.info({ conditionId, amountUsd }, 'Merge position');
  return requestSplitMerge({ conditionId, amount: amountUsd, action: 'merge' }, paperMode);
}
