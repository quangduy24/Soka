import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Compass } from 'lucide-react';
import { GenerativeInkCanvas } from './GenerativeInkCanvas';

export function ProLanding() {
  const navigate = useNavigate();
  const bloomRef = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver: smoothly reveals elements as they enter viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Hardware-accelerated cursor bloom tracking (zero React re-renders, 120fps)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (bloomRef.current) {
        bloomRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLaunch = () => {
    navigate('/app');
  };

  // Words for The Manifesto section
  const manifestoWords = [
    "WE", "DO", "NOT", "ESTIMATE", "ROUTES.",
    "WE", "WRITE", "DETERMINISTIC", "PROOFS",
    "DIRECTLY", "TO", "MEZO", "CONSENSUS."
  ];

  return (
    <div className="editorial-root relative min-h-screen w-full bg-[#FDF2F2] text-[#2C1924] selection:bg-[#EE97C2] selection:text-white">

      {/* ═══ 1. GENERATIVE INK BACKGROUND (ZERO BLACK - Luminous Soft Cream & Watercolor Plumes) ═══ */}
      <GenerativeInkCanvas />

      {/* ═══ 2. CURSOR DYE BLOOM (Hardware-accelerated DOM transform, zero re-renders) ═══ */}
      <div
        ref={bloomRef}
        className="fixed pointer-events-none z-10 w-[480px] h-[480px] rounded-full mix-blend-multiply opacity-40 blur-3xl transition-transform duration-100 ease-out hidden md:block"
        style={{
          top: 0,
          left: 0,
          background: 'radial-gradient(circle, #EE97C2 0%, rgba(253,242,242,0) 70%)',
          willChange: 'transform'
        }}
      />

      {/* ═══ 3. FIXED TRANSPARENT NAVIGATION ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-12 py-3.5 bg-[#FDF2F2]/90 backdrop-blur-md border-b border-[#F7D1D7]/50 shadow-[0_4px_20px_rgba(223,122,167,0.06)]">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="font-grotesk-125 text-xl tracking-tight text-[#2C1924] cursor-pointer hover:text-[#DF7AA7] transition-colors"
        >
          SOKA
        </button>

        <div className="flex items-center gap-6 sm:gap-8 font-meta text-[#2C1924]/80 text-[0.72rem]">
          <a href="#argument" className="nav-link-item hidden sm:inline-flex items-center gap-1.5 hover:text-[#DF7AA7] transition-colors">
            <span className="opacity-50">•</span> THE SHIFT
          </a>
          <a href="#offer" className="nav-link-item hidden md:inline-flex items-center gap-1.5 hover:text-[#DF7AA7] transition-colors">
            <span className="opacity-50">•</span> THE JOURNEY
          </a>
          <a href="#spec" className="nav-link-item hidden md:inline-flex items-center gap-1.5 hover:text-[#DF7AA7] transition-colors">
            <span className="opacity-50">•</span> THE PILLARS
          </a>
          <button
            onClick={handleLaunch}
            className="nav-link-item flex items-center gap-1.5 text-[#2C1924] font-bold cursor-pointer hover:text-white hover:bg-[#DF7AA7] hover:border-[#DF7AA7] transition-all duration-300 px-4 py-1.5 rounded-full border border-[#DF7AA7] bg-white/90 shadow-xs"
          >
            <span className="text-[#EE97C2] group-hover:text-white">•</span> LAUNCH TERMINAL
          </button>
        </div>
      </nav>

      {/* ═══ 4. STACKING CARDS DECK CONTAINER ═══ */}
      <main className="deck-container relative z-20 w-full max-w-[1340px] px-3 sm:px-6 lg:px-8 pt-20 pb-24 flex flex-col mx-auto">

        {/* ═══════════════════════════════════════════════════════════════
            CARD 1 (ACT I): THE PROLOGUE (Cover)
            Vertically centered card with stacking cards behavior
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="cover"
          className="stack-card stack-card-1 z-[10] mb-28 sm:mb-36 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#DF7AA7]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT I // THE PROLOGUE</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">SOKA INTENT ENGINE</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 01 / 07</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="my-auto flex flex-col items-center text-center py-4 sm:py-6">
            <div className="scroll-reveal inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-[#EAAEC0] bg-white mb-5 font-meta text-[0.66rem] text-[#2C1924]/80 shadow-xs">
              <Sparkles className="w-3 h-3 text-[#DF7AA7]" />
              <span>THE FIRST BITCOIN INTENT PROTOCOL ON MEZO</span>
            </div>

            <h1 className="scroll-reveal scroll-reveal-delay-1 font-grotesk-125 text-[clamp(2.4rem,6.2vw,5.5rem)] leading-[1.15] tracking-[-0.012em] mb-6 text-[#2C1924]">
              TRADE WITH<br />
              <span className="text-[#DF7AA7] drop-shadow-[0_4px_25px_rgba(223,122,167,0.25)]">
                INTENTION
              </span>
            </h1>

            <div className="scroll-reveal scroll-reveal-delay-2 font-grotesk-78 text-[clamp(1rem,1.8vw,1.45rem)] text-[#2C1924]/90 tracking-tight max-w-[28ch] mb-5 leading-[1.45]">
              FROM HUMAN THOUGHT TO ATOMIC EXECUTION
            </div>

            <p className="scroll-reveal scroll-reveal-delay-2 font-sans text-xs sm:text-sm text-[#2C1924]/80 max-w-[48ch] leading-relaxed mb-7 font-normal">
              No manual slippage math. No sandwich bot anxieties. Simply speak your trade, and let mathematical certainty seal it on-chain.
            </p>

            <button
              onClick={handleLaunch}
              className="scroll-reveal scroll-reveal-delay-3 inline-flex items-center gap-2.5 px-8 py-3 rounded-full border-2 border-[#D979A2] bg-white hover:bg-[#DF7AA7] hover:text-white transition-all duration-300 font-meta text-[0.7rem] cursor-pointer shadow-[0_8px_25px_rgba(223,122,167,0.22)] text-[#2C1924] hover:shadow-[0_12px_32px_rgba(223,122,167,0.35)] hover:-translate-y-0.5"
            >
              <span>ENTER THE TERMINAL</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          {/* Card Footer Hint */}
          <div className="pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>SCROLL DOWN TO REVEAL NEXT DECK CARD</span>
            <span className="text-[#DF7AA7] font-bold">↓ THE SHIFT</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            CARD 2 (ACT II): THE SHIFT (The Conflict)
            Slides over Card 1 as user scrolls
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="argument"
          className="stack-card stack-card-2 z-[20] mb-28 sm:mb-36 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F8B6A5]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT II // THE SHIFT</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">PARADIGM REVOLUTION</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 02 / 07</span>
            </div>
          </div>

          {/* Card Main Body: 2-Column Story */}
          <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center py-2">

            {/* Left Column: Compact Headline */}
            <div className="lg:col-span-6 scroll-reveal scroll-reveal-delay-1">
              <h2 className="font-grotesk-125 text-[clamp(2.2rem,4.8vw,4.2rem)] leading-[0.9] text-[#2C1924] mb-3.5">
                TELL IT WHAT<br />
                <span style={{ color: '#DF7AA7' }}>YOU WANT</span>
              </h2>
              <p className="font-meta text-[#2C1924]/65 tracking-wider text-[0.66rem] leading-relaxed max-w-md">
                THE PROTOCOL COMPILES YOUR GOALS DIRECTLY INTO MEZO EVM CONSENSUS — NO MANUAL DEXTABS, NO COMPLEX SLIPPAGE CALCULATIONS.
              </p>
            </div>

            {/* Right Column: Story Conflict Card */}
            <div className="lg:col-span-6 scroll-reveal scroll-reveal-delay-2">
              <div className="rounded-2xl bg-white border-2 border-[#EAAEC0] p-5 sm:p-6 shadow-[0_8px_25px_rgba(223,122,167,0.10)] hover:border-[#D979A2] hover:shadow-[0_12px_32px_rgba(223,122,167,0.18)] transition-all duration-300">
                <h3 className="font-grotesk-90 text-base sm:text-lg text-[#2C1924] mb-2">
                  DeFi made you do the work of a computer.
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#2C1924]/80 leading-relaxed mb-4">
                  Calculating slippage tolerance, hopping between multiple DEX tabs, and dodging predatory MEV bots in the mempool.
                  Trading shouldn't feel like navigating a minefield.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'SPEAK YOUR OUTCOME',
                    'IMMUNE TO SANDWICH BOTS',
                    'OPTIMAL LIQUIDITY SPLIT',
                    'VERIFIED BY CODE'
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="pill-invert-chip font-meta px-3.5 py-1.5 rounded-full cursor-default text-[0.62rem]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Card Footer Hint */}
          <div className="pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>PREVIOUS: ACT I PROLOGUE</span>
            <span className="text-[#DF7AA7] font-bold">NEXT: ACT III THE JOURNEY ↓</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            CARD 3 (ACT III): THE JOURNEY (The 3 Phases)
            Slides over Card 2
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="offer"
          className="stack-card stack-card-3 z-[30] mb-28 sm:mb-36 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#DF7AA7]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT III // THE JOURNEY</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">3 STAGES OF EXECUTION</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 03 / 07</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="my-auto py-2">
            <div className="scroll-reveal flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
              <div>
                <h2 className="font-grotesk-125 text-2xl sm:text-3xl text-[#2C1924]">
                  THE VOYAGE OF <span style={{ color: '#DF7AA7' }}>AN INTENT</span>
                </h2>
              </div>
              <p className="font-sans text-xs text-[#2C1924]/75 max-w-md">
                From the moment you speak or type, your order travels through three stages of absolute mathematical protection.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Step 1 */}
              <div className="story-step-card scroll-reveal scroll-reveal-delay-1 relative rounded-2xl bg-white border-2 border-[#EAAEC0] shadow-[0_6px_20px_rgba(223,122,167,0.08)] p-4 sm:p-5 flex flex-col justify-between overflow-hidden cursor-default">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#EE97C2]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-meta text-[0.62rem] text-[#DF7AA7] font-bold">STEP 01</span>
                    <span className="font-meta text-[0.62rem] text-[#2C1924]/40">// DECOMPILE</span>
                  </div>
                  <h3 className="font-grotesk-90 text-sm sm:text-base text-[#2C1924] mb-1.5">YOU SPEAK IN PLAIN WORDS</h3>
                  <p className="text-xs text-[#2C1924]/75 leading-relaxed mb-4 font-sans">
                    "Swap 0.05 BTC for the safest route into MUSD." Our natural engine decompiles your intention into strict mathematical parameters in under 84ms.
                  </p>
                </div>
                <div className="relative z-10 pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.6rem]">
                  <span className="text-[#2C1924]/60">INPUT</span>
                  <span className="text-[#DF7AA7] font-bold">NATURAL LANGUAGE</span>
                </div>
                <span className="step-watermark absolute -bottom-5 -right-2 font-grotesk-125 text-6xl text-[#F7D1D7] opacity-40 pointer-events-none select-none">
                  01
                </span>
              </div>

              {/* Step 2 */}
              <div className="story-step-card scroll-reveal scroll-reveal-delay-2 relative rounded-2xl bg-white border-2 border-[#EAAEC0] shadow-[0_6px_20px_rgba(223,122,167,0.08)] p-4 sm:p-5 flex flex-col justify-between overflow-hidden cursor-default">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#DF7AA7]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-meta text-[0.62rem] text-[#DF7AA7] font-bold">STEP 02</span>
                    <span className="font-meta text-[0.62rem] text-[#2C1924]/40">// DISCOVER</span>
                  </div>
                  <h3 className="font-grotesk-90 text-sm sm:text-base text-[#2C1924] mb-1.5">WE HARVEST MEZO POOLS</h3>
                  <p className="text-xs text-[#2C1924]/75 leading-relaxed mb-4 font-sans">
                    The protocol fragments and routes liquidity across Mezo Pools concentrated ticks, finding the most capital-efficient path through MUSD or MEZO.
                  </p>
                </div>
                <div className="relative z-10 pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.6rem]">
                  <span className="text-[#2C1924]/60">POOLS</span>
                  <span className="text-[#DF7AA7] font-bold">MEZO POOLS LIQUIDITY</span>
                </div>
                <span className="step-watermark absolute -bottom-5 -right-2 font-grotesk-125 text-6xl text-[#F7D1D7] opacity-40 pointer-events-none select-none">
                  02
                </span>
              </div>

              {/* Step 3 */}
              <div className="story-step-card scroll-reveal scroll-reveal-delay-3 relative rounded-2xl bg-white border-2 border-[#EAAEC0] shadow-[0_6px_20px_rgba(223,122,167,0.08)] p-4 sm:p-5 flex flex-col justify-between overflow-hidden cursor-default">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#F8B6A5]" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-meta text-[0.62rem] text-[#DF7AA7] font-bold">STEP 03</span>
                    <span className="font-meta text-[0.62rem] text-[#2C1924]/40">// GUARANTEE</span>
                  </div>
                  <h3 className="font-grotesk-90 text-sm sm:text-base text-[#2C1924] mb-1.5">SEALED AT CONSENSUS</h3>
                  <p className="text-xs text-[#2C1924]/75 leading-relaxed mb-4 font-sans">
                    An 8-point Risk Guardian evaluates live Skip + Pyth oracles and tBTC proof-of-reserves. Mezo executes via gasless meta-transactions: full settlement or zero loss.
                  </p>
                </div>
                <div className="relative z-10 pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.6rem]">
                  <span className="text-[#2C1924]/60">ASSURANCE</span>
                  <span className="text-[#DF7AA7] font-bold">META-TX RELAY</span>
                </div>
                <span className="step-watermark absolute -bottom-5 -right-2 font-grotesk-125 text-6xl text-[#F7D1D7] opacity-40 pointer-events-none select-none">
                  03
                </span>
              </div>

            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>PREVIOUS: ACT II THE SHIFT</span>
            <span className="text-[#DF7AA7] font-bold">NEXT: ACT IV THE CREED ↓</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            CARD 4 (ACT IV): THE CREED (The Manifesto)
            Slides over Card 3
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="position"
          className="stack-card stack-card-4 z-[40] mb-28 sm:mb-36 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EE97C2]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT IV // THE CREED</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">SOKA MANIFESTO</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 04 / 07</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="my-auto text-center py-4 sm:py-6">
            <div className="scroll-reveal flex flex-col items-center gap-1.5 mb-6">
              <span className="font-meta text-[#2C1924]/50 text-[0.66rem]">THE CERTAINTY PROMISE</span>
              <div className="section-hairline bg-[#DF7AA7]" />
            </div>

            <div className="scroll-reveal scroll-reveal-delay-1 max-w-4xl mx-auto flex flex-wrap justify-center gap-x-3 gap-y-1.5 mb-5">
              {manifestoWords.map((word, idx) => {
                const isAccentWord = word === "DETERMINISTIC" || word === "PROOFS";
                return (
                  <span
                    key={idx}
                    className={`font-grotesk-125 text-[clamp(1.6rem,3.8vw,3.2rem)] leading-[1] inline-block ${isAccentWord ? 'text-[#DF7AA7] drop-shadow-[0_2px_15px_rgba(223,122,167,0.25)]' : 'text-[#2C1924]'
                      }`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>

            <div className="scroll-reveal scroll-reveal-delay-2 font-meta text-[0.68rem] text-[#2C1924]/60 tracking-widest mt-3">
              — SOKA PROTOCOL // VERIFIED AT MEZO CONSENSUS
            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>PREVIOUS: ACT III THE JOURNEY</span>
            <span className="text-[#DF7AA7] font-bold">NEXT: ACT V THE PROOF ↓</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            CARD 5 (ACT V): THE PROOF (Real-Time Telemetry & Outcomes)
            Slides over Card 4
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="index"
          className="stack-card stack-card-5 z-[50] mb-28 sm:mb-36 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F5C5B7]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT V // THE PROOF</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">EMPIRICAL OUTCOMES</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 05 / 07</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center py-2">

            <div className="lg:col-span-5 flex flex-col items-start scroll-reveal scroll-reveal-delay-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DF7AA7] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#DF7AA7]"></span>
                </span>
                <span className="font-meta text-[0.65rem] text-[#2C1924]/60 tracking-wider">
                  REAL-TIME TELEMETRY
                </span>
              </div>
              <div className="font-grotesk-125 text-[clamp(2.8rem,5.5vw,5rem)] text-[#2C1924] leading-[0.85] mb-2.5">
                &lt; 84<span style={{ color: '#DF7AA7' }}>ms</span>
              </div>
              <h4 className="font-grotesk-90 text-base sm:text-lg text-[#2C1924] mb-2">
                Faster than human thought.
              </h4>
              <p className="font-sans text-xs text-[#2C1924]/75 leading-relaxed max-w-sm">
                In less time than a single eye-blink, your spoken intention is validated, compiled, and presented with transparent price guarantees.
              </p>
            </div>

            <div className="lg:col-span-7 flex flex-col border-t border-[#EAAEC0] scroll-reveal scroll-reveal-delay-2">
              {[
                {
                  title: 'ZERO MEV VULNERABILITY',
                  desc: 'Protected by Mezo Risk Guardian & oracle validation so predatory bots cannot front-run your trade.'
                },
                {
                  title: 'CONVERSATIONAL PRECISION',
                  desc: 'State amounts, limits, or strategies in your own everyday words (BTC, sats, MUSD).'
                },
                {
                  title: 'HYPER-OPTIMAL FILL',
                  desc: 'Mezo Pools concentrated liquidity ticks automatically balanced for minimal price impact.'
                },
                {
                  title: 'PRE-FLIGHT GUARDIAN',
                  desc: 'Eight automated safety checks verify Skip + Pyth oracles, pool depth, and tBTC bridge health.'
                },
                {
                  title: 'GASLESS META-TRANSACTIONS',
                  desc: 'Sponsor execution via permit + relay when users have no native BTC on hand.'
                },
                {
                  title: 'NON-CUSTODIAL PURITY',
                  desc: 'Your private keys never leave your custody. You interact directly with the blockchain.'
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="row-hover-fill py-2 px-2.5 border-b border-[#EAAEC0] flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-3 cursor-pointer"
                >
                  <div className="relative z-10 flex items-baseline gap-2.5">
                    <span className="font-meta text-[#2C1924]/40 text-[0.62rem]">0{i + 1}</span>
                    <span className="row-name font-grotesk-90 text-xs font-bold tracking-tight text-inherit">
                      {row.title}
                    </span>
                  </div>
                  <span className="relative z-10 font-sans text-[0.75rem] text-[#2C1924]/70 sm:text-right max-w-md">
                    {row.desc}
                  </span>
                </div>
              ))}
            </div>

          </div>

          {/* Card Footer */}
          <div className="pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>PREVIOUS: ACT IV THE CREED</span>
            <span className="text-[#DF7AA7] font-bold">NEXT: ACT VI THE ARCHITECTURE ↓</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            CARD 6 (ACT VI): THE PILLARS (Architecture)
            Slides over Card 5
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="spec"
          className="stack-card stack-card-6 z-[60] mb-28 sm:mb-36 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#DF7AA7]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT VI // THE ARCHITECTURE</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">3 CORE FOUNDATIONS</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 06 / 07</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="my-auto py-2">
            <div className="scroll-reveal scroll-reveal-delay-1 flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
              <h2 className="font-grotesk-125 text-2xl sm:text-3xl text-[#2C1924]">
                THE THREE <span style={{ color: '#DF7AA7' }}>PILLARS</span>
              </h2>
              <p className="font-sans text-xs text-[#2C1924]/70 max-w-md">
                Three layers of engineering built together so you never have to guess the outcome of a trade again.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Pillar 1: Cognitive */}
              <div className="pillar-card scroll-reveal scroll-reveal-delay-1 flex flex-col rounded-2xl bg-white p-4 sm:p-5 border-2 border-[#EAAEC0] shadow-[0_6px_20px_rgba(223,122,167,0.08)] cursor-default">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="pillar-icon-box w-6 h-6 rounded-full bg-[#EE97C2]/20 flex items-center justify-center text-[#DF7AA7]">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <span className="font-meta text-[0.62rem] text-[#DF7AA7] font-bold">PILLAR I // COGNITIVE</span>
                </div>
                <h3 className="font-grotesk-90 text-sm sm:text-base text-[#2C1924] mb-1.5">
                  Natural Language Intent Engine
                </h3>
                <p className="font-sans text-xs text-[#2C1924]/75 leading-relaxed mb-3.5">
                  Translates human intent into structured Mezo on-chain orders. Normalizes amounts into 18-decimal BTC and validates confirmed vs. pending tBTC bridge balances.
                </p>
                <div className="mt-auto pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.6rem] text-[#2C1924]/60">
                  <span>LATENCY: &lt; 84MS</span>
                  <span className="text-[#DF7AA7] font-bold">INTENT DECOMPILE</span>
                </div>
              </div>

              {/* Pillar 2: Liquidity */}
              <div className="pillar-card scroll-reveal scroll-reveal-delay-2 flex flex-col rounded-2xl bg-white p-4 sm:p-5 border-2 border-[#EAAEC0] shadow-[0_6px_20px_rgba(223,122,167,0.08)] cursor-default">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="pillar-icon-box w-6 h-6 rounded-full bg-[#F8B6A5]/25 flex items-center justify-center text-[#DF7AA7]">
                    <Compass className="w-3 h-3" />
                  </div>
                  <span className="font-meta text-[0.62rem] text-[#DF7AA7] font-bold">PILLAR II // LIQUIDITY</span>
                </div>
                <h3 className="font-grotesk-90 text-sm sm:text-base text-[#2C1924] mb-1.5">
                  Mezo Pools Smart Router
                </h3>
                <p className="font-sans text-xs text-[#2C1924]/75 leading-relaxed mb-3.5">
                  Taps Mezo Pools concentrated-liquidity AMM with multi-hop paths across BTC, MUSD, and MEZO, reserving native BTC gas before calculating tradeable volume.
                </p>
                <div className="mt-auto pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.6rem] text-[#2C1924]/60">
                  <span>INTEGRATION: MEZO POOLS</span>
                  <span className="text-[#DF7AA7] font-bold">CONCENTRATED AMM</span>
                </div>
              </div>

              {/* Pillar 3: Guardian */}
              <div className="pillar-card scroll-reveal scroll-reveal-delay-3 flex flex-col rounded-2xl bg-white p-4 sm:p-5 border-2 border-[#EAAEC0] shadow-[0_6px_20px_rgba(223,122,167,0.08)] cursor-default">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="pillar-icon-box w-6 h-6 rounded-full bg-[#DF7AA7]/20 flex items-center justify-center text-[#DF7AA7]">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                  <span className="font-meta text-[0.62rem] text-[#DF7AA7] font-bold">PILLAR III // GUARDIAN</span>
                </div>
                <h3 className="font-grotesk-90 text-sm sm:text-base text-[#2C1924] mb-1.5">
                  On-Chain Risk Guardian
                </h3>
                <p className="font-sans text-xs text-[#2C1924]/75 leading-relaxed mb-3.5">
                  Cross-checks Skip oracle (BTC/USD) with Pyth, monitors tBTC bridge proof-of-reserves, and validates pool depth before signing or gasless relay.
                </p>
                <div className="mt-auto pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.6rem] text-[#2C1924]/60">
                  <span>AUDIT: 8/8 CHECKS</span>
                  <span className="text-[#DF7AA7] font-bold">SKIP + PYTH ORACLES</span>
                </div>
              </div>

            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-2.5 border-t border-[#EAAEC0] flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>PREVIOUS: ACT V THE PROOF</span>
            <span className="text-[#DF7AA7] font-bold">NEXT: ACT VII THE HORIZON ↓</span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            CARD 7 (ACT VII): THE HORIZON (The Terminal CTA)
            The final card in the deck, slides over Card 6
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="close"
          className="stack-card stack-card-7 z-[70] mb-16 p-5 sm:p-8 lg:p-10 flex flex-col justify-between"
        >
          {/* Card Top Tab */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EAAEC0] font-meta text-[0.66rem] text-[#2C1924]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#DF7AA7]" />
              <span className="font-bold tracking-wider text-[#2C1924]">ACT VII // THE HORIZON</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[#DF7AA7] font-medium">TERMINAL ACCESS</span>
              <span className="font-mono tracking-widest text-[#2C1924]/40">CARD 07 / 07</span>
            </div>
          </div>

          {/* Card Main Body */}
          <div className="my-auto text-center max-w-3xl mx-auto flex flex-col items-center py-4 sm:py-6">
            <h2 className="scroll-reveal scroll-reveal-delay-1 font-grotesk-125 text-[clamp(2rem,5vw,4.2rem)] leading-[0.9] text-[#2C1924] mb-4">
              THE NEXT ERA OF TRADING IS A<br />
              <span>
                <span style={{ color: '#EE97C2' }}>CON</span>
                <span style={{ color: '#F8B6A5' }}>VER</span>
                <span style={{ color: '#DF7AA7' }}>SA</span>
                <span style={{ color: '#DF7AA7' }}>TION</span>
              </span>
            </h2>

            <p className="scroll-reveal scroll-reveal-delay-2 font-sans text-xs sm:text-sm text-[#2C1924]/75 max-w-[46ch] leading-relaxed mb-6">
              Step into the terminal where your intent is sovereign, your funds are uncompromised, and execution is absolute.
            </p>

            <button
              onClick={handleLaunch}
              className="scroll-reveal scroll-reveal-delay-3 close-pill-btn px-8 py-3.5 border-2 border-[#D979A2] bg-white text-[#2C1924] font-meta text-[0.75rem] tracking-wider uppercase mb-6 cursor-pointer group shadow-[0_10px_35px_rgba(223,122,167,0.22)] hover:border-[#DF7AA7]"
            >
              <div className="btn-fill" />
              <div className="relative z-10 flex items-center gap-2.5">
                <span>LAUNCH INTENT CONSOLE</span>
                <ArrowRight className="btn-arrow w-4 h-4 text-[#DF7AA7] group-hover:text-white" />
              </div>
            </button>

            <div className="scroll-reveal scroll-reveal-delay-4 flex flex-wrap justify-center items-center gap-5 sm:gap-8 font-meta text-[0.62rem] text-[#2C1924]/65">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="nav-link-item hover:text-[#DF7AA7] transition-colors">GITHUB</a>
              <span className="opacity-30">•</span>
              <a href="#spec" className="nav-link-item hover:text-[#DF7AA7] transition-colors">DOCUMENTATION</a>
              <span className="opacity-30">•</span>
              <a href="#argument" className="nav-link-item hover:text-[#DF7AA7] transition-colors">PROTOCOL STORY</a>
              <span className="opacity-30">•</span>
              <a href="https://discord.com" target="_blank" rel="noreferrer" className="nav-link-item hover:text-[#DF7AA7] transition-colors">COMMUNITY</a>
            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-2.5 border-t border-[#F7D1D7]/50 flex items-center justify-between font-meta text-[0.62rem] text-[#2C1924]/50">
            <span>END OF SOKA PROTOCOL DOSSIER</span>
            <span className="text-[#DF7AA7] font-bold">ALL 7 CARDS STACKED</span>
          </div>
        </section>

      </main>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER (Reveals cleanly below the finished card deck)
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="relative w-full border-t border-[#F7D1D7] px-6 sm:px-14 py-6 bg-gradient-to-b from-transparent to-[#FDF2F2] flex flex-col sm:flex-row items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-4">
          <span className="font-grotesk-125 text-xl tracking-tight text-[#2C1924]">
            SOKA
          </span>
          <span className="hidden sm:inline-block w-px h-3 bg-[#F7D1D7]" />
          <span className="font-meta text-[0.62rem] text-[#2C1924]/60">
            AI-POWERED BITCOIN INTENT PROTOCOL ON MEZO
          </span>
        </div>

        <div className="font-meta text-[0.62rem] text-[#2C1924]/50">
          © 2026 SOKA PROTOCOL. ALL RIGHTS RESERVED.
        </div>
      </footer>

    </div>
  );
}
