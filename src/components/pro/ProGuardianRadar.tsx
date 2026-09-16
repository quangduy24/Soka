import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, ExternalLink, ChevronDown, ChevronUp, Skull } from 'lucide-react';
import type { RiskCheck } from '../../types/shared';
import { mezoExplorerUrl } from '../../utils/explorer';

interface ProGuardianRadarProps {
  score: number;
  riskLevel: string;
  checks: RiskCheck[];
}

export const ProGuardianRadar: React.FC<ProGuardianRadarProps> = ({
  score = 95,
  riskLevel = 'LOW',
  checks = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (sc: number) => {
    if (sc >= 80) return 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10';
    if (sc >= 60) return 'text-[#06b6d4] border-[#06b6d4]/30 bg-[#06b6d4]/10';
    if (sc >= 30) return 'text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10';
    return 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SAFE':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />;
      case 'DANGER':
        return <XCircle className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />;
    }
  };

  // Group checks by category
  const categories = ['Slippage', 'Concentration', 'Pool Health', 'Token Safety'];
  const getCategoryStatus = (cat: string): 'SAFE' | 'WARNING' | 'DANGER' => {
    const relevant = checks.filter(c => {
      if (cat === 'Slippage') return c.category === 'High Slippage' || c.name.includes('Price Impact') || c.name.includes('Liquidity');
      if (cat === 'Concentration') return c.category === 'Concentration' || c.name.includes('Supply') || c.name.includes('Holder');
      if (cat === 'Pool Health') return c.category === 'Stale Pools' || c.name.includes('Age') || c.name.includes('Activity');
      if (cat === 'Token Safety') return c.category === 'Token Safety' || c.name.includes('Whitelist') || c.name.includes('Verification');
      return false;
    });
    if (relevant.some(c => c.status === 'DANGER')) return 'DANGER';
    if (relevant.some(c => c.status === 'WARNING')) return 'WARNING';
    return 'SAFE';
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#2C1924]/[0.09] shadow-2xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2C1924]/[0.07] pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#10b981]" />
          <span className="font-meta text-xs font-bold text-[#2C1924] tracking-wider uppercase">
            100% On-Chain Risk Guardian
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#845D74]">Zero External APIs</span>
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
        </div>
      </div>

      {/* Score and Safety Tier Badge */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
        <div className="flex flex-col">
          <span className="text-[10px] font-meta text-[#845D74] uppercase">Deterministic Safety Score</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-2xl font-mono font-extrabold ${score >= 80 ? 'text-[#10b981]' : score >= 60 ? 'text-[#06b6d4]' : score >= 30 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
              {score}
            </span>
            <span className="text-xs font-mono text-[#845D74]">/ 100</span>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold ${getScoreColor(score)}`}>
          {riskLevel || (score >= 80 ? 'LOW RISK' : score >= 60 ? 'MODERATE' : 'ELEVATED RISK')}
        </div>
      </div>

      {/* 4 Category Health Pills */}
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat, i) => {
          const status = getCategoryStatus(cat);
          const badgeStyle = 
            status === 'DANGER' ? 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]' :
            status === 'WARNING' ? 'bg-[#f59e0b]/10 border-[#f59e0b]/20 text-[#f59e0b]' :
            'bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]';
          return (
            <div key={i} className={`px-3 py-2 rounded-xl border flex items-center justify-between text-[11px] font-mono ${badgeStyle}`}>
              <span>{cat}</span>
              <span className="font-bold">{status}</span>
            </div>
          );
        })}
      </div>

      {/* Expandable 7-Point Audit Drawer */}
      <div className="border-t border-[#2C1924]/[0.07] pt-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between py-1 text-xs font-meta text-[#845D74] hover:text-[#DF7AA7] transition-colors cursor-pointer"
        >
          <span>7-Point On-Chain Audit Details ({checks.length || 7} checks)</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-[#845D74]" />}
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-[#2C1924]/[0.07]">
            {checks.map((chk, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] flex flex-col gap-1 text-xs font-mono shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chk.status)}
                    <span className="font-bold text-[#2C1924]">{chk.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    chk.status === 'DANGER' ? 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/25' :
                    chk.status === 'WARNING' ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/25' :
                    'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25'
                  }`}>
                    {chk.status}
                  </span>
                </div>

                <p className="text-[11px] text-[#845D74] leading-relaxed pl-5">
                  {chk.message}
                </p>

                {chk.references && chk.references.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-5 mt-1">
                    {chk.references.map((ref, rIdx) => {
                      const url = mezoExplorerUrl(ref);
                      return (
                        <a
                          key={rIdx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[#DF7AA7] hover:underline"
                        >
                          <span>{ref.label}: {ref.value.slice(0, 6)}...{ref.value.slice(-4)}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
