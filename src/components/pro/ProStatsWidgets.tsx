import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Globe, ShieldCheck, ArrowUpRight, Sparkles, Activity, Zap, CheckCircle2 } from 'lucide-react';

export const ProStatsWidgets: React.FC = () => {
  // Dynamic simulated metrics for real-time DeFi terminal feel
  const [volume, setVolume] = useState(2489120);
  const [activeUsers, setActiveUsers] = useState(1247);
  const [routesCount, setRoutesCount] = useState(12842);
  const [recentTrade, setRecentTrade] = useState<{ amount: string; dex: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown'>('overview');

  useEffect(() => {
    // Subtle periodic micro-updates to make the widgets feel alive and connected to on-chain events
    const interval = setInterval(() => {
      const volDelta = Math.floor(Math.random() * 850) + 120;
      setVolume(prev => prev + volDelta);
      
      if (Math.random() > 0.4) {
        setRoutesCount(prev => prev + 1);
      }
      
      if (Math.random() > 0.6) {
        const userDelta = Math.random() > 0.5 ? 1 : -1;
        setActiveUsers(prev => Math.max(1240, prev + userDelta));
      }

      const dexes = ['Cetus', 'Turbos', 'DeepBook'];
      const amounts = ['120 SUI', '450 USDC', '1,200 DEEP', '80 SUI'];
      const randomDex = dexes[Math.floor(Math.random() * dexes.length)];
      const randomAmount = amounts[Math.floor(Math.random() * amounts.length)];
      
      setRecentTrade({ amount: randomAmount, dex: randomDex });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Format currency
  const formatVol = (val: number) => {
    return '$' + (val / 1000000).toFixed(2) + 'M';
  };

  return (
    <div className="w-full mt-6">
      {/* 4 Glassmorphism Interactive DeFi Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* ═══ WIDGET 1: TOTAL VOLUME ═══ */}
        <div className="card-glass-widget rounded-3xl p-5 relative overflow-hidden group cursor-pointer border border-white/80">
          {/* Ambient glass reflections */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-pink-400/10 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-400/20 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-pink-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Top Bar: Icon + Live Indicator + Trend */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-50 to-rose-100/90 text-pink-600 border border-pink-200/90 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:shadow-pink-200/50 transition-all">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pink-50/80 border border-pink-200/60 text-[10px] font-mono font-bold text-pink-600">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                LIVE 24H
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50/90 text-emerald-600 border border-emerald-200/80 text-[11px] font-mono font-bold shadow-xs">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+24.6%</span>
            </div>
          </div>

          {/* Metric Value & Label */}
          <div className="relative z-10 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight font-display group-hover:text-pink-600 transition-colors">
                {formatVol(volume)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-semibold">USD</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mt-0.5">
              Total 24h Volume
            </div>
          </div>

          {/* Mini Interactive Sparkline & Visual Trend */}
          <div className="relative z-10 pt-1">
            <div className="h-10 w-full relative flex items-end">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 160 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F05391" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#F05391" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,32 Q25,28 45,30 T90,18 T130,12 T160,6 L160,40 L0,40 Z"
                  fill="url(#pinkGrad)"
                />
                <path
                  d="M0,32 Q25,28 45,30 T90,18 T130,12 T160,6"
                  fill="none"
                  stroke="#F05391"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {/* Live pulsing coordinate node */}
                <circle cx="160" cy="6" r="3.5" fill="#F05391" />
                <circle cx="160" cy="6" r="6" fill="#F05391" opacity="0.4" className="animate-ping" />
              </svg>
            </div>

            {/* Micro DEX Breakdown footer */}
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                Cetus 58%
              </span>
              <span className="flex items-center gap-1 font-semibold text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Turbos 29%
              </span>
              <span className="text-slate-400">DeepBook 13%</span>
            </div>
          </div>
        </div>

        {/* ═══ WIDGET 2: ACTIVE USERS ═══ */}
        <div className="card-glass-widget rounded-3xl p-5 relative overflow-hidden group cursor-pointer border border-white/80">
          {/* Ambient glass reflections */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-blue-400/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-400/20 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Top Bar: Icon + Live Radar + Today Stat */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-100/90 text-blue-600 border border-blue-200/90 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:shadow-blue-200/50 transition-all">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/60 text-[10px] font-mono font-bold text-blue-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                RADAR
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50/90 text-blue-700 border border-blue-200/80 text-[11px] font-mono font-bold shadow-xs">
              <span>+210 today</span>
            </div>
          </div>

          {/* Metric Value & Label */}
          <div className="relative z-10 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight font-display group-hover:text-blue-600 transition-colors">
                {activeUsers.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-slate-400 font-semibold">traders</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mt-0.5">
              Active Sui Wallets
            </div>
          </div>

          {/* Dynamic 7-bar activity histogram */}
          <div className="relative z-10 pt-1">
            <div className="h-10 w-full flex items-end justify-between gap-1.5 px-1">
              {[45, 62, 58, 80, 68, 92, 75].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                  <div 
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      i === 5 
                        ? 'bg-gradient-to-t from-blue-500 to-indigo-500 shadow-xs shadow-blue-300' 
                        : 'bg-blue-200/70 group-hover:bg-blue-300/90'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>

            {/* Concurrency detail footer */}
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1 text-blue-600 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                42 swapping now
              </span>
              <span className="text-slate-400 font-medium">Retention 91%</span>
            </div>
          </div>
        </div>

        {/* ═══ WIDGET 3: ROUTES FOUND ═══ */}
        <div className="card-glass-widget rounded-3xl p-5 relative overflow-hidden group cursor-pointer border border-white/80">
          {/* Ambient glass reflections */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-400/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-400/20 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Top Bar: Icon + Speed Badge + Status */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-50 to-orange-100/90 text-amber-600 border border-amber-200/90 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:shadow-amber-200/50 transition-all">
                <Globe className="w-5 h-5" />
              </div>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50/80 border border-amber-200/60 text-[10px] font-mono font-bold text-amber-700">
                <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                84ms AVG
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50/90 text-amber-700 border border-amber-200/80 text-[11px] font-mono font-bold shadow-xs">
              <span>Multi-DEX</span>
            </div>
          </div>

          {/* Metric Value & Label */}
          <div className="relative z-10 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight font-display group-hover:text-amber-600 transition-colors">
                {routesCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">FAST</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mt-0.5">
              Routes Optimized
            </div>
          </div>

          {/* Interactive Multi-DEX Route Stream Visualizer */}
          <div className="relative z-10 pt-1">
            <div className="h-10 w-full flex items-center">
              <div className="w-full bg-slate-100/90 p-2 rounded-xl border border-slate-200/70 flex items-center justify-between gap-1 relative overflow-hidden group-hover:border-amber-200 transition-colors">
                {/* Simulated route beam tracer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                
                <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-mono font-bold text-slate-700 shadow-xs border border-slate-200/60">
                  Input
                </span>
                <span className="h-[2px] flex-1 bg-gradient-to-r from-pink-400 via-amber-400 to-emerald-400 relative" />
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-mono font-bold text-amber-700 border border-amber-200/80">
                  CLMM
                </span>
                <span className="h-[2px] flex-1 bg-gradient-to-r from-amber-400 to-emerald-400" />
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-mono font-bold text-emerald-700 border border-emerald-200/80">
                  Atomic
                </span>
              </div>
            </div>

            {/* Routing detail footer */}
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span className="text-slate-600 font-semibold">Zero MEV Slip</span>
              <span className="text-amber-700 font-bold">100% Success</span>
            </div>
          </div>
        </div>

        {/* ═══ WIDGET 4: GUARDIAN UPTIME ═══ */}
        <div className="card-glass-widget rounded-3xl p-5 relative overflow-hidden group cursor-pointer border border-white/80">
          {/* Ambient glass reflections */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-400/20 transition-colors" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Top Bar: Icon + 8/8 Audit Pass Badge */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-100/90 text-emerald-600 border border-emerald-200/90 flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:shadow-emerald-200/50 transition-all">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50/80 border border-emerald-200/60 text-[10px] font-mono font-bold text-emerald-700">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                8/8 CHECKS
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 text-[11px] font-mono font-bold shadow-xs">
              <span>Audited</span>
            </div>
          </div>

          {/* Metric Value & Label */}
          <div className="relative z-10 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight font-display group-hover:text-emerald-600 transition-colors">
                99.99%
              </span>
              <span className="text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">SLO</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mt-0.5">
              Guardian Oracle Uptime
            </div>
          </div>

          {/* Live Node Status Matrix (12 green operational ticks) */}
          <div className="relative z-10 pt-1">
            <div className="h-10 w-full flex items-center justify-between gap-1.5 px-0.5">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className={`h-6 flex-1 rounded-sm transition-all duration-300 ${
                    i === 11
                      ? 'bg-emerald-500 shadow-xs shadow-emerald-400 animate-pulse'
                      : 'bg-emerald-400/80 group-hover:bg-emerald-400'
                  }`}
                  title={`Epoch Node ${i + 1}: 100% Operational`}
                />
              ))}
            </div>

            {/* Oracle Verification Footer */}
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Pyth + Sui Synced
              </span>
              <span className="text-slate-400 font-medium">0 Violations</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
