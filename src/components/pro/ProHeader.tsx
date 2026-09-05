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
    <header className="w-full z-40 border-b-[3px] border-[#141414] bg-[#FFF4E0] sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative -my-2 hidden sm:block" title="Skull Buddy says hi">
              <SkullBuddy size={46} mood="chill" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                {/* Wordmark logo — playful split: ADIDA in ink + HOOD in lime slab */}
                <span className="font-black leading-none text-[17px] text-[#141414] tracking-tight" style={{ fontFamily: '"Bungee", sans-serif' }}>
                  ADIDA
                </span>
                <span
                  className="font-black leading-none text-[17px] text-[#141414] px-1.5 py-0.5 rounded-md bg-[#CCFF00] border-2 border-[#141414]"
                  style={{ fontFamily: '"Bungee", sans-serif', transform: 'rotate(-2deg)' }}
                >
                  HOOD
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#141414]/50 tracking-wider mt-0.5">INTENT ENGINE // V2</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors border-2 ${
                !isApp ? 'text-[#141414] bg-[#CCFF00] border-[#141414] font-bold' : 'text-[#141414]/60 border-transparent hover:text-[#141414] hover:bg-[#CCFF00]/40'
              }`}
            >
              Overview
            </Link>
            <Link
              to="/app"
              className={`px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-colors border-2 ${
                isApp ? 'text-[#141414] bg-[#CCFF00] border-[#141414] font-bold' : 'text-[#141414]/60 border-transparent hover:text-[#141414] hover:bg-[#CCFF00]/40'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Trading Terminal
            </Link>
          </nav>
        </div>

        {/* Telemetry Status Bar */}
        <div className="hidden lg:flex pro3-chip pro3-chip-soft items-center gap-3 text-[10px] font-mono text-[#141414]/60 px-3 py-1.5">
          <span className="flex items-center gap-1.5">
            <span className="pro3-dot pro3-dot-green animate-pulse" />
            <span className="font-bold text-[#141414]">Adidahood</span>
          </span>
          <span className="text-[#141414]/25">|</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#141414]" />
            <span>Guardian: <strong className="text-[#141414]">100% On-Chain</strong></span>
          </span>
          <span className="text-[#141414]/25">|</span>
          <span>
            Ref Gas: <strong className="text-[#141414]">{gasPrice}</strong>
          </span>
        </div>

        {/* Right Actions: Wallet */}
        <div className="flex items-center gap-3">
          {/* Wallet connect — pill opens a balances dropdown (see WalletMenu) */}
          {currentAccount ? (
            <WalletMenu
              walletAddress={currentAccount.address}
              onDisconnect={() => dAppKit.disconnectWallet()}
            />
          ) : (
            <button
              onClick={handleConnect}
              className="pro3-btn text-xs font-mono font-bold !py-2.5 !px-5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet</span>
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

