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
    <header className="w-full z-40 border-b border-[#00f0ff]/20 bg-[#0d0d14]/95 backdrop-blur-md sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative -my-2 hidden sm:block" title="SOKA AI">
              <SkullBuddy size={46} mood="chill" className="skull-glow" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black leading-none text-[18px] text-white tracking-tight text-glow-cyan" style={{ fontFamily: 'var(--font-display)' }}>
                  SOKA
                </span>
                <span
                  className="font-black leading-none text-[12px] text-[#0a0a0f] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#00f0ff] to-[#7b2fff] border border-[#00f0ff]/50"
                  style={{ fontFamily: 'var(--font-display)', transform: 'rotate(-2deg)' }}
                >
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#00f0ff]/50 tracking-wider mt-0.5">INTENT ENGINE // V2</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all border ${
                !isApp
                  ? 'text-[#0a0a0f] bg-[#00f0ff] border-[#00f0ff] font-bold neon-cyan'
                  : 'text-[#a8f0ff]/60 border-transparent hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 hover:border-[#00f0ff]/30'
              }`}
            >
              Overview
            </Link>
            <Link
              to="/app"
              className={`px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-all border ${
                isApp
                  ? 'text-[#0a0a0f] bg-[#00f0ff] border-[#00f0ff] font-bold neon-cyan'
                  : 'text-[#a8f0ff]/60 border-transparent hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 hover:border-[#00f0ff]/30'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Trading Terminal
            </Link>
          </nav>
        </div>

        {/* Telemetry Status Bar */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-[#a8f0ff]/60 px-3 py-1.5 rounded-full border border-[#00f0ff]/20 bg-[#0d0d14]/80">
          <span className="flex items-center gap-1.5">
            <span className="cyber-dot cyber-dot-green animate-pulse" />
            <span className="font-bold text-[#00f0ff]">SOKA</span>
          </span>
          <span className="text-[#00f0ff]/20">|</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#39ff14]" />
            <span>Guardian: <strong className="text-[#39ff14]">100% On-Chain</strong></span>
          </span>
          <span className="text-[#00f0ff]/20">|</span>
          <span>
            Gas: <strong className="text-[#00f0ff]">{gasPrice}</strong>
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
              className="cyber-btn text-xs font-mono font-bold !py-2 !px-4"
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
