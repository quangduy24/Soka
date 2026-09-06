import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { RefreshCw, Eye, EyeOff, Wallet, LogOut, ChevronDown } from 'lucide-react';
import { fetchWalletTokens, fmt, useHiddenPref } from './walletUtils';
import type { WalletToken } from './walletUtils';

interface WalletMenuProps {
  walletAddress: string;
  onDisconnect: () => void;
}

function Avatar({ sym }: { sym: string }) {
  const palette = ['#F05391', '#BE8CC2', '#FF90E8', '#FFC900', '#A78BFA', '#F8A0C0', '#D9F0C2', '#E6D5FF'];
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 font-mono text-[8px] font-bold text-white" style={{ background: palette[h % palette.length] }}>
      {sym.slice(0, 2)}
    </span>
  );
}

export const WalletMenu: React.FC<WalletMenuProps> = ({ walletAddress, onDisconnect }) => {
  const client = useCurrentClient();
  const [hidden, toggleHidden] = useHiddenPref();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const { data: balances, isFetching, refetch } = useQuery({
    queryKey: ['wallet-menu', walletAddress],
    queryFn: async () => fetchWalletTokens(client, walletAddress),
    enabled: open,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const totalUsd = (balances || []).reduce((sum, t) => sum + (t.usd ?? 0), 0);
  const mask = (v: string) => (hidden ? '••••' : v);
  const addr = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border border-white/40 px-3 py-1.5 font-mono text-xs text-[#0f172a] backdrop-blur-sm transition-all ${open ? 'bg-white/40' : 'bg-white/20 hover:bg-white/30'}`}
        title="Wallet balances"
      >
        <span className="dot dot-accent" />
        <span>{addr}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-[70] flex max-h-[min(70vh,480px)] w-[320px] flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/60 shadow-[0_20px_60px_-16px_rgba(0,0,0,0.2),0_8px_24px_-8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl pop-in">
            {/* header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/20 bg-white/20 px-3 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#0f172a]/60">
                <Wallet className="h-3 w-3" /> Your Balances
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleHidden} title={hidden ? 'Show balances' : 'Hide balances'} className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/20 text-[#0f172a]/60 transition-colors hover:bg-white/40">
                  {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button onClick={() => refetch()} title="Refresh" className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/20 text-[#0f172a]/60 transition-colors hover:bg-white/40">
                  <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* total value - pastel with solid background */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-[#F05391]/20 bg-[#F8E8EE] px-4 py-4">
              <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#F05391]" style={{ fontFamily: 'var(--font-body)' }}>
                <Wallet className="h-3.5 w-3.5" /> Est. Total Value
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[#1a1a2e] tracking-tight" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 2.8vw, 34px)', lineHeight: 1, fontWeight: 700 }}>
                  {mask(totalUsd > 0 ? `$${fmt(totalUsd, 2)}` : '—')}
                </span>
                <span className="rounded-full bg-[#F8C8DC] px-2.5 py-1 font-mono text-[9px] font-bold text-[#C2185B]" style={{ fontFamily: 'var(--font-body)' }}>
                  {balances?.length ?? 0} asset{(balances?.length ?? 0) === 1 ? '' : 's'}
                </span>
              </span>
            </div>

            {/* token rows */}
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-white/10 px-1.5 py-1.5">
              {!balances || balances.length === 0 ? (
                <div className="px-3 py-6 text-center font-mono text-[10px] text-[#0f172a]/40">
                  {isFetching ? 'Loading balances…' : 'No spendable coins'}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {balances.map((t) => (
                    <div key={t.coinType} className="flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1.5 transition-colors hover:border-[#F05391]/20 hover:bg-white/20">
                      <Avatar sym={t.sym} />
                      <div className="min-w-0 flex-1 leading-none">
                        <div className="truncate font-mono text-[11px] font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-body)' }}>{t.sym}</div>
                        <div className="mt-0.5 truncate font-mono text-[7.5px] text-[#0f172a]/40">{t.coinType.split('::').pop()}</div>
                      </div>
                      <div className="shrink-0 text-right leading-none">
                        <div className="font-mono text-[11px] font-bold text-[#0f172a]">{mask(fmt(t.human))}</div>
                        <div className="mt-0.5 font-mono text-[8px] text-[#0f172a]/40">
                          {t.usd !== undefined ? `$${fmt(t.usd, 2)}` : t.sym}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* disconnect */}
            <button onClick={onDisconnect} className="flex shrink-0 items-center justify-center gap-1.5 border-t border-white/20 bg-white/10 py-2 font-mono text-[10px] font-bold text-[#ef4444] transition-colors hover:bg-[#ef4444]/10">
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
};
