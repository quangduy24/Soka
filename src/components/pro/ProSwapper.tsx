import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Wallet, Sparkles, ExternalLink, Info, History as HistoryIcon, Check } from 'lucide-react';
import { ProHeader } from './ProHeader';
import { SkullBuddy } from './SkullBuddy';
import { ProRouteVisualizer } from './ProRouteVisualizer';
import { ProGuardianRadar } from './ProGuardianRadar';
import { HistoryPanel } from './HistoryPanel';
import type { RiskCheck, RouteNode, PtbStep, SwapSnapshot } from '../../types/shared';
import { makeHistoryId } from '../../utils/explorer';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';

const HISTORY_KEY = 'soka:swap-history';
const LEGACY_HISTORY_KEY = 'adidahood:swap-history';
const MAX_HISTORY = 12;

const MiniStat: React.FC<{ label: string; value: string; accent?: boolean; warn?: boolean; danger?: boolean }> = ({ label, value, accent, warn, danger }) => (
  <div className="metric text-left">
    <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#0f172a]/30">{label}</div>
    <div className={`mt-1.5 truncate font-mono text-[14px] font-bold ${danger ? "text-[#ef4444]" : warn ? "text-[#f59e0b]" : accent ? "text-[#10b981]" : "text-[#0f172a]"}`} title={value}>{value}</div>
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
    return legacy.map((prompt) => ({ id: makeHistoryId(), prompt, status: "SIMULATED", createdAt: Date.now(), routeNodes: [], checks: [], ptbSteps: [] }));
  } catch { return []; }
}

