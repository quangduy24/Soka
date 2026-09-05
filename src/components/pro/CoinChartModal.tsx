import React, { useEffect, useMemo, useState } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Twitter } from 'lucide-react';

/**
 * CoinChartModal — popup chart for a market token (clicked from the sidebar).
 * Fetches /api/market/coin/:symbol (CMC quotes proxy) and renders an SVG
 * area chart from the reconstructed price series.
 */

export interface CoinDetail {
  symbol: string;
  name: string;
  priceUsd: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  series: Array<{ t: number; p: number }>;
  platform?: string;
  twitter?: string;
  logo?: string;
}

interface Props {
  symbol: string;
  onClose: () => void;
  onSwap: (sym: string) => void;
}

const fmtPrice = (p: number): string =>
  p >= 1 ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${p.toPrecision(4)}`;

const fmtCompact = (n: number | null): string => {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtTime = (hoursAgo: number): string => {
  if (hoursAgo <= 0) return 'now';
  if (hoursAgo < 48) return `${Math.round(hoursAgo)}h ago`;
  return `${Math.round(hoursAgo / 24)}d ago`;
};

/** Clean platform label — hide CMC placeholder slugs. */
const platformLabel = (slug?: string): string | null => {
  if (!slug) return null;
  const s = slug.toLowerCase();
  if (s.includes('placeholder') || s.includes('unknown')) return null;
  return s.replace(/-/g, ' ');
};

/** Pure SVG area chart of the price series. */
const AreaChart: React.FC<{ series: Array<{ t: number; p: number }>; up: boolean }> = ({ series, up }) => {
  const W = 520, H = 190, PAD = 8;
  const { path, area, maxP, minP } = useMemo(() => {
    if (!series.length) return { path: '', area: '', maxP: 0, minP: 0 };
    const prices = series.map((s) => s.p);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const span = maxP - minP || 1;
    const x = (i: number) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
    const y = (p: number) => H - PAD - ((p - minP) / span) * (H - PAD * 2);
    const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.p).toFixed(1)}`);
    return {
      path: `M${pts.join(' L')}`,
      area: `M${pts.join(' L')} L${x(series.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`,
      maxP,
      minP,
    };
  }, [series]);

  const color = up ? '#1c7a36' : '#d33';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none" style={{ height: 190 }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="#141414" strokeOpacity="0.08" strokeDasharray="3 4" />
      ))}
      <path d={area} fill="url(#chartFill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {/* last price dot */}
      {series.length > 0 && (
        <circle cx={W - PAD} cy={H - PAD - ((series[series.length - 1].p - minP) / (maxP - minP || 1)) * (H - PAD * 2)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
      )}
    </svg>
  );
};

