import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { PtbStep } from '../../../types/shared';

interface ExecutionFlowCardProps {
  ptbSteps: PtbStep[];
  isExecuting?: boolean;
  isSigning?: boolean;
}

export const ExecutionFlowCard: React.FC<ExecutionFlowCardProps> = ({ ptbSteps, isExecuting = false, isSigning = false }) => {
  const hasSteps = ptbSteps && ptbSteps.length > 0;

  const numberToWord = (num: number) => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    return num < 10 ? words[num] : num.toString();
  };
  const [currentStep, setCurrentStep] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        // The steps are the children of the container
        const activeEl = container.children[currentStep] as HTMLElement;
        if (activeEl) {
          const scrollTarget = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
          container.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
          });
        }
      }
    }, 50); // slight delay to ensure render
    return () => clearTimeout(timer);
  }, [currentStep]);

  useEffect(() => {
    if (isExecuting) {
      setCurrentStep(0);
      const interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < ptbSteps.length) {
            return prev + 1;
          }
          clearInterval(interval);
          return prev;
        });
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setCurrentStep(0);
    }
  }, [isExecuting, ptbSteps.length]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-[#FFFAF0] border border-[#141414] rounded-3xl w-full max-w-[600px] shadow-[6px_6px_0_#141414] my-4 self-center my-4 relative overflow-hidden flex flex-col p-6 md:p-8"
    >
      <div className="font-mono text-[12px] sm:text-[14px] md:text-[16px] text-[#141414] font-bold tracking-[0.05em] md:tracking-[0.15em] uppercase mb-6 flex flex-wrap items-center gap-2 drop-shadow-[0_0_8px_rgba(192,132,252,0.4)] break-words leading-relaxed">
        PROGRAMMABLE TRANSACTION BLOCK (PTB)
        {(isExecuting || isSigning) && <span className={`flex w-2 h-2 rounded-full ${isSigning ? 'bg-[#f59e0b]' : 'bg-[#CCFF00]'} animate-pulse`}></span>}
      </div>

      {hasSteps ? (
        <div ref={scrollContainerRef} className="flex flex-col gap-3 font-body overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
          {ptbSteps.map((step, idx) => {
            const isPast = isExecuting && idx < currentStep;
            const isActive = isExecuting && idx === currentStep;
            const isFuture = !isExecuting || idx > currentStep;

            // Format step number like 01, 02
            const stepNum = (idx + 1).toString().padStart(2, '0');

            // Fallback description if none is provided
            let description = step.description;
            if (!description) {
              if (step.command === 'SplitCoins') description = 'Split coin for routing';
              else if (step.command === 'MoveCall') description = step.target ? `Execute ${step.target.split('::').pop()}` : 'Execute MoveCall';
              else if (step.command === 'TransferObjects') description = 'Finalize and transfer output';
              else description = step.command;
            }

            return (
              <motion.div
                key={idx}
                ref={isActive ? activeStepRef : null}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.3 }}
                className={`flex items-center justify-between px-4 py-2.5 rounded-[16px] border transition-all duration-300 gap-4 ${isActive
                  ? 'border-[#141414] bg-[#CCFF00]/10 shadow-[0_0_20px_rgba(204, 255, 0, 0.2)]'
                  : isPast
                    ? 'border-[#10B981]/30 bg-[#10B981]/5'
                    : 'border-white/5 bg-[#141414]/5'
                  }`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0 transition-colors duration-300 ${isActive
                    ? 'bg-[#CCFF00] text-[#141414] shadow-[0_0_10px_rgba(204, 255, 0, 0.5)]'
                    : isPast
                      ? 'bg-[#10B981] text-[#141414] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-[#141414]/5 text-[#141414]'
                    }`}>
                    {stepNum}
                  </div>
                  <span className={`font-medium text-[15px] truncate ${isActive ? 'text-[#141414]' : isPast ? 'text-[#141414]' : 'text-[#141414]'}`}>
                    {description}
                  </span>
                </div>

                {/* Status Pill */}
                <div className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase border transition-colors duration-300 shrink-0 ${isActive
                  ? 'border-[#141414] text-[#141414] bg-[#CCFF00]/10'
                  : isPast
                    ? 'border-[#10B981]/50 text-[#10B981] bg-[#10B981]/10'
                    : 'border-[#10B981]/30 text-[#10B981] bg-transparent'
                  }`}>
                  {isActive ? 'Executing...' : isPast ? 'Success' : 'Ready'}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <span className="material-symbols-outlined text-[32px] text-[#2E7D00]/30">account_tree</span>
          <span className="font-mono text-[11px] text-[#141414]/50 uppercase tracking-widest text-center leading-relaxed">
            {isSigning ? 'Waiting for wallet signature...' : isExecuting ? 'Building transaction...' : 'Execution flow will appear after route calculation.'}
          </span>
        </div>
      )}

      {hasSteps && (
        <div className="mt-6 pt-4 border-t border-dashed border-[#141414]">
          <p className="text-center text-[16px] text-[#141414] font-body leading-relaxed">
            <span className="text-[#141414] font-bold">PTB Preview:</span> This transaction atomically executes {numberToWord(ptbSteps.length)} steps—<span className="text-[#4CA2FF] font-bold uppercase tracking-wider text-[11px]">merging inputs</span>, <span className="text-[#4CA2FF] font-bold uppercase tracking-wider text-[11px]">executing the optimal route</span>, and <span className="text-[#4CA2FF] font-bold uppercase tracking-wider text-[11px]">securely transferring the final output</span> to your wallet.
          </p>
        </div>
      )}
    </motion.div>
  );
};
