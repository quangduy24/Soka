import React from 'react';
import { motion } from 'framer-motion';
import { TokenIcon } from './TokenIcon';
import { shortContract } from '../../../constants';

interface AlternativeSourceCardProps {
  alternativeSource: any;
  onSelect?: (candidate: any) => void;
}

export const AlternativeSourceCard: React.FC<AlternativeSourceCardProps> = ({ alternativeSource, onSelect }) => {
  if (!alternativeSource || !alternativeSource.candidates?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col w-full max-w-[600px] mb-4 gap-2"
    >
      <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] text-amber-400 uppercase tracking-wider font-bold">
        <span className="material-symbols-outlined text-[12px]">account_balance_wallet</span>
        Balance Assistant
      </div>
      <div className="bg-amber-500/[0.07] border border-amber-500/25 rounded-2xl p-4 w-full shadow-[6px_6px_0_#141414]">
        <p className="font-body text-[#f1f5f9] leading-relaxed text-[13px] mb-4">
          {alternativeSource.message}
        </p>
        <div className="flex flex-col gap-2">
          {alternativeSource.candidates.map((c: any, i: number) => (
            <button
              key={c.coinType || i}
              type="button"
              onClick={() => onSelect?.(c)}
              className="text-left px-3 py-2.5 rounded-[12px] border border-[#141414] bg-[#CCFF00]/5 hover:bg-amber-500/15 hover:border-amber-500/40 transition-all duration-200 flex items-center gap-2.5"
            >
              <TokenIcon symbol={c.symbol} logoUrl={c.logoUrl} size={28} />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-[#141414] font-bold text-[12px] flex items-center gap-1.5">
                  {c.symbol}
                  {typeof c.usdValue === 'number' && (
                    <span className="text-amber-300/90 font-normal">~${c.usdValue.toFixed(2)}</span>
                  )}
                </span>
                <span className="text-[#64748b] font-mono text-[10px]">
                  Balance: {c.balance} · {shortContract(c.coinType)}
                </span>
              </span>
              <span className="flex flex-col items-end shrink-0">
                <span className="text-[9px] font-mono text-amber-300/70 uppercase tracking-wider">Swap</span>
                <span className="text-[11px] font-mono text-[#141414] font-bold">{c.suggestedAmount}</span>
              </span>
              <span className="material-symbols-outlined text-[16px] text-amber-300/60 shrink-0">arrow_forward</span>
            </button>
          ))}
        </div>
        <p className="font-body text-[10px] text-[#94a3b8] leading-relaxed mt-3">
          Tap a token to swap it to {alternativeSource.destSymbol} instead. Always verify before swapping.
        </p>
      </div>
    </motion.div>
  );
};
