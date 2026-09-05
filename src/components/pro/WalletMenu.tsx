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

/** Letter avatar with a stable pastel from the symbol. */
function Avatar({ sym }: { sym: string }) {
  const palette = ['#CCFF00', '#7DDCFF', '#FF90E8', '#FFC900', '#B8F2FF', '#D9F0C2', '#FDE1B9', '#E6D5FF'];
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#141414] font-mono text-[8px] font-black text-[#141414]"
      style={{ background: palette[h % palette.length] }}
    >
      {sym.slice(0, 2)}
    </span>
  );
}

/**
 * Dropdown attached under the wallet pill in the header. Mirrors the wallet
 * extension popup: "YOUR BALANCES" + token rows + hide/show + disconnect.
 */
export const WalletMenu: React.FC<WalletMenuProps> = ({ walletAddress, onDisconnect }) => {
  const client = useCurrentClient();
  const [hidden, toggleHidden] = useHiddenPref();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // close on outside click
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
      {/* wallet pill — click toggles dropdown */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border-2 border-[#141414] px-3 py-1.5 font-mono text-xs text-[#141414] shadow-[2px_2px_0_#141414] transition-colors ${
          open ? 'bg-[#CCFF00]' : 'bg-white hover:bg-[#CCFF00]/40'
        }`}
        title="Wallet balances"
      >
        <span className="pro3-dot pro3-dot-lime" />
        <span>{addr}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* dropdown */}
      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-[70] flex max-h-[min(70vh,480px)] w-[320px] flex-col overflow-hidden rounded-2xl border-[3px] border-[#141414] bg-[#FFFDF4] shadow-[6px_6px_0_#141414] pop-in">
            {/* header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b-[3px] border-[#141414] bg-[#FFC900] px-3 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#141414]">
                <Wallet className="h-3 w-3" /> Your Balances
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleHidden}
                  title={hidden ? 'Show balances' : 'Hide balances'}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#141414] bg-white text-[#141414]/70 transition-colors hover:bg-[#CCFF00]/40"
                >
                  {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => refetch()}
                  title="Refresh"
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#141414] bg-white text-[#141414]/70 transition-colors hover:bg-[#CCFF00]/40"
                >
                  <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* total — big & bold */}
            <div className="flex shrink-0 flex-col gap-1 border-b-[3px] border-[#141414] bg-[#141414] px-4 py-3">
              <span className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-[#CCFF00]/70">
                <Wallet className="h-3 w-3" /> Est. Total Value
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[#CCFF00] tracking-tight"
                  style={{ fontFamily: '"Bungee", sans-serif', fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1 }}
                >
                  {mask(totalUsd > 0 ? `$${fmt(totalUsd, 2)}` : '—')}
                </span>
                <span className="font-mono text-[9px] font-bold text-white/60">
                  {balances?.length ?? 0} asset{(balances?.length ?? 0) === 1 ? '' : 's'}
                </span>
              </span>
            </div>

            {/* token rows */}
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-[#FFFDF4] px-1.5 py-1.5">
              {!balances || balances.length === 0 ? (
                <div className="px-3 py-6 text-center font-mono text-[10px] text-[#141414]/45">
                  {isFetching ? 'Loading balances…' : 'No spendable coins'}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {balances.map((t) => (
                    <div
                      key={t.coinType}
                      className="flex items-center gap-2 rounded-xl border-2 border-transparent px-1.5 py-1.5 transition-colors hover:border-[#2b7a45] hover:bg-[#d9f2c9]/60"
                    >
                      <Avatar sym={t.sym} />
                      <div className="min-w-0 flex-1 leading-none">
                        <div className="truncate font-mono text-[11px] font-black text-[#141414]">{t.sym}</div>
                        <div className="mt-0.5 truncate font-mono text-[7.5px] text-[#141414]/40">{t.coinType.split('::').pop()}</div>
                      </div>
                      <div className="shrink-0 text-right leading-none">
                        <div className="font-mono text-[11px] font-black text-[#141414]">{mask(fmt(t.human))}</div>
                        <div className="mt-0.5 font-mono text-[8px] text-[#141414]/45">
                          {t.usd !== undefined ? `$${fmt(t.usd, 2)}` : t.sym}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* disconnect */}
            <button
              onClick={onDisconnect}
              className="flex shrink-0 items-center justify-center gap-1.5 border-t-[3px] border-[#141414] bg-white py-2 font-mono text-[10px] font-bold text-[#d33] transition-colors hover:bg-[#ff6b6b]/15"
            >
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
};
