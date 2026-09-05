/**
 * DIEPS Intent Engine — Token Advisor
 * When a token symbol cannot be resolved to a verified whitelist entry, we
 * search the registry/on-chain for tokens whose symbol/name is similar and ask
 * the LLM to summarise the matches — WITHOUT choosing one. The user picks the
 * exact token from the list shown in the chat.
 */

import { OPENROUTER_API_KEY, OPENROUTER_MODEL_CANDIDATES, OPENROUTER_BASE_URL } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { TokenCandidate } from '../coin/tokenResolver.js';

export interface TokenMatchSummary {
  missingSymbol: string;
  candidates: TokenCandidate[];
  /** Short human-readable intro to show above the selectable list in the chat. */
  message: string;
}

/**
 * Ask the LLM for a short intro summarising that we found N similar tokens and
 * inviting the user to pick one. The LLM must NOT recommend or choose a token —
 * selection is entirely the user's. Robust by design: tries each fallback model
 * and falls back to a deterministic message if the LLM is unavailable.
 */
export async function summarizeTokenMatches(
  userPrompt: string,
  missingSymbol: string,
  candidates: TokenCandidate[]
): Promise<TokenMatchSummary> {
  if (candidates.length === 0) {
    return { missingSymbol, candidates, message: '' };
  }

  const fallbackMessage = buildFallbackMessage(missingSymbol, candidates.length);

  if (!OPENROUTER_API_KEY) {
    return { missingSymbol, candidates, message: fallbackMessage };
  }

  const systemPrompt =
    `You are a Sui DeFi assistant. The user wants to swap to a token "${missingSymbol}" that is not in the verified whitelist. ` +
    `A search found ${candidates.length} token(s) whose symbol or name is similar. ` +
    `Write 1-2 short, friendly sentences telling the user you found ${candidates.length} possible match(es) and asking them to pick the exact token they want from the list below. ` +
    `Do NOT recommend, rank, or choose one yourself — the user decides. Do NOT list contract addresses (the UI shows them). No markdown, no code fences.`;

  const userMsg = `Original request: "${userPrompt}". Unresolved token: ${missingSymbol}. Matches found: ${candidates.length}.`;

  for (const model of OPENROUTER_MODEL_CANDIDATES) {
    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://dieps-intent-engine.app',
          'X-Title': 'DIEPS Intent Engine',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.3,
          max_tokens: 150,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text: string | undefined = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        return { missingSymbol, candidates, message: text };
      }
      throw new Error('Empty summary response');
    } catch (err: any) {
      logger.warn('Token match summary model failed, trying next candidate', {
        model,
        error: err.message,
      });
    }
  }

  return { missingSymbol, candidates, message: fallbackMessage };
}

function buildFallbackMessage(missingSymbol: string, count: number): string {
  return (
    `"${missingSymbol}" isn't in the verified whitelist. I found ${count} token${count > 1 ? 's' : ''} ` +
    `with a similar symbol — please pick the exact one you want to swap to from the list below, then I'll continue.`
  );
}
