import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Wallet, Sparkles, ExternalLink, Info, History as HistoryIcon, ShieldCheck, Check } from 'lucide-react';
import { ProHeader } from './ProHeader';
import { SkullBuddy } from './SkullBuddy';
import { ProRouteVisualizer } from './ProRouteVisualizer';
import { ProGuardianRadar } from './ProGuardianRadar';
import { MarketSidebar } from './MarketSidebar';
import { HistoryPanel } from './HistoryPanel';
import type { RiskCheck, RouteNode, PtbStep, SwapSnapshot } from '../../types/shared';
import { makeHistoryId } from '../../utils/explorer';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';

const HISTORY_KEY = 'soka:swap-history';
const LEGACY_HISTORY_KEY = 'adidahood:swap-history';
const MAX_HISTORY = 12;

const pnlLeaders = [
  { addr: '0x8f3a…c007', pnl: '+184.2%' },
  { addr: '0x2b91…4d11', pnl: '+127.8%' },
  { addr: '0x7c44…a9f2', pnl: '+96.5%' },
  { addr: '0x1a02…b33e', pnl: '+74.1%' },
];

const MiniStat: React.FC<{ label: string; value: string; accent?: boolean; warn?: boolean; danger?: boolean }> = ({ label, value, accent, warn, danger }) => (
  <div className="metric text-left">
    <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[#1a1a2e]/30">{label}</div>
    <div className={`mt-1 truncate font-mono text-[13px] font-bold ${danger ? 'text-[#ef4444]' : warn ? 'text-[#f59e0b]' : accent ? 'text-[#10b981]' : 'text-[#1a1a2e]'}`} title={value}>{value}</div>
  </div>
);

function migrateLegacyHistory(): SwapSnapshot[] {
  try {
    const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (!raw) return [];
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    const legacy = arr.filter((x): x is string => typeof x === 'string');
    localStorage.removeItem(LEGACY_HISTORY_KEY);
    return legacy.map((prompt) => ({ id: makeHistoryId(), prompt, status: 'SIMULATED', createdAt: Date.now(), routeNodes: [], checks: [], ptbSteps: [] }));
  } catch { return []; }
}

function buildDemoHistory(): SwapSnapshot[] {
  const now = Date.now();
  const checks = (impact: 'SAFE' | 'WARNING' | 'DANGER'): RiskCheck[] => [
    { name: 'Price Impact', status: impact, message: 'Effective impact vs slippage curve' },
    { name: 'Liquidity Risk', status: impact === 'DANGER' ? 'DANGER' : impact === 'WARNING' ? 'WARNING' : 'SAFE', message: 'Trade size vs pool depth' },
    { name: 'DEX Verification', status: impact === 'DANGER' ? 'WARNING' : 'SAFE', message: 'Creator matches audited protocol' },
    { name: 'Liquidity Health', status: impact === 'WARNING' ? 'WARNING' : impact === 'DANGER' ? 'DANGER' : 'SAFE', message: 'Pool age & activity verified on-chain' },
  ];
  const ptb = (n: number, dex = 'cetus', fromSui = true): PtbStep[] => {
    const steps: PtbStep[] = [];
    steps.push(fromSui ? { index: 1, command: 'SplitCoins', description: 'Split SUI for gas + swap input' } : { index: 1, command: 'MergeCoins', description: 'Merge selected coin objects' });
    let i = 2;
    for (let h = 0; h < n; h++) steps.push({ index: i++, command: 'MoveCall', target: `${dex}::swap::exact_in`, description: `${dex}::swap::exact_in` });
    steps.push({ index: i, command: 'TransferObjects', description: 'Send output to your wallet' });
    return steps;
  };
  const route = (arr: Array<[string, number, number]>): RouteNode[] =>
    arr.map(([dex, ratio, fee], i) => ({ dex, ratio, fee, weight: ratio, liquidityUsd: 250000 + i * 90000, poolAddress: `0x${(i + 1).toString(16).padStart(4, '0')}eabed72c53f027380872d35c6301cc6a7dc9dfe5e9f1fdc4c3f1a2b3c4d5e${(i + 7).toString(16)}` }));
  return [
    { id: makeHistoryId(), prompt: 'Swap 1 SUI to USDC', status: 'CONFIRMED', createdAt: now - 33 * 864e5, amount: '1', sourceSymbol: 'SUI', destSymbol: 'USDC', expectedOutput: '0.68671', executionImpact: '0.05%', slippage: '0.08%', gasEstimate: '0.0042 SUI', guardianScore: 96, guardianRiskLevel: 'LOW', guardianSafe: true, txDigest: '0x8f3a2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', routeNodes: route([['CETUS', 70, 0.01], ['BLUEFIN', 30, 0]]), checks: checks('SAFE'), ptbSteps: ptb(2, 'cetus') },
    { id: makeHistoryId(), prompt: 'Swap 500 SUI for CETUS', status: 'SIMULATED', createdAt: now - 2 * 36e5, amount: '500', sourceSymbol: 'SUI', destSymbol: 'CETUS', expectedOutput: '12844.52', executionImpact: '1.2%', slippage: '1.9%', gasEstimate: '0.005 SUI', guardianScore: 72, guardianRiskLevel: 'MEDIUM', guardianSafe: true, routeNodes: route([['CETUS', 55, 0.01], ['TURBOS', 30, 0.05], ['DEEPBOOK', 15, 0.025]]), checks: checks('WARNING'), ptbSteps: ptb(3, 'cetus') },
    { id: makeHistoryId(), prompt: 'Swap 10000 SUI to DEEP', status: 'SIMULATED', createdAt: now - 90 * 60e3, amount: '10000', sourceSymbol: 'SUI', destSymbol: 'DEEP', expectedOutput: '6090000', executionImpact: '5.8%', slippage: '12.5%', gasEstimate: '0.02 SUI', guardianScore: 18, guardianRiskLevel: 'CRITICAL', guardianSafe: false, routeNodes: route([['CETUS', 40, 0.01], ['AFTERMATH', 35, 0.05], ['KRIYA', 25, 0.03]]), checks: checks('DANGER'), ptbSteps: ptb(3, 'cetus') },
  ];
}

function loadHistory(): SwapSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    const valid = Array.isArray(arr) ? arr : [];
    const normalized: SwapSnapshot[] = [];
    for (const x of valid) {
      if (!x || typeof x !== 'object' || typeof x.prompt !== 'string' || !Array.isArray(x.routeNodes) || !Array.isArray(x.checks) || !Array.isArray(x.ptbSteps)) continue;
      const id = typeof x.id === 'string' && x.id ? x.id : makeHistoryId();
      if (seen.has(id)) continue;
      seen.add(id);
      normalized.push({ ...x, id });
    }
    if (normalized.length === 0 && localStorage.getItem(LEGACY_HISTORY_KEY)) return migrateLegacyHistory().slice(0, MAX_HISTORY);
    if (normalized.length === 0) { const seeded = buildDemoHistory(); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded)); } catch { /* */ } return seeded; }
    return normalized.slice(0, MAX_HISTORY);
  } catch { return []; }
}

