import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BuddyLogo, BlobBuddy, Sticker, Squiggle, IsoChatMock } from '../toon/Toon';

export const Hero = ({ onLaunch }: { onLaunch: () => void }) => {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = wrapRef.current?.querySelectorAll('.hero-pop');
    if (els && els.length) {
      gsap.fromTo(els,
        { opacity: 0, y: 34, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.12, ease: 'back.out(1.6)' });
    }
  }, []);

  return (
    <section className="relative w-full overflow-hidden">
      {/* marquee ribbon */}
      <div className="bg-[#141414] text-[#FFF4E0] overflow-hidden border-b-[3px] border-[#141414] py-2">
        <div className="toon-marquee whitespace-nowrap font-mono text-[11px] font-bold tracking-[0.22em] w-max">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              ★ CHATTY SWAPS ★ NO JARGON ★ SAFETY FIRST ★ SUI NETWORK ★ CHATTY SWAPS ★ NO JARGON ★ SAFETY FIRST ★ SUI NETWORK ★&nbsp;
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="w-full max-w-[1180px] mx-auto px-5 md:px-8 pt-7 pb-10">
        <div className="flex items-center justify-between">
          <BuddyLogo />
          <div className="hidden sm:flex items-center gap-2">
            <span className="toon-chip toon-chip-neon"><span className="sync-dot" /> LIVE ON SUI</span>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="hero-pop flex flex-wrap gap-2 mb-4">
              <Sticker color="#CCFF00" tilt={-5}>★ PLAYFUL</Sticker>
              <Sticker color="#FF90E8" tilt={4}>ISOMETRIC CHAT</Sticker>
              <Sticker color="#7DDCFF" tilt={-3}>RETRO CARTOON</Sticker>
            </div>
            <h1 className="hero-pop text-[44px] md:text-[64px] text-[#141414]">
              SWAPS THAT
              <br />
              <span className="inline-block mt-1 px-3 py-1 bg-[#141414] text-[#CCFF00] rounded-2xl" style={{ transform: 'rotate(-1.5deg)' }}>
                CHAT BACK!
              </span>
            </h1>
            <p className="hero-pop mt-5 text-[16px] md:text-[17px] font-medium text-[#141414]/75 max-w-[460px] leading-relaxed">
              Just type what you want — <b>“swap 1000 SUI to USDC, safest!”</b> — and
              Buddy finds the route, runs <b>7 safety checks</b>, and builds your transaction.
            </p>
            <Squiggle className="hero-pop w-[220px] mt-4" />
            <div className="hero-pop mt-6 flex flex-wrap items-center gap-4">
              <button onClick={onLaunch} className="toon-btn text-[16px]">
                OPEN THE CHAT →
              </button>
              <div className="flex items-center gap-2">
                <BlobBuddy size={56} mood="happy" />
                <span className="font-mono text-[11px] font-bold text-[#141414]/60">BUDDY IS<br />READY!!</span>
              </div>
            </div>
            <div className="hero-pop mt-7 grid grid-cols-3 gap-3 max-w-[460px]">
              {[
                ['#CCFF00', '<200ms', 'super fast'],
                ['#FFC900', '8 DEXs', 'scanned'],
                ['#FF90E8', '7 checks', 'stay safe'],
              ].map(([c, v, l]) => (
                <div key={l} className="toon-card-flat px-3 py-3 text-center" style={{ background: c }}>
                  <div className="text-[19px]" style={{ fontFamily: '"Bungee", sans-serif' }}>{v}</div>
                  <div className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-pop relative flex flex-col items-center gap-6">
            <IsoChatMock />
            <div className="flex items-end gap-1">
              <BlobBuddy size={92} mood="wow" />
              <div className="chat-bubble-bot px-4 py-2 text-[13px] font-bold mb-4">that route is squeaky clean!!</div>
            </div>
          </div>
        </div>

        {/* how it works */}
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {[
            ['💬', '#CCFF00', '1 · YOU CHAT', 'Type your trade like texting a friend. No forms, no sliders.'],
            ['🧭', '#7DDCFF', '2 · BUDDY ROUTES', 'Buddy scans liquidity and picks the cutest safest path.'],
            ['🛡️', '#FF90E8', '3 · SAFE & SIGN', 'Checks pass → you sign in wallet. Done-zo!'],
          ].map(([e, c, t, d]) => (
            <div key={t as string} className="toon-card p-5" style={{ background: c as string }}>
              <div className="text-[30px]">{e}</div>
              <div className="mt-2 text-[17px]" style={{ fontFamily: '"Bungee", sans-serif' }}>{t}</div>
              <p className="mt-1 text-[14px] font-medium text-[#141414]/75">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
