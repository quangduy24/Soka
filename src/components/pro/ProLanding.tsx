import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal, ShieldCheck, Zap, ArrowRight, Layers, ArrowUpRight, Cpu
} from 'lucide-react';
import { ProHeader } from './ProHeader';
import { SkullBuddy } from './SkullBuddy';

export const ProLanding: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunch = (intent?: string) => {
    if (intent) {
      navigate(`/app?intent=${encodeURIComponent(intent)}`);
    } else {
      navigate('/app');
    }
  };

  const samplePrompts = [
    { title: "Optimal Swap", text: "Swap 500 ETH for USDG with safest route", tag: "STABLE ROUTE" },
    { title: "Dynamic Ratio", text: "Swap 50% of my balance to ARB", tag: "WALLET BALANCED" },
    { title: "Whale Safe Mode", text: "Swap 1,000 ETH to ARB with low impact", tag: "MAX LIQUIDITY" },
    { title: "Direct Contract", text: "Swap 100 ETH to 0x912CE59144191C1204E64559FE8253a0e49E6548", tag: "ON-CHAIN CONTRACT" },
  ];

  const features = [
    {
      icon: <Cpu className="w-5 h-5 text-[#141414]" />,
      title: "Google Gemini Intent Parser",
      description: "Converts conversational prompts, percentage ratios ('ALL', '50%'), and custom constraints into deterministic execution payloads in under 120ms."
    },
    {
      icon: <Layers className="w-5 h-5 text-[#141414]" />,
      title: "Robinhood Chain DEX Router",
      description: "Autonomously routes across Uniswap, 1inch, Lighter, and Arcus to minimize slippage and optimize output pricing."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#141414]" />,
      title: "100% On-Chain Risk Guardian",
      description: "Zero external indexers. Verifies token mint authority / owner-key checks (infinite mint protection), pool staleness, and on-chain concentration directly on Robinhood Chain RPC + Chainlink oracles."
    },
    {
      icon: <Zap className="w-5 h-5 text-[#141414]" />,
      title: "Dynamic Mathematical Slippage",
      description: "Derives slippage limits dynamically based on live pool depth, trade volume ratios, and hop count to prevent frontrunning and sandwich attacks."
    }
  ];

  return (
    <div className="min-h-screen w-full pro3-bg text-[#141414] flex flex-col font-sans selection:bg-[#141414] selection:text-[#CCFF00] relative overflow-hidden">
      {/* Background halftone handled by .pro3-bg; ambient glows removed */}

      {/* Header */}
      <ProHeader />

      {/* Marquee */}
      <div className="pro3-marquee-bg">
        <div className="pro3-marquee-inner">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              ★ PLAYFUL DE-FI ★ NO JARGON ★ 7 ON-CHAIN CHECKS ★ ROBINHOOD CHAIN ★ AI INTENT SWAPS ★ PLAYFUL DE-FI ★ NO JARGON ★ 7 ON-CHAIN CHECKS ★ ROBINHOOD CHAIN ★ AI INTENT SWAPS ★&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-14 pb-20 relative z-10 flex flex-col items-center text-center">
        {/* Release Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full pro3-chip pro3-chip-soft mb-8">
          <span className="pro3-dot pro3-dot-lime animate-pulse" />
          <span className="text-xs font-mono text-[#141414]/80">Adidahood Intent Engine v2.0 • Robinhood Chain Mainnet (4663)</span>
          <span className="text-[#141414]/25">|</span>
          <span className="text-xs font-mono text-[#141414] font-bold flex items-center gap-0.5">
            On-Chain Swaps <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#141414] max-w-4xl leading-[1.05] mb-6" style={{ fontFamily: '"Bungee", sans-serif' }}>
          AI-POWERED INTENT SWAPS <br />
          <span className="inline-block mt-2 px-3 py-1 bg-[#141414] text-[#CCFF00] rounded-2xl" style={{ transform: 'rotate(-1deg)' }}>
            Protected by Chainlink Oracles
          </span>
        </h1>

        {/* Skull Buddy mascot + speech bubble */}
        <div className="flex items-center justify-center gap-3 mb-8 bubble-pop">
          <SkullBuddy size={104} mood="happy" />
          <div className="relative chat-bubble-bot !rounded-[20px] px-5 py-3 text-left max-w-[340px]">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/50">ADIDAHOOD ★ PRO</span>
            <p className="font-bold text-[15px] leading-snug mt-0.5">
              Type a swap. I'll sniff the route &amp; run 7 checks. No jargon, just vibes ⚡
            </p>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#141414]/70 max-w-2xl font-normal leading-relaxed mb-10">
          State your trading intent in plain English. ADIDAHOOD computes the optimal multi-DEX route, runs a 7-point on-chain safety audit, and compiles an atomic Transaction Bundle (ERC-4337 UserOperation) directly for your wallet.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => handleLaunch()}
            className="pro3-btn text-sm sm:text-base px-8 py-3.5 flex items-center gap-2"
          >
            <Terminal className="w-4 h-4" />
            <span>Launch Trading Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/app')}
            className="px-6 py-3.5 rounded-2xl bg-white hover:-translate-y-0.5 border-[3px] border-[#141414] text-[#141414] font-mono text-sm transition-all shadow-[4px_4px_0_#141414] flex items-center gap-2"
          >
            <span>Quick Start: Swap ETH → USDG</span>
            <span>⚡</span>
          </button>
        </div>

        {/* Live Intent Simulator / Quick Starts */}
        <div className="w-full max-w-4xl pro3-card p-6 sm:p-8 text-left mb-24 relative overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b-[3px] border-[#141414] pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff6b6b] border-2 border-[#141414]" />
              <span className="w-3 h-3 rounded-full bg-[#FFC900] border-2 border-[#141414]" />
              <span className="w-3 h-3 rounded-full bg-[#2fbf4f] border-2 border-[#141414]" />
              <span className="ml-2 font-mono text-xs text-[#141414]/60 font-bold">terminal.adidahood.intent</span>
            </div>
            <span className="text-[10px] font-mono text-[#141414] bg-[#CCFF00] px-2 py-1 rounded-lg border-2 border-[#141414] font-bold">
              CLICK TO EXECUTE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleLaunch(p.text)}
                className="group p-4 rounded-2xl bg-white hover:-translate-y-0.5 hover:bg-[#CCFF00]/60 border-[3px] border-[#141414] transition-all text-left flex flex-col justify-between shadow-[3px_3px_0_#141414]"
                style={{ transform: `rotate(${idx % 2 ? 0.4 : -0.4}deg)` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-[#141414]">
                    {p.title}
                  </span>
                  <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#CCFF00] border-2 border-[#141414] text-[#141414]">
                    {p.tag}
                  </span>
                </div>
                <div className="font-mono text-xs text-[#141414]/55 group-hover:text-[#141414] flex items-center justify-between">
                  <span>"{p.text}"</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all text-[#141414]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-6xl text-left">
          <div className="text-center mb-12">
            <span className="pro3-chip mb-4">★ System Novelty</span>
            <h2 className="text-3xl font-bold text-[#141414] mt-4" style={{ fontFamily: '"Bungee", sans-serif' }}>
              Engineered for Zero-Friction DeFi
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="pro3-card p-6 flex items-start gap-4 hover:-translate-y-1 transition-transform">
                <div className="p-3 rounded-2xl bg-[#CCFF00] border-[3px] border-[#141414] shadow-[3px_3px_0_#141414] shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-mono font-bold text-[#141414] text-base mb-1.5" style={{ fontFamily: '"Bungee", sans-serif' }}>{f.title}</h3>
                  <p className="text-sm text-[#141414]/65 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t-[3px] border-[#141414] bg-[#FFC900] py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#141414]/70 font-bold">
          <div className="flex items-center gap-2">
            <span className="pro3-dot pro3-dot-lime" />
            <span>Adidahood Protocol © 2026 • Robinhood Chain (EVM L2 · Arbitrum · Chain ID 4663)</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-[#141414] cursor-pointer" onClick={() => navigate('/app')}>Terminal</span>
            <span className="hover:text-[#141414] cursor-pointer" onClick={() => navigate('/')}>Overview</span>
            <span className="text-[#141414]/80 font-mono">Chain ID 4663</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
