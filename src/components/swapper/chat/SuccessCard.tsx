import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface SuccessCardProps {
  txHash: string | null;
  amount?: string;
  sourceToken?: string;
  destToken?: string;
  ptbSteps?: any[];
  onShowAll?: () => void;
  isExpanded?: boolean;
  received?: string | null;
  receivedToken?: string;
  receivedLogo?: string | null;
}

export const SuccessCard: React.FC<SuccessCardProps> = ({ 
  txHash, amount, sourceToken, destToken, onShowAll, isExpanded, received, receivedToken, receivedLogo
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative z-10 w-full max-w-[600px] mt-4 mb-4 my-4 self-center shrink-0 flex flex-col bg-[#FFFAF0] border border-[#141414] rounded-3xl p-6 md:p-8 shadow-[6px_6px_0_#141414]"
    >
      {/* Top Section */}
      <div className="flex flex-col items-center text-center mb-8 gap-4">
        <div className="w-16 h-16 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <span className="material-symbols-outlined text-[#10B981] text-[32px]">check</span>
        </div>
        
        <div className="px-4 py-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] text-[11px] font-bold tracking-widest uppercase flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          Execution Complete
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <h3 className="text-[#141414] text-[22px] font-bold tracking-tight">Transaction Successful</h3>
          <p className="text-[#141414]/55 text-[14px] font-body max-w-[320px] mx-auto leading-relaxed">
            Your swap was fully optimized and settled on the SUI blockchain network.
          </p>
        </div>
      </div>

      {/* Asset Summary */}
      <div className="flex flex-col border border-white/5 bg-[#141414]/5 rounded-2xl p-5 gap-5 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/60 font-body text-[15px]">Asset Swapped</span>
          <span className="text-[#141414] font-mono font-bold text-[15px]">
            {amount} {sourceToken?.split('::').pop()}
          </span>
        </div>
        
        <div className="w-full h-[1px] bg-[#141414]/5"></div>
        
        <div className="flex items-center justify-between">
          <span className="text-[#141414]/60 font-body text-[15px]">Asset Received</span>
          <div className="flex items-center gap-2">
            {receivedLogo && <img src={receivedLogo} alt="token" className="w-5 h-5 rounded-full object-contain" />}
            {!receivedLogo && <div className="w-5 h-5 rounded-full bg-[#10B981]/20 flex items-center justify-center"><span className="text-[#10B981] text-[10px] font-bold">$</span></div>}
            <span className="text-[#10B981] font-mono font-bold text-[15px]">
              +{received} {receivedToken?.split('::').pop() || destToken?.split('::').pop()}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Digest */}
      {txHash && (
        <div className="flex items-center justify-between border border-white/5 bg-[#141414]/5 rounded-2xl p-4 mb-6">
          <div className="flex flex-col gap-1 overflow-hidden">
            <span className="text-[#141414]/50 font-mono text-[10px] font-bold tracking-widest uppercase">Transaction Digest</span>
            <span className="text-[#141414]/70 font-mono text-[12px] truncate">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button 
              onClick={handleCopy}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#141414]/15 hover:bg-[#141414]/5 transition-colors text-[#10B981]"
            >
              <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'content_copy'}</span>
            </button>
            <a 
              href={`https://suiscan.xyz/mainnet/tx/${txHash}`} 
              target="_blank" 
              rel="noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#141414]/15 hover:bg-[#141414]/5 transition-colors text-[#10B981]"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          </div>
        </div>
      )}

      {/* Collapse Steps Button */}
      {onShowAll && (
        <button
          onClick={onShowAll}
          className="w-full py-3.5 rounded-2xl border border-[#10B981]/30 bg-[#10B981]/5 hover:bg-[#10B981]/10 text-[#10B981] font-bold font-body text-[14px] transition-all duration-300 flex items-center justify-center gap-2"
        >
          {isExpanded ? 'Collapse Block Steps' : 'View Block Steps'}
          <span className="material-symbols-outlined text-[20px] transition-transform">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      )}
    </motion.div>
  );
};
