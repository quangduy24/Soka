import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenIcon } from './TokenIcon';

const shortToken = (raw: string) =>
  raw?.includes('::') ? (raw.split('::').pop() || raw) : (raw || '?');

export interface SwapComparison {
  intent: string;
  sourceToken: string;
  destToken: string;
  amount: string;
  estOutput: string;
  guardianScore: number;
  guardianRiskLevel: string;
  isSafe: boolean;
  minLiquidityUsd: number;
  dangerCount: number;
  warningCount: number;
  sourceLogo?: string | null;
  destLogo?: string | null;
}

interface IntentConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  swapAIntent: string;
  swapBIntent: string;
  onKeepA: () => void;
  onSwitchToB: () => void;
  onCompare: () => void;
  comparison: { a: SwapComparison; b: SwapComparison } | null;
  isComparing: boolean;
  onSelectSwap: (which: 'a' | 'b') => void;
  onCancelBoth: () => void;
}

const RISK_LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  LOW: { color: 'text-[#2E7D00]', bg: 'bg-[#CCFF00]/10', border: 'border-[#141414]', label: 'LOW RISK' },
  MEDIUM: { color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', label: 'MEDIUM RISK' },
  HIGH: { color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', label: 'HIGH RISK' },
  CRITICAL: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', label: 'CRITICAL' },
};

const formatLiquidity = (usd: number) => {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}k`;
  return `$${usd.toFixed(0)}`;
};

const ComparisonColumn: React.FC<{ swap: SwapComparison; recommended: boolean }> = ({ swap, recommended }) => {
  const riskCfg = RISK_LEVEL_CONFIG[swap.guardianRiskLevel] || RISK_LEVEL_CONFIG.MEDIUM;
  const src = shortToken(swap.sourceToken);
  const dest = shortToken(swap.destToken);

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${recommended ? `${riskCfg.border} ${riskCfg.bg} ring-1 ring-[#CCFF00]/40` : 'border-[#141414] bg-[#FFFAF0]'}`}>
      {recommended && (
        <div className="flex items-center gap-1.5 -mt-1 mb-1">
          <span className="material-symbols-outlined text-[14px] text-[#2E7D00]">recommend</span>
          <span className="font-mono text-[8px] uppercase tracking-widest text-[#2E7D00] font-bold">Recommended</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <TokenIcon symbol={swap.sourceToken} logoUrl={swap.sourceLogo} size={28} />
        <span className="material-symbols-outlined text-[14px] text-[#2E7D00]/40">arrow_forward</span>
        <TokenIcon symbol={swap.destToken} logoUrl={swap.destLogo} size={28} />
      </div>
      <div className="font-mono text-[11px] text-[#141414] font-bold">
        {swap.amount} {src} → {dest}
      </div>

      <div className="flex flex-col gap-2 text-[10px] font-mono">
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/50 uppercase tracking-widest">Risk Score</span>
          <span className={`font-bold ${riskCfg.color}`}>{swap.guardianScore}/100</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/50 uppercase tracking-widest">Risk Level</span>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${riskCfg.bg} ${riskCfg.color} ${riskCfg.border} border`}>{riskCfg.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/50 uppercase tracking-widest">Min Liquidity</span>
          <span className={`font-bold ${swap.minLiquidityUsd < 50_000 ? 'text-red-400' : swap.minLiquidityUsd < 100_000 ? 'text-amber-400' : 'text-[#141414]'}`}>
            {formatLiquidity(swap.minLiquidityUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/50 uppercase tracking-widest">DANGER</span>
          <span className={`font-bold ${swap.dangerCount > 0 ? 'text-red-400' : 'text-[#141414]/50'}`}>{swap.dangerCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/50 uppercase tracking-widest">WARNING</span>
          <span className={`font-bold ${swap.warningCount > 0 ? 'text-amber-400' : 'text-[#141414]/50'}`}>{swap.warningCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/50 uppercase tracking-widest">Safe</span>
          <span className={`font-bold ${swap.isSafe ? 'text-[#2E7D00]' : 'text-red-400'}`}>{swap.isSafe ? '✓' : '✗ blocked'}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-[#141414]">
          <span className="text-[#141414]/50 uppercase tracking-widest">Est. Output</span>
          <span className="font-bold text-[#141414]">{swap.estOutput} {dest}</span>
        </div>
      </div>
    </div>
  );
};

export const IntentConflictModal: React.FC<IntentConflictModalProps> = ({
  isOpen,
  onClose,
  swapAIntent,
  swapBIntent,
  onKeepA,
  onSwitchToB,
  onCompare,
  comparison,
  isComparing,
  onSelectSwap,
  onCancelBoth,
}) => {
  const isComparisonMode = comparison !== null;
  const recommended = comparison
    ? comparison.a.guardianScore >= comparison.b.guardianScore ? 'a' : 'b'
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-[#FFFAF0] border-2 border-[#141414] rounded-[24px] p-6 w-full max-w-[520px] relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_15px_rgba(204, 255, 0, 0.1)] flex flex-col gap-4 m-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-[#141414] font-mono uppercase tracking-widest text-[14px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#2E7D00]">
                  {isComparisonMode ? 'compare_arrows' : 'alt_route'}
                </span>
                {isComparisonMode ? 'Compare Swaps' : 'Intent Conflict'}
              </h3>
              <button onClick={onClose} className="text-[#141414]/50 hover:text-[#2E7D00] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {!isComparisonMode && (
              <>
                {isComparing ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <span className="material-symbols-outlined text-[40px] text-[#2E7D00] animate-spin">sync</span>
                    <span className="font-mono text-[11px] text-[#141414]/60 uppercase tracking-widest">
                      Analyzing both swaps...
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-[#141414]/65 text-[13px] font-body leading-relaxed">
                      A swap is already being processed. Would you like to keep the current swap or switch to the new one?
                    </p>

                    <div className="rounded-xl border border-[#141414] bg-[#FFFAF0] p-3.5 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#2E7D00] font-bold">Swap A — Processing</span>
                      </div>
                      <span className="text-[#141414] text-[12px] font-body">{swapAIntent}</span>
                    </div>

                    <div className="rounded-xl border border-[#141414] bg-[#FFFAF0] p-3.5 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-[#E4FF70]" />
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#141414] font-bold">Swap B — New</span>
                      </div>
                      <span className="text-[#141414] text-[12px] font-body">{swapBIntent}</span>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={onCompare}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#CCFF00] to-[#7828dc] hover:opacity-90 text-[#141414] font-bold font-body text-[13px] transition-all duration-300 shadow-[0_0_15px_rgba(204, 255, 0, 0.3)] flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                        Compare Both
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={onKeepA}
                          className="flex-1 py-2.5 rounded-xl bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#141414] text-[#141414] font-bold font-body text-[12px] transition-all duration-300"
                        >
                          Keep Swap A
                        </button>
                        <button
                          onClick={onSwitchToB}
                          className="flex-1 py-2.5 rounded-xl bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#141414] text-[#141414] font-bold font-body text-[12px] transition-all duration-300"
                        >
                          Switch to B
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {isComparisonMode && comparison && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ComparisonColumn swap={comparison.a} recommended={recommended === 'a'} />
                  <ComparisonColumn swap={comparison.b} recommended={recommended === 'b'} />
                </div>

                <div className="rounded-xl border border-[#141414] bg-[#CCFF00]/5 p-3.5 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[#2E7D00] mt-0.5">lightbulb</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#2E7D00] font-bold">Recommendation</span>
                    <span className="text-[#141414]/70 text-[12px] font-body leading-relaxed">
                      Swap {recommended === 'a' ? 'A' : 'B'} is safer — risk score{' '}
                      <strong className="text-[#141414]">{recommended === 'a' ? comparison.a.guardianScore : comparison.b.guardianScore}/100</strong>{' '}
                      vs{' '}
                      <strong className="text-amber-400">{recommended === 'a' ? comparison.b.guardianScore : comparison.a.guardianScore}/100</strong>,
                      liquidity{' '}
                      <strong className="text-[#141414]">{formatLiquidity(recommended === 'a' ? comparison.a.minLiquidityUsd : comparison.b.minLiquidityUsd)}</strong>{' '}
                      vs{' '}
                      <strong className="text-amber-400">{formatLiquidity(recommended === 'a' ? comparison.b.minLiquidityUsd : comparison.a.minLiquidityUsd)}</strong>.
                      {(recommended === 'a' ? comparison.b : comparison.a).dangerCount > 0 && (
                        <> Swap {recommended === 'a' ? 'B' : 'A'} has {(recommended === 'a' ? comparison.b : comparison.a).dangerCount} DANGER checks — high risk.</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => onSelectSwap('a')}
                    className={`flex-1 py-2.5 rounded-xl font-bold font-body text-[12px] transition-all duration-300 ${
                      recommended === 'a'
                        ? 'bg-gradient-to-br from-[#CCFF00] to-[#7828dc] text-[#141414] shadow-[0_0_15px_rgba(204, 255, 0, 0.3)]'
                        : 'bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#141414] text-[#141414]'
                    }`}
                  >
                    Select Swap A
                  </button>
                  <button
                    onClick={() => onSelectSwap('b')}
                    className={`flex-1 py-2.5 rounded-xl font-bold font-body text-[12px] transition-all duration-300 ${
                      recommended === 'b'
                        ? 'bg-gradient-to-br from-[#CCFF00] to-[#7828dc] text-[#141414] shadow-[0_0_15px_rgba(204, 255, 0, 0.3)]'
                        : 'bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#141414] text-[#141414]'
                    }`}
                  >
                    Select Swap B
                  </button>
                  <button
                    onClick={onCancelBoth}
                    className="py-2.5 px-4 rounded-xl bg-[#141414]/5 hover:bg-red-500/10 border border-[#141414]/15 hover:border-red-500/30 text-[#141414]/60 hover:text-red-400 font-bold font-body text-[12px] transition-all duration-300"
                  >
                    Cancel Both
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
