import React from 'react';
import { motion } from 'framer-motion';
import { TokenIcon } from './TokenIcon';

interface IntentParserCardProps {
  action: string;
  amount: string;
  sourceToken: string;
  destToken: string;
  onNext?: () => void;
  showNext?: boolean;
  sourceLogo?: string | null;
  destLogo?: string | null;
}

export const IntentParserCard: React.FC<IntentParserCardProps> = ({ action, amount, sourceToken, destToken, onNext, showNext, sourceLogo, destLogo }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-[#FFFAF0] border-2 border-[#141414] rounded-[24px] p-5 lg:p-6 w-full max-w-[600px] shadow-[6px_6px_0_#141414] my-4 self-center my-4"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-2.5 h-2.5 rounded-full bg-[#CCFF00] shadow-[0_0_10px_rgba(204, 255, 0, 0.8)]"></div>
        <span className="font-mono text-[12px] sm:text-[14px] md:text-[16px] text-[#141414] font-bold tracking-[0.05em] md:tracking-[0.2em] uppercase drop-shadow-[0_0_8px_rgba(192,132,252,0.4)] break-words">
          Calculated Swap Optimization
        </span>
      </div>

      <div className="bg-[#FFFAF0] border border-[#141414] rounded-xl p-4 md:p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#CCFF00]/50"></div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]/50"></div>
          <span className="font-mono text-[10px] text-[#141414]/50 tracking-widest uppercase">Financial Goal Optimization</span>
        </div>

        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-[#141414]/30 uppercase tracking-widest">Action</span>
            <span className="font-mono text-[14px] text-[#141414] font-medium">{action || 'SWAP'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-[#141414]/30 uppercase tracking-widest">Amount</span>
            <span className="font-mono text-[12px] sm:text-[14px] text-[#141414] font-medium break-all">{amount}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-[#141414]/30 uppercase tracking-widest">From</span>
            <span className="font-mono text-[14px] text-[#141414] font-medium flex items-center gap-1.5">
              <TokenIcon symbol={sourceToken} logoUrl={sourceLogo} size={18} />
              {sourceToken.includes('::') ? sourceToken.split('::').pop() : sourceToken}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-[#141414]/30 uppercase tracking-widest">To</span>
            <span className="font-mono text-[14px] text-[#141414] font-medium flex items-center gap-1.5">
              <TokenIcon symbol={destToken} logoUrl={destLogo} size={18} />
              {destToken.includes('::') ? destToken.split('::').pop() : destToken}
            </span>
          </div>
        </div>
      </div>

      {showNext && onNext && (
        <div className="flex justify-end mt-4">
          <button
            onClick={onNext}
            className="px-6 py-2 text-[#141414] font-bold font-body text-[13px] transition-all duration-300 hover:opacity-90 border-none"
            style={{
              borderRadius: '24px',
              background: 'linear-gradient(180deg, #CCFF00 0%, #7AA500 100%)',
              boxShadow: '0 4px 12px 0 rgba(204, 255, 0, 0.19), 0 0 20px 0 rgba(204, 255, 0, 0.38)'
            }}
          >
            View Route
          </button>
        </div>
      )}
    </motion.div>
  );
};
