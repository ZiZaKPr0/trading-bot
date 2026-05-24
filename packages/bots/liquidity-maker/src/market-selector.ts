import { createClobClient, loadConfig, watchToken } from '@bot-trading/core';

export interface RewardMarket {
  conditionId: string;
  question: string;
  tokenId: string;
  maxIncentiveSpread: number;
  minIncentiveSize: number;
  rewardsRatePerDay: number;
}

export async function selectRewardMarkets(maxMarkets: number): Promise<RewardMarket[]> {
  const client = await createClobClient();
  const rewards = await client.getCurrentRewards();
  const selected: RewardMarket[] = [];

  for (const rm of rewards) {
    if (selected.length >= maxMarkets) break;
    const yesToken = rm.tokens?.[0];
    if (!yesToken?.token_id) continue;

    watchToken(yesToken.token_id, {
      conditionId: rm.condition_id,
      strategyId: 'liquidity-maker',
    });

    selected.push({
      conditionId: rm.condition_id,
      question: rm.question,
      tokenId: yesToken.token_id,
      maxIncentiveSpread: rm.rewards_max_spread ?? 0.03,
      minIncentiveSize: rm.rewards_min_size ?? 10,
      rewardsRatePerDay: rm.rewards_config?.[0]?.rate_per_day ?? 0,
    });
  }

  return selected.sort((a, b) => b.rewardsRatePerDay - a.rewardsRatePerDay);
}

export async function refreshMarketsIfNeeded(
  current: RewardMarket[],
  lastRefresh: number,
  intervalMs = 900_000,
): Promise<{ markets: RewardMarket[]; refreshed: boolean }> {
  if (Date.now() - lastRefresh < intervalMs && current.length > 0) {
    return { markets: current, refreshed: false };
  }
  const cfg = loadConfig();
  const markets = await selectRewardMarkets(cfg.LM_MAX_MARKETS);
  return { markets, refreshed: true };
}
