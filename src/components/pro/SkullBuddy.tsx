import React, { useEffect, useRef, useState } from 'react';

/**
 * SkullBuddy — playful retro skull mascot in the neo-brutalist spirit of the
 * reference: white bone, chunky ink outline, green bandana, deadpan/happy
 * moods, autonomous blinking. Pure SVG doodle, no image assets.
 */
export const SkullBuddy: React.FC<{
  size?: number;
  mood?: 'happy' | 'chill' | 'thinking' | 'wow';
  hopKey?: string | number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size = 120, mood = 'happy', hopKey = '', className = '', style }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  // Eyes track the cursor a little (like FlorkPal).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.42;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const m = Math.hypot(dx, dy) || 1;
      const max = 2.6;
      const k = Math.min(max, m / 60);
      setLook({ x: (dx / m) * k, y: (dy / m) * k });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Blink every ~3.4s.
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  const moodEye: 'round' | 'happy' | 'x' = mood === 'wow' ? 'round' : mood === 'thinking' ? 'x' : mood === 'happy' ? 'happy' : 'round';
  const moodMouth =
    mood === 'wow' ? 'wow'
    : mood === 'thinking' ? 'flat'
    : mood === 'chill' ? 'flat'
    : 'grin';

  const lx = look.x;
  const ly = look.y;

  return (
    <div ref={boxRef} key={hopKey} className={`skull-buddy ${className}`} style={style}>
      <svg width={size} height={size * 1.16} viewBox="0 0 200 232" fill="none">
        {/* drop shadow blob */}
        <ellipse cx="100" cy="222" rx="62" ry="9" fill="#141414" opacity="0.15" />

        {/* bandana tail */}
        <path d="M56 78 c-16 4 -26 16 -22 30 c4 14 18 18 28 10" fill="#0f766e" stroke="#141414" strokeWidth="7" strokeLinejoin="round" />
        <path d="M144 78 c16 4 26 16 22 30 c-4 14 -18 18 -28 10" fill="#0f766e" stroke="#141414" strokeWidth="7" strokeLinejoin="round" />

        {/* cranium */}
        <path
          d="M100 24 C 60 24 42 54 42 92 C 42 128 60 156 84 162 L 84 186 C 84 196 116 196 116 186 L 116 162 C 140 156 158 128 158 92 C 158 54 140 24 100 24 Z"
          fill="#FFFDF6"
          stroke="#141414"
          strokeWidth="8"
          strokeLinejoin="round"
        />

        {/* eye sockets */}
        <ellipse cx="74" cy="98" rx="19" ry="21" fill="#141414" />
        <ellipse cx="126" cy="98" rx="19" ry="21" fill="#141414" />

        {/* pupils */}
        <g className="skull-blink">
          <circle cx={74 + lx} cy={102 + ly} r={moodEye === 'x' ? 6 : 8} fill="#CCFF00" />
          <circle cx={126 + lx} cy={102 + ly} r={moodEye === 'x' ? 6 : 8} fill="#CCFF00" />
        </g>

        {/* mood accents: x-eyes for thinking, sparkle for wow */}
        {moodEye === 'x' && (
          <>
            <path d="M66 92 l16 16 M82 92 l-16 16" stroke="#CCFF00" strokeWidth="5" strokeLinecap="round" />
            <path d="M118 92 l16 16 M134 92 l-16 16" stroke="#CCFF00" strokeWidth="5" strokeLinecap="round" />
          </>
        )}
        {mood === 'wow' && (
          <>
            <path d="M60 62 l-12 -8 M72 52 l-2 -14 M84 62 l12 -8" stroke="#141414" strokeWidth="5" strokeLinecap="round" />
            <path d="M140 62 l12 -8 M128 52 l2 -14 M116 62 l-12 -8" stroke="#141414" strokeWidth="5" strokeLinecap="round" />
          </>
        )}

        {/* nose */}
        <path d="M92 128 Q 100 122 108 128" fill="#141414" />
        <path d="M98 116 l2 6 M102 116 l-2 6" stroke="#141414" strokeWidth="5" strokeLinecap="round" />

        {/* mouth */}
        {moodMouth === 'grin' && (
          <path d="M78 156 Q 100 178 122 156" fill="none" stroke="#141414" strokeWidth="7" strokeLinecap="round" />
        )}
        {moodMouth === 'wow' && (
          <ellipse cx="100" cy="162" rx="13" ry="14" fill="#141414" />
        )}
        {moodMouth === 'flat' && (
          <path d="M82 158 h36" stroke="#141414" strokeWidth="7" strokeLinecap="round" />
        )}

        {/* bandana band */}
        <path
          d="M44 70 C 64 88 136 88 156 70 L 152 82 C 130 100 70 100 48 82 Z"
          fill="#14b8a6"
          stroke="#141414"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        {/* skull button on bandana */}
        <circle cx="100" cy="80" r="10" fill="#FFC900" stroke="#141414" strokeWidth="5" />
        <circle cx="96" cy="78" r="2.2" fill="#141414" />
        <circle cx="104" cy="78" r="2.2" fill="#141414" />
        <path d="M96 84 q4 4 8 0" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
};
