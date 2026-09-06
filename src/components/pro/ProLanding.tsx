import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ShieldCheck, Zap, ArrowRight, Layers, Cpu, Sparkles } from 'lucide-react';
import { ProHeader } from './ProHeader';
import SokaCat from './SokaCat';

export const ProLanding: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunch = (intent?: string) => {
    if (intent) navigate(`/app?intent=${encodeURIComponent(intent)}`);
    else navigate('/app');
  };

  const features = [
    { icon: <Cpu className="w-5 h-5" />, title: "AI Intent Parser", description: "Converts conversational prompts into deterministic execution payloads in under 120ms." },
    { icon: <Layers className="w-5 h-5" />, title: "Smart DEX Router", description: "Routes across multiple DEXs to minimize slippage and optimize output pricing." },
    { icon: <ShieldCheck className="w-5 h-5" />, title: "Risk Guardian", description: "7-point on-chain safety audit with oracle-backed risk assessment." },
    { icon: <Zap className="w-5 h-5" />, title: "Dynamic Slippage", description: "Derives slippage limits dynamically based on live pool depth and trade volume." }
  ];

  const samplePrompts = [
    { title: "Optimal Swap", text: "Swap 500 SUI for USDC with safest route", tag: "STABLE" },
    { title: "Dynamic Ratio", text: "Swap 50% of my balance to CETUS", tag: "BALANCED" },
    { title: "Whale Mode", text: "Swap 1,000 SUI to DEEP with low impact", tag: "SAFE" },
    { title: "Direct", text: "Swap 100 SUI to USDC", tag: "FAST" },
  ];

  return (
    <div className="min-h-screen w-full mesh-texture-soft text-[#0f172a] flex flex-col relative overflow-hidden">
      {/* Ambient blobs with pink tint */}
      <div className="absolute top-[-150px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#F05391]/[0.08] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-100px] w-[400px] h-[400px] rounded-full bg-[#BE8CC2]/[0.06] blur-[100px] pointer-events-none" />

      <ProHeader />

      {/* Marquee */}
      <div className="border-y border-white/30 bg-white/20 overflow-hidden">
        <div className="flex whitespace-nowrap py-3">
          <span className="px-6 font-mono text-xs tracking-widest text-[#0f172a]/40">
            ◆ SOKA PROTOCOL ◆ AI-POWERED SWAPS ◆ 7 ON-CHAIN CHECKS ◆ SUI NETWORK ◆&nbsp;
            ◆ SOKA PROTOCOL ◆ AI-POWERED SWAPS ◆ 7 ON-CHAIN CHECKS ◆ SUI NETWORK ◆&nbsp;
          </span>
        </div>
      </div>

      {/* Hero */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-20 pb-24 relative z-10 flex flex-col items-center text-center">
        <div className="chip chip-accent mb-10 fade-in">
          <span className="dot dot-accent animate-pulse" />
          <span>SOKA v2.0 • Sui Mainnet</span>
        </div>

        {/* Main Headline - Satoshi font */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight max-w-5xl leading-[1.02] mb-8 slide-up" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="bg-gradient-to-r from-[#F05391] via-[#BE8CC2] to-[#F05391] bg-clip-text text-transparent">SOKA</span>
          <br />
          <span className="text-[#0f172a]">AI Intent Swaps</span>
        </h1>

        {/* Skull Buddy + Speech */}
        <div className="flex items-center justify-center gap-5 mb-10 fade-in" style={{ animationDelay: '0.1s' }}>
          <SokaCat size={100} className="skull-glow float" />
          <div className="glass-strong p-5 text-left max-w-[360px]">
            <span className="font-mono text-[9px] font-bold tracking-[0.12em] text-[#F05391]">SOKA ★ AI</span>
            <p className="font-medium text-[15px] leading-snug mt-1 text-[#0f172a]/80">
              Type a swap. I will sniff the route and run 7 checks. No jargon, just vibes ⚡
            </p>
          </div>
        </div>

        {/* Subtitle - Inter font */}
        <p className="text-base sm:text-lg text-[#0f172a]/50 max-w-2xl font-normal leading-relaxed mb-12 fade-in" style={{ fontFamily: 'var(--font-body)', animationDelay: '0.2s' }}>
          State your trading intent in plain English. SOKA computes the optimal multi-DEX route, runs a 7-point on-chain safety audit, and compiles an atomic transaction bundle for your wallet.
        </p>

        {/* CTA Buttons - Pink accent */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-24 fade-in" style={{ animationDelay: '0.3s' }}>
          <button onClick={() => handleLaunch()} className="btn-primary text-sm sm:text-base px-8 py-4 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span>Launch Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/app')} className="btn-ghost px-6 py-4 flex items-center gap-2">
            <span>Quick Start</span>
            <Sparkles className="w-4 h-4 text-[#F05391]" />
          </button>
        </div>

        {/* Quick Starts */}
        <div className="w-full max-w-4xl glass-strong p-6 sm:p-8 text-left mb-28">
          <div className="flex items-center justify-between gap-4 border-b border-white/30 pb-5 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]/70" />
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]/70" />
              <span className="w-3 h-3 rounded-full bg-[#10b981]/70" />
              <span className="ml-3 font-mono text-xs text-[#0f172a]/40 font-medium">terminal.soka.intent</span>
            </div>
            <span className="chip chip-accent">CLICK TO EXECUTE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samplePrompts.map((p, idx) => (
              <button key={idx} onClick={() => handleLaunch(p.text)} className="glass-interactive p-5 text-left flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#0f172a]">{p.title}</span>
                  <span className="chip chip-accent text-[9px]">{p.tag}</span>
                </div>
                <div className="font-mono text-xs text-[#0f172a]/40 flex items-center justify-between">
                  <span>"{p.text}"</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#F05391]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="w-full max-w-6xl text-left">
          <div className="text-center mb-14">
            <span className="chip chip-accent mb-5">◆ System Novelty</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0f172a] mt-5" style={{ fontFamily: 'var(--font-display)' }}>
              Engineered for Zero-Friction DeFi
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-[#F05391]/10 border border-[#F05391]/15 shrink-0">
                  <span className="text-[#F05391]">{f.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f172a] text-base mb-2" style={{ fontFamily: 'var(--font-body)' }}>{f.title}</h3>
                  <p className="text-sm text-[#0f172a]/45 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/30 bg-white/20 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#0f172a]/30">
          <div className="flex items-center gap-2">
            <span className="dot dot-accent" />
            <span>SOKA Protocol © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-[#F05391] cursor-pointer transition-colors" onClick={() => navigate('/app')}>Terminal</span>
            <span className="hover:text-[#F05391] cursor-pointer transition-colors" onClick={() => navigate('/')}>Overview</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
