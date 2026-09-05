import React from 'react';
import { motion } from 'framer-motion';

export const UserMessage: React.FC<{ text: string }> = ({ text }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-end gap-1.5 w-full ml-auto max-w-[88%] pop-in"
    >
      <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/50 mr-1">YOU ★</span>
      <div className="chat-bubble-user px-4 py-3 text-[14px] font-bold">
        {text}
      </div>
    </motion.div>
  );
};
