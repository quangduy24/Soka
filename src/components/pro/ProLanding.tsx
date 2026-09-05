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
      icon: <Cpu className="w-5 h-5" />,
      title: "Google Gemini Intent Parser",
      description: "Converts conversational prompts, percentage ratios ('ALL', '50%'), and custom constraints into deterministic execution payloads in under 120ms."
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: "Robinhood Chain DEX Router",
      description: "Autonomously routes across Uniswap, 1inch, Lighter, and Arcus to minimize slippage and optimize output pricing."
    },
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "100% On-Chain Risk Guardian",
      description: "Zero external indexers. Verifies token mint authority / owner-key checks (infinite mint protection), pool staleness, and on-chain concentration directly on Robinhood Chain RPC + Chainlink oracles."
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Dynamic Mathematical Slippage",
      description: "Derives slippage limits dynamically based on live pool depth, trade volume ratios, and hop count to prevent frontrunning and sandwich attacks."
    }
  ];

  return (
    <div className="min-h-screen w-full mesh-bg mesh-glow text-[#e0e0e8] flex flex-col font-sans selection:bg-[#ff00ff] selection:text-white relative overflow-hidden scanline">
      {/* Ambient glow orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#7b2fff] opacity-20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full bg-[#00f0ff] opacity-15 blur-[100px] pointer-events-none" />

      {/* Header */}
      <ProHeader />

      {/* Marquee */}
      <div className="cyber-marquee-container border-y border-[#00f0ff]/20 bg-gradient-to-r from-[#00f0ff]/5 to-[#7b2fff]/5 overflow-hidden">
        <div className="cyber-marquee inline-flex whitespace-nowrap py-2">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="px-4 font-mono text-xs tracking-widest text-[#00f0ff]">
              ◆ SOKA PROTOCOL ◆ AI-POWERED SWAPS ◆ 7 ON-CHAIN CHECKS ◆ ROBINHOOD CHAIN ◆ SOKA PROTOCOL ◆ AI-POWERED SWAPS ◆ 7 ON-CHAIN CHECKS ◆ ROBINHOOD CHAIN ◆&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-16 pb-20 relative z-10 flex flex-col items-center text-center">
        {/* Release Tag */}
        <div className="cyber-chip mb-8 flicker">
          <span className="cyber-dot cyber-dot-cyan animate-pulse" />
          <span>SOKA v2.0 • Sui Mainnet • On-Chain Swaps</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl leading-[1.05] mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-glow-cyan" style={{ color: '#00f0ff' }}>SOKA</span>
          <br />
          <span className="text-white">AI INTENT SWAPS</span>
          <br />
          <span className="inline-block mt-2 px-4 py-1 bg-gradient-to-r from-[#7b2fff] to-[#ff00ff] rounded-lg text-white text-glow-magenta" style={{ transform: 'rotate(-1deg)' }}>
            Protected by Chainlink
          </span>
        </h1>

        {/* Skull Buddy mascot + speech bubble */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <SkullBuddy size={104} mood="happy" className="skull-glow float" />
          <div className="relative cyber-card cyber-card-magenta p-4 text-left max-w-[340px]">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#ff00ff]">SOKA ★ AI</span>
            <p className="font-semibold text-[15px] leading-snug mt-0.5 text-white">
              Type a swap. I'll sniff the route &amp; run 7 checks. No jargon, just vibes ⚡
            </p>
            <div className="corner-br" />
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#a8f0ff]/70 max-w-2xl font-normal leading-relaxed mb-10">
          State your trading intent in plain English. SOKA computes the optimal multi-DEX route, runs a 7-point on-chain safety audit, and compiles an atomic Transaction Bundle directly for your wallet.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => handleLaunch()}
            className="cyber-btn pulse-neon text-sm sm:text-base px-8 py-3.5 flex items-center gap-2"
          >
            <Terminal className="w-4 h-4" />
            <span>Launch Trading Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/app')}
            className="cyber-btn cyber-btn-magenta px-6 py-3.5 flex items-center gap-2"
          >
            <span>Quick Start: Swap SUI → USDC</span>
            <span>⚡</span>
          </button>
        </div>

        {/* Live Intent Simulator / Quick Starts */}
        <div className="w-full max-w-4xl cyber-card p-6 sm:p-8 text-left mb-24 relative overflow-hidden">
          <div className="corner-br" />
          <div className="flex items-center justify-between gap-4 border-b border-[#00f0ff]/20 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff2d7b] border border-[#ff2d7b]/50" />
              <span className="w-3 h-3 rounded-full bg-[#ffb800] border border-[#ffb800]/50" />
              <span className="w-3 h-3 rounded-full bg-[#39ff14] border border-[#39ff14]/50" />
              <span className="ml-2 font-mono text-xs text-[#00f0ff]/60 font-bold">terminal.soka.intent</span>
            </div>
            <span className="cyber-chip cyber-chip-green">CLICK TO EXECUTE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleLaunch(p.text)}
                className="group p-4 rounded-xl bg-[#0d0d14] hover:bg-[#00f0ff]/10 border border-[#00f0ff]/20 hover:border-[#00f0ff]/50 transition-all text-left flex flex-col justify-between"
                style={{ transform: `rotate(${idx % 2 ? 0.4 : -0.4}deg)` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-white">
                    {p.title}
                  </span>
                  <span className="cyber-chip cyber-chip-magenta text-[9px]">
                    {p.tag}
                  </span>
                </div>
                <div className="font-mono text-xs text-[#a8f0ff]/50 group-hover:text-[#00f0ff] flex items-center justify-between">
                  <span>"{p.text}"</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all text-[#00f0ff]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-6xl text-left">
          <div className="text-center mb-12">
            <span className="cyber-chip cyber-chip-magenta mb-4">◆ System Novelty</span>
            <h2 className="text-3xl font-bold text-white mt-4 text-glow-electric" style={{ fontFamily: 'var(--font-display)' }}>
              Engineered for Zero-Friction DeFi
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="cyber-card p-6 flex items-start gap-4 hover:neon-cyan transition-all group">
                <div className="p-3 rounded-xl bg-gradient-to-br from-[#00f0ff]/20 to-[#7b2fff]/20 border border-[#00f0ff]/40 shrink-0 group-hover:neon-cyan transition-all">
                  <span className="text-[#00f0ff]">{f.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>{f.title}</h3>
                  <p className="text-sm text-[#a8f0ff]/60 leading-relaxed">{f.description}</p>
                </div>
                <div className="corner-br" />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#00f0ff]/20 bg-gradient-to-r from-[#0d0d14] to-[#12121c] py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#a8f0ff]/50 font-bold">
          <div className="flex items-center gap-2">
            <span className="cyber-dot cyber-dot-cyan" />
            <span>SOKA Protocol © 2026 • Sui Network</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-[#00f0ff] cursor-pointer transition-colors" onClick={() => navigate('/app')}>Terminal</span>
            <span className="hover:text-[#00f0ff] cursor-pointer transition-colors" onClick={() => navigate('/')}>Overview</span>
            <span className="text-[#00f0ff]/60 font-mono">SOKA</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
