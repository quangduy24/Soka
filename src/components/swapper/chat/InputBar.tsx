import React from 'react';
import { motion } from 'framer-motion';

interface InputBarProps {
  intentInput: string;
  setIntentInput: (val: string) => void;
  appState: 'idle' | 'processing' | 'done';
  executionState?: 'idle' | 'signing' | 'executing' | 'success';
  handleSimulate: (e: React.FormEvent) => void;
  onReset?: () => void;
}

const QUICK = ['safest 🛡️', 'fastest ⚡', 'cheapest 💰'];

export const InputBar: React.FC<InputBarProps> = ({
  intentInput, setIntentInput, appState, executionState, handleSimulate, onReset
}) => {
  const isBusy = appState === 'processing' || executionState === 'executing' || executionState === 'signing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="relative z-10 w-full mt-auto shrink-0"
    >
      <div className="flex gap-2 mb-2 flex-wrap">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            disabled={isBusy}
            onClick={() => setIntentInput((intentInput ? intentInput + ' ' : '') + q)}
            className="toon-chip hover:!bg-[#CCFF00] transition-colors disabled:opacity-50"
          >
            + {q}
          </button>
        ))}
      </div>
      <motion.form
        onSubmit={handleSimulate}
        className="toon-card !rounded-[20px] flex items-center gap-2.5 pl-4 pr-2.5 py-2.5"
        style={{ background: '#fffaf0' }}
      >
        {onReset && appState !== 'idle' && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[#FF90E8] border-[3px] border-[#141414] font-black text-[20px] leading-none"
            style={{ boxShadow: '3px 3px 0 #141414' }}
            title="New chat"
          >
            +
          </button>
        )}
        <input
          type="text"
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          disabled={isBusy}
          placeholder={appState === 'processing' ? 'Buddy is thinking…' : 'Tell Buddy your swap… 💬'}
          className="flex-1 bg-transparent border-none outline-none text-[#141414] font-bold text-[15px] placeholder:text-[#141414]/40 placeholder:font-medium disabled:opacity-50 h-[38px] min-w-0"
        />
        <button
          type="submit"
          disabled={isBusy || !intentInput.trim()}
          className="send-energy-btn shrink-0 h-[46px] px-5 font-black text-[15px]"
        >
          {isBusy ? '…' : 'SEND ➤'}
        </button>
      </motion.form>
    </motion.div>
  );
};
