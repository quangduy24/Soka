import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RiskCheck } from '../../../types/shared';

interface RiskSummaryData {
  summary: string;
  detailedAnalysis: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  hasHighRisk: boolean;
}

interface RiskReviewCardProps {
  guardianChecks: RiskCheck[];
  data: RiskSummaryData | null;
  loading: boolean;
  error: string | null;
  onAcknowledge?: (acknowledged: boolean) => void;
}

const RISK_COLORS: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  LOW: { dot: 'bg-emerald-400', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  MEDIUM: { dot: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  HIGH: { dot: 'bg-orange-400', text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
  CRITICAL: { dot: 'bg-red-500', text: 'text-red-500', border: 'border-red-500/30', bg: 'bg-red-500/10' },
};

const RISK_LABELS: Record<string, string> = {
  LOW: 'All Clear',
  MEDIUM: 'Caution',
  HIGH: 'High Risk',
  CRITICAL: 'Critical',
};

const PILL_STYLES: Record<string, { dot: string; text: string }> = {
  SAFE: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  NEUTRAL: { dot: 'bg-white/40', text: 'text-[#141414]/55' },
  WARNING: { dot: 'bg-amber-400', text: 'text-amber-400' },
  DANGER: { dot: 'bg-red-500', text: 'text-red-500' },
};

// Risk-related keywords to highlight in the summary text
const RISK_KEYWORDS = [
  'high slippage', 'slippage', 'price impact',
  'concentration', 'concentrated', 'concentrate',
  'stale pool', 'stale', 'inactive pool', 'low activity',
  'low liquidity', 'thin liquidity', 'insufficient liquidity',
  'pool depth', 'pool health', 'liquidity risk',
  'high risk', 'low risk', 'medium risk', 'critical risk',
  'unsafe', 'warning', 'danger', 'caution',
  'not recommend', 'recommend proceeding', 'recommend caution',
  'token safety', 'treasury cap', 'minting',
  'holder', 'distribution', 'unbalanced',
];

/**
 * Wrap risk keywords AND numeric values in the text with highlighted <span> elements.
 * Returns React nodes so it can be used directly in JSX.
 */
function highlightRiskKeywords(text: string): React.ReactNode[] {
  if (!text || typeof text !== 'string') return [];

  // Build a single regex: risk keywords OR numbers (with optional %, $, commas, decimals)
  const escaped = RISK_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const numberPattern = '\\$?[\\d,]+\\.?\\d*%?';
  const pattern = new RegExp(`(${escaped.join('|')}|${numberPattern})`, 'gi');

  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isKeyword = RISK_KEYWORDS.some((k) => k.toLowerCase() === part.toLowerCase());
    const isNumber = /^\$?[\d,]+\.?\d*%?$/.test(part);

    if (isKeyword) {
      return (
        <span key={i} className="text-[#141414] font-bold">
          {part}
        </span>
      );
    }
    if (isNumber) {
      return (
        <span key={i} className="text-[#141414] font-semibold">
          {part}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function getOverallPillStatus(checks: RiskCheck[], category: string, extraKeywords: string[] = []): string {
  const allKeywords = [category, ...extraKeywords];
  const matched = checks.filter(
    (c) =>
      allKeywords.some((kw) => c.name.toLowerCase().includes(kw)) ||
      (c.category && allKeywords.some((kw) => c.category!.toLowerCase().includes(kw)))
  );
  if (matched.some((c) => c.status === 'DANGER')) return 'DANGER';
  if (matched.some((c) => c.status === 'WARNING')) return 'WARNING';
  if (matched.length === 0) return 'NEUTRAL';
  return 'SAFE';
}

export const RiskReviewCard: React.FC<RiskReviewCardProps> = ({
  guardianChecks,
  data,
  loading,
  error,
  onAcknowledge,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAcknowledge = () => {
    const next = !acknowledged;
    setAcknowledged(next);
    onAcknowledge?.(next);
  };

  const riskLevel = data?.riskLevel || 'MEDIUM';
  const colors = RISK_COLORS[riskLevel];

  // Map guardian checks to the 4 display categories.
  // Each pill aggregates the worst status from all matching checks.
  // Keywords must match check.name or check.category (case-insensitive .includes()).
  const slipStatus = getOverallPillStatus(guardianChecks, 'slippage', ['price impact', 'liquidity risk', 'liquidity health', 'liquidity depth']);
  const concStatus = getOverallPillStatus(guardianChecks, 'concentration');
  const poolStatus = getOverallPillStatus(guardianChecks, 'pool', ['stale']);
  const tokenStatus = getOverallPillStatus(guardianChecks, 'token');

  const highlightedSummary = useMemo(
    () => (data?.summary ? highlightRiskKeywords(data.summary) : null),
    [data?.summary]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`bg-[#FFFAF0] border-2 ${colors.border} rounded-3xl w-full max-w-[600px] shadow-[6px_6px_0_#141414] my-4 self-center my-4 relative overflow-hidden flex flex-col p-6 md:p-8`}
    >
      {/* Header: risk level badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] sm:text-[14px] md:text-[16px] text-[#141414] font-bold tracking-[0.05em] md:tracking-[0.15em] uppercase drop-shadow-[0_0_8px_rgba(192,132,252,0.4)] break-words">
            FLUX Risk Review
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} ${colors.border} border`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
            {RISK_LABELS[riskLevel] || riskLevel}
          </span>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-4">
          <span className="material-symbols-outlined text-[16px] text-[#2E7D00] animate-spin">sync</span>
          <span className="text-[#141414]/60 text-[12px] animate-pulse">FLUX is analyzing risks...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 py-3">
          <span className="material-symbols-outlined text-[14px] text-amber-400">info</span>
          <span className="text-amber-400/80 text-[11px]">{error}</span>
        </div>
      )}

      {/* Summary text */}
      {!loading && data && (
        <>
          <p className="text-[#141414]/70 text-[13px] leading-relaxed font-body mb-3">
            {highlightedSummary}
          </p>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { label: 'Slippage', status: slipStatus },
              { label: 'Concentration', status: concStatus },
              { label: 'Pool Health', status: poolStatus },
              { label: 'Token Safety', status: tokenStatus },
            ].map(({ label, status }) => {
              const pill = PILL_STYLES[status] || PILL_STYLES.NEUTRAL;
              return (
                <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
                  <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
                  <span className={`text-[10px] font-mono font-medium ${pill.text}`}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Expandable detailed analysis */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[#141414]/60 hover:text-[#2E7D00] text-[11px] font-mono transition-colors duration-200 mb-1"
          >
            <span className="material-symbols-outlined text-[14px] transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              chevron_right
            </span>
            {expanded ? 'Hide Details Risk Review' : 'Details Risk Review'}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-3 rounded-xl bg-[#FFFAF0]/60 border border-white/[0.05] max-h-[320px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[#141414]/60 text-[11px] leading-[1.7] font-mono whitespace-pre-wrap break-words">
                    {data.detailedAnalysis
                      ? highlightRiskKeywords(data.detailedAnalysis)
                      : 'No detailed analysis available. All checks passed.'}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Acknowledgment checkbox */}
          <button
            onClick={handleAcknowledge}
            className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.06] w-full text-left group"
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
              acknowledged
                ? 'bg-[#CCFF00] border-[#141414] shadow-[0_0_8px_rgba(204, 255, 0, 0.5)]'
                : 'border-white/20 bg-white/[0.03] group-hover:border-[#141414]'
            }`}>
              {acknowledged && (
                <span className="material-symbols-outlined text-[14px] text-[#141414]">check</span>
              )}
            </div>
            <span className={`text-[12px] font-body transition-colors duration-200 ${
              acknowledged ? 'text-[#141414]/70' : 'text-[#141414]/55 group-hover:text-[#141414]/60'
            }`}>
              I understand the risks and want to proceed
            </span>
          </button>
        </>
      )}
    </motion.div>
  );
};
