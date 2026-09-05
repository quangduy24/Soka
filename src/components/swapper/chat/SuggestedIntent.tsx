import React from 'react';
import { motion } from 'framer-motion';

export const SuggestedIntent: React.FC<{ intents: string[], onClick: (intent: string) => void }> = ({ intents, onClick }) => {
  const colors = ['#CCFF00', '#FF90E8', '#7DDCFF', '#FFC900', '#C4B5FD', '#B9FFDD'];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="flex flex-col gap-2.5 mt-2 mb-4 w-full"
    >
      <span className="toon-chip toon-chip-sunny self-start">★ TAP TO TRY!</span>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
        {intents.map((intent, i) => (
          <button
            key={intent}
            onClick={() => onClick(intent)}
            className="command-tag px-4 py-2.5 text-[13px] font-bold text-left"
            style={{ background: colors[i % colors.length], transform: `rotate(${(i % 2 ? 0.7 : -0.7)}deg)` }}
          >
            {intent}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
