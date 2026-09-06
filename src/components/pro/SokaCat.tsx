import React from 'react';

interface SokaCatProps {
  size?: number;
  className?: string;
}

export const SokaCat: React.FC<SokaCatProps> = ({ size = 120, className = '' }) => (
  <div className={`inline-block ${className}`} style={{ width: size, height: size * 1.4 }}>
    <svg viewBox="0 0 200 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg">
      {/* Background gradient */}
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F3C0D6" />
          <stop offset="100%" stopColor="#BE8CC2" />
        </linearGradient>
        <linearGradient id="dressGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F05391" />
          <stop offset="100%" stopColor="#D63A7A" />
        </linearGradient>
        <linearGradient id="furGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F8A0C0" />
          <stop offset="100%" stopColor="#F05391" />
        </linearGradient>
      </defs>

      {/* Tail - pink and white striped */}
      <g>
        <path d="M145 200 C160 180, 175 160, 170 140 C165 120, 155 110, 160 95" stroke="#F05391" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M145 200 C160 180, 175 160, 170 140" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M170 140 C165 120, 155 110, 160 95" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>

      {/* Body - dress */}
      <path d="M75 140 L70 220 C70 230, 80 240, 100 240 C120 240, 130 230, 130 220 L125 140 Z" fill="url(#dressGrad)" stroke="#1a1a2e" strokeWidth="3" />

      {/* Belt */}
      <rect x="72" y="175" width="56" height="8" rx="2" fill="#89CFF0" stroke="#1a1a2e" strokeWidth="2" />
      <circle cx="100" cy="179" r="4" fill="#FFD700" stroke="#1a1a2e" strokeWidth="1.5" />

      {/* Neck */}
      <rect x="88" y="115" width="24" height="30" rx="8" fill="url(#furGrad)" stroke="#1a1a2e" strokeWidth="3" />

      {/* Necklace - gold hexagonal pendant */}
      <circle cx="100" cy="145" r="8" fill="#FFD700" stroke="#1a1a2e" strokeWidth="2" />
      <polygon points="100,138 106,142 106,150 100,154 94,150 94,142" fill="#FFF29" stroke="#1a1a2e" strokeWidth="1.5" />

      {/* Head */}
      <ellipse cx="100" cy="85" rx="45" ry="42" fill="url(#furGrad)" stroke="#1a1a2e" strokeWidth="3" />

      {/* Ears */}
      <path d="M60 55 L45 20 L75 45 Z" fill="url(#furGrad)" stroke="#1a1a2e" strokeWidth="3" />
      <path d="M140 55 L155 20 L125 45 Z" fill="url(#furGrad)" stroke="#1a1a2e" strokeWidth="3" />
      {/* Inner ears */}
      <path d="M62 52 L52 30 L72 47 Z" fill="#FFF29" stroke="#1a1a2e" strokeWidth="1.5" />
      <path d="M138 52 L148 30 L128 47 Z" fill="#FFF29" stroke="#1a1a2e" strokeWidth="1.5" />

      {/* Fringe - side-swept pink hair */}
      <path d="M55 70 C60 50, 75 40, 100 42 C125 40, 140 50, 145 70 C140 60, 120 55, 100 58 C80 55, 60 60, 55 70 Z" fill="#F05391" stroke="#1a1a2e" strokeWidth="2.5" />
      <path d="M58 72 C65 62, 80 58, 95 60" stroke="#D63A7A" strokeWidth="2" fill="none" />
      <path d="M142 72 C135 62, 120 58, 105 60" stroke="#D63A7A" strokeWidth="2" fill="none" />

      {/* Face - white muzzle */}
      <ellipse cx="100" cy="95" rx="25" ry="20" fill="white" stroke="#1a1a2e" strokeWidth="2" />

      {/* Eyes - half-lidded confident */}
      <g>
        {/* Left eye */}
        <ellipse cx="82" cy="80" rx="10" ry="8" fill="white" stroke="#1a1a2e" strokeWidth="2" />
        <ellipse cx="84" cy="82" rx="4" ry="5" fill="#1a1a2e" />
        <circle cx="85" cy="80" r="1.5" fill="white" />
        {/* Eyelashes */}
        <path d="M72 75 L74 72" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
        <path d="M76 73 L78 70" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
        <path d="M80 72 L82 69" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />

        {/* Right eye */}
        <ellipse cx="118" cy="80" rx="10" ry="8" fill="white" stroke="#1a1a2e" strokeWidth="2" />
        <ellipse cx="120" cy="82" rx="4" ry="5" fill="#1a1a2e" />
        <circle cx="121" cy="80" r="1.5" fill="white" />
        {/* Eyelashes */}
        <path d="M128 75 L126 72" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
        <path d="M124 73 L122 70" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
        <path d="M120 72 L118 69" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Nose */}
      <ellipse cx="100" cy="92" rx="4" ry="3" fill="#F05391" />

      {/* Mouth - subtle smile */}
      <path d="M92 100 Q100 106 108 100" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Arms */}
      {/* Left arm - pointing up */}
      <path d="M75 145 C60 140, 50 120, 45 100" stroke="url(#furGrad)" strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M75 145 C60 140, 50 120, 45 100" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Left glove - Sonic style white glove */}
      <ellipse cx="42" cy="92" rx="14" ry="12" fill="white" stroke="#1a1a2e" strokeWidth="3" />
      {/* Glove cuff */}
      <rect x="32" y="82" width="20" height="8" rx="3" fill="white" stroke="#1a1a2e" strokeWidth="2" />
      {/* Pointing finger */}
      <path d="M42 80 L42 68" stroke="white" strokeWidth="6" strokeLinecap="round" />
      <path d="M42 80 L42 68" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />

      {/* Right arm - on hip */}
      <path d="M125 145 C140 150, 145 165, 140 175" stroke="url(#furGrad)" strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M125 145 C140 150, 145 165, 140 175" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Right glove */}
      <ellipse cx="142" cy="180" rx="13" ry="11" fill="white" stroke="#1a1a2e" strokeWidth="3" />
      <rect x="133" y="172" width="18" height="7" rx="3" fill="white" stroke="#1a1a2e" strokeWidth="2" />

      {/* Legs */}
      <path d="M85 235 L82 265" stroke="url(#furGrad)" strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M85 235 L82 265" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M115 235 L118 265" stroke="url(#furGrad)" strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M115 235 L118 265" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Shoes - light pink point-toe heels */}
      <path d="M72 262 C72 258, 82 256, 88 260 L92 265 L72 268 Z" fill="#F8A0C0" stroke="#1a1a2e" strokeWidth="2.5" />
      <path d="M108 262 C108 258, 118 256, 122 260 L128 265 L108 268 Z" fill="#F8A0C0" stroke="#1a1a2e" strokeWidth="2.5" />
      {/* Heel details */}
      <path d="M72 268 L70 275" stroke="#1a1a2e" strokeWidth="2" />
      <path d="M108 268 L106 275" stroke="#1a1a2e" strokeWidth="2" />
    </svg>
  </div>
);

export default SokaCat;
