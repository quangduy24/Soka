import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import {
  RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Wallet, Sparkles, ExternalLink, Info, History as HistoryIcon, ShieldCheck, Check
} from 'lucide-react';
import { ProHeader } from './ProHeader';
import { SkullBuddy } from './SkullBuddy';
import { ProRouteVisualizer } from './ProRouteVisualizer';
import { ProGuardianRadar } from './ProGuardianRadar';
import { MarketSidebar } from './MarketSidebar';
import { HistoryPanel } from './HistoryPanel';
import type { RiskCheck, RouteNode, PtbStep, SwapSnapshot } from '../../types/shared';
import { makeHistoryId } from '../../utils/explorer';

import { ConnectModal } from '@mysten/dapp-kit-react/ui';

const HISTORY_KEY = 'adidahood:swap-history';
const LEGACY_HISTORY_KEY = 'robinhood:swap-history'; // old prompt-string entries
const MAX_HISTORY = 12;

/** Top weekly PNL leaders for the header ticker (demo feed). */
const pnlLeaders = [
  { addr: '0x8f3a…c007', pnl: '+184.2%' },
  { addr: '0x2b91…4d11', pnl: '+127.8%' },
  { addr: '0x7c44…a9f2', pnl: '+96.5%' },
  { addr: '0x1a02…b33e', pnl: '+74.1%' },
  { addr: '0x9e55…f8ab', pnl: '+61.9%' },
];

/** Small inline stat chip for the result key-figures row. */
const MiniStat: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  danger?: boolean;
}> = ({ label, value, accent, warn, danger }) => (
  <div className="rounded-xl border-2 border-[#141414]/80 bg-white px-2.5 py-1.5 text-left min-w-0">
    <div className="truncate font-mono text-[7px] font-bold uppercase tracking-[0.14em] text-[#141414]/40">{label}</div>
    <div
      className={`mt-0.5 truncate font-mono text-[11px] font-black ${
        danger ? 'text-[#d33]' : warn ? 'text-[#d33]' : accent ? 'text-[#1c7a36]' : 'text-[#141414]'
      }`}
      title={value}
    >
      {value}
    </div>
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
    return legacy.map((prompt) => ({
      id: makeHistoryId(),
      prompt,
      status: 'SIMULATED',
      createdAt: Date.now(),
      routeNodes: [],
      checks: [],
      ptbSteps: [],
    }));
  } catch {
    return [];
  }
}

