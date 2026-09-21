/**
 * Soka Intent Engine — Token Advisor
 * When a token symbol cannot be resolved to a verified whitelist entry, we
 * search for similar tokens and ask the LLM to summarize the matches.
 * The user picks the exact token from the list.
 */

import { generateLlmCompletion } from './llmClient.js';
import { logger } from '../../utils/logger.js';
import { LLM_DEFAULTS } from '../../config/index.js';
import type { TokenCandidate } from '../coin/tokenResolver.js';

export interface TokenMatchSummary {
  missingSymbol: string;
  candidates: TokenCandidate[];
  /** Short human-readable intro to show above the selectable list */
  message: string;
}

/**
 * Ask the LLM for a short intro summarising that we found N similar tokens and
 * inviting the user to pick one.
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

  const systemPrompt =
    `You are a DeFi assistant on Mezo. The user wants to swap to a token "${missingSymbol}" that is not in the verified whitelist. ` +
    `A search found ${candidates.length} token(s) whose symbol or name is similar. ` +
    `Write 1-2 short, friendly sentences telling the user you found ${candidates.length} possible match(es) and asking them to pick the exact token they want from the list below. ` +
    `Do NOT recommend, rank, or choose one yourself — the user decides. Do NOT list contract addresses (the UI shows them). No markdown, no code fences.`;

  const userMsg = `Original request: "${userPrompt}". Unresolved token: ${missingSymbol}. Matches found: ${candidates.length}.`;

  try {
    const text = await generateLlmCompletion({
      systemPrompt,
      userPrompt: userMsg,
      temperature: LLM_DEFAULTS.advisorTemperature,
      maxTokens: LLM_DEFAULTS.advisorShortMaxTokens,
      responseMimeType: 'text/plain',
    });

    if (text?.trim()) {
      return { missingSymbol, candidates, message: text.trim() };
    }
  } catch (err) {
    logger.warn('Token match summary LLM call failed, using fallback', {
      error: (err as Error).message,
    });
  }

  return { missingSymbol, candidates, message: fallbackMessage };
}

function buildFallbackMessage(missingSymbol: string, count: number): string {
  return (
    `"${missingSymbol}" isn't in the verified whitelist. I found ${count} token${count > 1 ? 's' : ''} ` +
    `with a similar symbol — please pick the exact one you want to swap to from the list below, then I'll continue.`
  );
}
