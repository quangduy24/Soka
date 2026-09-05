import React from 'react';
import { Link } from 'react-router-dom';
import { BuddyLogo, BlobBuddy, Sticker } from '../components/toon/Toon';
import { useSwapHistory } from '../hooks/useSwapHistory';

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_STYLE: Record<string, { chip: string; label: string }> = {
  executed: { chip: 'toon-chip-neon', label: '★ SWAPPED!' },
  failed: { chip: 'toon-chip-pink', label: '✖ OOPSIE' },
  simulated: { chip: 'toon-chip-sky', label: '○ DRAFT' },
};

export const Activity: React.FC = () => {
  const { sessions, clearHistory } = useSwapHistory();

  return (
    <div className="min-h-[100dvh] w-full relative flex flex-col bg-[#C4B5FD] toon-dots">
      <div className="relative z-10 flex flex-col flex-1 max-w-[1000px] w-full mx-auto px-4 md:px-8 py-5">
        <header className="toon-card-flat flex items-center justify-between gap-3 px-4 py-2.5 !rounded-2xl">
          <Link to="/"><BuddyLogo size={32} /></Link>
          <nav className="flex gap-2 font-mono text-[10px] font-bold tracking-[0.15em]">
            <Link to="/" className="toon-chip">← HOME</Link>
            <Link to="/app" className="toon-chip toon-chip-neon">→ CHAT</Link>
            <span className="toon-chip toon-chip-pink">♥ STICKERS</span>
          </nav>
        </header>

        <div className="mt-5 flex items-end gap-4 flex-wrap">
          <div>
            <Sticker color="#CCFF00" tilt={-4}>★ STICKER BOOK</Sticker>
            <h1 className="mt-3 text-[34px] md:text-[46px] text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>
              YOUR SWAPS,<br />AS STICKERS!
            </h1>
            <p className="mt-2 font-medium text-[#141414]/70 max-w-[520px]">
              Every chat-swap on this device becomes a collectible. Stored only in your browser — nothing leaves the clubhouse.
            </p>
          </div>
          <BlobBuddy size={110} mood="happy" className="ml-auto hidden sm:block" />
        </div>

        {sessions.length === 0 ? (
          <div className="toon-card mt-6 p-10 text-center">
            <BlobBuddy size={110} mood="thinking" className="mx-auto" />
            <p className="mt-3 font-bold text-[17px]">No stickers yet!!</p>
            <p className="text-[#141414]/65 font-medium">Go chat a swap and come back with treasure.</p>
            <Link to="/app" className="toon-btn mt-5">START CHATTING →</Link>
          </div>
        ) : (
          <>
            <div className="mt-5 flex justify-end">
              <button onClick={clearHistory} className="toon-chip hover:!bg-[#ff6b6b] transition-colors">✖ CLEAR BOOK</button>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-4">
              {sessions.map((s, i) => {
                const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.simulated;
                const bg = ['#fffaf0', '#CCFF00', '#FFC900', '#7DDCFF', '#FF90E8'][i % 5];
                return (
                  <div key={s.id} className="toon-card p-5 pop-in" style={{ background: bg, transform: `rotate(${(i % 2 ? 0.6 : -0.6)}deg)` }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`toon-chip ${st.chip}`}>{st.label}</span>
                      <span className="font-mono text-[10px] font-bold text-[#141414]/55">{timeAgo(s.timestamp)}</span>
                    </div>
                    <p className="mt-2.5 font-bold text-[16px] leading-snug">{s.intent || `${s.amount} ${s.sourceToken} → ${s.destToken}`}</p>
                    <p className="font-mono text-[12px] font-bold mt-1">
                      {s.amount} {s.sourceToken} → ≈{s.estOutput} {s.destToken}
                      {s.received ? <span> ★ got {s.received}!</span> : null}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="toon-chip !text-[9px]">🛡 {s.guardianChecks?.length ?? 0} CHECKS</span>
                      {s.txHash
                        ? <span className="toon-chip !text-[9px]">#{s.txHash.slice(0, 8)}…</span>
                        : <Link to="/app" className="toon-chip toon-chip-neon !text-[9px]">→ FINISH IT</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