/** Sample history so a full transaction history can be previewed immediately.
 * Only used when there is no real history yet. */
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
    steps.push(fromSui
      ? { index: 1, command: 'SplitCoins', description: 'Split SUI for gas + swap input' }
      : { index: 1, command: 'MergeCoins', description: 'Merge selected coin objects' });
    let i = 2;
    for (let h = 0; h < n; h++) steps.push({ index: i++, command: 'MoveCall', target: `${dex}::swap::exact_in`, description: `${dex}::swap::exact_in` });
    steps.push({ index: i, command: 'TransferObjects', description: 'Send output to your wallet' });
    return steps;
  };
  const route = (arr: Array<[string, number, number]>): RouteNode[] =>
    arr.map(([dex, ratio, fee], i) => ({
      dex, ratio, fee, weight: ratio,
      liquidityUsd: 250000 + i * 90000,
      poolAddress: `0x${(i + 1).toString(16).padStart(4, '0')}eabed72c53f027380872d35c6301cc6a7dc9dfe5e9f1fdc4c3f1a2b3c4d5e${(i + 7).toString(16)}`,
    }));

  return [
    {
      id: makeHistoryId(), prompt: 'Swap 1 SUI to USDC', status: 'CONFIRMED', createdAt: now - 33 * 864e5,
      amount: '1', sourceSymbol: 'SUI', destSymbol: 'USDC', expectedOutput: '0.68671',
      executionImpact: '0.05%', slippage: '0.08%', gasEstimate: '0.0042 SUI',
      guardianScore: 96, guardianRiskLevel: 'LOW', guardianSafe: true,
      txDigest: '0x8f3a2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
      routeNodes: route([['CETUS', 70, 0.01], ['BLUEFIN', 30, 0]]),
      checks: checks('SAFE'), ptbSteps: ptb(2, 'cetus'),
    },
    {
      id: makeHistoryId(), prompt: 'Swap 500 SUI for CETUS with safe route', status: 'SIMULATED', createdAt: now - 2 * 36e5,
      amount: '500', sourceSymbol: 'SUI', destSymbol: 'CETUS', expectedOutput: '12844.52',
      executionImpact: '1.2%', slippage: '1.9%', gasEstimate: '0.005 SUI',
      guardianScore: 72, guardianRiskLevel: 'MEDIUM', guardianSafe: true,
      routeNodes: route([['CETUS', 55, 0.01], ['TURBOS', 30, 0.05], ['DEEPBOOK', 15, 0.025]]),
      checks: checks('WARNING'), ptbSteps: ptb(3, 'cetus'),
    },
    {
      id: makeHistoryId(), prompt: 'Swap 250 USDC to DEEP', status: 'CONFIRMED', createdAt: now - 4 * 864e5,
      amount: '250', sourceSymbol: 'USDC', destSymbol: 'DEEP', expectedOutput: '152340.9',
      executionImpact: '0.4%', slippage: '0.75%', gasEstimate: '0.0061 SUI',
      guardianScore: 91, guardianRiskLevel: 'LOW', guardianSafe: true,
      txDigest: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091',
      routeNodes: route([['CETUS', 100, 0.01]]),
      checks: checks('SAFE'), ptbSteps: ptb(1, 'cetus', false),
    },
    {
      id: makeHistoryId(), prompt: 'Swap 10000 SUI to DEEP with low impact', status: 'SIMULATED', createdAt: now - 90 * 60e3,
      amount: '10000', sourceSymbol: 'SUI', destSymbol: 'DEEP', expectedOutput: '6090000',
      executionImpact: '5.8%', slippage: '12.5%', gasEstimate: '0.02 SUI',
      guardianScore: 18, guardianRiskLevel: 'CRITICAL', guardianSafe: false,
      routeNodes: route([['CETUS', 40, 0.01], ['AFTERMATH', 35, 0.05], ['KRIYA', 25, 0.03]]),
      checks: checks('DANGER'), ptbSteps: ptb(3, 'cetus'),
    },
    {
      id: makeHistoryId(), prompt: 'Swap 50% SUI to HIPPO', status: 'FAILED', createdAt: now - 30 * 60e3,
      amount: '75.2', sourceSymbol: 'SUI', destSymbol: 'HIPPO', expectedOutput: '0',
      executionImpact: '—', slippage: '1.0%', gasEstimate: '—',
      guardianScore: 88, guardianRiskLevel: 'LOW', guardianSafe: true,
      routeNodes: [], checks: checks('SAFE'), ptbSteps: [],
    },
    {
      id: makeHistoryId(), prompt: 'Swap 30 SUI to BLUB', status: 'SIMULATED', createdAt: now - 8 * 60e3,
      amount: '30', sourceSymbol: 'SUI', destSymbol: 'BLUB', expectedOutput: '9021500.0',
      executionImpact: '2.1%', slippage: '3.2%', gasEstimate: '0.005 SUI',
      guardianScore: 62, guardianRiskLevel: 'MEDIUM', guardianSafe: true,
      routeNodes: route([['CETUS', 80, 0.01], ['FLOWX', 20, 0.05]]),
      checks: checks('WARNING'), ptbSteps: ptb(2, 'cetus'),
    },
  ];
}

