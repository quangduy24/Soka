import React from 'react';

/** Buddy's Market Corner — demo feed of Sui meme action.
 *  Tap any token to start chatting a swap for it. */

interface TokenRow {
  sym: string;
  name: string;
  price: string;
  chg: string;
  up: boolean;
  spark: number[];
  color: string;
}

export const TRENDING: TokenRow[] = [  { sym: 'HIPPO', name: 'sudeng', price: '$0.0042', chg: '+18.4%', up: true, spark: [3, 4, 3.5, 5, 4.6, 6, 5.4, 7], color: '#FF90E8' },
  { sym: 'BLUB', name: 'BLUB', price: '$0.00031', chg: '+12.1%', up: true, spark: [4, 3.4, 5, 4.4, 5.6, 5.2, 6.4, 7], color: '#7DDCFF' },
  { sym: 'FUD', name: 'FUD', price: '$0.0112', chg: '+8.9%', up: true, spark: [5, 4.6, 5.4, 5, 6, 5.6, 6.6, 7], color: '#FFC900' },
  { sym: 'LOFI', name: 'LOFI', price: '$0.0214', chg: '-6.3%', up: false, spark: [7, 6.4, 6.8, 5.6, 6, 4.8, 5.2, 4], color: '#C4B5FD' },
];

const NEW_LISTINGS: { sym: string; name: string; age: string; price: string; color: string }[] = [
  { sym: 'MOON', name: 'Moonbag', age: '2h ago', price: '$0.00012', color: '#CCFF00' },
  { sym: 'AAA', name: 'aaa cat', age: '7h ago', price: '$0.0031', color: '#FF90E8' },
  { sym: 'BUGCAT', name: 'BugCat', age: '13h ago', price: '$0.00042', color: '#7DDCFF' },
  { sym: 'HOPDOG', name: 'HOPDOG', age: '1d ago', price: '$0.00087', color: '#FFC900' },
];

const NEWS: { tag: string; tagColor: string; text: string; time: string }[] = [
  { tag: 'PUMP', tagColor: '#CCFF00', text: 'HIPPO hops 18% as Sui memes wake up', time: '12m' },
  { tag: 'NEW', tagColor: '#7DDCFF', text: 'MOON lands in the toybox — fresh listing', time: '2h' },
  { tag: 'VOL', tagColor: '#FFC900', text: 'DeepBook volume sniffs an all-time high', time: '5h' },
  { tag: 'TIP', tagColor: '#FF90E8', text: 'Buddy says: check the 7 checks before aping', time: '1d' },
];

