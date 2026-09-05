import React, { useEffect, useRef, useState } from 'react';

/** Chunky cartoon logo: bolt buddy + wordmark. No image assets. */
export const BuddyLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <span className="inline-flex items-center gap-2.5 select-none">
    <span
      className="wiggle inline-flex items-center justify-center"
      style={{
        width: size, height: size, background: '#CCFF00',
        border: '3px solid #141414', borderRadius: 14,
        boxShadow: '4px 4px 0 #141414',
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <ellipse cx="9" cy="10" rx="2.2" ry="3" fill="#141414" />
        <ellipse cx="15" cy="10" rx="2.2" ry="3" fill="#141414" />
        <path d="M9 16.5c2 2 4 2 6 0" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="9.4" y="18.6" width="5.2" height="3.4" rx="1.2" fill="#FFFFFF" stroke="#141414" strokeWidth="1" />
      </svg>
    </span>
    <span className="leading-none">
      <span className="block text-[19px] tracking-tight text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>
        WAP<span style={{ background: '#141414', color: '#CCFF00', padding: '0 6px', borderRadius: 8 }}>CHAT</span>
      </span>
      <span className="block font-mono text-[9px] font-bold tracking-[0.28em] text-[#141414]/60 mt-1">
        CHATTY SWAP CLUB ★ SUI
      </span>
    </span>
  </span>
);

/** Flork-style sock buddy — original doodle in the spirit of Flork of Cows:
 *  tall white tube body, dot eyes, stick limbs. Moods: happy / thinking / wow. */
export const BlobBuddy: React.FC<{ size?: number; mood?: 'happy' | 'thinking' | 'wow'; className?: string; style?: React.CSSProperties }> = ({
  size = 120, mood = 'happy', className = '', style,
}) => (
  <div className={`float-slow ${className}`} style={style}>
    <svg width={size} height={size * 1.12} viewBox="0 0 120 134" fill="none">
      <ellipse cx="60" cy="126" rx="28" ry="5" fill="#141414" opacity="0.15" />
      {/* stick legs */}
      <path d="M50 102v14M70 102v14" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 116h12M64 116h12" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
      {/* tube body — theme neon green */}
      <rect x="30" y="8" width="60" height="96" rx="30" fill="#CCFF00" stroke="#141414" strokeWidth="4" />
      {/* stick arms */}
      {mood === 'thinking' ? (
        <>
          <path d="M30 66l-14 4" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
          <path d="M90 66l10-12" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
          <circle cx="102" cy="50" r="3" fill="#141414" />
        </>
      ) : (
        <>
          <path d="M30 64l-16-10" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
          <path d="M90 64l16-10" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {/* eyes */}
      {mood === 'wow' ? (
        <>
          <ellipse cx="48" cy="46" rx="8" ry="10" fill="#fff" stroke="#141414" strokeWidth="3" />
          <ellipse cx="72" cy="46" rx="8" ry="10" fill="#fff" stroke="#141414" strokeWidth="3" />
          <circle cx="48" cy="48" r="3" fill="#141414" />
          <circle cx="72" cy="48" r="3" fill="#141414" />
          <ellipse cx="60" cy="74" rx="7" ry="9" fill="#141414" />
        </>
      ) : mood === 'thinking' ? (
        <>
          <ellipse cx="48" cy="46" rx="5.5" ry="7" fill="#141414" />
          <ellipse cx="72" cy="46" rx="5.5" ry="7" fill="#141414" />
          <path d="M52 74h16" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
          <text x="92" y="26" fontFamily="monospace" fontSize="16" fontWeight="bold" fill="#141414">?</text>
        </>
      ) : (
        <>
          <ellipse cx="48" cy="46" rx="5.5" ry="7.5" fill="#141414" />
          <ellipse cx="72" cy="46" rx="5.5" ry="7.5" fill="#141414" />
          <circle cx="50" cy="44" r="1.6" fill="#fff" />
          <circle cx="74" cy="44" r="1.6" fill="#fff" />
          <path d="M48 68c7 7 17 7 24 0" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {/* swap-club belly patch — white badge on the neon body */}
      <g>
        <rect x="50" y="86" width="20" height="14" rx="4" fill="#FFFFFF" stroke="#141414" strokeWidth="2.5" />
        <path d="M61 88l-5 6h4l-1 4 5-6h-4l1-4Z" fill="#141414" />
      </g>
    </svg>
  </div>
);

/** Interactive Flork pal — pupils follow your cursor, blinks on its own,
 *  and hopKey replays a jelly hop (pass the balance so it jumps on change). */
export const FlorkPal: React.FC<{
  size?: number;
  mood?: 'happy' | 'thinking' | 'wow';
  hopKey?: string | number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size = 140, mood = 'happy', hopKey = '', className = '', style }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.34;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const m = Math.hypot(dx, dy) || 1;
      const max = 3.4;
      const k = Math.min(max, m / 45);
      setLook({ x: (dx / m) * k, y: (dy / m) * k });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div key={hopKey} ref={boxRef} className={`balance-jelly ${className}`} style={style}>
      <svg width={size} height={size * 1.12} viewBox="0 0 120 134" fill="none">
        <ellipse cx="60" cy="126" rx="28" ry="5" fill="#141414" opacity="0.15" />
        {/* stick legs */}
        <path d="M50 102v14M70 102v14" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
        <path d="M44 116h12M64 116h12" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
        {/* tube body — theme neon green */}
        <rect x="30" y="8" width="60" height="96" rx="30" fill="#CCFF00" stroke="#141414" strokeWidth="4" />
        {/* stick arms */}
        {mood === 'thinking' ? (
          <>
            <path d="M30 66l-14 4" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
            <path d="M90 66l10-12" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
            <circle cx="102" cy="50" r="3" fill="#141414" />
          </>
        ) : (
          <>
            <path d="M30 64l-16-10" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
            <path d="M90 64l16-10" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
          </>
        )}
        {/* tracking eyes */}
        <g
          style={{
            transform: blink ? 'scaleY(0.12)' : 'scaleY(1)',
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: 'transform 0.1s ease',
          }}
        >
          <ellipse cx="48" cy="46" rx="8" ry="10" fill="#fff" stroke="#141414" strokeWidth="3" />
          <ellipse cx="72" cy="46" rx="8" ry="10" fill="#fff" stroke="#141414" strokeWidth="3" />
          <circle cx={48 + look.x} cy={48 + look.y} r="3.2" fill="#141414" />
          <circle cx={72 + look.x} cy={48 + look.y} r="3.2" fill="#141414" />
        </g>
        {/* mouth per mood */}
        {mood === 'wow' ? (
          <ellipse cx="60" cy="74" rx="7" ry="9" fill="#141414" />
        ) : mood === 'thinking' ? (
          <>
            <path d="M52 74h16" stroke="#141414" strokeWidth="4" strokeLinecap="round" />
            <text x="92" y="26" fontFamily="monospace" fontSize="16" fontWeight="bold" fill="#141414">?</text>
          </>
        ) : (
          <path d="M48 68c7 7 17 7 24 0" stroke="#141414" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
        {/* swap-club belly patch */}
        <g>
          <rect x="50" y="86" width="20" height="14" rx="4" fill="#FFFFFF" stroke="#141414" strokeWidth="2.5" />
          <path d="M61 88l-5 6h4l-1 4 5-6h-4l1-4Z" fill="#141414" />
        </g>
      </svg>
    </div>
  );
};

/** Rotated sticker badge. */
export const Sticker: React.FC<{ children: React.ReactNode; color?: string; tilt?: number; className?: string }> = ({
  children, color = '#FF90E8', tilt = -6, className = '',
}) => (
  <span
    className={`sticker-burst px-4 py-2 text-[13px] ${className}`}
    style={{ background: color, transform: `rotate(${tilt}deg)` }}
  >
    {children}
  </span>
);

/** Squiggle divider. */
export const Squiggle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} height="14" viewBox="0 0 220 14" fill="none" preserveAspectRatio="none">
    <path d="M2 8 Q 14 2, 26 8 T 50 8 T 74 8 T 98 8 T 122 8 T 146 8 T 170 8 T 194 8 T 218 8"
      stroke="#141414" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Playful isometric chat mock for the landing hero. */
export const IsoChatMock: React.FC = () => (
  <div className="relative" style={{ perspective: 1100 }}>
    <div className="iso-stack toon-card p-5 md:p-6 max-w-[440px]" style={{ transform: 'rotateX(4deg) rotateZ(-1.5deg)' }}>
      <div className="flex items-center gap-2 pb-3 border-b-[3px] border-[#141414]">
        <span className="w-3 h-3 rounded-full bg-[#ff6b6b] border-2 border-[#141414]" />
        <span className="w-3 h-3 rounded-full bg-[#ffc900] border-2 border-[#141414]" />
        <span className="w-3 h-3 rounded-full bg-[#2fbf4f] border-2 border-[#141414]" />
        <span className="ml-2 font-mono text-[10px] font-bold tracking-[0.2em] text-[#141414]/60">WAPCHAT.EXE ★ ONLINE</span>
      </div>
      <div className="py-4 space-y-3">
        <div className="chat-bubble-user pop-in ml-auto max-w-[85%] px-4 py-2.5 text-[14px] font-bold">
          swap 1000 SUI to USDC, safest!! ⚡
        </div>
        <div className="chat-bubble-bot pop-in max-w-[90%] px-4 py-2.5 text-[13.5px]" style={{ animationDelay: '0.15s' }}>
          <span className="font-mono text-[10px] font-bold text-[#141414]/55 tracking-widest">BUDDY SAYS ★</span>
          <br />
          Found it! <b>2-hop</b> route, <b>7/7</b> safety checks passed. Tap go go go →
        </div>
        <div className="flex gap-2 pop-in" style={{ animationDelay: '0.3s' }}>
          {['42% via CETUS', '58% via TURBOS'].map((t) => (
            <span key={t} className="toon-chip !text-[10px]">{t}</span>
          ))}
        </div>
        <div className="pop-in rounded-2xl border-[3px] border-[#141414] bg-[#CCFF00] px-4 py-3 flex items-center justify-between" style={{ boxShadow: '4px 4px 0 #141414', animationDelay: '0.45s' }}>
          <span className="font-black text-[15px]">≈ 3,412 USDC</span>
          <span className="toon-chip !bg-[#141414] !text-[#CCFF00] !border-[#141414] !shadow-none">GO →</span>
        </div>
      </div>
    </div>
    <div className="absolute -top-6 -right-3 md:-right-8 float-slower">
      <Sticker color="#FFC900" tilt={8}>★ SAFEST!</Sticker>
    </div>
    <div className="absolute -bottom-5 -left-2 md:-left-6 float-slow" style={{ ['--tilt' as string]: '-4deg' }}>
      <Sticker color="#7DDCFF" tilt={-8}>7/7 CHECKS ✓</Sticker>
    </div>
  </div>
);
