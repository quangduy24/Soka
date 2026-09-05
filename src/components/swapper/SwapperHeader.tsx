import React, { useRef, useState, useEffect } from 'react';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import cetusTokens from '../../cetus-tokens.json';

interface SwapperHeaderProps {
  walletAddress: string | null;
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  disconnect: () => void;
  historyCount?: number;
  onOpenHistory?: () => void;
}

export const SwapperHeader: React.FC<SwapperHeaderProps> = ({
  walletAddress,
  isWalletModalOpen,
  setIsWalletModalOpen,
  disconnect,
  historyCount = 0,
  onOpenHistory
}) => {
  const modalRef = useRef<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const client = useCurrentClient();

  const { data: balances, isPending } = useQuery({
    queryKey: ['wallet-balances', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const res: any = await client.listBalances({ owner: walletAddress });
      const balancesList = Array.isArray(res) ? res : (res.balances || res.data || []);
      return balancesList.map((b: any) => {
        const tokenInfo = cetusTokens.find((t: any) => t.coinType === b.coinType);
        const decimals = tokenInfo?.decimals || 9;
        const symbol = tokenInfo?.symbol || b.coinType.split('::').pop() || 'UNKNOWN';
        const rawBalance = b.balance || b.totalBalance || '0';
        const humanBalance = Number(rawBalance) / Math.pow(10, decimals);
        return {
          ...b,
          symbol,
          humanBalance,
          logoUrl: tokenInfo?.logoUrl
        };
      }).filter((b: any) => b.humanBalance > 0).sort((a: any, b: any) => b.humanBalance - a.humanBalance);
    },
    enabled: !!walletAddress && isMenuOpen,
    refetchInterval: 10000
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex justify-between items-center gap-3 mb-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="wiggle w-11 h-11 inline-flex items-center justify-center shrink-0"
          style={{ background: '#CCFF00', border: '3px solid #141414', borderRadius: 14, boxShadow: '4px 4px 0 #141414' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M13 2 4.5 13.5H11L10 22 19.5 10H13L13 2Z" fill="#141414" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[19px] leading-none truncate" style={{ fontFamily: '"Bungee", sans-serif' }}>BUDDY CHAT</span>
          <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-[0.18em] text-[#141414]/60">
            <span className="sync-dot" /> SUI ★ ONLINE
          </span>
        </span>
      </div>
      <div className="flex gap-2.5 items-center">
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="relative w-11 h-11 rounded-full bg-[#FFC900] border-[3px] border-[#141414] flex items-center justify-center transition-all hover:bg-[#FF90E8]"
            style={{ boxShadow: '3px 3px 0 #141414' }}
            title="Sticker log"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#141414] text-[#CCFF00] text-[10px] font-mono font-bold flex items-center justify-center pointer-events-none">
                {historyCount > 9 ? '9+' : historyCount}
              </span>
            )}
          </button>
        )}
        {!walletAddress ? (
          <>
            <button onClick={() => setIsWalletModalOpen(true)} className="toon-btn !py-2.5 !px-5 text-[14px]">
              🔌 PLUG WALLET!
            </button>
            <ConnectModal
              open={isWalletModalOpen}
              // @ts-ignore
              onOpenChange={(isOpen) => setIsWalletModalOpen(isOpen)}
            />
          </>
        ) : (
          <div className="flex items-center gap-2.5 relative" ref={modalRef}>
            <span className="toon-chip toon-chip-neon hidden sm:inline-flex"><span className="sync-dot" /> SUI ★ LIVE</span>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="toon-btn !py-2 !px-4 font-mono !text-[12px]"
            >
              {walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)}
              <span className="material-symbols-outlined text-[16px]">{isMenuOpen ? 'expand_less' : 'expand_more'}</span>
            </button>

            {isMenuOpen && (
              <div className="toon-card absolute top-[120%] right-0 p-2 w-[240px] z-50 flex flex-col gap-1 !rounded-2xl" style={{ background: '#fffaf0' }}>
                <div className="px-3 py-2">
                  <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#141414]/55 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                    TREASURE CHEST
                  </div>
                  {isPending ? (
                    <div className="flex items-center justify-center py-4 text-[#141414]/50 text-[11px] font-mono">Loading...</div>
                  ) : balances?.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-[#141414]/50 text-[11px] font-mono">No tokens</div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                      {balances?.map((b) => (
                        <div key={b.coinType} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {b.logoUrl ? (
                              <img src={b.logoUrl} alt={b.symbol} className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[#CCFF00]/10 flex items-center justify-center text-[8px] font-bold text-[#141414] shrink-0">
                                {b.symbol.slice(0, 2)}
                              </div>
                            )}
                            <span className="text-[#141414] font-bold text-[12px]">{b.symbol}</span>
                          </div>
                          <span className="text-[#141414]/70 font-mono text-[11px]">
                            {b.humanBalance < 0.001 ? '<0.001' : b.humanBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-full h-[3px] bg-[#141414]/10 rounded-full my-1"></div>
                <button
                  className="w-full text-left px-4 py-2.5 text-[13px] font-bold text-[#c81e1e] hover:bg-[#ff6b6b]/20 rounded-xl transition-colors flex items-center gap-2"
                  onClick={() => {
                    setIsMenuOpen(false);
                    disconnect();
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  UNPLUG ✖
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
