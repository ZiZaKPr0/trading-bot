export interface BasketLeg {
  tokenId: string;
  conditionId: string;
  question: string;
  bestAsk: number;
  askDepthUsd: number;
  tickSize: string;
}

export interface BasketOpportunity {
  eventId: string;
  eventTitle: string;
  legs: BasketLeg[];
  sumAsks: number;
  edgePct: number;
  maxSizeUsd: number;
  k: number;
}
