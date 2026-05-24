import { createClobClient, saveRewardsDaily } from '@bot-trading/core';

export async function trackDailyRewards(strategyId: 'liquidity-maker') {
  const client = await createClobClient();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const earnings = await client.getUserEarningsAndMarketsConfig(today);
    let totalLiquidity = 0;

    for (const e of earnings) {
      const entry = e as { earnings?: Array<{ earnings?: number }>; condition_id?: string };
      const conditionId = entry.condition_id;
      const dayEarning = Array.isArray(entry.earnings)
        ? entry.earnings.reduce((s, x) => s + (x.earnings ?? 0), 0)
        : 0;
      totalLiquidity += dayEarning;
      saveRewardsDaily({
        strategyId,
        conditionId,
        date: today,
        liquidityRewards: dayEarning,
      });
    }

    return { totalLiquidity, markets: earnings.length };
  } catch {
    return { totalLiquidity: 0, markets: 0 };
  }
}

export async function getRewardPercentages() {
  const client = await createClobClient();
  return client.getRewardPercentages();
}
