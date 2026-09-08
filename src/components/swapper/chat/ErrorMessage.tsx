import React from 'react';
import { motion } from 'framer-motion';

export const ErrorMessage: React.FC<{ text: string }> = ({ text }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-start gap-2 w-full max-w-[85%] mb-4"
    >
      <div className="bg-rose-500/10 border-2 border-rose-500/30 rounded-2xl p-4 relative text-rose-100 text-[13px] font-body leading-relaxed overflow-hidden break-words">
        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
        {text}
      </div>
    </motion.div>
  );
};
