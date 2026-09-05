import React, { useEffect, useRef, useState } from 'react';
import { BlobBuddy, FlorkPal } from '../toon/Toon';

interface ConsoleHeroProps {
  walletAddress: string | null;
  balanceText: string;
  balanceSymbol: string;
  intentInput: string;
  setIntentInput: (val: string) => void;
  onSubmitText: (text: string) => void;
  isBusy: boolean;
  onOpenVault: () => void;
}

type RouteMode = 'buddy' | 'safest' | 'fastest' | 'cheapest';

const MODES: { id: RouteMode; label: string; suffix: string; blurb: string }[] = [
  { id: 'buddy', label: '✨ Buddy Pick', suffix: '', blurb: "Buddy's choice" },
  { id: 'safest', label: '🛡️ Safest', suffix: 'safest route', blurb: 'min risk' },
  { id: 'fastest', label: '⚡ Fastest', suffix: 'fastest route', blurb: 'min hops' },
  { id: 'cheapest', label: '💰 Max Out', suffix: 'max output', blurb: 'max received' },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortName(addr: string | null): string {
  if (!addr) return 'friend';
  return addr.slice(0, 6);
}

/** Smooth count-up between balance updates, preserving decimal places. */
function useCountUp(targetStr: string): string {
  const [display, setDisplay] = useState(targetStr);
  const prevRef = useRef<number>(parseFloat(targetStr) || 0);
  useEffect(() => {
    const target = parseFloat(targetStr);
    if (Number.isNaN(target)) {
      setDisplay(targetStr);
      return;
    }
    const decimals = (targetStr.split('.')[1] || '').length;
    const from = prevRef.current;
    if (from === target) {
      setDisplay(targetStr);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay((from + (target - from) * eased).toFixed(decimals));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetStr]);
  return display;
}

function groupNumber(s: string): string {
  const parts = s.split('.');
  const int = Number(parts[0]);
  const grouped = Number.isNaN(int) ? parts[0] : int.toLocaleString('en-US');
  return parts.length > 1 ? `${grouped}.${parts[1]}` : grouped;
}

/** Floating party doodads orbiting the balance hero. */
const FLOATERS: { e: string; left: string; top: string; size: number; cls: string; delay: string; hideMobile?: boolean }[] = [
  { e: '🪙', left: '2%', top: '6%', size: 36, cls: 'float-slow', delay: '0s' },
  { e: '⭐', left: '10%', top: '68%', size: 26, cls: 'doodle-twinkle', delay: '0.4s' },
  { e: '✨', left: '20%', top: '22%', size: 22, cls: 'doodle-twinkle', delay: '1.1s', hideMobile: true },
  { e: '💫', left: '82%', top: '14%', size: 28, cls: 'float-slower', delay: '0.7s' },
  { e: '🪙', left: '92%', top: '58%', size: 32, cls: 'float-slow', delay: '1.4s' },
  { e: '🌟', left: '74%', top: '78%', size: 24, cls: 'doodle-twinkle', delay: '0.2s', hideMobile: true },
  { e: '✨', left: '30%', top: '84%', size: 20, cls: 'doodle-twinkle', delay: '1.7s', hideMobile: true },
];

export const ConsoleHero: React.FC<ConsoleHeroProps> = ({
  walletAddress,
  balanceText,
  balanceSymbol,
  intentInput,
  setIntentInput,
  onSubmitText,
  isBusy,
  onOpenVault,
}) => {
  const [mode, setMode] = useState<RouteMode>('buddy');
  const [modeOpen, setModeOpen] = useState(false);
  const [deepScan, setDeepScan] = useState(false);
  const [remember, setRemember] = useState(() => localStorage.getItem('wapchat:memory-on') === '1');
  const [lastIntent, setLastIntent] = useState(() => localStorage.getItem('wapchat:last-intent') || '');
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('wapchat:memory-on', remember ? '1' : '0');
  }, [remember ]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const base = intentInput.trim();
    if (!base || isBusy) return;
    const suffix: string[] = [];
    const m = MODES.find((x) => x.id === mode);
    if (m && m.suffix) suffix.push(m.suffix);
    if (deepScan) suffix.push('with deep route scan');
    const finalText = suffix.length ? `${base}, ${suffix.join(', ')}` : base;
    setIntentInput(finalText);
    if (remember) {
      localStorage.setItem('wapchat:last-intent', finalText);
      setLastIntent(finalText);
    }
    onSubmitText(finalText);
  };

  const autoGrow = () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const bal = balanceText || '0.00';
  const counting = useCountUp(bal);
  const grouped = groupNumber(counting);

  // Flork reacts to the money situation
  const balNum = parseFloat(bal) || 0;
  const florkMood = !walletAddress || balNum <= 0 ? 'thinking' : balNum >= 1000 ? 'wow' : 'happy';
  const say = !walletAddress
    ? "psst… plug wallet, I'm hungry 🍔"
    : balNum <= 0
      ? 'so shiny… yet so empty'
      : balNum < 100
        ? 'ooo pocket money!!'
        : balNum < 1000
          ? 'LOOK AT ALL THIS!!'
          : "WHOA. WE'RE RICH!!";

  return (
    <div className="relative w-full flex flex-col items-center px-2 pt-4 md:pt-6 pb-8">
      {/* floating party orbit */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className={`absolute ${f.cls} ${f.hideMobile ? 'hidden sm:inline-block' : ''}`}
            style={{ left: f.left, top: f.top, fontSize: f.size, animationDelay: f.delay }}
          >
            {f.e}
          </span>
        ))}
      </div>
      {/* balance hero — one centered unit: Flork presents the number */}
      <div className="pop-in relative flex flex-col items-center text-center">
        <div
          key={say}
          className="chat-bubble-bot pop-in px-4 py-2 text-[13px] font-bold mb-3 max-w-[300px]"
        >
          {say}
        </div>
        <div className="flex items-center justify-center gap-0 md:gap-2">
          <FlorkPal size={128} mood={florkMood} hopKey={bal} className="shrink-0 -mr-1" />
          <div
            key={bal}
            className="balance-jelly text-[#141414] leading-none tracking-tight text-left"
            style={{ fontFamily: '"Bungee", sans-serif', fontSize: 'clamp(52px, 10vw, 108px)' }}
          >
            {grouped}
            <span className="wiggle ml-3 inline-block align-middle font-mono font-bold bg-[#CCFF00] border-[3px] border-[#141414] rounded-2xl px-3 py-1"
              style={{ fontSize: 'clamp(13px, 2.4vw, 20px)', boxShadow: '4px 4px 0 #141414', letterSpacing: '0.08em' }}>
              {balanceSymbol || 'SUI'}
            </span>
          </div>
        </div>
        <div className="mt-3 font-mono text-[11px] md:text-[12px] font-bold tracking-[0.25em] text-[#141414]/55 uppercase">
          <span className="doodle-twinkle">✨</span> AVAILABLE {grouped} · EARNING $0 <span className="doodle-twinkle" style={{ animationDelay: '1.2s' }}>✨</span>
        </div>
        <h2 className="mt-4 text-[24px] md:text-[32px] text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>
          {greeting()}, {shortName(walletAddress)}! <span className="wave-hand">👋</span>
        </h2>
        {!walletAddress && (
          <p className="mt-1 font-mono text-[11px] font-bold text-[#141414]/55 animate-pulse">★ plug your wallet to see treasure ★</p>
        )}
      </div>

      {/* big prompt card */}
      <form
        onSubmit={submit}
        className="toon-card mt-6 w-full p-3 md:p-4 pop-in"
        style={{ background: '#fff', animationDelay: '0.08s' }}
      >
        <div
          className="rounded-2xl border-[3px] transition-all bg-white px-4 py-3"
          style={{
            borderColor: focused ? '#141414' : '#141414',
            boxShadow: focused ? '0 0 0 4px #CCFF00, 4px 4px 0 #141414' : 'inset 2px 2px 0 rgba(20,20,20,0.06)',
          }}
        >
          <textarea
            ref={boxRef}
            rows={2}
            value={intentInput}
            onChange={(e) => { setIntentInput(e.target.value); autoGrow(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={isBusy}
            placeholder="Help me swap 1000 SUI to USDC, safest…"
            className="w-full bg-transparent outline-none resize-none text-[#141414] font-bold text-[17px] md:text-[19px] leading-snug placeholder:text-[#141414]/30 placeholder:font-medium disabled:opacity-60"
          />
        </div>

        {/* toolbar */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              type="button"
              onClick={() => setModeOpen((v) => !v)}
              className="toon-chip hover:!bg-[#CCFF00] transition-colors !py-2"
            >
              {MODES.find((m) => m.id === mode)?.label} ▾
            </button>
            {modeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModeOpen(false)} />
                <div className="toon-card absolute z-50 mt-2 w-[220px] p-2 !rounded-2xl pop-in" style={{ background: '#fffaf0' }}>
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMode(m.id); setModeOpen(false); }}
                      className="w-full text-left px-3 py-2.5 rounded-xl font-bold text-[14px] flex items-center justify-between hover:bg-[#CCFF00]/40 transition-colors"
                      style={mode === m.id ? { background: '#CCFF00' } : undefined}
                    >
                      {m.label}
                      <span className="font-mono text-[10px] text-[#141414]/50">{m.blurb}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDeepScan((v) => !v)}
            className="toon-chip transition-colors"
            style={deepScan ? { background: '#7DDCFF' } : undefined}
            title="Scan more pools per hop"
          >
            🔬 DEEP SCAN {deepScan ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setRemember((v) => !v)}
            className="toon-chip transition-colors"
            style={remember ? { background: '#FF90E8' } : undefined}
            title="Remember my intents on this device"
          >
            🧠 MEMORY
            <span
              className="inline-flex w-8 h-[18px] rounded-full border-2 border-[#141414] relative transition-colors"
              style={{ background: remember ? '#CCFF00' : '#fff' }}
            >
              <span
                className="absolute top-[1px] w-[12px] h-[12px] rounded-full bg-[#141414] transition-all"
                style={{ left: remember ? '14px' : '2px' }}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenVault}
            className="toon-chip hover:!bg-[#FFC900] transition-colors"
            title="Pick tokens from the toybox"
          >
            🔑 TOKENS
          </button>

          <button
            type="submit"
            disabled={isBusy || !intentInput.trim()}
            className="ml-auto w-[54px] h-[54px] rounded-2xl bg-[#141414] text-[#CCFF00] border-[3px] border-[#141414] font-black text-[24px] leading-none transition-all hover:bg-[#CCFF00] hover:text-[#141414] disabled:opacity-40 disabled:hover:bg-[#141414] disabled:hover:text-[#CCFF00]"
            style={{ boxShadow: '4px 4px 0 rgba(20,20,20,0.25)' }}
            title="Send to Buddy"
          >
            ↵
          </button>
        </div>

        {remember && lastIntent && !intentInput && (
          <button
            type="button"
            onClick={() => setIntentInput(lastIntent)}
            className="mt-2.5 w-full text-left font-mono text-[11px] font-bold text-[#141414]/60 hover:text-[#141414] truncate"
          >
            🧠 remembered: “{lastIntent}” — tap to reuse
          </button>
        )}
      </form>

      {/* buddy nudge */}
      <div className="mt-3 flex items-center gap-2 pop-in" style={{ animationDelay: '0.14s' }}>
        <BlobBuddy size={44} mood="happy" className="!animate-none" />
        <span className="chat-bubble-bot !shadow-[3px_3px_0_#141414] px-3 py-1.5 text-[12.5px] font-bold">
          type it + hit ↵ — I'll do the nerdy stuff!
        </span>
      </div>
    </div>
  );
};
