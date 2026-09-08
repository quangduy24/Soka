import React from 'react';

interface SokaAvatarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const SokaAvatar: React.FC<SokaAvatarProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
    xl: 'w-36 h-36',
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className} group inline-flex items-center justify-center`}>
      {/* SOKA AI Character Image with clean transparent background */}
      <img
        src="/soka-ai-avatar.png"
        alt="SOKA AI"
        className="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_4px_16px_rgba(244,114,182,0.25)]"
        draggable={false}
      />
    </div>
  );
};

export default SokaAvatar;
