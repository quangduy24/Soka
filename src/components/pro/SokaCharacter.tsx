import React from 'react';

interface SokaCharacterProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const SokaCharacter: React.FC<SokaCharacterProps> = ({ size = 120, className = '', style = {} }) => (
  <div 
    className={`inline-block ${className}`} 
    style={{ 
      width: size, 
      height: size * 1.4,
      ...style 
    }}
  >
    <img 
      src="/soka-character.png" 
      alt="Soka Character" 
      className="w-full h-full object-contain"
      draggable={false}
    />
  </div>
);

export default SokaCharacter;
