import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenIcon } from './TokenIcon';
import { SuiscanRefs } from './SuiscanRefs';
import type { RiskCheck, RiskReference, RouteNode } from '../../../types/shared';

const shortToken = (raw: string) =>
  raw?.includes('::') ? (raw.split('::').pop() || raw) : (raw || '?');

interface RouteSummaryCardProps {
  amount: string;
  sourceToken: string;
  destToken: string;
  estOutput: string;
  fee: string;
  onConfirm: () => void;
  onBack: () => void;
  isSafe: boolean;
  sourceLogo?: string | null;
  destLogo?: string | null;
  guardianChecks?: RiskCheck[];
  routeNodes?: RouteNode[];
  sourceAddress?: string;
  destAddress?: string;
  uiLabels?: {
    slippageLabel: string;
    slippageSubLabel: string;
    distributionLabel: string;
    distributionSubLabel: string;
    poolsLabel: string;
    poolsSubLabel: string;
    category: string;
  };
  isLoading?: boolean;
}

export const RouteSummaryCard: React.FC<RouteSummaryCardProps> = ({
  amount, sourceToken, destToken, estOutput, fee, onConfirm, onBack, isSafe, sourceLogo, destLogo, guardianChecks = [], routeNodes = [], sourceAddress, destAddress, uiLabels, isLoading
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleCard = (card: string) => {
    setExpandedCard(prev => prev === card ? null : card);
  };

  const getCheck = (names: string[]) => guardianChecks?.find(c => names.some(n => c.name.includes(n)));

  const getStatusWeight = (status?: string) => {
    switch (status) {
      case 'DANGER': return 4;
      case 'WARNING': return 3;
      case 'NEUTRAL': return 2;
      case 'SAFE': return 1;
      default: return 0;
    }
  };

  const getWorstCheck = (names: string[]) => {
    const matching = guardianChecks?.filter(c => names.some(n => c.name.includes(n))) || [];
    if (matching.length === 0) return undefined;
    return matching.reduce((worst, current) =>
      getStatusWeight(current.status) > getStatusWeight(worst.status) ? current : worst
    );
  };

  // Every guardian check that feeds a given card, sorted most-severe first,
  // so the expanded panel can surface the full evidence — not just the worst.
  const getAllChecks = (names: string[]) =>
    (guardianChecks?.filter(c => names.some(n => c.name.includes(n))) || [])
      .sort((a, b) => getStatusWeight(b.status) - getStatusWeight(a.status));

  // Fallback on-chain references derived from the route itself, so a Suiscan
  // proof link is always available even if the backend omitted per-check refs.
  const tokenRef = (addr: string | undefined, sym: string): RiskReference[] =>
    addr && addr.includes('::') ? [{ label: `${shortToken(sym)} coin`, type: 'coin', value: addr }] : [];
  const routePoolRefs: RiskReference[] = routeNodes
    .filter(n => n.poolAddress)
    .map((n, i) => ({ label: n.dex ? `${n.dex} pool` : `Pool ${i + 1}`, type: 'object', value: n.poolAddress as string }));

  // Merge + dedupe references from a set of checks with optional fallbacks.
  const mergeRefs = (checks: (RiskCheck | undefined)[], fallback: RiskReference[]): RiskReference[] => {
    const all = checks.flatMap(c => c?.references || []);
    const merged = all.length > 0 ? all : fallback;
    return merged.filter((r, i, arr) => arr.findIndex(x => x.value === r.value) === i);
  };

  const slippageChecks = getAllChecks(['Price Impact', 'Slippage']);
  const distChecks = getAllChecks(['Concentration', 'Holder', 'Token Whitelist', 'On-Chain Verification']);
  const poolsChecks = getAllChecks(['Liquidity Risk', 'Liquidity Depth', 'Liquidity Health', 'DEX Verification', 'Pool Verification', 'Pool Age']);

  const statusBadgeBg = (status?: string) =>
    status === 'DANGER' ? 'bg-red-400/10' : status === 'WARNING' ? 'bg-amber-400/10' : status === 'NEUTRAL' ? 'bg-lime-300/10' : 'bg-[#CCFF00]/10';

  const slippageCheck = getCheck(['Price Impact', 'Slippage']);
  const distCheck = getWorstCheck(['Concentration', 'Holder', 'Token Whitelist', 'On-Chain Verification']);
  const liquidityCheck = getWorstCheck(['Liquidity Risk', 'Liquidity Depth', 'Liquidity Health', 'DEX Verification', 'Pool Verification']);
  const stalePoolCheck = getCheck(['Pool Age Activity']);
  const poolsCheck = [liquidityCheck, stalePoolCheck].filter(Boolean).reduce<typeof liquidityCheck | undefined>(
    (worst, current) => current && getStatusWeight(current.status) > getStatusWeight(worst?.status) ? current : worst,
    undefined
  );

  const getStatusColor = (status?: string) => {
    if (status === 'DANGER') return 'text-red-400 bg-red-500/8 hover:bg-red-500/15';
    if (status === 'WARNING') return 'text-amber-400 bg-amber-500/8 hover:bg-amber-500/15';
    return 'text-[#2E7D00] bg-[#CCFF00]/8 hover:bg-[#CCFF00]/15';
  };

  const getStatusTextColor = (status?: string) => {
    if (status === 'DANGER') return 'text-red-400';
    if (status === 'WARNING') return 'text-amber-400';
    return 'text-[#2E7D00]';
  };

  const slipColor = getStatusColor(slippageCheck?.status);
  const slipText = getStatusTextColor(slippageCheck?.status);

  const distColor = getStatusColor(distCheck?.status);
  const distText = getStatusTextColor(distCheck?.status);

  const poolsColor = getStatusColor(poolsCheck?.status);
  const poolsText = getStatusTextColor(poolsCheck?.status);

  const isStalePoolWorst = poolsCheck?.name?.includes('Pool Age');
  const poolsLabel = uiLabels?.poolsLabel || (poolsCheck?.status === 'DANGER'
    ? (isStalePoolWorst ? 'Stale Pool' : 'Low Liquidity')
    : poolsCheck?.status === 'WARNING'
      ? (isStalePoolWorst ? 'Low Activity' : 'Pool Warning')
      : 'Liquidity & Pools');
      
  const poolsSubLabel = uiLabels?.poolsSubLabel || (poolsCheck?.status === 'DANGER'
    ? (isStalePoolWorst ? 'Pool abandoned.' : 'Pools too small.')
    : poolsCheck?.status === 'WARNING'
      ? (isStalePoolWorst ? 'Low trading activity.' : 'Proceed with caution.')
      : 'Healthy liquidity & active pools.');

  const categoryLabel = uiLabels?.category || poolsCheck?.status || 'Neutral';

  const iconForCheck = (name: string, status?: string): string => {
    if (status === 'DANGER') return 'error';
    if (name.includes('Concentration') || name.includes('Holder')) return 'pie_chart';
    if (name.includes('Whitelist') || name.includes('On-Chain')) return 'verified';
    if (name.includes('Pool Age')) return 'history';
    if (name.includes('DEX')) return 'account_tree';
    if (name.includes('Depth') || name.includes('Liquidity')) return 'water_drop';
    if (name.includes('Price Impact') || name.includes('Slippage')) return 'trending_down';
    return 'shield';
  };

  // One guardian check rendered in full: name, status, plain-language message,
  // and its on-chain proof links (Suiscan). This is the "show more" detail.
  const renderCheckDetail = (check?: RiskCheck) => {
    if (!check) return null;
    const subColor = getStatusTextColor(check.status);
    return (
      <div className="flex flex-col gap-1.5 py-2 border-b border-[#141414] last:border-b-0">
        <div className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[13px] ${subColor}`}>{iconForCheck(check.name, check.status)}</span>
          <span className={`font-mono text-[9px] uppercase tracking-widest font-bold ${subColor}`}>{check.name}</span>
          <span className={`ml-auto font-mono text-[8px] px-1.5 py-0.5 rounded tracking-widest uppercase ${subColor} ${statusBadgeBg(check.status)}`}>{check.status}</span>
        </div>
        <span className="text-[10px] leading-relaxed text-[#141414]/65">{check.message}</span>
        <SuiscanRefs references={check.references} className="mt-0.5" />
      </div>
    );
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-[#FFFAF0] border-2 border-[#141414] rounded-[24px] p-5 lg:p-6 w-full max-w-[600px] shadow-[6px_6px_0_#141414] my-4 self-center my-4 flex flex-col items-center justify-center min-h-[300px]"
      >
        <div className="flex flex-col items-center gap-4 opacity-70">
          <span className="material-symbols-outlined text-[32px] text-[#2E7D00] animate-spin">sync</span>
          <span className="font-mono text-[11px] uppercase tracking-widest font-bold text-[#2E7D00] animate-pulse">
            Analyzing route risks with FLUX...
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`bg-[#FFFAF0] border-2 ${isSafe ? 'border-[#141414]' : 'border-red-500/50'} rounded-[24px] p-5 lg:p-6 w-full max-w-[600px] shadow-[6px_6px_0_#141414] my-4 self-center my-4`}
    >
      {/* Unified Guardian Section — 3 cards + seamless expansion panel */}
      <div className="rounded-xl border border-[#141414] bg-[#FFFAF0] overflow-hidden mb-6">
        {/* 3 cards row */}
        <div className="flex flex-col md:flex-row divide-y divide-[#141414]/[0.06] md:divide-y-0 md:divide-x">

          {/* Slippage Card */}
          <div
            onClick={() => toggleCard('slippage')}
            className={`flex-1 cursor-pointer transition-all ${slipColor} ${expandedCard === 'slippage' ? 'brightness-125' : ''}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={`material-symbols-outlined text-[16px] ${slipText}`}>
                {slippageCheck?.status === 'DANGER' ? 'warning' : 'water_drop'}
              </span>
              <div className="flex flex-col flex-1">
                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${slipText}`}>
                  {uiLabels?.slippageLabel || (slippageCheck?.status === 'DANGER' ? 'High Slippage' : slippageCheck?.status === 'WARNING' ? 'Slippage Warning' : 'Safe Slippage')}
                </span>
                <span className={`text-[9px] leading-tight ${slipText} opacity-70`}>
                  {uiLabels?.slippageSubLabel || (slippageCheck?.status === 'DANGER' ? 'Critical price impact.' : slippageCheck?.status === 'WARNING' ? 'Moderate price impact.' : 'Within safe parameters.')}
                </span>
              </div>
              <span className={`material-symbols-outlined text-[14px] ${slipText} opacity-40 transition-transform duration-200 ${expandedCard === 'slippage' ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            {expandedCard === 'slippage' && <div className={`h-[2px] ${slippageCheck?.status === 'DANGER' ? 'bg-red-400' : slippageCheck?.status === 'WARNING' ? 'bg-amber-400' : 'bg-[#CCFF00]'}`} />}
          </div>

          {/* Distribution Card */}
          <div
            onClick={() => toggleCard('distribution')}
            className={`flex-1 cursor-pointer transition-all ${distColor} ${expandedCard === 'distribution' ? 'brightness-125' : ''}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={`material-symbols-outlined text-[16px] ${distText}`}>
                {distCheck?.status === 'DANGER' ? 'gpp_bad' : 'pie_chart'}
              </span>
              <div className="flex flex-col flex-1">
                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${distText}`}>
                  {uiLabels?.distributionLabel || (distCheck?.status === 'DANGER' ? 'Unsafe Token' : distCheck?.status === 'WARNING' ? 'Concentrated' : 'Concentration')}
                </span>
                <span className={`text-[9px] leading-tight ${distText} opacity-70`}>
                  {uiLabels?.distributionSubLabel || (distCheck?.status === 'DANGER' ? 'Critical concentration.' : distCheck?.status === 'WARNING' ? 'High concentration.' : 'Low concentration risk.')}
                </span>
              </div>
              <span className={`material-symbols-outlined text-[14px] ${distText} opacity-40 transition-transform duration-200 ${expandedCard === 'distribution' ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            {expandedCard === 'distribution' && <div className={`h-[2px] ${distCheck?.status === 'DANGER' ? 'bg-red-400' : distCheck?.status === 'WARNING' ? 'bg-amber-400' : 'bg-[#CCFF00]'}`} />}
          </div>

          {/* Pools Card */}
          <div
            onClick={() => toggleCard('pools')}
            className={`flex-1 cursor-pointer transition-all ${poolsColor} ${expandedCard === 'pools' ? 'brightness-125' : ''}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={`material-symbols-outlined text-[16px] ${poolsText}`}>
                {poolsCheck?.status === 'DANGER' ? (isStalePoolWorst ? 'history' : 'error') : 'waves'}
              </span>
              <div className="flex flex-col flex-1">
                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${poolsText}`}>
                  {poolsLabel}
                </span>
                <span className={`text-[9px] leading-tight ${poolsText} opacity-70`}>
                  {poolsSubLabel}
                </span>
              </div>
              <span className={`material-symbols-outlined text-[14px] ${poolsText} opacity-40 transition-transform duration-200 ${expandedCard === 'pools' ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            {expandedCard === 'pools' && <div className={`h-[2px] ${poolsCheck?.status === 'DANGER' ? 'bg-red-400' : poolsCheck?.status === 'WARNING' ? 'bg-amber-400' : 'bg-[#CCFF00]'}`} />}
          </div>
        </div>

        {/* Seamless Expansion Panel — flows directly below cards */}
        <AnimatePresence initial={false}>
          {expandedCard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="border-t border-[#141414] p-4 bg-[#FFFAF0]/50 flex flex-col gap-1">
                {expandedCard === 'slippage' && (
                  slippageChecks.length > 0
                    ? slippageChecks.map((c, i) => <React.Fragment key={i}>{renderCheckDetail(c)}</React.Fragment>)
                    : <span className="text-[11px] text-[#141414]/65">Slippage is within normal range.</span>
                )}
                {expandedCard === 'distribution' && (
                  distChecks.length > 0
                    ? distChecks.map((c, i) => <React.Fragment key={i}>{renderCheckDetail(c)}</React.Fragment>)
                    : <span className="text-[11px] text-[#141414]/65">Token ownership is well distributed.</span>
                )}
                {expandedCard === 'pools' && (
                  <>
                    {poolsChecks.length > 0
                      ? poolsChecks.map((c, i) => <React.Fragment key={i}>{renderCheckDetail(c)}</React.Fragment>)
                      : <span className="text-[11px] text-[#141414]/65">Healthy liquidity across all pools.</span>}
                    {routeNodes.length > 0 && (
                      <div className="flex flex-col gap-1 pt-2 mt-1">
                        <span className="font-mono text-[8px] uppercase tracking-widest text-[#141414]/50">Route splits</span>
                        <div className="flex flex-col gap-1.5 max-h-[95px] overflow-y-auto custom-scrollbar pr-1">
                          {routeNodes.map((node, idx) => (
                            <div key={idx} className="flex justify-between items-center shrink-0">
                              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full animate-pulse" /> <span className="text-[#141414] text-[10px] font-bold">{node.dex || 'DEX Pool'}</span></div>
                              <span className="text-[9px] text-[#141414]/60">Fee: {node.fee ?? '...'}% | {node.ratio ?? 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* On-chain proof — always surfaces a verifiable Suiscan link */}
                {(() => {
                  const refs =
                    expandedCard === 'slippage' ? mergeRefs(slippageChecks, routePoolRefs)
                      : expandedCard === 'distribution' ? mergeRefs(distChecks, [...tokenRef(destAddress, destToken), ...tokenRef(sourceAddress, sourceToken)])
                        : mergeRefs(poolsChecks, routePoolRefs);
                  if (refs.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-1.5 pt-3 mt-1 border-t border-[#141414]">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-[#141414] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[11px]">link</span> On-chain proof — verify on Suiscan
                      </span>
                      <SuiscanRefs references={refs} />
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Routing Visualization */}
      <div className="bg-[#FFFAF0] border border-[#141414] rounded-2xl p-4 md:p-5 flex items-center justify-between relative mb-6 overflow-hidden">
        {/* Connection line */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] border-t border-dashed border-[#141414] -z-0 -translate-y-1/2"></div>

        {/* Input */}
        <div className="flex flex-col items-center gap-2 relative z-10 bg-[#FFFAF0] p-2 rounded-xl">
          <TokenIcon symbol={sourceToken} logoUrl={sourceLogo} size={40} />
          <div className="flex flex-col items-center text-center max-w-[120px]">
            <span className="text-[10px] font-mono text-[#141414]/60 tracking-widest uppercase">Input</span>
            <span className="text-[12px] sm:text-[14px] font-bold text-[#141414] break-all">{amount}</span>
          </div>
        </div>

        {/* Pools */}
        <div className="flex flex-col gap-2 relative z-10 bg-[#FFFAF0] p-2 max-h-[190px] overflow-y-auto custom-scrollbar">
          {routeNodes.length > 0 ? (
            routeNodes.map((node, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-[#CCFF00]/5 border border-[#141414] rounded-xl px-3 py-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#2E7D00]">water_drop</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#141414]/70 font-bold tracking-wider">{node.dex || 'DEX Pool'}</span>
                  <span className="text-[8px] font-mono text-[#141414]/60 uppercase tracking-widest">{node.fee ?? fee}% FEE</span>
                </div>
                <span className="text-[10px] font-mono text-[#141414] font-bold ml-2">{node.ratio ?? 100}%</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 bg-[#CCFF00]/5 border border-[#141414] rounded-xl px-3 py-1.5">
              <span className="material-symbols-outlined text-[14px] text-[#2E7D00]/40">hourglass_empty</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-[#141414]/50 font-bold tracking-wider">PENDING</span>
                <span className="text-[8px] font-mono text-[#2E7D00]/40 uppercase tracking-widest">AWAITING ROUTE</span>
              </div>
            </div>
          )}
        </div>

        {/* Output */}
        <div className="flex flex-col items-center gap-2 relative z-10 bg-[#FFFAF0] p-2 rounded-xl">
          <TokenIcon symbol={destToken} logoUrl={destLogo} size={40} />
          <div className="flex flex-col items-center text-center max-w-[120px]">
            <span className="text-[10px] font-mono text-[#141414]/60 tracking-widest uppercase">Est. Output</span>
            <span className="text-[12px] sm:text-[14px] font-bold text-[#141414] break-all">{estOutput}</span>
          </div>
        </div>
      </div>

      {/* Summary Sentence */}
      <p className="text-center text-[16px] text-[#141414]/65 font-body mb-6 leading-relaxed">
        Swap{' '}
        <span className="font-bold text-gradient text-[14px]">{amount} {shortToken(sourceToken)}</span>
        {' '}&rarr;{' '}
        <span className="font-bold text-gradient text-[14px]">{estOutput} {shortToken(destToken)}</span>
        {', routed through '}
        <span className="font-mono text-[#141414] font-bold">DEX pools</span>
        {' at a '}
        <span className="font-mono text-[#141414] font-bold">{fee}</span>
        {' fee.'}
      </p>

    </motion.div>
  );
};
