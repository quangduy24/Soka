import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';
import { Shield, Terminal, Wallet } from 'lucide-react';
import SokaCat from './SokaCat';
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
    if (onOpenWalletModal) onOpenWalletModal();
    else setIsWalletModalOpen(true);
  };

  return (
    <header className="w-full z-40 border-b border-white/20 bg-white/30 backdrop-blur-xl sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative -my-2 hidden sm:block">
              <SokaCat size={44} className="skull-glow" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold leading-none text-lg text-[#0f172a] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                SOKA
              </span>
              <span className="text-[10px] font-mono text-[#1a1a2e]/40 tracking-wider mt-0.5">INTENT ENGINE</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all border ${!isApp ? 'text-[#1a1a2e] bg-white/50 border-white/60 font-semibold' : 'text-[#1a1a2e]/50 border-transparent hover:text-[#1a1a2e]/70 hover:bg-white/30'}`}>
              Overview
            </Link>
            <Link to="/app" className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all border ${isApp ? 'text-[#1a1a2e] bg-white/50 border-white/60 font-semibold' : 'text-[#1a1a2e]/50 border-transparent hover:text-[#1a1a2e]/70 hover:bg-white/30'}`}>
              <Terminal className="w-3.5 h-3.5" />
              Terminal
            </Link>
          </nav>
        </div>
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-[#1a1a2e]/50 px-3 py-1.5 rounded-full border border-white/40 bg-white/30">
          <span className="flex items-center gap-1.5">
            <span className="dot dot-success animate-pulse" />
            <span className="font-medium text-[#1a1a2e]/70">SOKA</span>
          </span>
          <span className="text-[#1a1a2e]/15">|</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#10b981]" />
            <span>Guardian: <strong className="text-[#10b981]">Active</strong></span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {currentAccount ? (
            <WalletMenu walletAddress={currentAccount.address} onDisconnect={() => dAppKit.disconnectWallet()} />
          ) : (
            <button onClick={handleConnect} className="btn-ghost text-xs font-medium !py-2 !px-4">
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          )}
          <ConnectModal open={isWalletModalOpen} onOpenChange={(isOpen: boolean) => setIsWalletModalOpen(isOpen)} />
        </div>
      </div>
    </header>
  );
};
