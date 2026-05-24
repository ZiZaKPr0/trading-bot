import { loadConfig } from '@bot-trading/core';

export interface ResolutionAssessment {
  allowed: boolean;
  ambiguous: boolean;
  reason: string;
}

const AMBIGUITY_PATTERNS = [
  /overtime|extra time|penalt/i,
  /suspend|postpone|cancel/i,
  /unless|except|subject to/i,
  /consensus|interpret/i,
  /pr[oó]rroga/i,
];

export async function assessResolutionRules(
  question: string,
  description?: string,
): Promise<ResolutionAssessment> {
  const cfg = loadConfig();
  const text = `${question}\n${description ?? ''}`;

  for (const pattern of AMBIGUITY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        allowed: false,
        ambiguous: true,
        reason: `Ambiguous rule pattern: ${pattern.source}`,
      };
    }
  }

  if (!cfg.LLM_RESOLUTION_FILTER || !cfg.LLM_API_KEY || !cfg.LLM_API_URL) {
    return { allowed: true, ambiguous: false, reason: 'Heuristic pass (LLM disabled)' };
  }

  try {
    const res = await fetch(cfg.LLM_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a conservative risk filter for prediction market resolution rules. Reply ONLY with JSON: {"allowed":boolean,"ambiguous":boolean,"reason":string}. Reject if rules could be disputed on UMA (overtime, suspension, subjective criteria). Only approve sports/economic data with clear official resolution.',
          },
          {
            role: 'user',
            content: `Market question: ${question}\n\nRules/description: ${description ?? 'N/A'}`,
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as ResolutionAssessment;
    return parsed;
  } catch (err) {
    return {
      allowed: false,
      ambiguous: true,
      reason: `LLM filter error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
