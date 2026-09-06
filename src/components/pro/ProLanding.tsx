import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ShieldCheck, Zap, ArrowRight, Layers, Cpu, Sparkles, TrendingUp, Activity, Wallet, Globe } from 'lucide-react';
import { ProHeader } from './ProHeader';
import SokaCharacter from './SokaCharacter';

export const ProLanding: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunch = (intent?: string) => {
    if (intent) navigate(`/app?intent=${encodeURIComponent(intent)}`);
    else navigate('/app');
  };

  const features = [
    { icon: <Cpu className="w-6 h-6" />, title: "AI Intent Parser", description: "Conversational prompts into deterministic execution payloads in under 120ms.", color: "#F05391" },
    { icon: <Layers className="w-6 h-6" />, title: "Smart DEX Router", description: "Routes across multiple DEXs to minimize slippage and optimize output.", color: "#BE8CC2" },
    { icon: <ShieldCheck className="w-6 h-6" />, title: "Risk Guardian", description: "7-point on-chain safety audit with oracle-backed risk assessment.", color: "#F05391" },
    { icon: <Zap className="w-6 h-6" />, title: "Dynamic Slippage", description: "Derives slippage limits from live pool depth and trade volume.", color: "#BE8CC2" },
  ];

  const samplePrompts = [
    { title: "Optimal Swap", text: "Swap 500 SUI for USDC with safest route", tag: "STABLE" },
    { title: "Dynamic Ratio", text: "Swap 50% of my balance to CETUS", tag: "BALANCED" },
    { title: "Whale Mode", text: "Swap 1,000 SUI to DEEP with low impact", tag: "SAFE" },
    { title: "Direct", text: "Swap 100 SUI to USDC", tag: "FAST" },
  ];

  const stats = [
    { label: "Total Volume", value: "$2.4M", icon: <TrendingUp className="w-4 h-4" /> },
    { label: "Active Users", value: "1,247", icon: <Wallet className="w-4 h-4" /> },
    { label: "Routes Found", value: "12K+", icon: <Globe className="w-4 h-4" /> },
    { label: "Uptime", value: "99.9%", icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen w-full mesh-texture-soft text-[#0f172a] flex flex-col relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-200px] left-[-150px] w-[600px] h-[600px] rounded-full bg-[#F05391]/[0.1] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-150px] w-[500px] h-[500px] rounded-full bg-[#BE8CC2]/[0.08] blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#FFF29]/[0.15] blur-[100px] pointer-events-none" />

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

      {/* Main Content - Widget Grid Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 relative z-10">
        
        {/* Hero Widget - Full Width with 3D Character */}
        <div className="relative mb-6 fade-in overflow-visible">
          {/* Character - positioned to overflow */}
          <div className="absolute -right-4 sm:right-0 top-0 lg:top-8 z-20 pointer-events-none">
            <div className="transform lg:scale-110 xl:scale-125 origin-bottom-right perspective-1000">
              <SokaCharacter size={280} className="float drop-shadow-2xl" style={{ filter: 'drop-shadow(0 25px 50px rgba(240, 83, 145, 0.3))' }} />
            </div>
          </div>
          
          <div className="glass-strong p-8 sm:p-10 lg:pr-[320px] xl:pr-[380px] relative z-10 overflow-hidden">
            <div className="text-left">
              <div className="chip chip-accent mb-6 inline-flex">
                <span className="dot dot-accent animate-pulse" />
                <span>SOKA v2.0 • Sui Mainnet</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                <span className="bg-gradient-to-r from-[#F05391] via-[#BE8CC2] to-[#F05391] bg-clip-text text-transparent">SOKA</span>
                <br />
                <span className="text-[#0f172a]">AI Intent Swaps</span>
              </h1>
              <p className="text-base sm:text-lg text-[#0f172a]/55 max-w-xl leading-relaxed mb-8" style={{ fontFamily: 'var(--font-body)' }}>
                State your trading intent in plain English. SOKA computes the optimal multi-DEX route, runs a 7-point on-chain safety audit, and compiles an atomic transaction bundle.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <button onClick={() => handleLaunch()} className="btn-primary text-sm sm:text-base px-8 py-4 flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  <span>Launch Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => navigate('/app')} className="btn-ghost px-6 py-4 flex items-center gap-2">
                  <span>Quick Start</span>
                  <Sparkles className="w-4 h-4 text-[#F05391]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Widget Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="glass p-5 fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-[#F05391]/10 text-[#F05391]">
                  {stat.icon}
                </div>
                <span className="text-xs font-medium text-[#0f172a]/40 uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Quick Start Widget - 2 cols */}
          <div className="lg:col-span-2 glass-strong p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>Quick Start</h2>
                <p className="text-sm text-[#0f172a]/45 mt-1">Try these sample intents</p>
              </div>
              <span className="chip chip-accent">CLICK TO EXECUTE</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {samplePrompts.map((p, idx) => (
                <button key={idx} onClick={() => handleLaunch(p.text)} className="glass-interactive p-4 text-left group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#0f172a]">{p.title}</span>
                    <span className="chip chip-accent text-[8px]">{p.tag}</span>
                  </div>
                  <div className="font-mono text-xs text-[#0f172a]/40 flex items-center justify-between">
                    <span>"{p.text}"</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#F05391] transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Activity Widget */}
          <div className="glass p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="dot dot-accent animate-pulse" />
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">Live Activity</h3>
            </div>
            <div className="space-y-4">
              {[
                { action: "Swap", detail: "500 SUI → USDC", time: "2s ago", status: "CONFIRMED" },
                { action: "Route", detail: "SUI → CETUS via Cetus", time: "5s ago", status: "CONFIRMED" },
                { action: "Guardian", detail: "7/7 checks passed", time: "8s ago", status: "SAFE" },
                { action: "Swap", detail: "1000 DEEP → USDC", time: "12s ago", status: "CONFIRMED" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/20 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-[#0f172a]">{item.action}</div>
                    <div className="text-xs text-[#0f172a]/40 font-mono">{item.detail}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-[#10b981]">{item.status}</div>
                    <div className="text-[10px] text-[#0f172a]/30">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features Widget Grid */}
        <div className="mb-10">
          <div className="text-center mb-8">
            <span className="chip chip-accent mb-4">◆ System Novelty</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a] mt-4" style={{ fontFamily: 'var(--font-display)' }}>
              Engineered for Zero-Friction DeFi
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 text-center group">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: f.color + '15', border: `1px solid ${f.color}25` }}>
                  <span style={{ color: f.color }}>{f.icon}</span>
                </div>
                <h3 className="font-bold text-[#0f172a] text-base mb-2" style={{ fontFamily: 'var(--font-body)' }}>{f.title}</h3>
                <p className="text-sm text-[#0f172a]/45 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Widget */}
        <div className="glass-accent p-8 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Ready to swap with intent?
          </h3>
          <p className="text-[#0f172a]/50 mb-6 max-w-lg mx-auto">
            Join thousands of traders using natural language to execute optimal swaps on Sui Network.
          </p>
          <button onClick={() => handleLaunch()} className="btn-primary text-base px-10 py-4">
            <span>Launch SOKA Terminal</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/30 bg-white/20 py-8 relative z-10 mt-auto">
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