function loadHistory(): SwapSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    const valid = Array.isArray(arr) ? arr : [];
    // Normalize: ensure every entry has a unique id (mock/copy-paste data can
    // carry duplicate or missing ids, which breaks React list keys and expand).
    const normalized: SwapSnapshot[] = [];
    for (const x of valid) {
      if (!x || typeof x !== 'object' || typeof x.prompt !== 'string' ||
          !Array.isArray(x.routeNodes) || !Array.isArray(x.checks) || !Array.isArray(x.ptbSteps)) continue;
      const id = typeof x.id === 'string' && x.id ? x.id : makeHistoryId();
      if (seen.has(id)) continue; // drop duplicates, keep first
      seen.add(id);
      normalized.push({ ...x, id });
    }
    // One-time carry-over of the old prompt-string history.
    if (normalized.length === 0 && localStorage.getItem(LEGACY_HISTORY_KEY)) {
      return migrateLegacyHistory().slice(0, MAX_HISTORY);
    }
    // No real history yet → seed sample tasks so a full history with all
    // sub-panels can be previewed. They behave like normal entries until the
    // user clears them or performs real swaps.
    if (normalized.length === 0) {
      const seeded = buildDemoHistory();
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
      return seeded;
    }
    return normalized.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export const ProSwapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();
  const suiClient = useCurrentClient();
  const walletAddress = currentAccount?.address || null;
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const [intentPrompt, setIntentPrompt] = useState<string>(
    searchParams.get('intent') || ""
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  // History of sent intents (localStorage) — full swap snapshots
  const [history, setHistory] = useState<SwapSnapshot[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const activeSwapRef = useRef<SwapSnapshot | null>(null);

  const upsertHistory = (id: string, patch: Partial<SwapSnapshot>) => {
    setHistory(prev => {
      const next = prev.map(x => (x.id === id ? { ...x, ...patch } : x));
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (activeSwapRef.current && activeSwapRef.current.id === id) {
      activeSwapRef.current = { ...activeSwapRef.current, ...patch };
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setExpandedHistory(null);
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  };

  /** Cancel the current order: clears the shown results so the user can retry. */
  const handleCancelSwap = () => {
    setRouteNodes([]);
    setGuardianChecks([]);
    setGuardianSafe(true);
    setErrorMessage(null);
    setTxDigest(null);
    setTokenSuggestion(null);
    setAlternativeSource(null);
    setShowDetails(false);
    setHasConfirmedSettings(false);
    activeSwapRef.current = null;
    setCancelMsg('Order cancelled — no transaction was sent. Want to try a different swap? ⚡');
  };

  const deleteHistoryEntry = (id: string) => {
    setHistory(prev => {
      const next = prev.filter(x => x.id !== id);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setExpandedHistory(prev => (prev === id ? null : prev));
    if (activeSwapRef.current && activeSwapRef.current.id === id) activeSwapRef.current = null;
  };

  // Resolved Pipeline State
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

  // Guardian State
  const [guardianScore, setGuardianScore] = useState<number>(95);
  const [guardianRiskLevel, setGuardianRiskLevel] = useState<string>("LOW");
  const [guardianSafe, setGuardianSafe] = useState<boolean>(true);
  const [guardianChecks, setGuardianChecks] = useState<RiskCheck[]>([]);
  const [hasConfirmedSettings, setHasConfirmedSettings] = useState<boolean>(false);

  // Token suggestions & Alternative sources
  const [tokenSuggestion, setTokenSuggestion] = useState<any | null>(null);
  const [alternativeSource, setAlternativeSource] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  // Run initial intent if passed via search param
  useEffect(() => {
    const initialIntent = searchParams.get('intent');
    if (initialIntent) {
      handleProcessIntent(initialIntent);
    }
  }, [searchParams]);

  const handleProcessIntent = async (promptToRun?: string) => {
    const prompt = promptToRun || intentPrompt;
    if (!prompt.trim() || isProcessing) return;

    // Create a pending history snapshot immediately; fill details as they arrive.
    const swapId = makeHistoryId();
    const snapshot: SwapSnapshot = {
      id: swapId,
      prompt,
      status: 'SIMULATED',
      createdAt: Date.now(),
      routeNodes: [],
      checks: [],
      ptbSteps: [],
    };
    activeSwapRef.current = snapshot;
    // StrictMode / double-click guard: if this exact prompt is already at the
    // top of history as a pending snapshot, reuse it instead of duplicating.
    setHistory(prev => {
      const already = prev[0];
      const isDup = !!already && already.prompt === prompt && already.status === 'SIMULATED'
        && already.routeNodes.length === 0 && already.ptbSteps.length === 0
        && Date.now() - already.createdAt < 5000;
      if (isDup) {
        activeSwapRef.current = already;
        return prev;
      }
      const next = [snapshot, ...prev.filter(x => x.id !== snapshot.id)].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setIsProcessing(true);
    setErrorMessage(null);
    setTxDigest(null);
    setTokenSuggestion(null);
    setAlternativeSource(null);
    setShowDetails(false);
    setCancelMsg(null);

    try {
      const res = await fetch('/api/process-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          senderAddress: walletAddress || '0x0000000000000000000000000000000000000000000000000000000000000000',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process swap intent');
      }

      // If token is ambiguous
      if (data.tokenSuggestion) {
        setTokenSuggestion(data.tokenSuggestion);
        setIsProcessing(false);
        upsertHistory(swapId, { status: 'FAILED' }); // no swap produced — needs user pick
        return;
      }

      // If alternative source available
      if (data.alternativeSource) {
        setAlternativeSource(data.alternativeSource);
      }

      // Set pipeline data
      if (data.intent) {
        setSourceSymbol(data.intent.source_token_symbol || 'SUI');
        setDestSymbol(data.intent.destination_token_symbol || 'USDC');
        setTradeAmount(data.intent.trade_amount || '100');
      }

      const patch: Partial<SwapSnapshot> = {
        sourceSymbol: data.intent?.source_token_symbol || undefined,
        destSymbol: data.intent?.destination_token_symbol || undefined,
        amount: data.intent?.trade_amount || undefined,
      };

      if (data.route) {
        setRouteNodes(data.route.route || []);
        setExpectedOutput(Number(data.route.expected_output || 0).toFixed(4));
        setExecutionImpact(data.route.execution_impact || '0.05%');
        patch.routeNodes = data.route.route || [];
        patch.expectedOutput = Number(data.route.expected_output || 0).toFixed(4);
        patch.executionImpact = data.route.execution_impact || '0.05%';
      }

      if (data.guardian) {
        setGuardianSafe(data.guardian.safe);
        setGuardianScore(data.guardian.score || 90);
        setGuardianRiskLevel(data.guardian.riskLevel || 'LOW');
        setGuardianChecks(data.guardian.checks || []);
        patch.guardianSafe = !!data.guardian.safe;
        patch.guardianScore = data.guardian.score || 90;
        patch.guardianRiskLevel = data.guardian.riskLevel || 'LOW';
        patch.checks = data.guardian.checks || [];
      }

      if (data.ptb) {
        setPtbData(data.ptb);
        if (data.ptb.slippage) {
          setOptimalSlippage(`${data.ptb.slippage}%`);
          patch.slippage = `${data.ptb.slippage}%`;
        }
        patch.ptbSteps = data.ptb.ptbSteps || [];
        if (data.ptb.simulation?.estGas) {
          const mist = Number(data.ptb.simulation.estGas);
          patch.gasEstimate = !isNaN(mist) ? `${(mist / 1e9).toFixed(4)} SUI` : undefined;
        }
      }

      if (data.tokenLogos) {
        setSourceLogo(data.tokenLogos.source);
        setDestLogo(data.tokenLogos.dest);
      }

      upsertHistory(swapId, patch);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with Adidahood Engine');
      upsertHistory(swapId, { status: 'FAILED' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!currentAccount) {
      setIsWalletModalOpen(true);
      return;
    }

    if (isExecuting) return;
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/execute-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAddress: currentAccount.address,
          sourceSymbol,
          destSymbol,
          amount: tradeAmount,
          slippage: parseFloat(optimalSlippage.replace('%', '')) || 0.5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to build transaction block');
      }

      if (data.transactionBytes) {
        const { Transaction } = await import('@mysten/sui/transactions');
        const tx = Transaction.from(data.transactionBytes);

        // Sign and execute via Sui Wallet Adapter
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: tx,
        });
        const digest = (result as any).digest || (result as any).Transaction?.digest || (result as any).effects?.transactionDigest;
        if (!digest) {
          throw new Error('Swap transaction submitted but no digest was returned.');
        }
        setTxDigest(digest);
        if (activeSwapRef.current) {
          upsertHistory(activeSwapRef.current.id, { status: 'CONFIRMED', txDigest: digest });
        }
      } else {
        throw new Error('Simulation completed, but no transaction bytes were compiled by wallet.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Swap execution failed or was rejected by wallet.');
      if (activeSwapRef.current) {
        upsertHistory(activeSwapRef.current.id, { status: 'FAILED' });
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const quickPrompts = [
    "Swap 10 SUI to USDC",
    "Swap 100 SUI to CETUS",
    "Swap 50% SUI to DEEP",
    "Swap 500 SUI for USDC with safe route",
  ];

  const hasResult = routeNodes.length > 0 || guardianChecks.length > 0;
  const hasRiskWarnings = guardianChecks.some(c => c.status === 'WARNING' || c.status === 'DANGER') || !guardianSafe;

  const onPickMarket = (sym: string) => {
    const p = `Swap 100 ${sym} to USDC`;
    setIntentPrompt(p);
    handleProcessIntent(p);
  };

  return (
    <div className="h-[100dvh] w-full pro3-bg text-[#141414] flex flex-col font-sans selection:bg-[#141414] selection:text-[#CCFF00] overflow-hidden">
      <ProHeader onOpenWalletModal={() => setIsWalletModalOpen(true)} />

      {/* top PNL marquee — mimics the landing ticker */}
      <div className="pro3-marquee-bg shrink-0">
        <div className="pro3-marquee-inner">
          {Array.from({ length: 2 }).map((_, dup) => (
            <span key={dup} className="flex items-center">
              {pnlLeaders.map((l, i) => (
                <span key={i} className="flex items-center">
                  <span className="px-3">{l.addr} just hit the weekly Top PNL with {l.pnl}</span>
                  <span className="text-[#7DDCFF]">★</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <main className="flex-1 min-h-0 w-full mx-auto flex justify-center px-3 sm:px-6 py-4 gap-4">
        {/* left sidebar — market widgets */}
        <aside className="hidden lg:block w-[300px] shrink-0 pr-1">
          <MarketSidebar onPick={onPickMarket} />
        </aside>

        {/* center chat window */}
        <div className="flex-1 min-h-0 max-w-[1080px] pro3-card overflow-hidden flex flex-col shadow-[10px_10px_0_#141414]">
          {/* window titlebar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b-[3px] border-[#141414] bg-[#FFC900] shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#ff6b6b] border-2 border-[#141414]" />
            <span className="w-3 h-3 rounded-full bg-[#fffaf0] border-2 border-[#141414]" />
            <span className="w-3 h-3 rounded-full bg-[#2fbf4f] border-2 border-[#141414]" />
            <span className="ml-2 font-mono text-[10px] font-bold tracking-[0.2em] text-[#141414]/80 truncate">
              ADIDAHOOD.EXE ★ BUDDY IS TYPING…
            </span>
            <span className="ml-auto hidden sm:inline font-mono text-[10px] font-bold text-[#141414]/60">ADIDAHOOD ★ SAFE ★ FUN</span>
          </div>

          {/* workspace: single chat column — results render inline under the message */}
          <div className="flex-1 min-h-0 flex">
            {/* chat / command panel */}
            <div className="flex flex-col min-h-0 w-full">
              {/* panel header */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b-[3px] border-[#141414] bg-[#FFFDF4] shrink-0">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[#CCFF00] border-2 border-[#141414] flex items-center justify-center overflow-hidden shadow-[2px_2px_0_#141414]">
                    <SkullBuddy size={40} mood="happy" className="!animate-none !drop-shadow-none" />
                  </div>
                  <div className="leading-none">
                    <div className="font-black text-[15px] text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>Skull Buddy</div>
                    <div className="text-[10px] font-mono font-bold text-[#1c7a36] mt-0.5 flex items-center gap-1">
                      <span className="pro3-dot pro3-dot-green" /> Online
                    </div>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {/* History button — opens centered modal */}
                  <div className="relative">
                    <button
                      onClick={() => setHistoryOpen(v => !v)}
                      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-[#141414] font-mono text-[10px] font-bold transition-colors shadow-[2px_2px_0_#141414] ${
                        historyOpen ? 'bg-[#CCFF00] text-[#141414]' : 'bg-white text-[#141414]/70 hover:bg-[#CCFF00]/50'
                      }`}
                      title="Swap history"
                    >
                      <HistoryIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">History</span>
                      {history.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[#141414] text-[#CCFF00] text-[8px] font-mono font-bold flex items-center justify-center">
                          {history.length > 9 ? '9+' : history.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => { setIntentPrompt(''); setRouteNodes([]); setGuardianChecks([]); setErrorMessage(null); setTxDigest(null); activeSwapRef.current = null; }}
                    className="w-8 h-8 rounded-full bg-white border-2 border-[#141414] flex items-center justify-center hover:bg-[#CCFF00] transition-colors shadow-[2px_2px_0_#141414]"
                    title="New chat"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_comment</span>
                  </button>
                </div>
              </div>

              {/* messages area — gradient applied to the scroller itself so it
                  always fills the visible region (no white gap when scrolling) */}
              <div
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-3 relative"
                style={{
                  backgroundImage:
                    'linear-gradient(160deg, #EAF7D9 0%, #D9F0C2 38%, #BCE69A 72%, #9FD87E 100%)',
                  backgroundAttachment: 'local',
                }}
              >

                {/* conversation bubbles — anchored close to the panel edges */}
                <div className="relative flex flex-col gap-2.5 w-full">
                  {/* buddy intro */}
                  <div className="flex items-end gap-2">
                    <SkullBuddy size={40} mood="happy" className="shrink-0 !animate-none" />
                    <div className="relative chat-bubble-bot !rounded-[6px_18px_18px_18px] px-3.5 py-2 max-w-[78%]">
                      <div className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#141414]/50 mb-0.5">ADIDAHOOD ★</div>
                      <div className="text-[14px] font-bold leading-snug">
                        Tell me your dream swap. I sniff the route &amp; run 7 checks — no jargon, just vibes ⚡
                      </div>
                    </div>
                  </div>

                  {/* last user message */}
                  {intentPrompt.trim() !== '' && (
                    <div className="flex justify-end">
                      <div className="relative chat-bubble-user !rounded-[18px_18px_6px_18px] px-3.5 py-2 max-w-[78%]">
                        <div className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#141414]/50 mb-0.5 text-right">YOU ★</div>
                        <div className="text-[14px] font-bold leading-snug break-words">{intentPrompt}</div>
                      </div>
                    </div>
                  )}

                  {/* token picker / alternative-source (inline, when no route yet) */}
                  {!hasResult && !isProcessing && (tokenSuggestion || alternativeSource) && (
                    <div className="flex flex-col gap-2.5 w-full pop-in">
                      {tokenSuggestion && (
                        <div className="rounded-2xl border-[3px] border-[#141414] bg-[#FFC900]/20 p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Info className="w-4 h-4 text-[#8a5a00]" />
                            <span className="font-mono text-[11px] font-bold text-[#141414]">Pick the exact token</span>
                          </div>
                          <p className="text-[11px] font-mono text-[#141414]/70 mb-2">{tokenSuggestion.message}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {tokenSuggestion.candidates?.map((c: any, i: number) => (
                              <button key={i} onClick={() => { if (c.retryPrompt) { setIntentPrompt(c.retryPrompt); handleProcessIntent(c.retryPrompt); } }}
                                className="p-2.5 rounded-xl bg-white hover:bg-[#CCFF00]/60 border-2 border-[#141414] text-left font-mono text-[11px] shadow-[2px_2px_0_rgba(20,20,20,0.15)]">
                                <span className="block font-bold text-[#141414]">{c.symbol} ({c.name})</span>
                                <span className="text-[10px] text-[#141414]/50 break-all">{c.coinType.slice(0, 34)}…</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {alternativeSource && (
                        <div className="rounded-2xl border-[3px] border-[#141414] bg-[#7DDCFF]/20 p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-[#141414]/80">
                            <Sparkles className="w-4 h-4 shrink-0" /> {alternativeSource.message}
                          </div>
                          {alternativeSource.candidates?.[0] && (
                            <button onClick={() => { const p = alternativeSource.candidates[0].retryPrompt; setIntentPrompt(p); handleProcessIntent(p); }}
                              className="self-start px-3 py-1.5 rounded-xl bg-[#CCFF00] border-2 border-[#141414] text-[#141414] font-mono text-[11px] font-bold hover:-translate-y-0.5 transition-all shadow-[2px_2px_0_#141414]">
                              Swap with {alternativeSource.candidates[0].symbol} instead
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* inline result — key figures + route + guardian + execute, in the message flow */}
                  {hasResult && !isProcessing && (
                    <div className="flex flex-col gap-2 w-full max-w-[780px] pop-in">
                      {/* key figures row (no PAY card) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniStat label="Est. Output" value={`${expectedOutput} ${destSymbol}`} accent />
                        <MiniStat label="Impact" value={executionImpact} warn={parseFloat(executionImpact) >= 1} />
                        <MiniStat label="Slippage" value={optimalSlippage} />
                        <MiniStat label="Guardian" value={guardianSafe ? `${guardianScore}/100` : `${guardianScore}/100`} danger={!guardianSafe} />
                      </div>

                      {/* inline route summary — single line */}
                      {routeNodes.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap rounded-xl border-2 border-[#141414]/70 bg-white/85 px-3 py-1.5">
                          <span className="font-mono text-[7.5px] font-bold uppercase tracking-wider text-[#141414]/35">Route</span>
                          <span className="font-mono text-[11px] font-bold text-[#141414]">{tradeAmount} {sourceSymbol}</span>
                          <span className="text-[#141414]/30 text-[11px]">→</span>
                          {routeNodes.slice(0, 3).map((n, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="rounded-md bg-[#7DDCFF]/40 border border-[#141414]/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#141414]">{n.dex}</span>
                              {i < Math.min(routeNodes.length, 3) - 1 && <span className="text-[#141414]/30 text-[11px]">→</span>}
                            </span>
                          ))}
                          <span className="text-[#141414]/30 text-[11px]">→</span>
                          <span className="font-mono text-[11px] font-bold text-[#1c7a36]">{expectedOutput} {destSymbol}</span>
                        </div>
                      )}

                      {/* guardian mini checks — WARNING/DANGER in red */}
                      {guardianChecks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {guardianChecks.slice(0, 4).map((c, i) => (
                            <span key={i} className={`rounded-md border px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${
                              c.status === 'DANGER' ? 'border-[#d33] bg-[#ff6b6b]/25 text-[#d33]'
                                : c.status === 'WARNING' ? 'border-[#d33] bg-[#ff6b6b]/15 text-[#d33]'
                                : 'border-[#141414]/60 bg-[#CCFF00]/20 text-[#1c7a36]'
                            }`}>
                              {c.name}: {c.status}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* error inline */}
                      {errorMessage && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-[#d33]/60 bg-[#ff6b6b]/15 px-2 py-1 font-mono text-[9.5px] font-bold text-[#a00]">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {errorMessage}
                        </div>
                      )}

                      {/* tx confirmed */}
                      {txDigest && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-[#141414]/70 bg-[#CCFF00]/25 px-2 py-1 font-mono text-[10px]">
                          <span className="flex items-center gap-1.5 font-bold text-[#141414]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#1c7a36]" /> Swap confirmed!
                          </span>
                          <a href={`https://suiscan.xyz/mainnet/tx/${txDigest}`} target="_blank" rel="noreferrer"
                             className="rounded-md bg-[#141414] px-2 py-0.5 text-[9px] font-bold text-[#CCFF00] inline-flex items-center gap-1">
                            Suiscan <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      )}

                      {/* risk acknowledgment — user must confirm before execute */}
                      {hasRiskWarnings && (
                        <div
                          className="flex items-center gap-2 rounded-xl border-2 border-[#d33]/70 bg-[#ff6b6b]/10 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-[#ff6b6b]/20"
                          onClick={() => setHasConfirmedSettings(!hasConfirmedSettings)}
                          title="I acknowledge the on-chain risk warnings detected by Guardian"
                        >
                          <button
                            role="checkbox"
                            aria-checked={hasConfirmedSettings}
                            onClick={(e) => { e.stopPropagation(); setHasConfirmedSettings(!hasConfirmedSettings); }}
                            className={`w-4 h-4 rounded border-2 border-[#141414] flex items-center justify-center transition-colors ${
                              hasConfirmedSettings ? 'bg-[#CCFF00] text-[#141414]' : 'bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <span className="font-mono text-[9.5px] font-bold text-[#a00] leading-tight">
                            I acknowledge the on-chain risk warnings detected by Guardian.
                          </span>
                        </div>
                      )}

                      {/* execute row */}
                      <div className="flex items-stretch gap-2">
                        <button
                          onClick={handleExecuteSwap}
                          disabled={isExecuting || (!guardianSafe && !hasConfirmedSettings)}
                          className={`flex-1 py-2.5 rounded-xl font-mono text-[12px] font-bold flex items-center justify-center gap-1.5 border-2 border-[#141414] transition-all ${
                            !guardianSafe && !hasConfirmedSettings ? 'bg-[#e8e0cf] text-[#a39e8d] cursor-not-allowed' : 'pro3-btn shadow-none'
                          }`}
                        >
                          {isExecuting ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Signing in Wallet...</>)
                            : !currentAccount ? (<><Wallet className="w-3.5 h-3.5" /> Connect Wallet to Execute</>)
                              : !guardianSafe && !hasConfirmedSettings ? (<span>Acknowledge Risk to Proceed</span>)
                                : (<><span>Execute Swap ({tradeAmount} {sourceSymbol} → {destSymbol})</span><ArrowRight className="w-3.5 h-3.5" /></>)}
                        </button>
                        {/* expand/collapse full details */}
                        <button
                          onClick={() => setShowDetails(v => !v)}
                          title={showDetails ? 'Hide details' : 'Show full route & guardian audit'}
                          className="px-3 py-2 rounded-xl border-2 border-[#141414] bg-white font-mono text-[10px] font-bold text-[#141414]/70 hover:bg-[#CCFF00]/40 transition-colors"
                        >
                          {showDetails ? 'Hide ▲' : 'Details ▼'}
                        </button>
                        {/* cancel — clears the current order/results */}
                        <button
                          onClick={handleCancelSwap}
                          title="Cancel this order"
                          className="px-3 py-2 rounded-xl border-2 border-[#141414] bg-white font-mono text-[10px] font-bold text-[#d33] hover:bg-[#ff6b6b]/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* full detail cards (expandable inside the flow) — height-capped */}
                      {showDetails && (
                        <div className="flex flex-col gap-2.5 w-full max-h-[330px] overflow-y-auto custom-scrollbar rounded-xl pr-1">
                          <ProRouteVisualizer
                            sourceSymbol={sourceSymbol}
                            destSymbol={destSymbol}
                            amount={tradeAmount}
                            expectedOutput={expectedOutput}
                            routeNodes={routeNodes}
                            executionImpact={executionImpact}
                            slippage={optimalSlippage}
                            sourceLogo={sourceLogo}
                            destLogo={destLogo}
                          />
                          <ProGuardianRadar
                            score={guardianScore}
                            riskLevel={guardianRiskLevel}
                            checks={guardianChecks}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* cancel reply from Skull Buddy */}
                  {cancelMsg && !isProcessing && !hasResult && (
                    <div className="flex items-end gap-2 pop-in">
                      <SkullBuddy size={40} mood="chill" className="shrink-0 !animate-none" />
                      <div className="relative chat-bubble-bot !rounded-[6px_18px_18px_18px] px-3.5 py-2 max-w-[85%]">
                        <div className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#141414]/50 mb-0.5">ADIDAHOOD ★</div>
                        <div className="text-[13px] font-bold leading-snug">{cancelMsg}</div>
                      </div>
                    </div>
                  )}

                  {/* processing bubble */}
                  {isProcessing && (
                    <div className="flex items-end gap-2">
                      <SkullBuddy size={40} mood="thinking" className="shrink-0 !animate-none" />
                      <div className="chat-bubble-bot !rounded-[6px_18px_18px_18px] px-3.5 py-2.5">
                        <div className="flex items-center gap-2 font-mono text-[12px] font-bold text-[#141414]/70">
                          <span className="w-2 h-2 rounded-full bg-[#CCFF00] border-[1.5px] border-[#141414] animate-pulse" />
                          <span className="w-2 h-2 rounded-full bg-[#FFC900] border-[1.5px] border-[#141414] animate-pulse" style={{ animationDelay: '0.15s' }} />
                          <span className="w-2 h-2 rounded-full bg-[#FF90E8] border-[1.5px] border-[#141414] animate-pulse" style={{ animationDelay: '0.3s' }} />
                          sniffing pools…
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* composer pinned at bottom of chat panel */}
              <div className="px-3 pb-3 pt-1 shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); handleProcessIntent(); }} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={intentPrompt}
                      onChange={(e) => setIntentPrompt(e.target.value)}
                      placeholder="Try “Swap 100 SUI to USDC, safest route”…"
                      className="w-full px-4 py-3 pr-10 rounded-2xl pro3-input font-mono text-sm outline-none"
                    />
                    <span className="absolute right-3 bottom-1/2 translate-y-1/2 text-[10px] font-mono text-[#141414]/35 pointer-events-none hidden sm:block">
                      ENTER ↵
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={isProcessing || !intentPrompt.trim()}
                    className="pro3-btn !rounded-2xl px-5 py-3 text-sm shrink-0 disabled:opacity-50"
                    title="Send to Buddy"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send ⚡</span>}
                  </button>
                </form>

                {/* quick chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => { setIntentPrompt(q); handleProcessIntent(q); }}
                      className="text-[10px] font-mono font-bold text-[#141414]/70 bg-white hover:bg-[#CCFF00] border-2 border-[#141414] rounded-full px-2.5 py-1 transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* History modal — task list with expandable detail sub-panel */}
      {historyOpen && (
        <HistoryPanel
          history={history}
          expandedId={expandedHistory}
          onToggle={(id) => setExpandedHistory(expandedHistory === id ? null : id)}
          onRerun={(snap) => { setIntentPrompt(snap.prompt); setHistoryOpen(false); handleProcessIntent(snap.prompt); }}
          onDelete={deleteHistoryEntry}
          onClear={clearHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <ConnectModal
        open={isWalletModalOpen}
        // @ts-ignore
        onOpenChange={(isOpen) => setIsWalletModalOpen(isOpen)}
      />
    </div>
  );

};

