import React from 'react';
import { Layers, ArrowRight, ExternalLink, Zap, Percent, Shield, AlertTriangle } from 'lucide-react';
import type { RouteNode } from '../../types/shared';

interface ProRouteVisualizerProps {
  sourceSymbol: string;
  destSymbol: string;
  amount: string;
  expectedOutput: string;
  routeNodes: RouteNode[];
  executionImpact: string;
  slippage: string;
  sourceLogo?: string | null;
  destLogo?: string | null;
}

export const ProRouteVisualizer: React.FC<ProRouteVisualizerProps> = ({
  sourceSymbol,
  destSymbol,
  amount,
  expectedOutput,
  routeNodes,
  executionImpact,
  slippage,
  sourceLogo,
  destLogo,
}) => {
  const formatUsd = (val?: number) => {
    if (!val) return 'Deep Pool';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  const getImpactColor = (impactStr: string) => {
    const val = parseFloat(impactStr.replace('%', '')) || 0;
    if (val >= 5.0) return 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20';
    if (val >= 2.0) return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';
    return 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20';
  };

  return (
    <div className="p-5 rounded-2xl bg-white/85 border border-[#F7D1D7] shadow-sm flex flex-col gap-4">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[#F7D1D7]/60 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#DF7AA7]" />
          <span className="font-meta text-xs font-bold text-[#2C1924] tracking-wider uppercase">
            Mezo Pools Optimal Smart Route
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#2C1924]/50">Hops: {routeNodes.length || 1}</span>
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
        </div>
      </div>

      {/* Input / Output Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#FDF4F2]/70 border border-[#F7D1D7]">
        {/* In */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#F7D1D7] flex items-center justify-center font-mono font-bold text-xs text-[#2C1924] shrink-0 overflow-hidden shadow-2xs">
            {sourceLogo ? (
              <img src={sourceLogo} alt={sourceSymbol} className="w-full h-full object-cover" />
            ) : (
              sourceSymbol.slice(0, 3)
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-meta text-[#2C1924]/50 uppercase">You Pay</span>
            <span className="text-sm font-mono font-bold text-[#2C1924]">
              {amount} <span className="text-[#DF7AA7]">{sourceSymbol}</span>
            </span>
          </div>
        </div>

        {/* Out */}
        <div className="flex items-center gap-3 sm:border-l sm:border-[#F7D1D7] sm:pl-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#F7D1D7] flex items-center justify-center font-mono font-bold text-xs text-[#2C1924] shrink-0 overflow-hidden shadow-2xs">
            {destLogo ? (
              <img src={destLogo} alt={destSymbol} className="w-full h-full object-cover" />
            ) : (
              destSymbol.slice(0, 3)
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-meta text-[#2C1924]/50 uppercase">Expected Return</span>
            <span className="text-sm font-mono font-bold text-[#10b981]">
              {expectedOutput} <span className="text-[#2C1924]">{destSymbol}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Multi-hop Route Graph */}
      <div className="flex flex-col gap-2 pt-1">
        <span className="text-[10px] font-meta text-[#2C1924]/50 uppercase tracking-wider">
          Execution Path & Pools
        </span>

        {routeNodes.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white/60 border border-dashed border-[#F7D1D7] text-center font-mono text-xs text-[#2C1924]/50">
            Direct swap path simulated
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {routeNodes.map((node, i) => {
              const poolId = node.poolAddress || '';
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white hover:bg-pink-50/40 border border-[#F7D1D7] transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#DF7AA7]/15 border border-[#DF7AA7]/30 text-[#DF7AA7] font-mono text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#2C1924]">
                          {node.dex || 'Mezo Pools'}
                        </span>
                        <span className="text-[10px] font-meta text-[#2C1924]/60 bg-white border border-[#F7D1D7] px-2 py-0.5 rounded-full">
                          Split: {node.ratio || 100}%
                        </span>
                      </div>
                      {poolId && (
                        <a
                          href={`https://explorer.mezo.org/address/${poolId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] text-[#DF7AA7] hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <span>{poolId.slice(0, 8)}...{poolId.slice(-6)}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-[#2C1924]/50 block">Fee Rate</span>
                      <span className="text-[#2C1924] font-bold">{node.fee || '0.25'}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#2C1924]/50 block">Depth</span>
                      <span className="text-[#2C1924] font-bold">{formatUsd(node.liquidityUsd)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Metrics Row: Slippage, Impact */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#F7D1D7]/60">
        <div className="p-3 rounded-2xl bg-white border border-[#F7D1D7] flex flex-col shadow-2xs">
          <span className="text-[10px] font-meta text-[#2C1924]/50 uppercase">Price Impact</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${getImpactColor(executionImpact)}`}>
              {executionImpact || '0.05%'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-[#F7D1D7] flex flex-col shadow-2xs">
          <span className="text-[10px] font-meta text-[#2C1924]/50 uppercase">Optimal Slippage</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-mono font-bold text-[#2C1924] bg-pink-50 border border-[#F7D1D7] px-2 py-0.5 rounded-lg">
              {slippage || '0.50%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
