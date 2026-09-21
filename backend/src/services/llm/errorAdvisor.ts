/**
 * Soka Intent Engine — LLM Error Advisor
 * Transforms technical on-chain, routing, and validation errors into concise,
 * friendly natural-language explanations powered by the LLM model.
 * All user-facing explanations are strictly delivered in English.
 */

import { generateLlmCompletion } from './llmClient.js';
import { logger } from '../../utils/logger.js';

export interface ExplainErrorParams {
  userPrompt: string;
  error: string;
  details?: string;
  intentAction?: string;
  context?: Record<string, unknown>;
}

/** Provides deterministic English fallback messages if LLM is unreachable. */
function getDeterministicFallback(userPrompt: string, error: string, details?: string): string {
  const errLower = (error + ' ' + (details || '')).toLowerCase();

  if (errLower.includes('no_liquidity') || errLower.includes('no live pool') || errLower.includes('no active pool')) {
    return 'There is no active liquidity pool for this pair on Mezo Testnet yet. You can try swapping between BTC, MUSD, or mUSDC!';
  }

  if (errLower.includes('insufficient') || errLower.includes('balance')) {
    return 'Your wallet balance is insufficient for this trade. Please check your balance or reduce the trade amount!';
  }

  if (errLower.includes('unknown token') || errLower.includes('unknown_token')) {
    return 'This token is not supported on Mezo Testnet. Supported tokens are BTC, MUSD, and mUSDC.';
  }

  if (errLower.includes('unclear') || errLower.includes('ambiguous')) {
    return 'I could not clearly understand your intent. Try commands like "Swap 0.001 BTC to MUSD" or "Bridge 0.01 BTC to Ethereum"!';
  }

  if (errLower.includes('recipient') || errLower.includes('evm address')) {
    return 'A valid destination address (starting with 0x) is required. Please verify the recipient address!';
  }

  return `Unable to process request: ${error}. You can try again with standard pairs like BTC/MUSD.`;
}

/**
 * Explains an execution, routing, or validation error using the LLM model.
 * Produces a 1-2 sentence friendly, natural language response strictly in English.
 */
export async function explainErrorWithLlm(params: ExplainErrorParams): Promise<string> {
  const { userPrompt, error, details, intentAction, context } = params;

  const systemPrompt = `You are Soka AI, the helpful, friendly DeFi copilot on Mezo Testnet.
A user asked: "${userPrompt}"
However, the system cannot execute this action due to an issue: "${error}" (${details || 'no additional detail'}).
Intent action: ${intentAction || 'UNKNOWN'}.
Context: ${JSON.stringify(context || {})}

YOUR TASK:
1. Explain the situation in 1 to 2 very concise, friendly, and complete sentences.
2. ALWAYS reply strictly in ENGLISH. Never use any other language.
3. STRICT GUIDELINES:
   - Always finish complete sentences. Do NOT leave sentences unfinished.
   - Speak naturally like a helpful AI DeFi assistant.
   - NEVER show raw technical codes, HTTP status codes (like 422/500), stack traces, JSON, or RPC errors.
   - If a pool does not exist (e.g. MEZO token), politely explain that this pair lacks liquidity on Mezo Testnet and suggest available tokens like BTC, MUSD, or mUSDC.
   - If balance is insufficient, politely explain that the wallet balance is too low.
   - Keep the reply under 45 words.`;

  try {
    const completion = await generateLlmCompletion({
      systemPrompt,
      userPrompt: `Explain this situation politely to the user in English: ${error}. Detail: ${details || ''}`,
      temperature: 0.3,
      maxTokens: 1024,
    });

    const cleaned = completion.trim().replace(/^["']|["']$/g, '');
    if (cleaned.length > 5) {
      return cleaned;
    }
  } catch (err) {
    logger.warn(`explainErrorWithLlm fallback used due to LLM error: ${(err as Error).message}`);
  }

  return getDeterministicFallback(userPrompt, error, details);
}
