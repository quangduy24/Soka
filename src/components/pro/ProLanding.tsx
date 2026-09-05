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
    <div className="min-h-screen w-full mesh-inspection-bg mesh-grid-overlay mesh-dots text-[#f0f0f5] flex flex-col font-sans selection:bg-[#6366f1] selection:text-white relative overflow-hidden">
      {/* Ambient gradient orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full bg-[#6366f1] opacity-[0.07] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[#8b5cf6] opacity-[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-[#22d3ee] opacity-[0.03] blur-[100px] pointer-events-none" />

      {/* Header */}
      <ProHeader />

      {/* Marquee */}
      <div className="border-y border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="glass-marquee inline-flex whitespace-nowrap py-3">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="px-6 font-mono text-xs tracking-widest text-white/40">
              ◆ SOKA PROTOCOL ◆ AI-POWERED SWAPS ◆ 7 ON-CHAIN CHECKS ◆ SUI NETWORK ◆ SOKA PROTOCOL ◆ AI-POWERED SWAPS ◆ 7 ON-CHAIN CHECKS ◆ SUI NETWORK ◆&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-20 pb-24 relative z-10 flex flex-col items-center text-center">
        {/* Release Tag */}
        <div className="glass-chip glass-chip-accent mb-10">
          <span className="status-dot status-dot-accent animate-pulse" />
          <span>SOKA v2.0 • Sui Mainnet • On-Chain Swaps</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight max-w-5xl leading-[1.02] mb-8" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="bg-gradient-to-r from-[#6366f1] via-[#a78bfa] to-[#22d3ee] bg-clip-text text-transparent">SOKA</span>
          <br />
          <span className="text-white">AI INTENT SWAPS</span>
          <br />
          <span className="inline-block mt-3 px-5 py-2 bg-gradient-to-r from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/30 rounded-2xl text-white/90 backdrop-blur-sm">
            Protected by Chainlink
          </span>
        </h1>

        {/* Skull Buddy mascot + speech bubble */}
        <div className="flex items-center justify-center gap-5 mb-10">
          <SkullBuddy size={110} mood="happy" className="skull-glow float" />
          <div className="relative glass-strong p-5 text-left max-w-[360px] glass-highlight">
            <span className="font-mono text-[9px] font-semibold tracking-[0.15em] text-[#a78bfa]">SOKA ★ AI</span>
            <p className="font-medium text-[15px] leading-snug mt-1 text-white/90">
              Type a swap. I'll sniff the route &amp; run 7 checks. No jargon, just vibes ⚡
            </p>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-white/50 max-w-2xl font-normal leading-relaxed mb-12">
          State your trading intent in plain English. SOKA computes the optimal multi-DEX route, runs a 7-point on-chain safety audit, and compiles an atomic Transaction Bundle directly for your wallet.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
          <button
            onClick={() => handleLaunch()}
            className="glass-btn glass-btn-primary text-sm sm:text-base px-8 py-4 flex items-center gap-2"
          >
            <Terminal className="w-4 h-4" />
            <span>Launch Trading Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/app')}
            className="glass-btn px-6 py-4 flex items-center gap-2"
          >
            <span>Quick Start: Swap SUI → USDC</span>
            <span>⚡</span>
          </button>
        </div>

        {/* Live Intent Simulator / Quick Starts */}
        <div className="w-full max-w-4xl glass-strong p-6 sm:p-8 text-left mb-28 relative glass-highlight">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-5 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#fb7185]/80" />
              <span className="w-3 h-3 rounded-full bg-[#fbbf24]/80" />
              <span className="w-3 h-3 rounded-full bg-[#34d399]/80" />
              <span className="ml-3 font-mono text-xs text-white/40 font-medium">terminal.soka.intent</span>
            </div>
            <span className="glass-chip glass-chip-green">CLICK TO EXECUTE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleLaunch(p.text)}
                className="group p-5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] transition-all text-left flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/90">
                    {p.title}
                  </span>
                  <span className="glass-chip glass-chip-accent text-[9px]">
                    {p.tag}
                  </span>
                </div>
                <div className="font-mono text-xs text-white/40 group-hover:text-white/60 flex items-center justify-between">
                  <span>"{p.text}"</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all text-[#6366f1]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-6xl text-left">
          <div className="text-center mb-14">
            <span className="glass-chip glass-chip-accent mb-5">◆ System Novelty</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-5" style={{ fontFamily: 'var(--font-display)' }}>
              Engineered for Zero-Friction DeFi
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 flex items-start gap-4 group">
                <div className="p-3 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/20 shrink-0 group-hover:bg-[#6366f1]/15 transition-all">
                  <span className="text-[#a78bfa]">{f.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{f.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/[0.06] bg-white/[0.01] py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-white/30">
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot-accent" />
            <span>SOKA Protocol © 2026 • Sui Network</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-white/60 cursor-pointer transition-colors" onClick={() => navigate('/app')}>Terminal</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors" onClick={() => navigate('/')}>Overview</span>
            <span className="text-white/40 font-mono">SOKA</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
