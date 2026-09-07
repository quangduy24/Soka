import React, { useState } from 'react';

interface SokaAvatarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SokaAvatar: React.FC<SokaAvatarProps> = ({ className = '', size = 'md' }) => {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Character Image with transparent background */}
      <img
        src="/soka-ai-avatar.png"
        alt="SOKA AI"
        className="w-full h-full object-contain relative z-10"
        style={{
          mixBlendMode: 'multiply',
          imageRendering: 'auto',
          filter: 'contrast(1.02) saturate(1.05)',
        }}
      />

      {/* Blinking eyes overlay */}
      <div
        className={`absolute inset-0 z-20 transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Left eye */}
        <div
          className="absolute bg-white rounded-full animate-blink"
          style={{
            width: '18%',
            height: '12%',
            top: '28%',
            left: '28%',
            animationDelay: '0s',
          }}
        />
        {/* Right eye */}
        <div
          className="absolute bg-white rounded-full animate-blink"
          style={{
            width: '18%',
            height: '12%',
            top: '28%',
            right: '28%',
            animationDelay: '0.1s',
          }}
        />
      </div>
    </div>
  );
};

export default SokaAvatar;