function buildDemoHistory(): SwapSnapshot[] {
  const now = Date.now();
  const checks = (impact: "SAFE" | "WARNING" | "DANGER"): RiskCheck[] => [
    { name: "Price Impact", status: impact, message: "Effective impact vs slippage curve" },
    { name: "Liquidity Risk", status: impact === "DANGER" ? "DANGER" : impact === "WARNING" ? "WARNING" : "SAFE", message: "Trade size vs pool depth" },
    { name: "DEX Verification", status: impact === "DANGER" ? "WARNING" : "SAFE", message: "Creator matches audited protocol" },
    { name: "Liquidity Health", status: impact === "WARNING" ? "WARNING" : impact === "DANGER" ? "DANGER" : "SAFE", message: "Pool age verified on-chain" },
  ];
  const ptb = (n: number, dex = "cetus", fromSui = true): PtbStep[] => {
    const steps: PtbStep[] = [];
    steps.push(fromSui ? { index: 1, command: "SplitCoins", description: "Split SUI for gas + swap input" } : { index: 1, command: "MergeCoins", description: "Merge selected coin objects" });
    let i = 2;
    for (let h = 0; h < n; h++) steps.push({ index: i++, command: "MoveCall", target: `${dex}::swap::exact_in`, description: `${dex}::swap::exact_in` });
    steps.push({ index: i, command: "TransferObjects", description: "Send output to your wallet" });
    return steps;
  };
  const route = (arr: Array<[string, number, number]>): RouteNode[] =>
    arr.map(([dex, ratio, fee], i) => ({ dex, ratio, fee, weight: ratio, liquidityUsd: 250000 + i * 90000, poolAddress: "0x" + (i + 1).toString(16).padStart(4, "0") + "eabed72c53f027380872d35c6301cc6a7dc9dfe5e9f1fdc4c3f1a2b3c4d5e" + (i + 7).toString(16) }));
  return [
    { id: makeHistoryId(), prompt: "Swap 1 SUI to USDC", status: "CONFIRMED", createdAt: now - 33 * 864e5, amount: "1", sourceSymbol: "SUI", destSymbol: "USDC", expectedOutput: "0.68671", executionImpact: "0.05%", slippage: "0.08%", gasEstimate: "0.0042 SUI", guardianScore: 96, guardianRiskLevel: "LOW", guardianSafe: true, txDigest: "0x8f3a", routeNodes: route([["CETUS", 70, 0.01], ["BLUEFIN", 30, 0]]), checks: checks("SAFE"), ptbSteps: ptb(2, "cetus") },
    { id: makeHistoryId(), prompt: "Swap 500 SUI for CETUS", status: "SIMULATED", createdAt: now - 2 * 36e5, amount: "500", sourceSymbol: "SUI", destSymbol: "CETUS", expectedOutput: "12844.52", executionImpact: "1.2%", slippage: "1.9%", gasEstimate: "0.005 SUI", guardianScore: 72, guardianRiskLevel: "MEDIUM", guardianSafe: true, routeNodes: route([["CETUS", 55, 0.01], ["TURBOS", 30, 0.05], ["DEEPBOOK", 15, 0.025]]), checks: checks("WARNING"), ptbSteps: ptb(3, "cetus") },
    { id: makeHistoryId(), prompt: "Swap 10000 SUI to DEEP", status: "SIMULATED", createdAt: now - 90 * 60e3, amount: "10000", sourceSymbol: "SUI", destSymbol: "DEEP", expectedOutput: "6090000", executionImpact: "5.8%", slippage: "12.5%", gasEstimate: "0.02 SUI", guardianScore: 18, guardianRiskLevel: "CRITICAL", guardianSafe: false, routeNodes: route([["CETUS", 40, 0.01], ["AFTERMATH", 35, 0.05], ["KRIYA", 25, 0.03]]), checks: checks("DANGER"), ptbSteps: ptb(3, "cetus") },
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
      if (!x || typeof x !== "object" || typeof x.prompt !== "string" || !Array.isArray(x.routeNodes) || !Array.isArray(x.checks) || !Array.isArray(x.ptbSteps)) continue;
      const id = typeof x.id === "string" && x.id ? x.id : makeHistoryId();
      if (seen.has(id)) continue;
      seen.add(id);
      normalized.push({ ...x, id });
    }
    if (normalized.length === 0 && localStorage.getItem(LEGACY_HISTORY_KEY)) return migrateLegacyHistory().slice(0, MAX_HISTORY);
    if (normalized.length === 0) { const s = buildDemoHistory(); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(s)); } catch { /* */ } return s; }
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
  const [intentPrompt, setIntentPrompt] = useState<string>(searchParams.get("intent") || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [history, setHistory] = useState<SwapSnapshot[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const activeSwapRef = useRef<SwapSnapshot | null>(null);
  const [sourceSymbol, setSourceSymbol] = useState("SUI");
  const [destSymbol, setDestSymbol] = useState("USDC");
  const [tradeAmount, setTradeAmount] = useState("100");
  const [expectedOutput, setExpectedOutput] = useState("0.00");
  const [executionImpact, setExecutionImpact] = useState("0.05%");
  const [optimalSlippage, setOptimalSlippage] = useState("0.50%");
  const [sourceLogo, setSourceLogo] = useState<string | null>(null);
  const [destLogo, setDestLogo] = useState<string | null>(null);
  const [routeNodes, setRouteNodes] = useState<RouteNode[]>([]);
  const [guardianScore, setGuardianScore] = useState(95);
  const [guardianRiskLevel, setGuardianRiskLevel] = useState("LOW");
  const [guardianSafe, setGuardianSafe] = useState(true);
  const [guardianChecks, setGuardianChecks] = useState<RiskCheck[]>([]);
  const [hasConfirmedSettings, setHasConfirmedSettings] = useState(false);
  const [tokenSuggestion, setTokenSuggestion] = useState<any>(null);
  const [alternativeSource, setAlternativeSource] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const upsertHistory = (id: string, patch: Partial<SwapSnapshot>) => {
    setHistory(prev => { const n = prev.map(x => (x.id === id ? { ...x, ...patch } : x)); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
    if (activeSwapRef.current?.id === id) activeSwapRef.current = { ...activeSwapRef.current, ...patch };
  };
  const clearHistory = () => { setHistory([]); setExpandedHistory(null); try { localStorage.removeItem(HISTORY_KEY); } catch { /* */ } };
  const handleCancelSwap = () => { setRouteNodes([]); setGuardianChecks([]); setGuardianSafe(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setHasConfirmedSettings(false); activeSwapRef.current = null; setCancelMsg("Order cancelled. Try another swap? \u26a1"); };
  const deleteHistoryEntry = (id: string) => { setHistory(prev => { const n = prev.filter(x => x.id !== id); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch { /* */ } return n; }); setExpandedHistory(prev => (prev === id ? null : prev)); if (activeSwapRef.current?.id === id) activeSwapRef.current = null; };

  useEffect(() => { const ii = searchParams.get("intent"); if (ii) handleProcessIntent(ii); }, [searchParams]);

  const handleProcessIntent = async (promptToRun?: string) => {
    const prompt = promptToRun || intentPrompt;
    if (!prompt.trim() || isProcessing) return;
    const swapId = makeHistoryId();
    const snapshot: SwapSnapshot = { id: swapId, prompt, status: "SIMULATED", createdAt: Date.now(), routeNodes: [], checks: [], ptbSteps: [] };
    activeSwapRef.current = snapshot;
    setHistory(prev => { const a = prev[0]; const dup = !!a && a.prompt === prompt && a.status === "SIMULATED" && a.routeNodes.length === 0 && Date.now() - a.createdAt < 5000; if (dup) { activeSwapRef.current = a; return prev; } const n = [snapshot, ...prev.filter(x => x.id !== snapshot.id)].slice(0, MAX_HISTORY); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
    setIsProcessing(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setCancelMsg(null);
    try {
      const res = await fetch("/api/process-intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, senderAddress: walletAddress || "0x0000000000000000000000000000000000000000000000000000000000000000" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process intent");
      if (data.tokenSuggestion) { setTokenSuggestion(data.tokenSuggestion); setIsProcessing(false); upsertHistory(swapId, { status: "FAILED" }); return; }
      if (data.alternativeSource) setAlternativeSource(data.alternativeSource);
      if (data.intent) { setSourceSymbol(data.intent.source_token_symbol || "SUI"); setDestSymbol(data.intent.destination_token_symbol || "USDC"); setTradeAmount(data.intent.trade_amount || "100"); }
      const patch: Partial<SwapSnapshot> = { sourceSymbol: data.intent?.source_token_symbol || undefined, destSymbol: data.intent?.destination_token_symbol || undefined, amount: data.intent?.trade_amount || undefined };
      if (data.route) { setRouteNodes(data.route.route || []); setExpectedOutput(Number(data.route.expected_output || 0).toFixed(4)); setExecutionImpact(data.route.execution_impact || "0.05%"); patch.routeNodes = data.route.route || []; patch.expectedOutput = Number(data.route.expected_output || 0).toFixed(4); patch.executionImpact = data.route.execution_impact || "0.05%"; }
      if (data.guardian) { setGuardianSafe(data.guardian.safe); setGuardianScore(data.guardian.score || 90); setGuardianRiskLevel(data.guardian.riskLevel || "LOW"); setGuardianChecks(data.guardian.checks || []); patch.guardianSafe = !!data.guardian.safe; patch.guardianScore = data.guardian.score || 90; patch.guardianRiskLevel = data.guardian.riskLevel || "LOW"; patch.checks = data.guardian.checks || []; }
      upsertHistory(swapId, patch);
    } catch (err: any) { setErrorMessage(err.message || "Error communicating with SOKA"); upsertHistory(swapId, { status: "FAILED" }); }
    finally { setIsProcessing(false); }
  };

  const handleExecuteSwap = async () => {
    if (!currentAccount) { setIsWalletModalOpen(true); return; }
    if (isExecuting) return;
    setIsExecuting(true); setErrorMessage(null);
    try {
      const res = await fetch("/api/execute-swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderAddress: currentAccount.address, sourceSymbol, destSymbol, amount: tradeAmount, slippage: parseFloat(optimalSlippage.replace("%", "")) || 0.5 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build transaction");
      if (data.transactionBytes) {
        const { Transaction } = await import("@mysten/sui/transactions");
        const tx = Transaction.from(data.transactionBytes);
        const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
        const digest = (result as any).digest || (result as any).Transaction?.digest || (result as any).effects?.transactionDigest;
        if (!digest) throw new Error("No digest returned.");
        setTxDigest(digest);
        if (activeSwapRef.current) upsertHistory(activeSwapRef.current.id, { status: "CONFIRMED", txDigest: digest });
      } else throw new Error("No transaction bytes compiled.");
    } catch (err: any) { setErrorMessage(err.message || "Swap failed."); if (activeSwapRef.current) upsertHistory(activeSwapRef.current.id, { status: "FAILED" }); }
    finally { setIsExecuting(false); }
  };

  const quickPrompts = ["Swap 10 SUI to USDC", "Swap 100 SUI to CETUS", "Swap 50% SUI to DEEP", "Swap 500 SUI safe route"];
  const hasResult = routeNodes.length > 0 || guardianChecks.length > 0;
  const hasRiskWarnings = guardianChecks.some(c => c.status === "WARNING" || c.status === "DANGER") || !guardianSafe;

  return (
    <div className="h-[100dvh] w-full mesh-texture text-[#0f172a] flex flex-col overflow-hidden">
      <div className="absolute top-[15%] left-[5%] w-[400px] h-[400px] rounded-full bg-[#6366f1]/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#8b5cf6]/[0.04] blur-[100px] pointer-events-none" />

      <ProHeader onOpenWalletModal={() => setIsWalletModalOpen(true)} />

      <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 relative z-10">
        {/* Main Chat Card - Floating */}
        <div className="h-full glass-strong flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/40 bg-white/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#6366f1]/10 border border-[#6366f1]/15 flex items-center justify-center">
                <SkullBuddy size={44} mood="happy" className="!animate-none skull-glow" />
              </div>
              <div>
                <div className="font-bold text-[16px] text-[#0f172a]" style={{ fontFamily: "var(--font-display)" }}>SOKA AI</div>
                <div className="text-[11px] font-medium text-[#10b981] flex items-center gap-1.5"><span className="dot dot-success" /> Online</div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setHistoryOpen(v => !v)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-medium transition-all ${historyOpen ? "bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20" : "bg-white/40 text-[#0f172a]/50 border-white/50 hover:bg-white/60"}`}>
                <HistoryIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History</span>
                {history.length > 0 && <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-[#6366f1] text-white text-[9px] font-bold flex items-center justify-center">{history.length > 9 ? "9+" : history.length}</span>}
              </button>
              <button onClick={() => { setIntentPrompt(""); setRouteNodes([]); setGuardianChecks([]); setErrorMessage(null); setTxDigest(null); activeSwapRef.current = null; }} className="w-9 h-9 rounded-xl bg-white/40 border border-white/50 flex items-center justify-center hover:bg-white/60 transition-all">
                <span className="text-[#0f172a]/50 text-sm font-medium">+</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.01) 100%)" }}>
            <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
              {/* Intro */}
              <div className="flex items-end gap-3">
                <SkullBuddy size={44} mood="happy" className="shrink-0 !animate-none" />
                <div className="glass p-4 max-w-[85%]">
                  <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#6366f1] mb-1">SOKA ★</div>
                  <div className="text-[15px] font-medium text-[#0f172a]/80 leading-relaxed">Tell me your dream swap. I sniff the route &amp; run 7 checks — no jargon, just vibes ⚡</div>
                </div>
              </div>

              {intentPrompt.trim() !== "" && (
                <div className="flex justify-end">
                  <div className="glass-accent p-4 max-w-[85%]">
                    <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#6366f1] mb-1 text-right">YOU ★</div>
                    <div className="text-[15px] font-medium text-[#0f172a]/80 break-words">{intentPrompt}</div>
                  </div>
                </div>
              )}

              {/* Token suggestion */}
              {!hasResult && !isProcessing && (tokenSuggestion || alternativeSource) && (
                <div className="flex flex-col gap-3 w-full">
                  {tokenSuggestion && (
                    <div className="glass p-4">
                      <div className="flex items-center gap-2 mb-2"><Info className="w-4 h-4 text-[#6366f1]" /><span className="font-mono text-[12px] font-bold text-[#0f172a]">Pick the exact token</span></div>
                      <p className="text-[12px] text-[#0f172a]/50 mb-3">{tokenSuggestion.message}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tokenSuggestion.candidates?.map((c: any, i: number) => (
                          <button key={i} onClick={() => { if (c.retryPrompt) { setIntentPrompt(c.retryPrompt); handleProcessIntent(c.retryPrompt); } }} className="p-3 rounded-xl bg-white/40 hover:bg-white/60 border border-white/50 text-left font-mono text-[12px] transition-all">
                            <span className="block font-bold text-[#0f172a]">{c.symbol} ({c.name})</span>
                            <span className="text-[11px] text-[#0f172a]/40 break-all">{c.coinType.slice(0, 34)}…</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {hasResult && !isProcessing && (
                <div className="flex flex-col gap-3 w-full">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MiniStat label="Est. Output" value={`${expectedOutput} ${destSymbol}`} accent />
                    <MiniStat label="Impact" value={executionImpact} warn={parseFloat(executionImpact) >= 1} />
                    <MiniStat label="Slippage" value={optimalSlippage} />
                    <MiniStat label="Guardian" value={`${guardianScore}/100`} danger={!guardianSafe} />
                  </div>
                  {routeNodes.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap rounded-2xl border border-white/40 bg-white/30 px-4 py-3">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#0f172a]/25">Route</span>
                      <span className="font-mono text-[12px] font-bold text-[#0f172a]">{tradeAmount} {sourceSymbol}</span>
                      <span className="text-[#0f172a]/20">→</span>
                      {routeNodes.slice(0, 3).map((n, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#6366f1]">{n.dex}</span>
                          {i < Math.min(routeNodes.length, 3) - 1 && <span className="text-[#0f172a]/20">→</span>}
                        </span>
                      ))}
                      <span className="text-[#0f172a]/20">→</span>
                      <span className="font-mono text-[12px] font-bold text-[#10b981]">{expectedOutput} {destSymbol}</span>
                    </div>
                  )}
                  {guardianChecks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {guardianChecks.slice(0, 4).map((c, i) => (
                        <span key={i} className={`rounded-xl border px-2 py-1 font-mono text-[9px] font-bold ${c.status === "DANGER" ? "border-[#ef4444]/20 bg-[#ef4444]/10 text-[#ef4444]" : c.status === "WARNING" ? "border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]" : "border-[#10b981]/20 bg-[#10b981]/8 text-[#10b981]"}`}>
                          {c.name}: {c.status}
                        </span>
                      ))}
                    </div>
                  )}
                  {errorMessage && <div className="flex items-center gap-2 rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/8 px-3 py-2 font-mono text-[11px] font-bold text-[#ef4444]"><AlertCircle className="h-4 w-4 shrink-0" /> {errorMessage}</div>}
                  {txDigest && (
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#10b981]/20 bg-[#10b981]/8 px-3 py-2 font-mono text-[11px]">
                      <span className="flex items-center gap-2 font-bold text-[#10b981]"><CheckCircle2 className="h-4 w-4" /> Swap confirmed!</span>
                      <a href={`https://suiscan.xyz/mainnet/tx/${txDigest}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#6366f1] px-2.5 py-1 text-[10px] font-bold text-white inline-flex items-center gap-1">Suiscan <ExternalLink className="h-3 w-3" /></a>
                    </div>
                  )}
                  {hasRiskWarnings && (
                    <div className="flex items-center gap-3 rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-4 py-3 cursor-pointer select-none hover:bg-[#ef4444]/8" onClick={() => setHasConfirmedSettings(!hasConfirmedSettings)}>
                      <button role="checkbox" aria-checked={hasConfirmedSettings} onClick={(e) => { e.stopPropagation(); setHasConfirmedSettings(!hasConfirmedSettings); }} className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${hasConfirmedSettings ? "bg-[#10b981] border-[#10b981]" : "bg-transparent border-[#ef4444]/30"}`}>
                        <Check className="w-3 h-3 text-white" />
                      </button>
                      <span className="font-mono text-[11px] font-bold text-[#ef4444]">I acknowledge the on-chain risk warnings.</span>
                    </div>
                  )}
                  <div className="flex items-stretch gap-2">
                    <button onClick={handleExecuteSwap} disabled={isExecuting || (!guardianSafe && !hasConfirmedSettings)} className={`flex-1 py-3.5 rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all ${!guardianSafe && !hasConfirmedSettings ? "bg-white/20 text-[#0f172a]/20 border border-white/30 cursor-not-allowed" : "btn-primary"}`}>
                      {isExecuting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Signing...</> : !currentAccount ? <><Wallet className="w-4 h-4" /> Connect Wallet</> : !guardianSafe && !hasConfirmedSettings ? <span>Acknowledge Risk</span> : <><span>Execute ({tradeAmount} {sourceSymbol} → {destSymbol})</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                    <button onClick={() => setShowDetails(v => !v)} className="px-4 py-3 rounded-2xl border border-white/40 bg-white/30 font-mono text-[11px] font-medium text-[#0f172a]/50 hover:bg-white/50 transition-colors">{showDetails ? "Hide" : "Details"}</button>
                    <button onClick={handleCancelSwap} className="px-4 py-3 rounded-2xl border border-[#ef4444]/20 bg-white/30 font-mono text-[11px] font-medium text-[#ef4444] hover:bg-[#ef4444]/8 transition-colors">Cancel</button>
                  </div>
                  {showDetails && (
                    <div className="flex flex-col gap-3 w-full max-h-[350px] overflow-y-auto custom-scrollbar rounded-2xl pr-1">
                      <ProRouteVisualizer sourceSymbol={sourceSymbol} destSymbol={destSymbol} amount={tradeAmount} expectedOutput={expectedOutput} routeNodes={routeNodes} executionImpact={executionImpact} slippage={optimalSlippage} sourceLogo={sourceLogo} destLogo={destLogo} />
                      <ProGuardianRadar score={guardianScore} riskLevel={guardianRiskLevel} checks={guardianChecks} />
                    </div>
                  )}
                </div>
              )}

              {cancelMsg && !isProcessing && !hasResult && (
                <div className="flex items-end gap-3">
                  <SkullBuddy size={44} mood="chill" className="shrink-0 !animate-none" />
                  <div className="glass p-4 max-w-[85%]"><div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#6366f1] mb-1">SOKA ★</div><div className="text-[14px] font-medium text-[#0f172a]/80">{cancelMsg}</div></div>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-end gap-3">
                  <SkullBuddy size={44} mood="thinking" className="shrink-0 !animate-none" />
                  <div className="glass p-4"><div className="flex items-center gap-2 font-mono text-[13px] font-medium text-[#0f172a]/50"><span className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" /><span className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" style={{ animationDelay: "0.15s" }} /><span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-pulse" style={{ animationDelay: "0.3s" }} />sniffing pools…</div></div>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="px-5 pb-4 pt-3 shrink-0 border-t border-white/30 bg-white/20">
            <form onSubmit={(e) => { e.preventDefault(); handleProcessIntent(); }} className="flex items-end gap-3">
              <div className="relative flex-1">
                <input type="text" value={intentPrompt} onChange={(e) => setIntentPrompt(e.target.value)} placeholder={"Try \"Swap 100 SUI to USDC, safest route\"\u2026"} className="w-full px-5 py-4 pr-12 rounded-2xl input-glass font-medium text-[15px] outline-none" />
                <span className="absolute right-4 bottom-1/2 translate-y-1/2 text-[11px] font-mono text-[#0f172a]/20 pointer-events-none hidden sm:block">↵</span>
              </div>
              <button type="submit" disabled={isProcessing || !intentPrompt.trim()} className="btn-primary !rounded-2xl px-6 py-4 shrink-0 disabled:opacity-50">
                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2">Send <Sparkles className="w-4 h-4" /></span>}
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              {quickPrompts.map((q) => (
                <button key={q} type="button" disabled={isProcessing} onClick={() => { setIntentPrompt(q); handleProcessIntent(q); }} className="text-[11px] font-medium text-[#0f172a]/45 bg-white/40 hover:bg-white/60 border border-white/40 rounded-full px-3 py-1.5 transition-all disabled:opacity-50">{q}</button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {historyOpen && <HistoryPanel history={history} expandedId={expandedHistory} onToggle={(id) => setExpandedHistory(expandedHistory === id ? null : id)} onRerun={(snap) => { setIntentPrompt(snap.prompt); setHistoryOpen(false); handleProcessIntent(snap.prompt); }} onDelete={deleteHistoryEntry} onClear={clearHistory} onClose={() => setHistoryOpen(false)} />}
      <ConnectModal open={isWalletModalOpen} onOpenChange={(isOpen: boolean) => setIsWalletModalOpen(isOpen)} />
    </div>
  );
};
