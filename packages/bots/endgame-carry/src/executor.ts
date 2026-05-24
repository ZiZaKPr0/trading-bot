import {
  countOpenPositions,
  createClobClient,
  ExposureError,
  incrementOpsToday,
  loadConfig,
  logTrade,
  openPosition,
  releaseExposure,
  reserveExposure,
  saveFill,
  saveOpportunity,
} from '@bot-trading/core';
import type { TailCandidate } from './scanner.js';

export async function executeTailBuy(
  candidate: TailCandidate,
  paperMode: boolean,
  log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void },
) {
  const cfg = loadConfig();

  if (countOpenPositions('endgame-carry') >= cfg.CARRY_MAX_POSITIONS) {
    log.warn({}, 'Max carry positions reached');
    return { success: false, reason: 'max_positions' };
  }

  let reservationId: number | undefined;
  try {
    reservationId = reserveExposure('endgame-carry', candidate.sizeUsd, candidate.marketId);
  } catch (err) {
    if (err instanceof ExposureError) {
      log.warn({ err: err.message }, 'Exposure limit');
      return { success: false, reason: err.message };
    }
    throw err;
  }

  const size = Math.floor((candidate.sizeUsd / candidate.bestAsk) * 100) / 100;

  if (paperMode) {
    log.info({ candidate, size }, 'PAPER: tail buy');
    openPosition({
      strategyId: 'endgame-carry',
      conditionId: candidate.conditionId,
      tokenId: candidate.tokenId,
      side: 'BUY',
      size,
      avgPrice: candidate.bestAsk,
      costUsd: candidate.sizeUsd,
      metadata: { impliedApy: candidate.impliedApy, paper: true },
    });
    saveOpportunity('endgame-carry', candidate.marketId, candidate.impliedApy, { executed: true, paper: true }, true);
    logTrade('endgame-carry', 'paper_tail_buy', { ...candidate, size });
    incrementOpsToday('endgame-carry');
    if (reservationId !== undefined) releaseExposure(reservationId);
    return { success: true };
  }

  try {
    const client = await createClobClient();
    const { Side, OrderType } = await import('@polymarket/clob-client-v2');

    const result = await client.createAndPostMarketOrder(
      {
        tokenID: candidate.tokenId,
        price: candidate.bestAsk,
        amount: candidate.sizeUsd,
        side: Side.BUY,
        orderType: OrderType.FOK,
      },
      {},
      OrderType.FOK,
    );

    if (!result?.success && result?.status !== 'matched') {
      return { success: false, reason: 'FOK not filled' };
    }

    openPosition({
      strategyId: 'endgame-carry',
      conditionId: candidate.conditionId,
      tokenId: candidate.tokenId,
      side: 'BUY',
      size,
      avgPrice: candidate.bestAsk,
      costUsd: candidate.sizeUsd,
      metadata: { impliedApy: candidate.impliedApy },
    });
    saveFill({
      strategyId: 'endgame-carry',
      marketId: candidate.marketId,
      tokenId: candidate.tokenId,
      side: 'BUY',
      price: candidate.bestAsk,
      size,
    });
    saveOpportunity('endgame-carry', candidate.marketId, candidate.impliedApy, { executed: true }, true);
    logTrade('endgame-carry', 'tail_buy', { ...candidate, size });
    incrementOpsToday('endgame-carry');
    return { success: true };
  } finally {
    if (reservationId !== undefined) releaseExposure(reservationId);
  }
}
