import React from 'react';

/**
 * Token icon that shows the real logo when available and falls back to a
 * gradient letter-avatar when there's no logo or the image fails to load.
 */
export const TokenIcon: React.FC<{ symbol: string; logoUrl?: string | null; size?: number }> = ({
  symbol,
  logoUrl,
  size = 40,
}) => {
  const [failed, setFailed] = React.useState(false);
  const label = (symbol?.includes('::') ? symbol.split('::').pop() || symbol : symbol || '?')
    .slice(0, 3)
    .toUpperCase();
  const dim = { width: size, height: size };

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        onError={() => setFailed(true)}
        style={dim}
        className="rounded-full object-cover bg-[#CCFF00]/5 shrink-0"
      />
    );
  }

  return (
    <div
      style={dim}
      className="rounded-full shrink-0 bg-gradient-to-br from-[#7AA500]/25 to-[#CCFF00]/25 border border-[#141414] flex items-center justify-center font-bold text-[#141414]"
    >
      <span style={{ fontSize: Math.max(9, Math.round(size * 0.3)) }}>{label}</span>
    </div>
  );
};
