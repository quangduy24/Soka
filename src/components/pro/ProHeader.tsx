import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';
import { Shield, Terminal, ArrowUpRight, Wallet } from 'lucide-react';
import { SkullBuddy } from './SkullBuddy';
import { WalletMenu } from './WalletMenu';

interface ProHeaderProps {
  onOpenWalletModal?: () => void;
  gasPrice?: string;
}

export const ProHeader: React.FC<ProHeaderProps> = ({ onOpenWalletModal, gasPrice = '750 MIST' }) => {
  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();
  const location = useLocation();
  const isApp = location.pathname.includes('/app');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const handleConnect = () => {
    if (onOpenWalletModal) {
      onOpenWalletModal();
    } else {
      setIsWalletModalOpen(true);
    }
  };

  return (
    <header className="w-full z-40 border-b border-white/[0.06] bg-[#08080c]/80 backdrop-blur-xl sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative -my-2 hidden sm:block" title="SOKA AI">
              <SkullBuddy size={46} mood="chill" className="skull-glow" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold leading-none text-[18px] text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  SOKA
                </span>
                <span
                  className="font-semibold leading-none text-[11px] text-[#08080c] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
                  style={{ fontFamily: 'var(--font-display)', transform: 'rotate(-2deg)' }}
                >
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-mono text-white/30 tracking-wider mt-0.5">INTENT ENGINE // V2</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all border ${
                !isApp
                  ? 'text-white bg-[#6366f1]/20 border-[#6366f1]/40 font-semibold'
                  : 'text-white/50 border-transparent hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              Overview
            </Link>
            <Link
              to="/app"
              className={`px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-all border ${
                isApp
                  ? 'text-white bg-[#6366f1]/20 border-[#6366f1]/40 font-semibold'
                  : 'text-white/50 border-transparent hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Trading Terminal
            </Link>
          </nav>
        </div>

        {/* Telemetry Status Bar */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-white/40 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
          <span className="flex items-center gap-1.5">
            <span className="status-dot status-dot-green animate-pulse" />
            <span className="font-medium text-white/70">SOKA</span>
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#34d399]" />
            <span>Guardian: <strong className="text-[#34d399]">On-Chain</strong></span>
          </span>
          <span className="text-white/15">|</span>
          <span>
            Gas: <strong className="text-white/60">{gasPrice}</strong>
          </span>
        </div>

        {/* Right Actions: Wallet */}
        <div className="flex items-center gap-3">
          {currentAccount ? (
            <WalletMenu
              walletAddress={currentAccount.address}
              onDisconnect={() => dAppKit.disconnectWallet()}
            />
          ) : (
            <button
              onClick={handleConnect}
              className="glass-btn text-xs font-mono font-medium !py-2 !px-4"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          )}

          <ConnectModal
            open={isWalletModalOpen}
            // @ts-ignore
            onOpenChange={(isOpen) => setIsWalletModalOpen(isOpen)}
          />
        </div>
      </div>
    </header>
  );
};
