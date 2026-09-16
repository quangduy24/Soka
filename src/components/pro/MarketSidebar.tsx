import React, { useCallback, useEffect, useState } from 'react';
import { CoinChartModal } from './CoinChartModal';

/**
 * MarketSidebar — playful neo-brutal market widgets for Adidahood.
 * Data: CoinMarketCap proxied through /api/market/* (backend keeps the key),
 * filtered to the Robinhood Chain (Arbitrum L2) ecosystem. Falls back to the
 * built-in demo feed when the API is unavailable.
 */

const HIDDEN_KEY = 'adidahood:hidden-market-coins';

function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function saveHidden(s: Set<string>) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

export interface MarketToken {
  sym: string;
  name: string;
  price: string;
  chg: string;
  up: boolean;
  spark: number[];
  color: string;
  mc?: string;
  age?: string;
  /** CMC logo URL — rendered as the avatar when present. */
  logo?: string;
}

/* ── Built-in demo fallback (used only when /api/market fails) ── */
const FALLBACK_MARKET = {
  movers: [
    { sym: 'ADH', name: 'Adidahood', price: '$0.0842', chg: '+4.2%', up: true, spark: [3, 3.4, 3.2, 4, 4.4, 4.1, 4.8, 5.2], color: '#CCFF00' },
    { sym: 'HOOD', name: 'Hood Dog', price: '$0.0012', chg: '+22.1%', up: true, spark: [2, 3, 4, 3.6, 5, 5.6, 6.2, 7], color: '#7DDCFF' },
    { sym: 'ARB', name: 'Arbitrum', price: '$0.62', chg: '+1.8%', up: true, spark: [4, 4.2, 4, 4.4, 4.3, 4.6, 4.5, 4.7], color: '#FFC900' },
    { sym: 'STOCK', name: 'Stock Token', price: '$3.10', chg: '-1.9%', up: false, spark: [6, 5.6, 5.8, 5.2, 5, 4.6, 4.4, 4.2], color: '#FF90E8' },
  ] as MarketToken[],
  trending: [
    { sym: 'HOOD', name: 'Hood Dog', price: '$0.0012', chg: '+22.1%', up: true, spark: [2, 3, 4, 3.6, 5, 5.6, 6.2, 7], color: '#7DDCFF' },
    { sym: 'MOMO', name: 'Momo', price: '$0.0008', chg: '+64.0%', up: true, spark: [1, 2, 2.4, 4, 5, 6, 6.4, 7], color: '#FF90E8' },
    { sym: 'ROBIN', name: 'Robin', price: '$0.042', chg: '+12.4%', up: true, spark: [3, 3.6, 4.2, 4, 4.8, 5, 5.4, 6], color: '#FFC900' },
    { sym: 'BIRD', name: 'Bluebird', price: '$0.0021', chg: '-3.3%', up: false, spark: [5, 5.2, 4.8, 4.6, 4.2, 4, 3.8, 3.6], color: '#CCFF00' },
  ] as MarketToken[],
  gems: [
    { sym: 'GEM1', name: 'Gold Nugget', age: '2h ago', price: '$0.00004', mc: '$1.2M', color: '#FFC900' },
    { sym: 'RWA', name: 'RWA Bond', age: '5h ago', price: '$1.02', mc: '$8.4M', color: '#CCFF00' },
    { sym: 'TICK', name: 'Ticker', age: '9h ago', price: '$0.003', mc: '$3.1M', color: '#7DDCFF' },
    { sym: 'PAGE', name: 'Page One', age: '1d ago', price: '$0.0009', mc: '$890K', color: '#FF90E8' },
  ] as MarketToken[],
};

/* ── Palette for letter avatars (stable per symbol) ──────────── */
const AVATAR_COLORS = ['#CCFF00', '#7DDCFF', '#FF90E8', '#FFC900', '#B8F2FF', '#D9F0C2', '#FDE1B9', '#E6D5FF'];