export const CoinChartModal: React.FC<Props> = ({ symbol, onClose, onSwap }) => {
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/market/coin/${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { if (!cancelled) setDetail(j.data as CoinDetail); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, retry]);

  const up = (detail?.change24h ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#141414]/55 backdrop-blur-[2px] pop-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] pro3-card flex flex-col max-h-[min(85vh,680px)] pop-in shadow-[10px_10px_0_#141414] overflow-hidden">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-[#141414] bg-[#FFC900] px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#141414] bg-white overflow-hidden">
              {detail?.logo ? (
                <img src={detail.logo} alt={symbol} className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className="font-mono text-[13px] font-black text-[#141414]">{symbol.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            <div className="leading-none min-w-0">
              <div className="truncate font-black text-[15px] text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>
                {symbol}
              </div>
              <div className="mt-0.5 truncate font-mono text-[9px] text-[#141414]/60">{detail?.name || 'Loading…'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {platformLabel(detail?.platform) && (
              <span className="rounded-md border-2 border-[#141414] bg-white px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#141414]/70">
                {platformLabel(detail?.platform)}
              </span>
            )}
            <button onClick={() => setRetry((v) => v + 1)} title="Refresh chart"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#141414] bg-white text-[#141414] transition-colors hover:bg-[#CCFF00]/40">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#141414] bg-white font-black text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#CCFF00]">
              ✕
            </button>
          </div>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-[#FFFDF4] p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <span className="flex items-center gap-2 font-mono text-[11px] font-bold text-[#141414]/60">
                <span className="w-2 h-2 rounded-full bg-[#CCFF00] border-[1.5px] border-[#141414] animate-pulse" />
                Loading chart…
              </span>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="font-mono text-[11px] font-bold text-[#a00]">Could not load chart: {error}</div>
              <button onClick={() => setRetry((v) => v + 1)}
                className="rounded-xl border-2 border-[#141414] bg-[#CCFF00] px-4 py-1.5 font-mono text-[11px] font-bold text-[#141414]">
                Try again
              </button>
            </div>
          )}

          {detail && !loading && (
            <div className="flex flex-col gap-3">
              {/* price + change + twitter */}
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-[#141414]/45">Price</div>
                  <div className="text-[30px] font-black leading-none text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>
                    {fmtPrice(detail.priceUsd)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {detail.twitter && (
                    <a
                      href={`https://twitter.com/${detail.twitter.replace(/^@/, '')}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-[#141414] bg-[#7DDCFF]/50 px-2 py-1 font-mono text-[11px] font-black text-[#141414] transition-colors hover:bg-[#7DDCFF]"
                      title={`Twitter @${detail.twitter}`}
                    >
                      𝕏 <span className="max-w-[90px] truncate">{detail.twitter}</span>
                    </a>
                  )}
                  <div className="flex items-center gap-1 rounded-lg border-2 border-[#141414] px-2 py-1 font-mono text-[12px] font-black"
                    style={{ background: up ? '#CCFF00' : '#ff6b6b', color: up ? '#141414' : '#fff' }}>
                    {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {detail.change24h != null ? `${detail.change24h >= 0 ? '+' : ''}${detail.change24h.toFixed(2)}%` : '—'}
                  </div>
                </div>
              </div>

              {/* chart */}
              <div className="rounded-2xl border-2 border-[#141414] bg-white p-2">
                <AreaChart series={detail.series} up={up} />
                <div className="flex justify-between px-1 pt-1 font-mono text-[8px] font-bold text-[#141414]/40">
                  <span>90d</span><span>30d</span><span>7d</span><span>24h</span><span>1h</span><span>now</span>
                </div>
              </div>

              {/* change buckets */}
              <div className="grid grid-cols-4 gap-2">
                {([
                  ['1H', detail.change1h], ['24H', detail.change24h], ['7D', detail.change7d], ['30D', detail.change30d],
                ] as Array<[string, number | null]>).map(([label, v]) => (
                  <div key={label} className="rounded-lg border-2 border-[#141414] bg-white px-2 py-1.5 text-center">
                    <div className="font-mono text-[7px] font-bold uppercase text-[#141414]/40">{label}</div>
                    <div className={`mt-0.5 font-mono text-[11px] font-black ${(v ?? 0) >= 0 ? 'text-[#1c7a36]' : 'text-[#d33]'}`}>
                      {v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border-2 border-[#141414] bg-white px-2.5 py-1.5">
                  <div className="font-mono text-[7px] font-bold uppercase text-[#141414]/40">Market Cap</div>
                  <div className="mt-0.5 font-mono text-[12px] font-black text-[#141414]">{fmtCompact(detail.marketCap)}</div>
                </div>
                <div className="rounded-lg border-2 border-[#141414] bg-white px-2.5 py-1.5">
                  <div className="font-mono text-[7px] font-bold uppercase text-[#141414]/40">Volume 24h</div>
                  <div className="mt-0.5 font-mono text-[12px] font-black text-[#141414]">{fmtCompact(detail.volume24h)}</div>
                </div>
              </div>

              {/* actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onSwap(symbol)}
                  className="flex-1 rounded-xl border-[3px] border-[#141414] bg-[#CCFF00] py-2.5 font-mono text-[12px] font-black text-[#141414] transition-all hover:-translate-y-0.5"
                >
                  Swap {symbol} ⚡
                </button>
                <a
                  href={`https://coinmarketcap.com/currencies/${detail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border-2 border-[#141414] bg-white px-3 py-2 font-mono text-[10px] font-bold text-[#141414]/70 hover:bg-[#CCFF00]/30 transition-colors"
                  title="View on CoinMarketCap"
                >
                  CMC <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
