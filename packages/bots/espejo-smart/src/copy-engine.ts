import {
  createClobClient,
  ExposureError,
  getOrderBook,
  getStrategyExposure,
  incrementOpsToday,
  loadConfig,
  logTrade,
  parseBestAsk,
  parseBestBid,
  releaseExposure,
  reserveExposure,
  saveCopiedTrade,
  saveFill,
} from '@bot-trading/core';
import type { DetectedTrade } from './trade-monitor.js';

export interface CopyResult {
  copied: boolean;
  reason?: string;
  slippageCents?: number;
}

export async function copyTrade(
  trade: DetectedTrade,
  paperMode: boolean,
  dryRun: boolean,
  log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void },
): Promise<CopyResult> {
  const cfg = loadConfig();

  if (dryRun) {
    log.info({ trade }, 'DRY RUN: would copy trade');
    saveCopiedTrade({
      strategyId: 'espejo-smart',
      sourceWallet: trade.wallet,
      tokenId: trade.tokenId,
      conditionId: trade.conditionId,
      sourcePrice: trade.price,
      copyPrice: trade.price,
      slippageCents: 0,
      size: 0,
      costUsd: 0,
      status: 'dry_run',
    });
    return { copied: false, reason: 'dry_run' };
  }

  const book = await getOrderBook(trade.tokenId);
  const currentPrice =
    trade.side === 'BUY'
      ? parseBestAsk(book) ?? trade.price
      : parseBestBid(book) ?? trade.price;

  const slippageCents = Math.abs(currentPrice - trade.price) * 100;
  const maxSlippage = cfg.MAX_SLIPPAGE_CENTS / 100;

  if (currentPrice > trade.price + maxSlippage && trade.side === 'BUY') {
    log.warn({ slippageCents, trade, currentPrice }, 'Slippage too high — skip');
    saveCopiedTrade({
      strategyId: 'espejo-smart',
      sourceWallet: trade.wallet,
      tokenId: trade.tokenId,
      conditionId: trade.conditionId,
      sourcePrice: trade.price,
      copyPrice: currentPrice,
      slippageCents,
      size: 0,
      costUsd: 0,
      status: 'skipped_slippage',
    });
    return { copied: false, reason: 'slippage', slippageCents };
  }

  const maxCopyExposure =
    cfg.MAX_TOTAL_EXPOSURE_USD * (cfg.ESPEJO_MAX_COPY_EXPOSURE_PCT / 100);
  if (getStrategyExposure('espejo-smart') >= maxCopyExposure) {
    return { copied: false, reason: 'max_copy_exposure' };
  }

  const copySizeUsd = Math.min(cfg.MAX_POSITION_USD, trade.notionalUsd * 0.05);
  let reservationId: number | undefined;

  try {
    reservationId = reserveExposure('espejo-smart', copySizeUsd, trade.conditionId);
  } catch (err) {
    if (err instanceof ExposureError) {
      return { copied: false, reason: err.message };
    }
    throw err;
  }

  const size = Math.floor((copySizeUsd / currentPrice) * 100) / 100;

  if (paperMode) {
    log.info({ trade, copySizeUsd, size, currentPrice }, 'PAPER: copy trade');
    saveCopiedTrade({
      strategyId: 'espejo-smart',
      sourceWallet: trade.wallet,
      tokenId: trade.tokenId,
      conditionId: trade.conditionId,
      sourcePrice: trade.price,
      copyPrice: currentPrice,
      slippageCents,
      size,
      costUsd: copySizeUsd,
      status: 'paper',
    });
    logTrade('espejo-smart', 'paper_copy', { wallet: trade.wallet, tokenId: trade.tokenId });
    incrementOpsToday('espejo-smart');
    if (reservationId !== undefined) releaseExposure(reservationId);
    return { copied: true, slippageCents };
  }

  try {
    const client = await createClobClient();
    const { Side, OrderType } = await import('@polymarket/clob-client-v2');

    const result = await client.createAndPostMarketOrder(
      {
        tokenID: trade.tokenId,
        price: trade.price + maxSlippage,
        amount: copySizeUsd,
        side: trade.side === 'BUY' ? Side.BUY : Side.SELL,
        orderType: OrderType.FOK,
      },
      {},
      OrderType.FOK,
    );

    if (!result?.success && result?.status !== 'matched') {
      saveCopiedTrade({
        strategyId: 'espejo-smart',
        sourceWallet: trade.wallet,
        tokenId: trade.tokenId,
        conditionId: trade.conditionId,
        sourcePrice: trade.price,
        copyPrice: currentPrice,
        slippageCents,
        size: 0,
        costUsd: 0,
        status: 'fok_failed',
      });
      return { copied: false, reason: 'fok_failed', slippageCents };
    }

    saveCopiedTrade({
      strategyId: 'espejo-smart',
      sourceWallet: trade.wallet,
      tokenId: trade.tokenId,
      conditionId: trade.conditionId,
      sourcePrice: trade.price,
      copyPrice: currentPrice,
      slippageCents,
      size,
      costUsd: copySizeUsd,
      status: 'filled',
    });
    saveFill({
      strategyId: 'espejo-smart',
      tokenId: trade.tokenId,
      side: trade.side,
      price: currentPrice,
      size,
    });
    logTrade('espejo-smart', 'copy_filled', {
      wallet: trade.wallet,
      tokenId: trade.tokenId,
      slippageCents,
    });
    incrementOpsToday('espejo-smart');
    return { copied: true, slippageCents };
  } finally {
    if (reservationId !== undefined) releaseExposure(reservationId);
  }
}