function colorFor(sym?: string): string {
  const s = (sym || '?').toUpperCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Deterministic little sparkline from a % change so rows keep the visual. */
function sparkFromChange(chg: string): number[] {
  const v = parseFloat(chg) || 0;
  const base = 3 + Math.min(4, Math.abs(v) / 10);
  const sign = v >= 0 ? 1 : -1;
  return Array.from({ length: 8 }, (_, i) => {
    const t = i / 7;
    return Math.max(0.5, base + sign * (2 + Math.sin(t * 5) * 1.5) * t);
  });
}

interface WidgetItem {
  sym: string;
  name: string;
  price: string;
  chg?: string;
  age?: string;
  mc?: string;
  up: boolean;
  logo?: string;
}

const Spark: React.FC<{ data: number[]; up: boolean }> = ({ data, up }) => {
  const w = 56, h = 18;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={up ? '#1c7a36' : '#d33'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** Round token avatar — CMC logo image when present, letter otherwise. */
const TokenAvatar: React.FC<{ token: MarketToken }> = ({ token }) => (
  <span className="w-6 h-6 rounded-full border-2 border-[#141414] flex items-center justify-center font-black text-[9px] shrink-0 overflow-hidden" style={{ background: token.color }}>
    {token.logo ? (
      <img src={token.logo} alt={token.sym} className="w-full h-full object-cover" loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    ) : token.sym.slice(0, 1)}
  </span>
);

const Row: React.FC<{ token: MarketToken; idx: number; onClick?: (sym: string) => void }> = ({ token, idx, onClick }) => (
  <button
    onClick={() => onClick?.(token.sym)}
    title={`Open ${token.sym} chart`}
    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#CCFF00]/30 transition-colors rounded-lg"
  >
    <span className="font-mono text-[9px] font-bold text-[#141414]/40 w-3">{idx + 1}</span>
    <TokenAvatar token={token} />
    <span className="min-w-0 flex-1">
      <span className="block font-black text-[11px] leading-tight truncate">{token.sym}</span>
      <span className="block font-mono text-[8px] text-[#141414]/45 leading-tight truncate">{token.name} · {token.price}</span>
    </span>
    <Spark data={token.spark} up={token.up} />
    <span
      className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md border-2 border-[#141414] shrink-0"
      style={{ background: token.up ? '#CCFF00' : '#ff6b6b', color: token.up ? '#141414' : '#fff' }}
    >
      {token.chg}
    </span>
  </button>
);

const GemRow: React.FC<{ token: MarketToken; onClick?: (sym: string) => void }> = ({ token, onClick }) => (
  <button onClick={() => onClick?.(token.sym)} title={`Open ${token.sym} chart`}
    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#CCFF00]/30 transition-colors rounded-lg">
    <TokenAvatar token={token} />
    <span className="min-w-0 flex-1">
      <span className="block font-black text-[11px] leading-tight truncate">{token.sym}
        <span className="ml-1 font-mono text-[7px] font-bold bg-[#141414] text-[#CCFF00] px-1 py-px rounded">NEW</span>
      </span>
      <span className="block font-mono text-[8px] text-[#141414]/45 leading-tight truncate">
        {token.name} · {token.price}
        {token.mc && <span className="ml-1 inline-flex items-center rounded border border-[#141414] bg-[#141414] px-1 font-bold text-[#FFC900]">MC {token.mc}</span>}
      </span>
    </span>
    <span className="font-mono text-[9px] font-bold text-[#141414]/55 shrink-0">{token.age}</span>
  </button>
);

const Panel: React.FC<{ color: string; title: string; children: React.ReactNode }> = ({ color, title, children }) => (
  <div className="pro3-card widget-panel overflow-hidden flex flex-col">
    <div className="px-3 py-1.5 border-b-[3px] border-[#141414] font-mono text-[9px] font-bold tracking-[0.18em] uppercase shrink-0" style={{ background: color }}>
      {title}
    </div>
    <div className="min-h-0 max-h-[168px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5 p-1.5">{children}</div>
  </div>
);

/** Map one CMC-backed item to a MarketToken row (tolerates odd API rows). */
function toRow(item: WidgetItem, fallbackChg: string): MarketToken | null {
  if (!item || typeof item.sym !== 'string' || !item.sym) return null;
  const chg = item.chg ?? fallbackChg;
  return {
    sym: item.sym,
    name: item.name || item.sym,
    price: item.price || '—',
    chg,
    up: item.up,
    spark: sparkFromChange(chg),
    color: colorFor(item.sym),
    mc: item.mc,
    age: item.age,
    logo: item.logo,
  };
}

/** Fetch a market endpoint and return items (throws → caller falls back). */
async function fetchMarket<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`market ${path} ${res.status}`);
  const json = await res.json();
  return json.data as T;
}

type MoverDto = { sym: string; name: string; price: string; chg: string; up: boolean; mc?: string; logo?: string };
type GemDto = { sym: string; name: string; price: string; age: string; mc?: string; logo?: string };

/** Market widgets are hidden until a real /api/market backend exists. */
export const MARKET_ENABLED =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_MARKET === 'true') || false;

export const MarketSidebar: React.FC<{ onPick: (sym: string) => void }> = ({ onPick }) => {
  const [movers, setMovers] = useState<MarketToken[]>(FALLBACK_MARKET.movers);
  const [trending, setTrending] = useState<MarketToken[]>(FALLBACK_MARKET.trending);
  const [gems, setGems] = useState<MarketToken[]>(FALLBACK_MARKET.gems);
  const [live, setLive] = useState(false);
  const [chartSym, setChartSym] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, t, g] = await Promise.all([
        fetchMarket<MoverDto[]>('/api/market/movers'),
        fetchMarket<MoverDto[]>('/api/market/trending'),
        fetchMarket<GemDto[]>('/api/market/gems'),
      ]);
      if (m.length) setMovers(m.map((x) => toRow(x, '+0.0%')).filter((r): r is MarketToken => !!r));
      if (t.length) setTrending(t.map((x) => toRow(x, '+0.0%')).filter((r): r is MarketToken => !!r));
      if (g.length) setGems(g.map((x) => toRow({ ...x, up: true, chg: undefined }, '+0.0%')).filter((r): r is MarketToken => !!r));
      setLive(true);
    } catch {
      // API unavailable — keep the demo fallback rows.
      setLive(false);
    }
  }, []);

  useEffect(() => {
    if (!MARKET_ENABLED) return;
    load();
    const iv = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(iv);
  }, [load]);

  // Hidden until a real /api/market backend exists (no demo data shown).
  if (!MARKET_ENABLED) return null;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2">
        <span
          className="inline-block px-3 py-1 text-[13px] bg-[#CCFF00] border-[3px] border-[#141414] rounded-full font-bold"
          style={{ fontFamily: '"Bungee", sans-serif', boxShadow: '3px 3px 0 #141414', transform: 'rotate(-1.5deg)' }}
        >
          ★ MARKET
        </span>
        <span className="flex items-center gap-1 font-mono text-[9px] font-bold tracking-[0.15em] text-[#141414]/50 uppercase">
          Robinhood Chain
          <span className={`ml-0.5 inline-block w-1.5 h-1.5 rounded-full ${live ? 'bg-[#2fbf4f]' : 'bg-[#141414]/25'}`} />
        </span>
      </div>

      <Panel color="#CCFF00" title="⚡ Top Movers · 24h">
        {movers.length === 0
          ? <div className="px-2 py-3 font-mono text-[9px] text-[#141414]/40 text-center">No movers right now</div>
          : movers.map((t, i) => <Row key={t.sym + i} token={t} idx={i} onClick={() => setChartSym(t.sym)} />)}
      </Panel>

      <Panel color="#FF90E8" title="🔥 Top Trending Memes">
        {trending.length === 0
          ? <div className="px-2 py-3 font-mono text-[9px] text-[#141414]/40 text-center">No trending tokens right now</div>
          : trending.map((t, i) => <Row key={t.sym + i} token={t} idx={i} onClick={() => setChartSym(t.sym)} />)}
      </Panel>

      <Panel color="#7DDCFF" title="💎 Newly Listed Gems">
        {gems.length === 0
          ? <div className="px-2 py-3 font-mono text-[9px] text-[#141414]/40 text-center">No new listings right now</div>
          : gems.map((t, i) => <GemRow key={t.sym + i} token={t} onClick={() => setChartSym(t.sym)} />)}
      </Panel>

      {/* popup chart when a token is clicked */}
      {chartSym && (
        <CoinChartModal
          symbol={chartSym}
          onClose={() => setChartSym(null)}
          onSwap={(sym) => { setChartSym(null); onPick(sym); }}
        />
      )}
    </div>
  );
};