const Spark: React.FC<{ data: number[]; up: boolean }> = ({ data, up }) => {
  const w = 64;
  const h = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={up ? '#2f9e44' : '#e03131'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const Panel: React.FC<{ color: string; title: string; children: React.ReactNode }> = ({ color, title, children }) => (
  <div className="toon-card overflow-hidden flex flex-col" style={{ background: '#fffaf0' }}>
    <div
      className="px-4 py-2.5 border-b-[3px] border-[#141414] font-mono text-[11px] font-bold tracking-[0.2em]"
      style={{ background: color }}
    >
      {title}
    </div>
    <div className="flex flex-col">{children}</div>
  </div>
);

export const MarketBoard: React.FC<{ onPickToken: (sym: string) => void }> = ({ onPickToken }) => (
  <div className="mt-6 w-full pop-in" style={{ animationDelay: '0.2s' }}>
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <span
        className="inline-block px-4 py-1.5 text-[15px] bg-[#FF90E8] border-[3px] border-[#141414] rounded-full font-bold"
        style={{ fontFamily: '"Bungee", sans-serif', boxShadow: '3px 3px 0 #141414', transform: 'rotate(-1.5deg)' }}
      >
        ★ BUDDY'S MARKET CORNER
      </span>
      <span className="toon-chip toon-chip-sunny !text-[9px]">DEMO FEED — TAP A COIN TO CHAT IT!</span>
    </div>

    <div className="grid md:grid-cols-2 gap-3">
      <Panel color="#FF90E8" title="🔥 TOP TRENDING MEMES">
        {TRENDING.map((t, i) => (
          <button
            key={t.sym}
            onClick={() => onPickToken(t.sym)}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#CCFF00]/25 transition-colors border-b-2 border-[#141414]/10 last:border-b-0"
            title={`Chat a ${t.sym} swap`}
          >
            <span className="font-mono text-[11px] font-bold text-[#141414]/40 w-4">{i + 1}</span>
            <span
              className="w-9 h-9 rounded-full border-[2.5px] border-[#141414] flex items-center justify-center font-black text-[13px] shrink-0"
              style={{ background: t.color }}
            >
              {t.sym.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block font-black text-[14px] leading-tight">{t.sym}</span>
              <span className="block font-mono text-[10px] text-[#141414]/50 leading-tight">{t.name} · {t.price}</span>
            </span>
            <span className="ml-auto flex items-center gap-2 shrink-0">
              <Spark data={t.spark} up={t.up} />
              <span
                className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg border-2 border-[#141414]"
                style={{ background: t.up ? '#CCFF00' : '#ff6b6b', color: t.up ? '#141414' : '#fff' }}
              >
                {t.chg}
              </span>
            </span>
          </button>
        ))}
      </Panel>

      <Panel color="#7DDCFF" title="🆕 NEWLY LISTED TOYS">
        {NEW_LISTINGS.map((t) => (
          <button
            key={t.sym}
            onClick={() => onPickToken(t.sym)}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#CCFF00]/25 transition-colors border-b-2 border-[#141414]/10 last:border-b-0"
            title={`Chat a ${t.sym} swap`}
          >
            <span
              className="w-9 h-9 rounded-full border-[2.5px] border-[#141414] flex items-center justify-center font-black text-[13px] shrink-0"
              style={{ background: t.color }}
            >
              {t.sym.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="font-black text-[14px] leading-tight flex items-center gap-1.5">
                {t.sym}
                <span className="font-mono text-[8px] font-bold bg-[#141414] text-[#CCFF00] px-1.5 py-0.5 rounded-md">NEW!</span>
              </span>
              <span className="block font-mono text-[10px] text-[#141414]/50 leading-tight">{t.name} · spotted {t.age}</span>
            </span>
            <span className="ml-auto font-mono text-[12px] font-bold shrink-0">{t.price}</span>
          </button>
        ))}
      </Panel>

      <Panel color="#CCFF00" title="⚡ 24H MOVERS">
        <div className="grid grid-cols-2 gap-2.5 p-3.5">
          <div className="rounded-2xl border-[3px] border-[#141414] bg-[#CCFF00] p-3" style={{ boxShadow: '3px 3px 0 #141414' }}>
            <div className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#141414]/60">TOP GAINER</div>
            <button onClick={() => onPickToken('HOPDOG')} className="font-black text-[20px] hover:underline" title="Chat a HOPDOG swap">HOPDOG</button>
            <div className="font-mono text-[15px] font-bold">+42.7%</div>
          </div>
          <div className="rounded-2xl border-[3px] border-[#141414] bg-white p-3" style={{ boxShadow: '3px 3px 0 #141414' }}>
            <div className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#141414]/60">TOP LOSER</div>
            <button onClick={() => onPickToken('FROG')} className="font-black text-[20px] hover:underline" title="Chat a FROG swap">FROG</button>
            <div className="font-mono text-[15px] font-bold text-[#c81e1e]">-9.8%</div>
          </div>
        </div>
        <div className="px-4 pb-3.5 font-mono text-[10px] font-bold text-[#141414]/50">
          SUI MEMES ± WILD TODAY — BUDDY CHECKS SLIPPAGE SO YOU DON'T HAVE TO ♥
        </div>
      </Panel>

      <Panel color="#FFC900" title="📰 MARKET MEWS">
        {NEWS.map((n) => (
          <div
            key={n.text}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b-2 border-[#141414]/10 last:border-b-0"
          >
            <span
              className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-md border-2 border-[#141414] shrink-0"
              style={{ background: n.tagColor }}
            >
              {n.tag}
            </span>
            <span className="text-[13px] font-bold leading-snug">{n.text}</span>
            <span className="ml-auto font-mono text-[10px] text-[#141414]/45 shrink-0">{n.time}</span>
          </div>
        ))}
      </Panel>
    </div>
  </div>
);

/** Compact sticky ticker — the market corner distilled to one persistent strip.
 *  Lives pinned at the top of the thread so prices never scroll away. */
export const MarketTicker: React.FC<{ onPick: (sym: string) => void }> = ({ onPick }) => (
  <div
    className="flex items-center gap-2 rounded-2xl border-[3px] border-[#141414] bg-[#FFF4E0]/95 px-2.5 py-1.5 overflow-x-auto scrollbar-none"
    style={{ boxShadow: '4px 4px 0 #141414', backdropFilter: 'blur(6px)' }}
  >
    <span className="font-mono text-[9px] font-bold tracking-[0.15em] text-[#141414]/55 shrink-0 pl-1">
      ★ DEMO
    </span>
    {TRENDING.map((t) => (
      <button
        key={t.sym}
        onClick={() => onPick(t.sym)}
        className="flex items-center gap-1.5 rounded-full border-2 border-[#141414] bg-white pl-1 pr-2 py-0.5 shrink-0 hover:-translate-y-0.5 transition-transform"
        title={`Chat a ${t.sym} swap`}
      >
        <span
          className="w-5 h-5 rounded-full border-2 border-[#141414] flex items-center justify-center font-black text-[9px]"
          style={{ background: t.color }}
        >
          {t.sym.slice(0, 1)}
        </span>
        <span className="font-black text-[11px]">{t.sym}</span>
        <span className="font-mono text-[10px] text-[#141414]/55">{t.price}</span>
        <span
          className="font-mono text-[9px] font-bold px-1.5 py-px rounded-md border border-[#141414]"
          style={{ background: t.up ? '#CCFF00' : '#ff6b6b', color: t.up ? '#141414' : '#fff' }}
        >
          {t.chg}
        </span>
      </button>
    ))}
  </div>
);

/** Horizontal rail edition — the same market widgets squeezed into strips
 *  that fit a narrow side column. Tap a coin to chat a swap for it. */
export const MarketRail: React.FC<{ onPickToken: (sym: string) => void }> = ({ onPickToken }) => (
  <div className="flex flex-col gap-3 shrink-0">
    <div
      className="inline-block self-start px-3.5 py-1 text-[13px] bg-[#FF90E8] border-[3px] border-[#141414] rounded-full font-bold"
      style={{ fontFamily: '"Bungee", sans-serif', boxShadow: '3px 3px 0 #141414', transform: 'rotate(-1.5deg)' }}
    >
      ★ MARKET
    </div>

    {/* trending strip */}
    <div>
      <div className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/55 mb-1.5">🔥 TRENDING →</div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1.5 -mx-0.5 px-0.5">
        {TRENDING.map((t) => (
          <button
            key={t.sym}
            onClick={() => onPickToken(t.sym)}
            className="shrink-0 w-[118px] rounded-2xl border-[2.5px] border-[#141414] bg-white p-2 text-left hover:-translate-y-0.5 transition-transform"
            style={{ boxShadow: '3px 3px 0 #141414' }}
            title={`Chat a ${t.sym} swap`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-6 h-6 rounded-full border-2 border-[#141414] flex items-center justify-center font-black text-[10px] shrink-0"
                style={{ background: t.color }}
              >
                {t.sym.slice(0, 1)}
              </span>
              <span className="font-black text-[12px]">{t.sym}</span>
            </span>
            <span className="block font-mono text-[10px] text-[#141414]/55 mt-1">{t.price}</span>
            <span
              className="inline-block font-mono text-[9px] font-bold px-1.5 py-px rounded-md border-2 border-[#141414] mt-1"
              style={{ background: t.up ? '#CCFF00' : '#ff6b6b', color: t.up ? '#141414' : '#fff' }}
            >
              {t.chg}
            </span>
          </button>
        ))}
      </div>
    </div>

    {/* newly listed strip */}
    <div>
      <div className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/55 mb-1.5">🆕 FRESH TOYS →</div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1.5 -mx-0.5 px-0.5">
        {NEW_LISTINGS.map((t) => (
          <button
            key={t.sym}
            onClick={() => onPickToken(t.sym)}
            className="shrink-0 w-[132px] rounded-2xl border-[2.5px] border-[#141414] bg-white p-2 text-left hover:-translate-y-0.5 transition-transform"
            style={{ boxShadow: '3px 3px 0 #141414' }}
            title={`Chat a ${t.sym} swap`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-6 h-6 rounded-full border-2 border-[#141414] flex items-center justify-center font-black text-[10px] shrink-0"
                style={{ background: t.color }}
              >
                {t.sym.slice(0, 1)}
              </span>
              <span className="font-black text-[12px]">{t.sym}</span>
              <span className="font-mono text-[7px] font-bold bg-[#141414] text-[#CCFF00] px-1 py-px rounded">NEW!</span>
            </span>
            <span className="block font-mono text-[10px] text-[#141414]/55 mt-1">{t.price} · {t.age}</span>
          </button>
        ))}
      </div>
    </div>

    {/* movers duo */}
    <div>
      <div className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/55 mb-1.5">⚡ 24H MOVERS</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPickToken('HOPDOG')}
          className="rounded-2xl border-[2.5px] border-[#141414] bg-[#CCFF00] p-2 text-left hover:-translate-y-0.5 transition-transform"
          style={{ boxShadow: '3px 3px 0 #141414' }}
          title="Chat a HOPDOG swap"
        >
          <div className="font-mono text-[8px] font-bold text-[#141414]/60">▲ GAINER</div>
          <div className="font-black text-[14px]">HOPDOG</div>
          <div className="font-mono text-[12px] font-bold">+42.7%</div>
        </button>
        <button
          onClick={() => onPickToken('FROG')}
          className="rounded-2xl border-[2.5px] border-[#141414] bg-white p-2 text-left hover:-translate-y-0.5 transition-transform"
          style={{ boxShadow: '3px 3px 0 #141414' }}
          title="Chat a FROG swap"
        >
          <div className="font-mono text-[8px] font-bold text-[#141414]/60">▼ LOSER</div>
          <div className="font-black text-[14px]">FROG</div>
          <div className="font-mono text-[12px] font-bold text-[#c81e1e]">-9.8%</div>
        </button>
      </div>
    </div>

    {/* news strip */}
    <div>
      <div className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/55 mb-1.5">📰 MEWS →</div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1.5 -mx-0.5 px-0.5">
        {NEWS.map((n) => (
          <div
            key={n.text}
            className="shrink-0 w-[210px] rounded-2xl border-[2.5px] border-[#141414] bg-white p-2.5"
            style={{ boxShadow: '3px 3px 0 #141414' }}
          >
            <span
              className="font-mono text-[8px] font-bold px-1.5 py-px rounded border-2 border-[#141414]"
              style={{ background: n.tagColor }}
            >
              {n.tag}
            </span>
            <p className="text-[12px] font-bold leading-snug mt-1.5">{n.text}</p>
            <p className="font-mono text-[9px] text-[#141414]/45 mt-1">{n.time} ago</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
