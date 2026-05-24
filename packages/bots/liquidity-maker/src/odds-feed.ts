import { loadConfig } from '@bot-trading/core';

export interface OddsReference {
  homeTeam?: string;
  awayTeam?: string;
  homeProb?: number;
  awayProb?: number;
}

export async function fetchPinnacleImplied(
  sport: string,
  eventQuery: string,
): Promise<OddsReference | null> {
  const cfg = loadConfig();
  if (!cfg.ODDS_API_KEY) return null;

  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
    url.searchParams.set('apiKey', cfg.ODDS_API_KEY);
    url.searchParams.set('regions', 'eu');
    url.searchParams.set('markets', 'h2h');
    url.searchParams.set('oddsFormat', 'decimal');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    const events = (await res.json()) as Array<{
      home_team: string;
      away_team: string;
      bookmakers: Array<{ markets: Array<{ outcomes: Array<{ name: string; price: number }> }> }>;
    }>;

    const match = events.find(
      (e) =>
        eventQuery.toLowerCase().includes(e.home_team.toLowerCase()) ||
        eventQuery.toLowerCase().includes(e.away_team.toLowerCase()),
    );
    if (!match?.bookmakers?.[0]?.markets?.[0]?.outcomes) return null;

    const outcomes = match.bookmakers[0].markets[0].outcomes;
    const home = outcomes.find((o) => o.name === match.home_team);
    const away = outcomes.find((o) => o.name === match.away_team);
    if (!home || !away) return null;

    const homeProb = 1 / home.price;
    const awayProb = 1 / away.price;
    const total = homeProb + awayProb;

    return {
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      homeProb: homeProb / total,
      awayProb: awayProb / total,
    };
  } catch {
    return null;
  }
}

export function oddsDeviationCents(
  polymarketMid: number,
  referenceProb: number,
): number {
  return Math.abs(polymarketMid - referenceProb) * 100;
}
