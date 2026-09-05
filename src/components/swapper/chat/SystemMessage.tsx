import React from 'react';
import { motion } from 'framer-motion';
import { BlobBuddy } from '../../toon/Toon';

export const SystemMessage: React.FC<{ text: string | React.ReactNode }> = ({ text }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-row items-start gap-2.5 w-full max-w-[92%] pop-in"
    >
      <BlobBuddy size={44} mood="happy" className="!animate-none" />
      <div className="chat-bubble-bot px-4 py-3 text-[14px] font-medium leading-relaxed max-w-full">
        {text}
      </div>
    </motion.div>
  );
};
