import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ShieldCheck, Zap, ArrowRight, Layers, Cpu, Sparkles, TrendingUp, Activity, Wallet, Globe, Play, CheckCircle2, Zap as ZapIcon, Check } from 'lucide-react';
import { ProHeader } from './ProHeader';
import { SokaAvatar } from './SokaAvatar';

export const ProLanding: React.FC = () => {
  const navigate = useNavigate();
  const [selectedIntent, setSelectedIntent] = useState<string | undefined>(undefined);
  const [intentInput, setIntentInput] = useState('');

  const handleLaunch = (intent?: string) => {
    if (intent) navigate(`/app?intent=${encodeURIComponent(intent)}`);
    else navigate('/app');
  };

  const features = [
    { icon: <Cpu className="w-6 h-6" />, title: "AI Intent Parser", description: "Conversational prompts into deterministic execution payloads in under 120ms.", color: "#F05391", metric: "< 84ms", tag: "18-DECIMAL WEI" },
    { icon: <Layers className="w-6 h-6" />, title: "Smart DEX Router", description: "Routes across multiple DEXs to minimize slippage and optimize output.", color: "#3B82F6", metric: "Multi-DEX", tag: "CLMM + TWAP" },
    { icon: <ShieldCheck className="w-6 h-6" />, title: "Risk Guardian", description: "7-point on-chain safety audit with oracle-backed risk assessment.", color: "#10b981", metric: "8/8 Checks", tag: "SKIP + PYTH" },
    { icon: <Zap className="w-6 h-6" />, title: "Dynamic Slippage", description: "Derives slippage limits from live pool depth and trade volume.", color: "#8B5CF6", metric: "Adaptive", tag: "GASLESS" },
  ];

  const samplePrompts = [
    { id: '1', title: "Optimal Swap", prompt: "Swap 500 SUI for USDC with safest route", tag: "STABLE", output: "Cetus 70% + Turbos 30%" },
    { id: '2', title: "Dynamic Ratio", prompt: "Swap 50% of my balance to CETUS", tag: "BALANCED", output: "Auto-split route" },
    { id: '3', title: "Whale Mode", prompt: "Swap 1,000 SUI to DEEP with low impact", tag: "SAFE", output: "TWAP verified" },
    { id: '4', title: "Direct", prompt: "Swap 100 SUI to USDC", tag: "FAST", output: "Single pool" },
  ];

  const stats = [
    { label: "Total Volume", value: "$2.4M", icon: <TrendingUp className="w-4 h-4" />, change: "+24.6%", color: "pink", bgGlow: "from-pink-100/60 via-rose-50/40 to-transparent", borderColor: "group-hover:border-pink-300", iconBg: "bg-pink-50 text-pink-600 border-pink-200/80" },
    { label: "Active Users", value: "1,247", icon: <Wallet className="w-4 h-4" />, change: "+210 today", color: "blue", bgGlow: "from-blue-100/60 via-indigo-50/40 to-transparent", borderColor: "group-hover:border-blue-300", iconBg: "bg-blue-50 text-blue-600 border-blue-200/80" },
    { label: "Routes Found", value: "12K+", icon: <Globe className="w-4 h-4" />, change: "84ms avg", color: "amber", bgGlow: "from-amber-100/60 via-orange-50/40 to-transparent", borderColor: "group-hover:border-amber-300", iconBg: "bg-amber-50 text-amber-600 border-amber-200/80" },
    { label: "Uptime", value: "99.9%", icon: <Activity className="w-4 h-4" />, change: "Guardian 8/8", color: "emerald", bgGlow: "from-emerald-100/60 via-teal-50/40 to-transparent", borderColor: "group-hover:border-emerald-300", iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200/80" },
  ];

  const [activities, setActivities] = useState([
    { id: '1', action: "Swap", detail: "500 SUI → USDC", time: "2s ago", status: "CONFIRMED", hash: "0x8f3a..." },
    { id: '2', action: "Route", detail: "SUI → CETUS via Cetus", time: "5s ago", status: "CONFIRMED", hash: "0x2b7c..." },
    { id: '3', action: "Guardian", detail: "7/7 checks passed", time: "8s ago", status: "SAFE", hash: "0x9d1e..." },
    { id: '4', action: "Swap", detail: "1000 DEEP → USDC", time: "12s ago", status: "CONFIRMED", hash: "0x4f2a..." },
  ]);

  // Simulated live activity
  useEffect(() => {
    const interval = setInterval(() => {
      const randomTx = [
        { action: "Swap", detail: "0.05 BTC → 4,821 MUSD", hash: "0x" + Math.random().toString(16).substring(2, 6) + "..." },
        { action: "Route", detail: "1,200 MUSD → 0.0124 BTC", hash: "0x" + Math.random().toString(16).substring(2, 6) + "..." },
        { action: "Guardian", detail: "8/8 checks passed", hash: "0x" + Math.random().toString(16).substring(2, 6) + "..." },
      ];
      const selected = randomTx[Math.floor(Math.random() * randomTx.length)];
      setActivities(prev => [{ ...selected, id: `act-${Date.now()}`, time: "Just now", status: "CONFIRMED" }, ...prev.slice(0, 4)]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getTagStyle = (tag: string) => {
    switch (tag) {
      case 'STABLE': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'BALANCED': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'SAFE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FAST': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = intentInput.trim() || 'Swap 500 SUI for USDC with safest route';
    handleLaunch(query);
  };

  return (
    <div className="min-h-screen w-full bg-mesh-terminal text-[#0f172a] flex flex-col relative overflow-x-hidden snap-y snap-mandatory">
      {/* Animated Ambient Orbs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-pink-300/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute top-1/3 -right-40 w-[550px] h-[550px] bg-blue-300/15 rounded-full blur-[130px] animate-float-reverse" />
        <div className="absolute -bottom-40 left-1/3 w-[650px] h-[650px] bg-purple-200/15 rounded-full blur-[140px] animate-float-slow" />
      </div>

      <ProHeader />

      {/* Section 1: Hero - Full Screen */}
      <section className="flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-6xl mx-auto">
        
        {/* Hero Box - with background border image */}
        <div className="relative animate-float-slow">
          {/* Background border image */}
          <div className="absolute inset-0 rounded-[32px] overflow-hidden">
            <img 
              src="/background-border.png" 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Main box - ultra-matte white ceramic */}
          <div className="relative rounded-[32px] overflow-hidden border border-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08),0_4px_16px_-4px_rgba(244,114,182,0.06)]">
            
            {/* Ceramic surface base */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/80 to-white" />
            
            {/* Center gradient spreading outward with noise */}
            <div className="absolute inset-0">
              {/* Center glow gradient */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,114,182,0.06)_0%,rgba(244,114,182,0.02)_30%,transparent_70%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.04)_0%,rgba(168,85,247,0.01)_25%,transparent_60%)]" />
              
              {/* Noise overlay for texture */}
              <div className="absolute inset-0 opacity-[0.04]" style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundSize: '256px 256px',
                mixBlendMode: 'overlay'
              }} />
              
              {/* Additional noise layer for depth */}
              <div className="absolute inset-0 opacity-[0.02]" style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise2)'/%3E%3C/svg%3E")`,
                backgroundSize: '128px 128px',
                mixBlendMode: 'soft-light'
              }} />
            </div>
            
            {/* Flowing 3D ribbon accents */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Ribbon 1 - flows left to right */}
              <div className="absolute top-[20%] left-[-20%] w-[140%] h-[30%] bg-gradient-to-r from-transparent via-pink-100/20 to-transparent rounded-full blur-xl rotate-[-3deg] animate-[ribbon-flow_12s_linear_infinite] bg-[length:200%_100%]" />
              {/* Ribbon 2 - flows right to left */}
              <div className="absolute bottom-[25%] right-[-20%] w-[140%] h-[25%] bg-gradient-to-r from-transparent via-purple-100/15 to-transparent rounded-full blur-xl rotate-[2deg] animate-[ribbon-flow-reverse_15s_linear_infinite] bg-[length:200%_100%]" />
              {/* Ribbon 3 - subtle center glow */}
              <div className="absolute top-[50%] left-[10%] w-[80%] h-[20%] bg-gradient-to-r from-transparent via-rose-100/10 to-transparent rounded-full blur-2xl animate-[ribbon-flow_20s_linear_infinite] bg-[length:200%_100%]" />
            </div>
            
            {/* Sandblasted grain texture */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
              backgroundSize: '100px 100px'
            }} />
            
            {/* Soft noise gradient falloff */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(244,114,182,0.02)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.015)_0%,transparent_50%)]" />
            
            {/* Tactile micro-texture */}
            <div className="absolute inset-0 opacity-[0.02]" style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='micro'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.05' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23micro)'/%3E%3C/svg%3E")`,
              backgroundSize: '50px 50px'
            }} />
            
            {/* Matte finish highlight */}
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/40 to-transparent" />
            
            {/* Edge definition */}
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_2px_rgba(0,0,0,0.02),inset_1px_0_2px_rgba(0,0,0,0.01),inset_-1px_0_2px_rgba(0,0,0,0.01)]" />

            <div className="relative z-10 p-6 sm:p-8 text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 self-center px-3.5 py-1.5 rounded-full bg-pink-50/95 border border-pink-200/90 shadow-sm backdrop-blur-md mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wider text-pink-600 uppercase font-mono">SOKA BETA V2.0 • SUI MAINNET</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6">
                <span className="block bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 bg-clip-text text-transparent">SOKA</span>
                <span className="block text-slate-900 mt-1">AI Intent Swaps</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-2xl mx-auto font-medium mb-8">
                State your trading intent in plain English. SOKA computes the optimal multi-DEX route, runs a 7-point on-chain safety audit, and compiles an atomic transaction bundle.
              </p>

              {/* Interactive Intent Input Bar */}
              <form onSubmit={handleHeroSubmit} className="pt-1 mb-6 max-w-xl mx-auto">
                <div className="relative flex items-center p-2 bg-white/90 border border-slate-200/90 rounded-2xl shadow-sm focus-within:ring-4 focus-within:ring-pink-500/15 focus-within:border-pink-400 transition-all duration-200">
                  <div className="pl-3 pr-2 text-pink-500">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <input
                    type="text"
                    value={intentInput}
                    onChange={(e) => setIntentInput(e.target.value)}
                    placeholder="e.g. Swap 500 SUI for USDC with safest route..."
                    className="w-full bg-transparent text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-none py-2 font-medium"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-400 to-rose-400 text-white text-xs font-bold shadow-sm hover:from-pink-500 hover:to-rose-500 transition-all cursor-pointer shrink-0"
                  >
                    <span>Parse Intent</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Prompt Suggestions */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-400 font-mono">Quick:</span>
                  <button
                    type="button"
                    onClick={() => { setIntentInput('Swap 500 SUI for USDC'); handleLaunch('Swap 500 SUI for USDC'); }}
                    className="px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/80 hover:border-pink-300 hover:text-pink-600 hover:bg-white shadow-sm transition-all cursor-pointer font-medium"
                  >
                    "Swap 500 SUI for USDC"
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIntentInput('Swap 1000 SUI to DEEP'); handleLaunch('Swap 1000 SUI to DEEP'); }}
                    className="px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/80 hover:border-pink-300 hover:text-pink-600 hover:bg-white shadow-sm transition-all cursor-pointer font-medium"
                  >
                    "Swap 1000 SUI to DEEP"
                  </button>
                </div>
              </form>

              {/* Action Buttons - softer colors */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2 mb-6">
                <button
                  onClick={() => handleLaunch()}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 hover:from-pink-500 hover:via-rose-500 hover:to-pink-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Launch Terminal</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>
                <button
                  onClick={() => navigate('/app')}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/80 hover:bg-white text-slate-700 font-semibold text-sm border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all cursor-pointer hover:-translate-y-0.5"
                >
                  <span>Quick Start</span>
                  <Sparkles className="w-4 h-4 text-pink-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Widget Row - Highlighted */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {stats.map((stat, i) => (
            <div key={i} className={`group relative rounded-2xl bg-white p-5 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(236,72,153,0.12)] transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1`} style={{ animationDelay: `${i * 0.1}s` }}>
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
              
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color === 'pink' ? 'from-pink-400 to-rose-400' : stat.color === 'blue' ? 'from-blue-400 to-indigo-400' : stat.color === 'amber' ? 'from-amber-400 to-orange-400' : 'from-emerald-400 to-teal-400'} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                    {stat.icon}
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 text-[10px] font-bold text-slate-600 border border-slate-200/60 group-hover:bg-white group-hover:shadow-sm transition-all font-mono">
                    <ArrowRight className="w-2.5 h-2.5 text-pink-400" />
                    {stat.change}
                  </span>
                </div>
                
                {/* Value */}
                <div className="text-3xl font-black tracking-tight text-slate-900 group-hover:text-slate-950 transition-colors mb-1" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</div>
                
                {/* Label */}
                <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase font-mono">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* Section 2: Quick Start + Live Activity */}
      <section className="flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-7xl mx-auto">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          
          {/* Quick Start Widget - 2 cols */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="rounded-[32px] card-ultra-depth p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-200/20 rounded-full blur-3xl pointer-events-none -z-10" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 flex items-center justify-center">
                      <ZapIcon className="w-4 h-4" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Quick Start Intents</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 border border-pink-200 text-[10px] font-extrabold tracking-wider text-pink-600 uppercase font-mono">
                    <Play className="w-2.5 h-2.5 fill-pink-600" />
                    Click to Execute
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mb-6 font-medium">Choose a pre-formulated intent to inspect real-time multi-DEX split routing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {samplePrompts.map((intent, idx) => {
                    const isSelected = selectedIntent === intent.id;
                    return (
                      <button
                        key={intent.id}
                        onClick={() => { setSelectedIntent(intent.id); handleLaunch(intent.prompt); }}
                        className={`group relative text-left p-4 sm:p-5 rounded-2xl border transition-all duration-300 overflow-hidden ${
                          isSelected
                            ? 'bg-pink-50/80 border-pink-300 shadow-[0_8px_24px_rgba(236,72,153,0.18)] ring-2 ring-pink-400/40'
                            : 'bg-white/80 hover:bg-white border-slate-200/80 hover:border-pink-200 hover:shadow-[0_8px_24px_rgba(236,72,153,0.08)]'
                        }`}
                      >
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-pink-200/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="font-extrabold text-sm text-slate-900 group-hover:text-pink-600 transition-colors">{intent.title}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border tracking-wider font-mono ${getTagStyle(intent.tag)}`}>{intent.tag}</span>
                        </div>
                        <p className="text-xs font-mono text-slate-600 leading-relaxed bg-slate-50/90 group-hover:bg-pink-50/40 p-2.5 rounded-xl border border-slate-200/60 group-hover:border-pink-200/70 transition-colors">
                          "{intent.prompt}"
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-400 font-mono text-[11px]">Routing:</span>
                          <span className="font-bold text-slate-700 group-hover:text-pink-600 flex items-center gap-1 transition-colors">
                            {intent.output}
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-pink-500" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                  Autonomous Multi-DEX Arbitrage Engine
                </span>
                <span className="font-mono text-[11px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Zero MEV Slippage
                </span>
              </div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="rounded-[32px] card-ultra-depth p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl pointer-events-none -z-10" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"></span>
                    </span>
                    <h2 className="text-xs font-black tracking-widest text-slate-800 uppercase font-mono">LIVE NETWORK ACTIVITY</h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/60">
                    <Activity className="w-3 h-3 text-pink-500 animate-spin" style={{ animationDuration: '5s' }} />
                    <span>Sui Block 2.8M</span>
                  </span>
                </div>
                <div className="space-y-2.5">
                  {activities.map((act) => {
                    const isGuardian = act.action === 'Guardian';
                    return (
                      <div key={act.id} className="group flex items-center justify-between p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-slate-200/70 hover:border-pink-200/80 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_4px_16px_rgba(236,72,153,0.08)]">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                            isGuardian 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                              : 'bg-gradient-to-tr from-pink-50 to-rose-50 text-pink-600 border border-pink-200/80'
                          }`}>
                            {isGuardian ? <ShieldCheck className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-800">{act.action}</span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100/90 px-1.5 py-0.5 rounded">{act.hash}</span>
                            </div>
                            <div className="text-xs text-slate-600 font-bold group-hover:text-slate-900 transition-colors mt-0.5">{act.detail}</div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono border bg-emerald-50 text-emerald-600 border-emerald-200">{act.status}</span>
                          <span className="text-[10px] text-slate-400 mt-1 font-mono">{act.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px] text-slate-500 font-medium">
                  Consensus Latency: <span className="font-mono text-slate-800 font-black">~390ms</span>
                </span>
                <button className="text-[11px] font-extrabold text-pink-600 hover:text-pink-700 flex items-center gap-1 transition-colors cursor-pointer">
                  <span>Inspect In Terminal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
        </section>

        {/* Section 3: Features - Full Screen */}
        <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 snap-start">
        <div className="max-w-7xl w-full mx-auto">
        {/* Features Widget Grid - With Progress & Details */}
        <div className="mb-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-50/90 border border-pink-200/90 text-pink-700 text-xs font-bold uppercase tracking-wider mb-4 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
              <span>SYSTEM NOVELTY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
              Engineered for Zero-Friction DeFi
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="group relative rounded-[28px] p-5 sm:p-6 bg-white/95 backdrop-blur-md border border-slate-200/80 hover:border-pink-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgba(236,72,153,0.14)] transition-all duration-300 cursor-pointer overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
                <div className="flex items-center justify-between mb-4 mt-1">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: f.color + '15', borderColor: f.color + '25' }}>
                    <span style={{ color: f.color }}>{f.icon}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100/90 text-slate-600 border border-slate-200/70">{f.metric}</span>
                </div>
                <h3 className="text-base font-black text-slate-900 group-hover:text-pink-600 transition-colors mb-2">{f.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4 font-normal">{f.description}</p>
                <div className="pt-3.5 border-t border-slate-100 space-y-2">
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500 font-medium">
                    <Check className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{f.tag}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

         {/* CTA Widget */}
         <div className="card-ultra-depth p-8 text-center">
           <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
             Ready to swap with intent?
           </h3>
           <p className="text-slate-500 mb-6 max-w-lg mx-auto">
             Join thousands of traders using natural language to execute optimal swaps on Sui Network.
           </p>
           <button onClick={() => handleLaunch()} className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 text-white font-bold text-base shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
             <span>Launch SOKA Terminal</span>
             <ArrowRight className="w-5 h-5" />
           </button>
         </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white/50 py-8 relative z-10 snap-start">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
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
