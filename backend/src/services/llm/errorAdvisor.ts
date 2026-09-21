/**
 * Soka Intent Engine — LLM Error Advisor
 * Transforms technical on-chain, routing, and validation errors into concise,
 * friendly natural-language explanations powered by the LLM model.
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

/** Checks if a string contains Vietnamese characters or common keywords. */
function isVietnameseText(text: string): boolean {
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
    return true;
  }
  const lower = text.toLowerCase();
  const vnKeywords = ['swap', 'đổi', 'chuyển', 'tất cả', 'hết', 'ví', 'sang', 'cho', 'bao nhiêu', 'rút', 'vay'];
  return vnKeywords.some((k) => lower.includes(k) && !lower.match(/^[a-z0-9\s.,!?-]+$/i));
}

/** Provides deterministic fallback messages if LLM is unreachable. */
function getDeterministicFallback(userPrompt: string, error: string, details?: string): string {
  const isVn = isVietnameseText(userPrompt);
  const errLower = (error + ' ' + (details || '')).toLowerCase();

  if (errLower.includes('no_liquidity') || errLower.includes('no live pool') || errLower.includes('no active pool')) {
    return isVn
      ? 'Cặp giao dịch này hiện chưa có pool thanh khoản hoạt động trên Mezo Testnet. Bạn có thể thử swap giữa BTC, MUSD hoặc mUSDC nhé!'
      : 'There is no active liquidity pool for this pair on Mezo Testnet yet. You can try swapping between BTC, MUSD, or mUSDC!';
  }

  if (errLower.includes('insufficient') || errLower.includes('balance')) {
    return isVn
      ? 'Số dư trong ví của bạn không đủ để thực hiện lệnh này. Vui lòng kiểm tra lại số dư ví hoặc giảm bớt số lượng nhé!'
      : 'Your wallet balance is insufficient for this trade. Please check your balance or reduce the amount!';
  }

  if (errLower.includes('unknown token') || errLower.includes('unknown_token')) {
    return isVn
      ? 'Token này chưa được hỗ trợ trên mạng Mezo Testnet. Các token được hỗ trợ gồm: BTC, MUSD và mUSDC.'
      : 'This token is not supported on Mezo Testnet. Currently supported tokens are: BTC, MUSD, and mUSDC.';
  }

  if (errLower.includes('unclear') || errLower.includes('ambiguous')) {
    return isVn
      ? 'Mình chưa hiểu rõ ý định của bạn. Bạn có thể thử các câu lệnh mẫu như "Swap 0.001 BTC sang MUSD" hoặc "Bridge 0.01 BTC sang Ethereum" nhé!'
      : 'I could not clearly understand your intent. Try commands like "Swap 0.001 BTC to MUSD" or "Bridge 0.01 BTC to Ethereum"!';
  }

  if (errLower.includes('recipient') || errLower.includes('evm address')) {
    return isVn
      ? 'Giao dịch cần một địa chỉ ví nhận hợp lệ (bắt đầu bằng 0x). Bạn vui lòng kiểm tra lại địa chỉ ví nhé!'
      : 'A valid destination address (starting with 0x) is required. Please verify the recipient address!';
  }

  return isVn
    ? `Hệ thống chưa thể xử lý yêu cầu: ${error}. Bạn có thể thử lại với cặp BTC/MUSD hoặc liên hệ hỗ trợ nhé!`
    : `Unable to process request: ${error}. You can try with standard pairs like BTC/MUSD.`;
}

/**
 * Explains an execution, routing, or validation error using the LLM model.
 * Produces a 1-2 sentence friendly, natural language response.
 */
export async function explainErrorWithLlm(params: ExplainErrorParams): Promise<string> {
  const { userPrompt, error, details, intentAction, context } = params;
  const isVn = isVietnameseText(userPrompt);

  const systemPrompt = `You are Soka AI, the helpful, friendly DeFi copilot on Mezo Testnet.
A user asked: "${userPrompt}"
However, the system cannot execute this action due to an issue: "${error}" (${details || 'no additional detail'}).
Intent action: ${intentAction || 'UNKNOWN'}.
Context: ${JSON.stringify(context || {})}

YOUR TASK:
1. Explain the situation in 1 to 2 very concise, friendly, and complete sentences.
2. Reply in ${isVn ? 'Vietnamese' : 'the user’s language (Vietnamese if the prompt is in Vietnamese or from a Vietnamese user, English otherwise)'}.
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
      userPrompt: `Explain this situation politely to the user: ${error}. Detail: ${details || ''}`,
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
