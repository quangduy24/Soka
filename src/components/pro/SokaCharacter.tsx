import React from 'react';

interface SokaCharacterProps {
  size?: number;
  className?: string;
}

export const SokaCharacter: React.FC<SokaCharacterProps> = ({ size = 120, className = '' }) => (
  <div className={`inline-block ${className}`} style={{ width: size, height: size * 1.4 }}>
    <img 
      src="/soka-character.png" 
      alt="Soka Character" 
      className="w-full h-full object-contain drop-shadow-lg"
      draggable={false}
    />
  </div>
);

export default SokaCharacter;