export const ProSwapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();
  const suiClient = useCurrentClient();
  const walletAddress = currentAccount?.address || null;
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [intentPrompt, setIntentPrompt] = useState<string>(searchParams.get('intent') || "");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [history, setHistory] = useState<SwapSnapshot[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const activeSwapRef = useRef<SwapSnapshot | null>(null);
  const [sourceSymbol, setSourceSymbol] = useState<string>("SUI");
  const [destSymbol, setDestSymbol] = useState<string>("USDC");
  const [tradeAmount, setTradeAmount] = useState<string>("100");
  const [expectedOutput, setExpectedOutput] = useState<string>("0.00");
  const [executionImpact, setExecutionImpact] = useState<string>("0.05%");
  const [optimalSlippage, setOptimalSlippage] = useState<string>("0.50%");
  const [sourceLogo, setSourceLogo] = useState<string | null>(null);
  const [destLogo, setDestLogo] = useState<string | null>(null);
  const [routeNodes, setRouteNodes] = useState<RouteNode[]>([]);
  const [ptbData, setPtbData] = useState<any | null>(null);
  const [guardianScore, setGuardianScore] = useState<number>(95);
  const [guardianRiskLevel, setGuardianRiskLevel] = useState<string>("LOW");
  const [guardianSafe, setGuardianSafe] = useState<boolean>(true);
  const [guardianChecks, setGuardianChecks] = useState<RiskCheck[]>([]);
  const [hasConfirmedSettings, setHasConfirmedSettings] = useState<boolean>(false);
  const [tokenSuggestion, setTokenSuggestion] = useState<any | null>(null);
  const [alternativeSource, setAlternativeSource] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const upsertHistory = (id: string, patch: Partial<SwapSnapshot>) => {
    setHistory(prev => { const next = prev.map(x => (x.id === id ? { ...x, ...patch } : x)); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* */ } return next; });
    if (activeSwapRef.current && activeSwapRef.current.id === id) activeSwapRef.current = { ...activeSwapRef.current, ...patch };
  };

  const clearHistory = () => { setHistory([]); setExpandedHistory(null); try { localStorage.removeItem(HISTORY_KEY); } catch { /* */ } };

  const handleCancelSwap = () => {
    setRouteNodes([]); setGuardianChecks([]); setGuardianSafe(true); setErrorMessage(null); setTxDigest(null);
    setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setHasConfirmedSettings(false);
    activeSwapRef.current = null; setCancelMsg('Order cancelled. Want to try a different swap? ⚡');
  };

  const deleteHistoryEntry = (id: string) => { setHistory(prev => { const next = prev.filter(x => x.id !== id); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* */ } return next; }); setExpandedHistory(prev => (prev === id ? null : prev)); if (activeSwapRef.current?.id === id) activeSwapRef.current = null; };

  useEffect(() => { const initialIntent = searchParams.get('intent'); if (initialIntent) handleProcessIntent(initialIntent); }, [searchParams]);

  const handleProcessIntent = async (promptToRun?: string) => {
    const prompt = promptToRun || intentPrompt;
    if (!prompt.trim() || isProcessing) return;
    const swapId = makeHistoryId();
    const snapshot: SwapSnapshot = { id: swapId, prompt, status: 'SIMULATED', createdAt: Date.now(), routeNodes: [], checks: [], ptbSteps: [] };
    activeSwapRef.current = snapshot;
    setHistory(prev => { const already = prev[0]; const isDup = !!already && already.prompt === prompt && already.status === 'SIMULATED' && already.routeNodes.length === 0 && Date.now() - already.createdAt < 5000; if (isDup) { activeSwapRef.current = already; return prev; } const next = [snapshot, ...prev.filter(x => x.id !== snapshot.id)].slice(0, MAX_HISTORY); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* */ } return next; });
    setIsProcessing(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setCancelMsg(null);
    try {
      const res = await fetch('/api/process-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, senderAddress: walletAddress || '0x0000000000000000000000000000000000000000000000000000000000000000' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process swap intent');
      if (data.tokenSuggestion) { setTokenSuggestion(data.tokenSuggestion); setIsProcessing(false); upsertHistory(swapId, { status: 'FAILED' }); return; }
      if (data.alternativeSource) setAlternativeSource(data.alternativeSource);
      if (data.intent) { setSourceSymbol(data.intent.source_token_symbol || 'SUI'); setDestSymbol(data.intent.destination_token_symbol || 'USDC'); setTradeAmount(data.intent.trade_amount || '100'); }
      const patch: Partial<SwapSnapshot> = { sourceSymbol: data.intent?.source_token_symbol || undefined, destSymbol: data.intent?.destination_token_symbol || undefined, amount: data.intent?.trade_amount || undefined };
      if (data.route) { setRouteNodes(data.route.route || []); setExpectedOutput(Number(data.route.expected_output || 0).toFixed(4)); setExecutionImpact(data.route.execution_impact || '0.05%'); patch.routeNodes = data.route.route || []; patch.expectedOutput = Number(data.route.expected_output || 0).toFixed(4); patch.executionImpact = data.route.execution_impact || '0.05%'; }
      if (data.guardian) { setGuardianSafe(data.guardian.safe); setGuardianScore(data.guardian.score || 90); setGuardianRiskLevel(data.guardian.riskLevel || 'LOW'); setGuardianChecks(data.guardian.checks || []); patch.guardianSafe = !!data.guardian.safe; patch.guardianScore = data.guardian.score || 90; patch.guardianRiskLevel = data.guardian.riskLevel || 'LOW'; patch.checks = data.guardian.checks || []; }
      if (data.ptb) { setPtbData(data.ptb); if (data.ptb.slippage) { setOptimalSlippage(`${data.ptb.slippage}%`); patch.slippage = `${data.ptb.slippage}%`; } patch.ptbSteps = data.ptb.ptbSteps || []; if (data.ptb.simulation?.estGas) { const mist = Number(data.ptb.simulation.estGas); patch.gasEstimate = !isNaN(mist) ? `${(mist / 1e9).toFixed(4)} SUI` : undefined; } }
      if (data.tokenLogos) { setSourceLogo(data.tokenLogos.source); setDestLogo(data.tokenLogos.dest); }
      upsertHistory(swapId, patch);
    } catch (err: any) { setErrorMessage(err.message || 'Error communicating with SOKA Engine'); upsertHistory(swapId, { status: 'FAILED' }); }
    finally { setIsProcessing(false); }
  };

  const handleExecuteSwap = async () => {
    if (!currentAccount) { setIsWalletModalOpen(true); return; }
    if (isExecuting) return;
    setIsExecuting(true); setErrorMessage(null);
    try {
      const res = await fetch('/api/execute-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderAddress: currentAccount.address, sourceSymbol, destSymbol, amount: tradeAmount, slippage: parseFloat(optimalSlippage.replace('%', '')) || 0.5 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build transaction block');
      if (data.transactionBytes) {
        const { Transaction } = await import('@mysten/sui/transactions');
        const tx = Transaction.from(data.transactionBytes);
        const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
        const digest = (result as any).digest || (result as any).Transaction?.digest || (result as any).effects?.transactionDigest;
        if (!digest) throw new Error('No digest returned.');
        setTxDigest(digest);
        if (activeSwapRef.current) upsertHistory(activeSwapRef.current.id, { status: 'CONFIRMED', txDigest: digest });
      } else throw new Error('Simulation completed, but no transaction bytes were compiled.');
    } catch (err: any) { setErrorMessage(err.message || 'Swap execution failed.'); if (activeSwapRef.current) upsertHistory(activeSwapRef.current.id, { status: 'FAILED' }); }
    finally { setIsExecuting(false); }
  };

  const quickPrompts = ["Swap 10 SUI to USDC", "Swap 100 SUI to CETUS", "Swap 50% SUI to DEEP", "Swap 500 SUI for USDC with safe route"];
  const hasResult = routeNodes.length > 0 || guardianChecks.length > 0;
  const hasRiskWarnings = guardianChecks.some(c => c.status === 'WARNING' || c.status === 'DANGER') || !guardianSafe;
  const onPickMarket = (sym: string) => { const p = `Swap 100 ${sym} to USDC`; setIntentPrompt(p); handleProcessIntent(p); };

  return (
    <div className="h-[100dvh] w-full canvas-bg text-[#1a1a2e] flex flex-col overflow-hidden">
      <div className="absolute top-[20%] left-[5%] w-[300px] h-[300px] rounded-full bg-[#6366f1]/[0.03] blur-[100px] pointer-events-none" />
      <ProHeader onOpenWalletModal={() => setIsWalletModalOpen(true)} />

      <div className="border-y border-white/30 bg-white/20 overflow-hidden shrink-0">
        <div className="flex whitespace-nowrap py-2">
          <span className="px-4 font-mono text-xs text-[#1a1a2e]/30">
            ◆ SOKA • AI-POWERED SWAPS • SUI NETWORK ◆ SOKA • AI-POWERED SWAPS • SUI NETWORK ◆&nbsp;
          </span>
        </div>
      </div>

      <main className="flex-1 min-h-0 w-full mx-auto flex justify-center px-3 sm:px-6 py-4 gap-4 relative z-10">
        <aside className="hidden lg:block w-[280px] shrink-0"><MarketSidebar onPick={onPickMarket} /></aside>

        <div className="flex-1 min-h-0 max-w-[1080px] glass-strong overflow-hidden flex flex-col">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/30 bg-white/20 shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
            <span className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
            <span className="w-3 h-3 rounded-full bg-[#10b981]/60" />
            <span className="ml-3 font-mono text-[10px] font-medium text-[#1a1a2e]/40">SOKA.EXE ★ PROCESSING</span>
          </div>

          <div className="flex-1 min-h-0 flex">
            <div className="flex flex-col min-h-0 w-full">
              {/* Panel header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/20 bg-white/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center">
                    <SkullBuddy size={42} mood="happy" className="!animate-none skull-glow" />
                  </div>
                  <div>
                    <div className="font-bold text-[15px] text-[#1a1a2e]" style={{ fontFamily: 'var(--font-display)' }}>SOKA AI</div>
                    <div className="text-[10px] font-mono text-[#10b981] flex items-center gap-1"><span className="dot dot-success" /> Online</div>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setHistoryOpen(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[10px] font-medium transition-all ${historyOpen ? 'bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20' : 'bg-white/30 text-[#1a1a2e]/50 border-white/40 hover:bg-white/40'}`}>
                    <HistoryIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">History</span>
                    {history.length > 0 && <span className="ml-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#6366f1] text-white text-[8px] font-bold flex items-center justify-center">{history.length > 9 ? '9+' : history.length}</span>}
                  </button>
                  <button onClick={() => { setIntentPrompt(''); setRouteNodes([]); setGuardianChecks([]); setErrorMessage(null); setTxDigest(null); activeSwapRef.current = null; }} className="w-8 h-8 rounded-lg bg-white/30 border border-white/40 flex items-center justify-center hover:bg-white/50 transition-all">
                    <span className="text-[#1a1a2e]/50 text-sm">+</span>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-4" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.02) 100%)' }}>
                <div className="flex flex-col gap-3 w-full">
                  {/* Intro */}
                  <div className="flex items-end gap-2">
                    <SkullBuddy size={42} mood="happy" className="shrink-0 !animate-none" />
                    <div className="glass p-4 max-w-[80%]">
                      <div className="font-mono text-[9px] font-semibold tracking-[0.12em] text-[#6366f1] mb-0.5">SOKA ★</div>
                      <div className="text-[14px] font-medium text-[#1a1a2e]/80">Tell me your dream swap. I sniff the route and run 7 checks — no jargon, just vibes ⚡</div>
                    </div>
                  </div>

                  {intentPrompt.trim() !== '' && (
                    <div className="flex justify-end">
                      <div className="glass-accent p-4 max-w-[80%]">
                        <div className="font-mono text-[9px] font-semibold tracking-[0.12em] text-[#6366f1] mb-0.5 text-right">YOU ★</div>
                        <div className="text-[14px] font-medium text-[#1a1a2e]/80 break-words">{intentPrompt}</div>
                      </div>
                    </div>
                  )}

                  {/* Token suggestion */}
                  {!hasResult && !isProcessing && (tokenSuggestion || alternativeSource) && (
                    <div className="flex flex-col gap-3 w-full">
                      {tokenSuggestion && (
                        <div className="glass p-4">
                          <div className="flex items-center gap-2 mb-2"><Info className="w-4 h-4 text-[#6366f1]" /><span className="font-mono text-[11px] font-semibold text-[#1a1a2e]">Pick the exact token</span></div>
                          <p className="text-[11px] font-mono text-[#1a1a2e]/50 mb-3">{tokenSuggestion.message}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {tokenSuggestion.candidates?.map((c: any, i: number) => (
                              <button key={i} onClick={() => { if (c.retryPrompt) { setIntentPrompt(c.retryPrompt); handleProcessIntent(c.retryPrompt); } }} className="p-3 rounded-lg bg-white/30 hover:bg-white/50 border border-white/40 text-left font-mono text-[11px] transition-all">
                                <span className="block font-semibold text-[#1a1a2e]">{c.symbol} ({c.name})</span>
                                <span className="text-[10px] text-[#1a1a2e]/40 break-all">{c.coinType.slice(0, 34)}…</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Results */}
                  {hasResult && !isProcessing && (
                    <div className="flex flex-col gap-2.5 w-full max-w-[780px]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Est. Output" value={`${expectedOutput} ${destSymbol}`} accent />
                        <MiniStat label="Impact" value={executionImpact} warn={parseFloat(executionImpact) >= 1} />
                        <MiniStat label="Slippage" value={optimalSlippage} />
                        <MiniStat label="Guardian" value={`${guardianScore}/100`} danger={!guardianSafe} />
                      </div>
                      {routeNodes.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap rounded-lg border border-white/30 bg-white/20 px-3 py-2">
                          <span className="font-mono text-[8px] font-semibold uppercase tracking-wider text-[#1a1a2e]/25">Route</span>
                          <span className="font-mono text-[11px] font-semibold text-[#1a1a2e]">{tradeAmount} {sourceSymbol}</span>
                          <span className="text-[#1a1a2e]/20">→</span>
                          {routeNodes.slice(0, 3).map((n, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="rounded-md bg-[#6366f1]/10 border border-[#6366f1]/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#6366f1]">{n.dex}</span>
                              {i < Math.min(routeNodes.length, 3) - 1 && <span className="text-[#1a1a2e]/20">→</span>}
                            </span>
                          ))}
                          <span className="text-[#1a1a2e]/20">→</span>
                          <span className="font-mono text-[11px] font-semibold text-[#10b981]">{expectedOutput} {destSymbol}</span>
                        </div>
                      )}
                      {guardianChecks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {guardianChecks.slice(0, 4).map((c, i) => (
                            <span key={i} className={`rounded-md border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold ${c.status === 'DANGER' ? 'border-[#ef4444]/20 bg-[#ef4444]/8 text-[#ef4444]' : c.status === 'WARNING' ? 'border-[#f59e0b]/20 bg-[#f59e0b]/8 text-[#f59e0b]' : 'border-[#10b981]/20 bg-[#10b981]/6 text-[#10b981]'}`}>
                              {c.name}: {c.status}
                            </span>
                          ))}
                        </div>
                      )}
                      {errorMessage && <div className="flex items-center gap-1.5 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/8 px-2 py-1 font-mono text-[9.5px] font-semibold text-[#ef4444]"><AlertCircle className="h-3 w-3 shrink-0" /> {errorMessage}</div>}
                      {txDigest && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#10b981]/20 bg-[#10b981]/8 px-2 py-1 font-mono text-[10px]">
                          <span className="flex items-center gap-1.5 font-semibold text-[#10b981]"><CheckCircle2 className="h-3.5 w-3.5" /> Swap confirmed!</span>
                          <a href={`https://suiscan.xyz/mainnet/tx/${txDigest}`} target="_blank" rel="noreferrer" className="rounded-md bg-[#6366f1] px-2 py-0.5 text-[9px] font-semibold text-white inline-flex items-center gap-1">Suiscan <ExternalLink className="h-2.5 w-2.5" /></a>
                        </div>
                      )}
                      {hasRiskWarnings && (
                        <div className="flex items-center gap-2 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/5 px-3 py-2 cursor-pointer select-none hover:bg-[#ef4444]/8" onClick={() => setHasConfirmedSettings(!hasConfirmedSettings)}>
                          <button role="checkbox" aria-checked={hasConfirmedSettings} onClick={(e) => { e.stopPropagation(); setHasConfirmedSettings(!hasConfirmedSettings); }} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hasConfirmedSettings ? 'bg-[#10b981] border-[#10b981]' : 'bg-transparent border-[#ef4444]/30'}`}>
                            <Check className="w-3 h-3 text-white" />
                          </button>
                          <span className="font-mono text-[9.5px] font-semibold text-[#ef4444]">I acknowledge the on-chain risk warnings.</span>
                        </div>
                      )}
                      <div className="flex items-stretch gap-2">
                        <button onClick={handleExecuteSwap} disabled={isExecuting || (!guardianSafe && !hasConfirmedSettings)} className={`flex-1 py-3 rounded-lg font-mono text-[12px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${!guardianSafe && !hasConfirmedSettings ? 'bg-white/20 text-[#1a1a2e]/20 border-white/30 cursor-not-allowed' : 'btn-primary'}`}>
                          {isExecuting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Signing...</> : !currentAccount ? <><Wallet className="w-3.5 h-3.5" /> Connect Wallet</> : !guardianSafe && !hasConfirmedSettings ? <span>Acknowledge Risk</span> : <><span>Execute ({tradeAmount} {sourceSymbol} → {destSymbol})</span><ArrowRight className="w-3.5 h-3.5" /></>}
                        </button>
                        <button onClick={() => setShowDetails(v => !v)} className="px-3 py-2 rounded-lg border border-white/30 bg-white/20 font-mono text-[10px] font-medium text-[#1a1a2e]/50 hover:bg-white/30 transition-colors">{showDetails ? 'Hide ▲' : 'Details ▼'}</button>
                        <button onClick={handleCancelSwap} className="px-3 py-2 rounded-lg border border-[#ef4444]/20 bg-white/20 font-mono text-[10px] font-medium text-[#ef4444] hover:bg-[#ef4444]/8 transition-colors">Cancel</button>
                      </div>
                      {showDetails && (
                        <div className="flex flex-col gap-2.5 w-full max-h-[330px] overflow-y-auto custom-scrollbar rounded-lg pr-1">
                          <ProRouteVisualizer sourceSymbol={sourceSymbol} destSymbol={destSymbol} amount={tradeAmount} expectedOutput={expectedOutput} routeNodes={routeNodes} executionImpact={executionImpact} slippage={optimalSlippage} sourceLogo={sourceLogo} destLogo={destLogo} />
                          <ProGuardianRadar score={guardianScore} riskLevel={guardianRiskLevel} checks={guardianChecks} />
                        </div>
                      )}
                    </div>
                  )}

                  {cancelMsg && !isProcessing && !hasResult && (
                    <div className="flex items-end gap-2">
                      <SkullBuddy size={42} mood="chill" className="shrink-0 !animate-none" />
                      <div className="glass p-4 max-w-[85%]"><div className="font-mono text-[9px] font-semibold tracking-[0.12em] text-[#6366f1] mb-0.5">SOKA ★</div><div className="text-[13px] font-medium text-[#1a1a2e]/80">{cancelMsg}</div></div>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="flex items-end gap-2">
                      <SkullBuddy size={42} mood="thinking" className="shrink-0 !animate-none" />
                      <div className="glass p-4"><div className="flex items-center gap-2 font-mono text-[12px] font-medium text-[#1a1a2e]/50"><span className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" /><span className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" style={{ animationDelay: '0.15s' }} /><span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-pulse" style={{ animationDelay: '0.3s' }} />sniffing pools…</div></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Composer */}
              <div className="px-3 pb-3 pt-2 shrink-0 border-t border-white/20 bg-white/10">
                <form onSubmit={(e) => { e.preventDefault(); handleProcessIntent(); }} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <input type="text" value={intentPrompt} onChange={(e) => setIntentPrompt(e.target.value)} placeholder={'Try "Swap 100 SUI to USDC, safest route"…'} className="w-full px-4 py-3 pr-10 rounded-lg input-glass font-mono text-sm outline-none" />
                    <span className="absolute right-3 bottom-1/2 translate-y-1/2 text-[10px] font-mono text-[#1a1a2e]/20 pointer-events-none hidden sm:block">ENTER</span>
                  </div>
                  <button type="submit" disabled={isProcessing || !intentPrompt.trim()} className="btn-primary !rounded-lg px-5 py-3 text-sm shrink-0 disabled:opacity-50">
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send ⚡</span>}
                  </button>
                </form>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {quickPrompts.map((q) => (
                    <button key={q} type="button" disabled={isProcessing} onClick={() => { setIntentPrompt(q); handleProcessIntent(q); }} className="text-[10px] font-mono font-medium text-[#1a1a2e]/40 bg-white/30 hover:bg-white/50 border border-white/30 rounded-full px-2.5 py-1 transition-all disabled:opacity-50">{q}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {historyOpen && <HistoryPanel history={history} expandedId={expandedHistory} onToggle={(id) => setExpandedHistory(expandedHistory === id ? null : id)} onRerun={(snap) => { setIntentPrompt(snap.prompt); setHistoryOpen(false); handleProcessIntent(snap.prompt); }} onDelete={deleteHistoryEntry} onClear={clearHistory} onClose={() => setHistoryOpen(false)} />}
      <ConnectModal open={isWalletModalOpen} onOpenChange={(isOpen: boolean) => setIsWalletModalOpen(isOpen)} />
    </div>
  );
};
