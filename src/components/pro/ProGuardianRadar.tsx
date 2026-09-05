import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, ExternalLink, ChevronDown, ChevronUp, Skull } from 'lucide-react';
import type { RiskCheck } from '../../types/shared';

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
    if (sc >= 80) return 'text-[#1c7a36] border-[#141414] bg-[#CCFF00]/30';
    if (sc >= 60) return 'text-[#0b7285] border-[#141414] bg-[#7DDCFF]/30';
    if (sc >= 30) return 'text-[#8a5a00] border-[#141414] bg-[#FFC900]/30';
    return 'text-[#d33] border-[#141414] bg-[#ff6b6b]/20';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SAFE':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#1c7a36] shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#8a5a00] shrink-0" />;
      case 'DANGER':
        return <XCircle className="w-3.5 h-3.5 text-[#d33] shrink-0" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#1c7a36] shrink-0" />;
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
    <div className="pro3-card p-5 border-[3px] border-[#141414] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b-[3px] border-[#141414] pb-3">
        <div className="flex items-center gap-2">
          <Skull className="w-5 h-5 text-[#1c7a36]" />
          <span className="font-mono text-xs font-bold text-[#141414] tracking-wider uppercase">
            100% On-Chain Risk Guardian
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[#141414]/50">Zero External APIs</span>
          <span className="pro3-dot pro3-dot-green" />
        </div>
      </div>

      {/* Score and Safety Tier Badge */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border-[3px] border-[#141414] shadow-[3px_3px_0_rgba(20,20,20,0.15)]">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-[#141414]/50 uppercase">Deterministic Safety Score</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-2xl font-mono font-extrabold ${score >= 80 ? 'text-[#1c7a36]' : score >= 60 ? 'text-[#0b7285]' : score >= 30 ? 'text-[#8a5a00]' : 'text-[#d33]'}`}>
              {score}
            </span>
            <span className="text-xs font-mono text-[#141414]/50">/ 100</span>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-xl border-2 font-mono text-xs font-bold ${getScoreColor(score)}`}>
          {riskLevel || (score >= 80 ? 'LOW RISK' : score >= 60 ? 'MODERATE' : 'ELEVATED RISK')}
        </div>
      </div>

      {/* 4 Category Health Pills */}
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat, i) => {
          const status = getCategoryStatus(cat);
          const badgeStyle = 
            status === 'DANGER' ? 'bg-[#ff6b6b]/20 border-[#141414] text-[#d33]' :
            status === 'WARNING' ? 'bg-[#FFC900]/30 border-[#141414] text-[#8a5a00]' :
            'bg-[#CCFF00]/30 border-[#141414] text-[#1c7a36]';
          return (
            <div key={i} className={`px-2.5 py-1.5 rounded-lg border-2 flex items-center justify-between text-[11px] font-mono ${badgeStyle}`}>
              <span>{cat}</span>
              <span className="font-bold">{status}</span>
            </div>
          );
        })}
      </div>

      {/* Expandable 7-Point Audit Drawer */}
      <div className="border-t-[3px] border-[#141414]/15 pt-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between py-1 text-xs font-mono text-[#141414]/70 hover:text-[#141414] transition-colors"
        >
          <span>7-Point On-Chain Audit Details ({checks.length || 7} checks)</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-[#141414]" />}
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-2 mt-3 pt-2 border-t-2 border-[#141414]/15">
            {checks.map((chk, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-white border-[3px] border-[#141414] flex flex-col gap-1 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chk.status)}
                    <span className="font-bold text-[#141414]/90">{chk.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border-2 ${
                    chk.status === 'DANGER' ? 'text-[#d33] bg-[#ff6b6b]/15 border-[#141414]' :
                    chk.status === 'WARNING' ? 'text-[#8a5a00] bg-[#FFC900]/25 border-[#141414]' :
                    'text-[#1c7a36] bg-[#CCFF00]/25 border-[#141414]'
                  }`}>
                    {chk.status}
                  </span>
                </div>

                <p className="text-[11px] text-[#141414]/60 leading-relaxed pl-5">
                  {chk.message}
                </p>

                {chk.references && chk.references.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-5 mt-1">
                    {chk.references.map((ref, rIdx) => {
                      const url = ref.type === 'object' || ref.type === 'coin'
                        ? `https://suiscan.xyz/mainnet/object/${ref.value}`
                        : ref.type === 'tx'
                        ? `https://suiscan.xyz/mainnet/tx/${ref.value}`
                        : `https://suiscan.xyz/mainnet/account/${ref.value}`;
                      return (
                        <a
                          key={rIdx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[#0b7285] hover:underline"
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
