import React from 'react';
import type { RiskReference } from '../../../types/shared';
import { suiscanUrl, shortenRef } from '../../../utils/explorer';

const REF_ICON: Record<RiskReference['type'], string> = {
  coin: 'toll',
  object: 'database',
  tx: 'receipt_long',
  account: 'account_balance_wallet',
};

interface SuiscanRefsProps {
  references?: RiskReference[];
  /** Extra tailwind classes for the wrapper. */
  className?: string;
  /** De-duplicate references sharing the same value (across merged checks). */
  dedupe?: boolean;
}

/**
 * Renders guardian on-chain references as clickable Suiscan proof chips.
 * Every chip opens the exact object / coin / tx / wallet on the explorer,
 * so each risk verdict is backed by verifiable on-chain evidence.
 */
export const SuiscanRefs: React.FC<SuiscanRefsProps> = ({ references, className = '', dedupe = true }) => {
  if (!references || references.length === 0) return null;

  const list = dedupe
    ? references.filter((r, i, arr) => arr.findIndex(x => x.value === r.value) === i)
    : references;

  return (
    <div className={`flex flex-wrap gap-3 max-h-[135px] overflow-y-auto custom-scrollbar pr-1 content-start ${className}`}>
      {list.map((ref, idx) => (
        <a
          key={`${ref.value}-${idx}`}
          href={suiscanUrl(ref)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Verify on Suiscan: ${ref.value}`}
          className="group flex items-center justify-between gap-2 px-2.5 py-1.5 w-[calc(50%-6px)] rounded-lg bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#141414] hover:border-[#141414] transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
            <span className="material-symbols-outlined text-[13px] text-[#141414] shrink-0">{REF_ICON[ref.type]}</span>
            <span className="font-mono text-[9px] text-[#141414] uppercase tracking-wider truncate">{ref.label}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-mono text-[9px] text-[#141414]/55 group-hover:text-[#141414]/70">{shortenRef(ref.value)}</span>
            <span className="material-symbols-outlined text-[12px] text-[#141414]/60 group-hover:text-[#141414]">open_in_new</span>
          </div>
        </a>
      ))}
    </div>
  );
};
