import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Terminal, Wallet } from 'lucide-react';
import { WalletMenu } from './WalletMenu.js';

interface ProHeaderProps {
  onOpenWalletModal?: () => void;
  gasPrice?: string;
}

export const ProHeader: React.FC<ProHeaderProps> = ({ onOpenWalletModal, gasPrice = '0.0001 BTC' }) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const location = useLocation();
  const isApp = location.pathname.includes('/app');

  const handleConnect = () => {
    if (onOpenWalletModal) onOpenWalletModal();
    else if (openConnectModal) openConnectModal();
  };

  return (
    <header className="w-full z-40 border-b border-[#DF7AA7]/30 backdrop-blur-2xl sticky top-0 transition-colors bg-[#F4E1E9]/90 shadow-[0_4px_24px_-4px_rgba(44,25,36,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="font-grotesk-125 text-xl tracking-tight text-[#2C1924] cursor-pointer hover:text-[#DF7AA7] transition-colors"
          >
            SOKA
          </Link>

          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl border border-[#DF7AA7]/30 bg-white/85 shadow-2xs">
            <Link
              to="/"
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all font-meta ${!isApp
                  ? 'bg-white text-[#DF7AA7] font-bold border border-[#F7D1D7] shadow-xs'
                  : 'text-[#2C1924] font-semibold hover:text-[#DF7AA7] hover:bg-white/60'
                }`}
            >
              Overview
            </Link>
            <Link
              to="/app"
              className={`px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all font-meta ${isApp
                  ? 'bg-white text-[#DF7AA7] font-bold border border-[#F7D1D7] shadow-xs'
                  : 'text-[#2C1924] font-semibold hover:text-[#DF7AA7] hover:bg-white/60'
                }`}
            >
              <Terminal className="w-3.5 h-3.5 text-[#DF7AA7]" />
              Launch App
            </Link>
          </nav>
        </div>

        {/* Action Controls */}
        {isApp && (
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <WalletMenu walletAddress={address} onDisconnect={() => disconnect()} />
            ) : (
              <button
                onClick={handleConnect}
                className="relative group overflow-hidden bg-gradient-to-r from-[#DF7AA7] via-[#EE97C2] to-[#DF7AA7] hover:opacity-95 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-[0_2px_12px_rgba(223,122,167,0.3)] hover:shadow-[0_4px_16px_rgba(223,122,167,0.4)] transition-all flex items-center gap-2 active:scale-95 border border-white/60 backdrop-blur-md cursor-pointer select-none font-meta"
              >
                <span className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-t-xl" />
                <Wallet className="w-3.5 h-3.5 text-white/95 group-hover:scale-110 transition-transform drop-shadow-2xs" />
                <span className="tracking-wide drop-shadow-2xs">Connect Wallet</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
