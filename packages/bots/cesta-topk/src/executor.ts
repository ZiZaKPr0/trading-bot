import {
  createClobClient,
  ExposureError,
  incrementOpsToday,
  insertAlert,
  logTrade,
  releaseExposure,
  reserveExposure,
  saveFill,
  saveOpportunity,
  saveOrder,
} from '@bot-trading/core';
import type { BasketOpportunity } from './types.js';

export interface ExecutionResult {
  success: boolean;
  reservationId?: number;
  filledLegs: number;
  error?: string;
  directionalExposure?: boolean;
}

export async function executeBasket(
  opp: BasketOpportunity,
  paperMode: boolean,
  log: {
    info: (obj: object, msg?: string) => void;
    warn: (obj: object, msg?: string) => void;
    error: (obj: object, msg?: string) => void;
  },
): Promise<ExecutionResult> {
  const sortedLegs = [...opp.legs].sort((a, b) => a.askDepthUsd - b.askDepthUsd);
  let reservationId: number | undefined;

  try {
    reservationId = reserveExposure('cesta-topk', opp.maxSizeUsd, opp.eventId);
  } catch (err) {
    if (err instanceof ExposureError) {
      const message = err.message;
      log.warn({ err: message }, 'Exposure limit — skip execution');
      return { success: false, filledLegs: 0, error: message };
    }
    throw err;
  }

  if (paperMode) {
    log.info(
      { eventId: opp.eventId, sizeUsd: opp.maxSizeUsd, legs: sortedLegs.length, k: opp.k },
      'PAPER: would execute basket (thin-leg-first, leg1=FOK)',
    );
    logTrade('cesta-topk', 'paper_basket', {
      eventId: opp.eventId,
      edgePct: opp.edgePct,
      k: opp.k,
      sizeUsd: opp.maxSizeUsd,
      legs: sortedLegs.map((l) => ({ tokenId: l.tokenId, ask: l.bestAsk })),
    });
    saveOpportunity('cesta-topk', opp.eventId, opp.edgePct, { executed: true, paper: true, k: opp.k }, true);
    incrementOpsToday('cesta-topk');
    if (reservationId !== undefined) releaseExposure(reservationId);
    return { success: true, reservationId, filledLegs: sortedLegs.length };
  }

  const client = await createClobClient();
  const { Side, OrderType } = await import('@polymarket/clob-client-v2');
  let filledLegs = 0;

  try {
    const thinLeg = sortedLegs[0];
    const thinSize = Math.floor((opp.maxSizeUsd / thinLeg.bestAsk) * 100) / 100;

    log.info(
      { tokenId: thinLeg.tokenId, price: thinLeg.bestAsk, size: thinSize },
      'Leg 1 (thinnest): FOK order',
    );

    const leg1Result = await client.createAndPostMarketOrder(
      {
        tokenID: thinLeg.tokenId,
        price: thinLeg.bestAsk,
        amount: opp.maxSizeUsd,
        side: Side.BUY,
        orderType: OrderType.FOK,
      },
      { negRisk: true },
      OrderType.FOK,
    );

    if (!leg1Result?.success && leg1Result?.status !== 'matched') {
      log.warn({ leg1Result }, 'Leg 1 FOK failed — abort entire basket');
      return { success: false, reservationId, filledLegs: 0, error: 'Leg 1 FOK failed' };
    }

    filledLegs = 1;
    saveOrder({
      id: leg1Result.orderID ?? `leg1-${Date.now()}`,
      strategyId: 'cesta-topk',
      marketId: opp.eventId,
      tokenId: thinLeg.tokenId,
      side: 'BUY',
      price: thinLeg.bestAsk,
      size: thinSize,
      status: 'filled',
    });
    saveFill({
      strategyId: 'cesta-topk',
      marketId: opp.eventId,
      tokenId: thinLeg.tokenId,
      side: 'BUY',
      price: thinLeg.bestAsk,
      size: thinSize,
    });
    logTrade('cesta-topk', 'leg1_fok_filled', { tokenId: thinLeg.tokenId, eventId: opp.eventId });

    for (const leg of sortedLegs.slice(1)) {
      const size = Math.floor((opp.maxSizeUsd / leg.bestAsk) * 100) / 100;
      if (size <= 0) continue;

      log.info({ tokenId: leg.tokenId, price: leg.bestAsk, size }, 'Subsequent leg: FOK');

      try {
        const result = await client.createAndPostMarketOrder(
          {
            tokenID: leg.tokenId,
            price: leg.bestAsk,
            amount: opp.maxSizeUsd,
            side: Side.BUY,
            orderType: OrderType.FOK,
          },
          { negRisk: true },
          OrderType.FOK,
        );

        if (result?.success || result?.status === 'matched') {
          filledLegs++;
          saveFill({
            strategyId: 'cesta-topk',
            marketId: opp.eventId,
            tokenId: leg.tokenId,
            side: 'BUY',
            price: leg.bestAsk,
            size,
          });
          logTrade('cesta-topk', 'leg_filled', { tokenId: leg.tokenId, eventId: opp.eventId });
        } else {
          throw new Error(`Leg FOK failed for ${leg.tokenId}`);
        }
      } catch (legErr) {
        const msg = legErr instanceof Error ? legErr.message : String(legErr);
        log.error({ err: msg, filledLegs }, 'Partial basket — directional exposure');
        insertAlert(
          'error',
          `DIRECTIONAL_EXPOSURE: ${filledLegs}/${sortedLegs.length} legs filled for ${opp.eventTitle}`,
          'cesta-topk',
        );
        logTrade('cesta-topk', 'directional_exposure', {
          eventId: opp.eventId,
          filledLegs,
          totalLegs: sortedLegs.length,
          error: msg,
        });

        try {
          await client.cancelAll();
        } catch {
          log.warn({}, 'Failed to cancel after partial basket');
        }

        return {
          success: false,
          reservationId,
          filledLegs,
          error: msg,
          directionalExposure: true,
        };
      }
    }

    saveOpportunity('cesta-topk', opp.eventId, opp.edgePct, { executed: true, k: opp.k }, true);
    incrementOpsToday('cesta-topk');
    return { success: filledLegs === sortedLegs.length, reservationId, filledLegs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg, filledLegs }, 'Basket execution failed');
    logTrade('cesta-topk', 'basket_error', { eventId: opp.eventId, error: msg, filledLegs });

    try {
      await client.cancelAll();
    } catch {
      log.warn({}, 'Failed to cancel remaining orders');
    }

    return { success: false, reservationId, filledLegs, error: msg };
  } finally {
    if (reservationId !== undefined) releaseExposure(reservationId);
  }
}
