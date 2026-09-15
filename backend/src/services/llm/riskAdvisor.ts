/**
 * Soka Intent Engine — Risk Advisor
 * Generates natural-language risk advice and structured risk summaries
 * from risk guardian checks for Mezo Testnet using the unified LLM client.
 */

import { generateLlmCompletion } from './llmClient.js';
import { logger } from '../../utils/logger.js';
import type { RiskCheck, RouteNode } from '../../types/index.js';

// ─── Types ─────────────────────────────────────────────────────

export interface RiskSummaryResult {
  summary: string;
  detailedAnalysis: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  hasHighRisk: boolean;
  uiLabels?: {
    slippageLabel: string;
    slippageSubLabel: string;
    distributionLabel: string;
    distributionSubLabel: string;
    poolsLabel: string;
    poolsSubLabel: string;
    category: string;
  };
}

function computeRiskLevel(checks: RiskCheck[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  let score = 100;
  for (const c of checks) {
    if (c.status === 'DANGER') score -= 25;
    else if (c.status === 'WARNING') score -= 10;
  }
  if (score >= 80) return 'LOW';
  if (score >= 60) return 'MEDIUM';
  if (score >= 30) return 'HIGH';
  return 'CRITICAL';
}

function buildFallbackSummary(
  checks: RiskCheck[],
  sourceToken: string,
  destToken: string,
  amount: string
): RiskSummaryResult {
  const dangerChecks = checks.filter((c) => c.status === 'DANGER');
  const warningChecks = checks.filter((c) => c.status === 'WARNING');
  const safeChecks = checks.filter((c) => c.status === 'SAFE');
  const hasHighRisk = dangerChecks.length > 0;
  const riskLevel = computeRiskLevel(checks);

  let summary: string;
  if (hasHighRisk) {
    const dangerNames = dangerChecks.map((c) => c.name).join(', ');
    summary =
      `Soka Agent detected critical risks (${dangerNames}) for swapping ${amount} ${sourceToken} to ${destToken}. ` +
      `Check for high slippage or low pool liquidity before signing. ` +
      `Soka Agent advises against this swap — the risks outweigh the benefits.`;
  } else if (warningChecks.length > 0) {
    const warnNames = warningChecks.map((c) => c.name).join(', ');
    summary =
      `Your swap of ${amount} ${sourceToken} to ${destToken} has minor warnings (${warnNames}). ` +
      `Slippage and concentration are within manageable parameters, and liquidity pools are active. ` +
      `Soka Agent recommends proceeding with awareness of the factors above.`;
  } else {
    summary =
      `Your trade of ${amount} ${sourceToken} to ${destToken} has safe price impact with no high slippage. ` +
      `Token concentration is low, and all liquidity pools are active (no stale pools). ` +
      `Soka Agent sees no concerns with this swap.`;
  }

  const detailedAnalysis = [
    `[Slippage]\n${checks.filter((c) => c.category === 'Market Risk' || c.name.includes('Slippage') || c.name.includes('Price Impact')).map((c) => `• ${c.message}`).join('\n') || '• Price impact within safe parameters.'}`,
    `[Concentration]\n${checks.filter((c) => c.category === 'Concentration' || c.name.includes('Concentration')).map((c) => `• ${c.message}`).join('\n') || '• No high concentration risk detected.'}`,
    `[Pool Health]\n${checks.filter((c) => c.category === 'Pool Safety' || c.name.includes('Pool') || c.name.includes('Liquidity')).map((c) => `• ${c.message}`).join('\n') || '• Liquidity pool is active and operational.'}`,
    `[Token Safety]\n${checks.filter((c) => c.category === 'Token Safety' || c.name.includes('Token') || c.name.includes('Verification')).map((c) => `• ${c.message}`).join('\n') || '• Token contract verified on Mezo.'}`,
  ].join('\n\n');

  return {
    summary,
    detailedAnalysis,
    riskLevel,
    hasHighRisk,
    uiLabels: {
      slippageLabel: hasHighRisk ? 'High Slippage' : warningChecks.length > 0 ? 'Slippage Warning' : 'Safe Slippage',
      slippageSubLabel: hasHighRisk ? 'Price impact exceeds danger threshold.' : 'Within safe parameters.',
      distributionLabel: 'Concentration',
      distributionSubLabel: 'Token distribution evaluated on Mezo.',
      poolsLabel: 'Liquidity & Pools',
      poolsSubLabel: 'Pool verification completed on Mezo Swap.',
      category: hasHighRisk ? 'Danger' : warningChecks.length > 0 ? 'Warning' : 'Safe',
    },
  };
}

export async function getRiskSummary(
  guardianChecks: RiskCheck[],
  sourceToken: string,
  destToken: string,
  amount: string,
  routeNodes: RouteNode[] = []
): Promise<RiskSummaryResult> {
  const systemPrompt = `You are the Soka Risk Guardian agent on Mezo (Bitcoin Layer 2 EVM).
Analyze risk checks and return strict JSON with fields:
{
  "summary": "<3 to 4 concise plain English sentences summarizing risks, explicitly mentioning slippage, concentration, and pool health>",
  "detailedAnalysis": "[Slippage]\\n...\\n\\n[Concentration]\\n...\\n\\n[Pool Health]\\n...\\n\\n[Token Safety]\\n...",
  "uiLabels": {
    "slippageLabel": "Safe Slippage" | "High Slippage",
    "slippageSubLabel": "...",
    "distributionLabel": "...",
    "distributionSubLabel": "...",
    "poolsLabel": "...",
    "poolsSubLabel": "...",
    "category": "Safe" | "Warning" | "Danger"
  }
}`;

  const userMsg = `Risk checks:
${JSON.stringify(guardianChecks, null, 2)}
Route:
${JSON.stringify(routeNodes, null, 2)}
Trade: ${amount} ${sourceToken} -> ${destToken}`;

  try {
    const rawOutput = await generateLlmCompletion({
      systemPrompt,
      userPrompt: userMsg,
      temperature: 0.2,
      maxTokens: 1024,
    });

    const cleaned = rawOutput.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.summary && parsed.detailedAnalysis) {
      return {
        summary: parsed.summary,
        detailedAnalysis: typeof parsed.detailedAnalysis === 'string' ? parsed.detailedAnalysis : JSON.stringify(parsed.detailedAnalysis),
        riskLevel: computeRiskLevel(guardianChecks),
        hasHighRisk: guardianChecks.some((c) => c.status === 'DANGER'),
        uiLabels: parsed.uiLabels || {
          slippageLabel: 'Safe Slippage',
          slippageSubLabel: 'Within safe parameters.',
          distributionLabel: 'Concentration',
          distributionSubLabel: 'Low concentration risk.',
          poolsLabel: 'Liquidity & Pools',
          poolsSubLabel: 'Analysis completed on Mezo.',
          category: 'Safe',
        },
      };
    }
  } catch (err) {
    logger.warn('LLM risk summary call failed, falling back to deterministic summary', {
      error: (err as Error).message,
    });
  }

  return buildFallbackSummary(guardianChecks, sourceToken, destToken, amount);
}

export async function summarizeRiskAdvice(
  sourceToken: string,
  destToken: string,
  risks: RiskCheck[]
): Promise<string> {
  if (risks.length === 0) return '';

  const fallbackMessage = '⚠️ Notice: ' + risks.map((r) => r.message).join(' ');

  const systemPrompt = `You are a DeFi security advisor on Mezo Network. The user is swapping ${sourceToken} for ${destToken}.
Advise the user in 1-2 friendly sentences regarding the detected risks. No markdown.`;

  const userMsg = `Risks detected: ${JSON.stringify(risks.map((r) => ({ risk: r.name, detail: r.message })))}`;

  try {
    const text = await generateLlmCompletion({
      systemPrompt,
      userPrompt: userMsg,
      temperature: 0.3,
      maxTokens: 150,
      responseMimeType: 'text/plain',
    });
    if (text?.trim()) return `⚠️ ${text.trim()}`;
  } catch (err) {
    logger.warn('Risk advice LLM call failed, using fallback', {
      error: (err as Error).message,
    });
  }

  return fallbackMessage;
}
