/**
 * Soka Intent Engine — LLM Client
 * Calls OpenRouter chat completions API using native fetch without external SDK dependencies.
 */

import {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL,
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL_CANDIDATES,
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
  const key = OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://soka-intent-engine.app',
      'X-Title': 'Soka Intent Engine',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1024,
    }),
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
  if (OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY) {
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
