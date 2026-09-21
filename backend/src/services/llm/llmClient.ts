/**
 * Soka Intent Engine — LLM Client
 * Calls OpenRouter chat completions API using native fetch without external SDK dependencies.
 */

import {
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL_CANDIDATES,
  LLM_TIMEOUT_MS,
  LLM_DEFAULTS,
} from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface LlmCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string;
}

/**
 * Calls OpenRouter chat completion API using native fetch.
 */
async function callOpenRouterRest(model: string, options: LlmCallOptions): Promise<string> {
  const key = OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

  const response = await fetch(`${OPENROUTER_BASE_URL}${LLM_DEFAULTS.chatPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': LLM_DEFAULTS.refererUrl,
      'X-Title': LLM_DEFAULTS.appTitle,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? LLM_DEFAULTS.temperature,
      max_tokens: Math.max(options.maxTokens ?? LLM_DEFAULTS.maxTokens, 2048),
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status} on model ${model}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`OpenRouter returned empty choices for model ${model}`);
  }

  return text;
}

/**
 * Executes an LLM completion via OpenRouter, trying candidate models in order.
 */
export async function generateLlmCompletion(options: LlmCallOptions): Promise<string> {
  if (OPENROUTER_API_KEY) {
    for (const model of OPENROUTER_MODEL_CANDIDATES) {
      try {
        return await callOpenRouterRest(model, options);
      } catch (err) {
        logger.warn(`OpenRouter model ${model} failed: ${(err as Error).message}`);
      }
    }
  }

  throw new Error('OpenRouter API call failed or OPENROUTER_API_KEY is not configured');
}
