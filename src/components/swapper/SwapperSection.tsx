import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useDisconnect, useSendTransaction, usePublicClient } from 'wagmi';
import { TokenSelectorModal } from '../TokenSelectorModal';
import { SwapperHeader } from './SwapperHeader';
import { ConversationPanel } from './chat/ConversationPanel';
import { SessionView, sessionTitle, timeAgo } from './SessionView';
import { BlobBuddy } from '../toon/Toon';
import { IntentConflictModal, type SwapComparison } from './chat/IntentConflictModal';
import { useSwapHistory, type SwapSession } from '../../hooks/useSwapHistory';
import { TOKENS, getTokenInfo, shortContract } from '../../constants';
import type { RiskCheck, PtbStep, RouteNode } from '../../types/shared';

/**
 * Turn a raw backend/RPC error into a short, user-friendly message.
 */
function formatSwapError(raw: string | undefined, ctx: { amount?: string; sourceToken?: string }): string {
  const msg = (raw || '').toLowerCase();
  const sym = ctx.sourceToken ? ctx.sourceToken.split('::').pop() : undefined;
  const amt = ctx.amount;

  if (msg.includes('insufficient') && msg.includes('balance')) {
    if (sym && sym.toUpperCase() !== 'BTC') {
      return 'Not enough BTC in your wallet to cover gas fees.';
    }
    if (amt && sym) return `You don't have enough ${sym} in your wallet (need ${amt}).`;
    return 'Your wallet balance is not enough for this swap.';
  }
  if (msg.includes('no viable') || msg.includes('no route') || msg.includes('liquidity')) {
    return 'No swap route found — not enough liquidity for this pair on Mezo Swap.';
  }
  if (msg.includes('slippage')) {
    return 'Price moved beyond your slippage limit. Please try again.';
  }
  if (msg.includes('gas')) {
    return 'Not enough BTC in your wallet to cover gas fees.';
  }
  if (msg.includes('unknown_token')) {
    return 'Could not recognize that token. Please pick one from the list.';
  }

  let cleaned = (raw || 'Something went wrong.')
    .replace(/0x[0-9a-fA-F]{6,}(::[^\s,).]+)*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (cleaned.length > 140) cleaned = cleaned.slice(0, 140) + '…';
  return cleaned || 'Something went wrong while processing the swap.';
}

export const SwapperSection: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const walletAddress = isConnected && address ? address : null;

  const [intentInput, setIntentInput] = useState("Swap 0.05 BTC to mUSDC");
  const [appState, setAppState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [processStep, setProcessStep] = useState(0);
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [executionState, setExecutionState] = useState<'idle' | 'signing' | 'executing' | 'success'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [tokenSuggestion, setTokenSuggestion] = useState<any | null>(null);
  const [selectedCoinType, setSelectedCoinType] = useState<string | null>(null);
  const [alternativeSource, setAlternativeSource] = useState<any | null>(null);

  const [sourceToken, setSourceToken] = useState("SUI");
  const [destToken, setDestToken] = useState("USDC");
  const [amount, setAmount] = useState("1000.00");
  const [routeNodes, setRouteNodes] = useState<RouteNode[]>([]);
  const [estOutput, setEstOutput] = useState<string>("0.00");
  const [sourceAddress, setSourceAddress] = useState<string>("");
  const [destAddress, setDestAddress] = useState<string>("");
  const [sourceLogo, setSourceLogo] = useState<string | null>(null);
  const [destLogo, setDestLogo] = useState<string | null>(null);
  const [destDecimals, setDestDecimals] = useState<number>(9);
  const [receivedAmount, setReceivedAmount] = useState<string | null>(null);
  const [sourceTokenBalance, setSourceTokenBalance] = useState<string>("0");
  const [gasPrice, setGasPrice] = useState<string>("...");
  const [slippage, setSlippage] = useState<string>("...");
  const [hasConfirmedSettings, setHasConfirmedSettings] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [tokenModalMode, setTokenModalMode] = useState<'source' | 'dest' | null>(null);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);

  const [guardianChecks, setGuardianChecks] = useState<RiskCheck[]>([]);
  const [ptbSteps, setPtbSteps] = useState<PtbStep[]>([]);
  const [transactionBytes, setTransactionBytes] = useState<string | null>(null);
  const [isSafe, setIsSafe] = useState<boolean>(true);
  const [guardianScore, setGuardianScore] = useState<number>(0);
  const [guardianRiskLevel, setGuardianRiskLevel] = useState<string>('');

  // Intent conflict modal: when user submits a new swap while one is processing.
  const [pendingIntent, setPendingIntent] = useState<{ text: string; opts?: { displayText?: string; keepSuggestion?: boolean } } | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState<{ a: SwapComparison; b: SwapComparison } | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const swapAResultRef = useRef<any>(null);

  // History panel: swap session snapshots persisted to localStorage.
  const { sessions, addSession, updateSession, clearHistory } = useSwapHistory();
  const currentSessionId = useRef<string | null>(null);

  // Messenger selection: live Buddy chat or a past session replay.
  const [selected, setSelected] = useState<{ type: 'buddy' } | { type: 'session'; id: string }>({ type: 'buddy' });
  const [histOpen, setHistOpen] = useState(false);

  const resetConversation = () => {
    setAppState('idle');
    setExecutionState('idle');
    setProcessStep(0);
    setIntentInput('');
    setSubmittedIntent('');
    setTxHash(null);
    setSwapError(null);
    setTokenSuggestion(null);
    setAlternativeSource(null);
    setReceivedAmount(null);
    setGuardianChecks([]);
    setPtbSteps([]);
    setRouteNodes([]);
    setEstOutput("0.00");
    setHasConfirmedSettings(false);
  };

  useEffect(() => {
    if (walletAddress && sourceToken) {
      fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress, symbol: sourceToken })
      })
        .then(r => r.json())
        .then(data => {
          if (data.balance) {
            setSourceTokenBalance(data.balance);
          }
        })
        .catch(e => console.error("Failed to fetch user balance for token", e));
    } else {
      setSourceTokenBalance("0");
    }
  }, [walletAddress, sourceToken]);

  const fetchGasPrice = async () => {
    try {
      const res = await fetch('/api/sui-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getReferenceGasPrice',
          params: []
        })
      });
      const data = await res.json();
      if (data.result) {
        // Convert mist to SUI — use same multiplier as backend (5M MIST per swap)
        const baseGas = (Number(data.result) * 5000000) / 1e9;
        setGasPrice(baseGas.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 5 }));
      }
    } catch (e) {
      console.error("Failed to fetch gas price", e);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    runIntent(intentInput);
  };

  // User picked a token from the suggestion list → rebuild the intent with the
  // full coin type and run it. The list stays visible so a wrong pick can be
  // changed without re-typing; the chosen token is highlighted.
  const applyTokenCandidate = (candidate: { retryPrompt: string; coinType: string; symbol: string }) => {
    const short = shortContract(candidate.coinType);
    const displayPrompt = candidate.retryPrompt.replace(
      candidate.coinType,
      `${candidate.symbol} (${short})`
    );
    setIntentInput(displayPrompt);
    setSelectedCoinType(candidate.coinType);
    runIntent(candidate.retryPrompt, { displayText: displayPrompt, keepSuggestion: true });
  };

  // User accepted an alternative source token → run the swap with that token.
  const applyAlternativeSource = (candidate: { retryPrompt: string; suggestedAmount: string; symbol: string }) => {
    const displayPrompt = `Swap ${candidate.suggestedAmount} ${candidate.symbol} to ${alternativeSource?.destSymbol || destToken}`;
    setIntentInput(displayPrompt);
    runIntent(candidate.retryPrompt, { displayText: displayPrompt });
  };

  const clearSwapState = () => {
    setTransactionBytes(null);
    setRouteNodes([]);
    setGuardianChecks([]);
    setPtbSteps([]);
    setEstOutput("0.00");
    setSlippage("...");
    setExecutionState('idle');
    setReceivedAmount(null);
    setGuardianScore(0);
    setGuardianRiskLevel('');
    setTxHash(null);
    setHasConfirmedSettings(false);
    setSwapError(null);
    setAlternativeSource(null);
  };

  const buildSwapComparison = (data: any, displayIntent: string): SwapComparison => {
    const checks = data.guardian?.checks || [];
    const nodes = data.route?.route || [];
    const minLiq = nodes.length > 0
      ? nodes.reduce((min: number, n: any) => Math.min(min, n.liquidityUsd || Infinity), Infinity)
      : 0;
    return {
      intent: displayIntent,
      sourceToken: data.intent?.source_token_symbol || '',
      destToken: data.intent?.destination_token_symbol || '',
      amount: data.intent?.trade_amount || '0',
      estOutput: data.route?.expected_output ? Number(data.route.expected_output).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0.00',
      guardianScore: data.guardian?.score ?? 0,
      guardianRiskLevel: data.guardian?.riskLevel ?? '',
      isSafe: data.guardian?.safe ?? false,
      minLiquidityUsd: minLiq === Infinity ? 0 : minLiq,
      dangerCount: checks.filter((c: any) => c.status === 'DANGER').length,
      warningCount: checks.filter((c: any) => c.status === 'WARNING').length,
      sourceLogo: data.tokenLogos?.source || null,
      destLogo: data.tokenLogos?.dest || null,
    };
  };

  const applySwapResult = (data: any, displayIntent: string, promptText: string) => {
    setProcessStep(1);
    setAmount(data.intent.trade_amount || "0");
    setSourceToken(data.intent.source_token_symbol || "SUI");
    setDestToken(data.intent.destination_token_symbol || "USDC");
    setSourceAddress(data.intent.source_token_address || "");
    setDestAddress(data.intent.destination_token_address || "");
    setSourceLogo(data.tokenLogos?.source || null);
    setDestLogo(data.tokenLogos?.dest || null);
    if (typeof data.destDecimals === 'number') setDestDecimals(data.destDecimals);
    setAlternativeSource(data.alternativeSource || null);

    setRouteNodes(data.route.route || []);
    setEstOutput(data.route.expected_output ? Number(data.route.expected_output).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0.00');

    setGuardianChecks(data.guardian.checks || []);
    setIsSafe(data.guardian.safe);
    setGuardianScore(data.guardian.score ?? 0);
    setGuardianRiskLevel(data.guardian.riskLevel ?? '');
    setPtbSteps(data.ptb.ptbSteps || []);
    if (data.ptb.transactionBytes) setTransactionBytes(data.ptb.transactionBytes);

    if (data.ptb.simulation?.gasUsed) {
      const baseGas = Number(data.ptb.simulation.gasUsed) / 1e9;
      setGasPrice(baseGas.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }));
    }
    if (data.route.execution_impact) {
      setSlippage(data.route.execution_impact);
    }

    setProcessStep(1);
    setAppState('done');

    const sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    currentSessionId.current = sessionId;
    addSession({
      id: sessionId,
      timestamp: Date.now(),
      intent: displayIntent,
      sourceToken: data.intent.source_token_symbol || "SUI",
      destToken: data.intent.destination_token_symbol || "USDC",
      amount: data.intent.trade_amount || "0",
      estOutput: data.route.expected_output ? Number(data.route.expected_output).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '0.00',
      fee: data.route.execution_impact ? (String(data.route.execution_impact).includes('%') ? data.route.execution_impact : `${data.route.execution_impact}%`) : '0.02%',
      slippage: data.route.execution_impact || '...',
      gasPrice,
      routeNodes: data.route.route || [],
      guardianChecks: data.guardian.checks || [],
      ptbSteps: data.ptb.ptbSteps || [],
      isSafe: data.guardian.safe,
      status: 'simulated',
      sourceLogo: data.tokenLogos?.source || null,
      destLogo: data.tokenLogos?.dest || null,
    });
  };

  const runIntent = async (
    promptText: string,
    opts?: { displayText?: string; keepSuggestion?: boolean }
  ) => {
    if (!promptText.trim()) return;

    // Conflict detection: if a swap is already processing, ask user what to do.
    if (appState === 'processing') {
      setPendingIntent({ text: promptText, opts });
      setIsConflictModalOpen(true);
      return;
    }

    const displayIntent = opts?.displayText || promptText;

    // C1 fix: clear ALL previous swap state before starting new one.
    clearSwapState();
    setAppState('processing');
    setProcessStep(0);
    setSubmittedIntent(displayIntent);
    if (!opts?.keepSuggestion) {
      setTokenSuggestion(null);
      setSelectedCoinType(null);
    }

    // C2 fix: AbortController to cancel stale in-flight requests.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      fetchGasPrice();

      const processRes = await fetch("/api/process-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          senderAddress: walletAddress || "0x0000000000000000000000000000000000000000000000000000000000000000"
        }),
        signal: controller.signal,
      });

      // Discard stale response if a newer request has started.
      if (controller.signal.aborted) return;

      const data = await processRes.json();

      if (controller.signal.aborted) return;

      if (data.tokenSuggestion) {
        setTokenSuggestion(data.tokenSuggestion);
        setSelectedCoinType(null);
        setAppState('idle');
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      applySwapResult(data, displayIntent, promptText);

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Failed to simulate", err);
      setSwapError(formatSwapError(err.message, { amount, sourceToken }));
      setAppState('idle');
    }
  };

  // ── Intent Conflict Modal handlers ──────────────────────────────

  const handleKeepA = () => {
    setPendingIntent(null);
    setIsConflictModalOpen(false);
  };

  const handleSwitchToB = () => {
    abortRef.current?.abort();
    clearSwapState();
    setIsConflictModalOpen(false);
    const pending = pendingIntent;
    setPendingIntent(null);
    if (pending) {
      runIntent(pending.text, pending.opts);
    }
  };

  const handleCompare = async () => {
    if (!pendingIntent) return;
    setIsComparing(true);

    // Run B in parallel without aborting A.
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const processRes = await fetch("/api/process-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: pendingIntent.text,
          senderAddress: walletAddress || "0x0000000000000000000000000000000000000000000000000000000000000000"
        }),
        signal: controller.signal,
      });

      const dataB = await processRes.json();

      if (dataB.error || dataB.tokenSuggestion) {
        // B failed or needs token suggestion — just switch to B normally.
        setIsComparing(false);
        setIsConflictModalOpen(false);
        setPendingIntent(null);
        if (dataB.tokenSuggestion) {
          setTokenSuggestion(dataB.tokenSuggestion);
          setSelectedCoinType(null);
          setAppState('idle');
        } else {
          setSwapError(formatSwapError(dataB.error, {}));
          setAppState('idle');
        }
        return;
      }

      // Build comparison for B.
      const compB = buildSwapComparison(dataB, pendingIntent.opts?.displayText || pendingIntent.text);

      // Wait for A to finish if it hasn't yet. A's result is in swapAResultRef
      // if it completed during the modal interaction; otherwise poll appState.
      const waitForA = (): Promise<any> => {
        return new Promise((resolve) => {
          const check = () => {
            if (appState === 'done' || appState === 'idle') {
              resolve(swapAResultRef.current);
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });
      };

      const dataAResult = await waitForA();

      // Build comparison for A from current state (A is already applied).
      const compA: SwapComparison = {
        intent: submittedIntent,
        sourceToken,
        destToken,
        amount,
        estOutput,
        guardianScore,
        guardianRiskLevel,
        isSafe,
        minLiquidityUsd: routeNodes.length > 0
          ? routeNodes.reduce((min, n) => Math.min(min, n.liquidityUsd || Infinity), Infinity)
          : 0,
        dangerCount: guardianChecks.filter(c => c.status === 'DANGER').length,
        warningCount: guardianChecks.filter(c => c.status === 'WARNING').length,
        sourceLogo,
        destLogo,
      };

      // Store B's full result for later application.
      swapAResultRef.current = dataB;

      setComparisonData({ a: compA, b: compB });
      setIsComparing(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setIsComparing(false);
      setIsConflictModalOpen(false);
      setPendingIntent(null);
      setSwapError(formatSwapError(err.message, {}));
      setAppState('idle');
    }
  };

  const handleSelectSwap = (which: 'a' | 'b') => {
    if (which === 'a') {
      // A is already applied — just close modal.
      setIsConflictModalOpen(false);
      setComparisonData(null);
      setPendingIntent(null);
    } else {
      // Apply B's result.
      const dataB = swapAResultRef.current;
      if (dataB && pendingIntent) {
        clearSwapState();
        setSubmittedIntent(pendingIntent.opts?.displayText || pendingIntent.text);
        applySwapResult(dataB, pendingIntent.opts?.displayText || pendingIntent.text, pendingIntent.text);
      }
      setIsConflictModalOpen(false);
      setComparisonData(null);
      setPendingIntent(null);
    }
  };

  const handleCancelBoth = () => {
    abortRef.current?.abort();
    clearSwapState();
    setAppState('idle');
    setProcessStep(0);
    setSubmittedIntent('');
    setIsConflictModalOpen(false);
    setComparisonData(null);
    setPendingIntent(null);
  };

  // Store the latest successful result for comparison use.
  useEffect(() => {
    if (appState === 'done') {
      swapAResultRef.current = { intent: submittedIntent, sourceToken, destToken, amount, estOutput, guardianScore, guardianRiskLevel, isSafe, routeNodes, guardianChecks };
    }
  }, [appState]);

  const handleExecute = async () => {
    if (!walletAddress) {
      setIsWalletModalOpen(true);
      return;
    }

    setSwapError(null);
    setReceivedAmount(null);
    setExecutionState('signing');
    try {
      let finalTransactionBytes = transactionBytes;
      let executeData: any = null;

      // Ensure PTB has been built using the connected wallet's real balance
      if (!finalTransactionBytes) {
        const executeRes = await fetch("/api/execute-swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderAddress: walletAddress,
            sourceSymbol: sourceToken,
            destSymbol: destToken,
            amount: amount,
            slippage: slippage ? parseFloat(slippage) : 0.5
          })
        });

        executeData = await executeRes.json();

        if (executeData.error || executeData.simulation?.error) {
          throw new Error(executeData.error || executeData.simulation?.error || "Please check your wallet balance and try again.");
        }

        finalTransactionBytes = executeData.transactionBytes;

        if (!finalTransactionBytes && !executeData.data) {
          throw new Error("Unable to build transaction. Your wallet balance is insufficient.");
        }
      }

      let targetContract = (executeData?.to || executeData?.target) as `0x${string}`;
      let txData = (executeData?.data || "0x") as `0x${string}`;
      let txValue = BigInt(executeData?.value || "0");
      let gasLimit = executeData?.gasLimit ? BigInt(executeData.gasLimit) : undefined;

      if (finalTransactionBytes) {
        try {
          const decoded = Buffer.from(finalTransactionBytes, 'base64').toString('utf8');
          const parsed = JSON.parse(decoded);
          if (parsed.to) targetContract = parsed.to;
          if (parsed.data) txData = parsed.data;
          if (parsed.value) txValue = BigInt(parsed.value);
          if (parsed.gasLimit) gasLimit = BigInt(parsed.gasLimit);
        } catch {
          // fallback
        }
      }

      setExecutionState('signing');

      // 1. Ask wallet to sign and execute the transaction
      const hash = await sendTransactionAsync({
        to: targetContract,
        data: txData,
        value: txValue,
        gas: gasLimit,
      });

      if (!hash) {
        throw new Error("Execution failed: No transaction hash returned from wallet.");
      }

      setExecutionState('executing');

      // 2. Wait for Mezo block confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setExecutionState('success');
      setTxHash(hash);
      setReceivedAmount(estOutput);

      // Update the session snapshot with execution result.
      if (currentSessionId.current) {
        updateSession(currentSessionId.current, {
          status: 'executed',
          txHash: hash,
          received: estOutput,
        });
      }
    } catch (err: any) {
      console.error("Execution failed", err);
      setSwapError(formatSwapError(err.message, { amount, sourceToken }));
      setExecutionState('idle');
    }
  };

  useEffect(() => {
    if (appState === 'idle') {
      const regex = /swap\s+([\d.,]+)\s+([a-zA-Z]+)\s+(to|for)\s+([a-zA-Z]+)/i;
      const match = intentInput.match(regex);
      if (match) {
        setAmount(match[1].replace(/,/g, ''));
        setSourceToken(match[2].toUpperCase());
        setDestToken(match[4].toUpperCase());
      }
    }
  }, [intentInput, appState]);

  // Realtime route/price refresh: while viewing a computed route (and not
  // executing), re-fetch the optimal route every 8s so output/slippage stay
  // current. Paused when the tab is hidden to avoid wasted work.
  useEffect(() => {
    if (appState !== 'done' || executionState !== 'idle') return;
    if (!sourceAddress || !destAddress) return;

    let active = true;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/calculate-optimal-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceSymbol: sourceToken, destSymbol: destToken, sourceAddress, destAddress, amount }),
        });
        const data = await res.json();
        if (!active || data.error || !data.route) return;
        setRouteNodes(data.route || []);
        setEstOutput(
          data.expected_output
            ? Number(data.expected_output).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
            : '0.00'
        );
        if (data.execution_impact) setSlippage(data.execution_impact);
      } catch {
        // keep last good values on transient failure
      }
    };

    const id = setInterval(refresh, 8000);
    return () => { active = false; clearInterval(id); };
  }, [appState, executionState, sourceAddress, destAddress, amount, sourceToken, destToken]);

  const isInsufficientBalance = walletAddress ? parseFloat(amount) > parseFloat(sourceTokenBalance) : false;

  const selSession = selected.type === 'session' ? sessions.find((s) => s.id === selected.id) ?? null : null;
  const buddyTyping = appState === 'processing';
  const buddyBusyLabel =
    executionState === 'signing' ? 'Signing…'
    : executionState === 'executing' ? 'Executing…'
    : appState === 'done' ? 'Online — just swapped!'
    : null;

  return (
    <section id="swapper-section" className="w-full flex-1 min-h-0 py-3 relative flex flex-col items-center overflow-hidden bg-transparent">
      <div className="w-full mx-auto px-2 md:px-6 flex flex-col h-full gap-2 relative z-10">
        <SwapperHeader
          walletAddress={walletAddress}
          isWalletModalOpen={isWalletModalOpen}
          setIsWalletModalOpen={setIsWalletModalOpen}
          disconnect={disconnect}
        />

        {/* centered chat window — one messenger-style card */}
        <div className="flex-1 min-h-0 w-full max-w-[880px] mx-auto">
          <div
            className="h-full flex flex-col overflow-hidden toon-card !rounded-[26px]"
            style={{ background: '#FFF9EF' }}
          >
            {selSession ? (
              <>
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b-[3px] border-[#141414] bg-[#FFC900] shrink-0">
                  <button
                    onClick={() => setSelected({ type: 'buddy' })}
                    className="w-9 h-9 rounded-full bg-white border-[2.5px] border-[#141414] flex items-center justify-center hover:bg-[#CCFF00] transition-colors shrink-0"
                    style={{ boxShadow: '2px 2px 0 #141414' }}
                    title="Back to Buddy"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>
                  <span className="font-black text-[16px] truncate" style={{ fontFamily: '"Bungee", sans-serif' }}>
                    {(selSession.sourceToken.includes('::') ? selSession.sourceToken.split('::').pop() : selSession.sourceToken)
                      + ' → ' +
                      (selSession.destToken.includes('::') ? selSession.destToken.split('::').pop() : selSession.destToken)}
                  </span>
                  <button
                    onClick={() => {
                      resetConversation();
                      setSelected({ type: 'buddy' });
                    }}
                    className="ml-auto toon-chip toon-chip-neon !text-[9px] shrink-0"
                    title="Start a fresh chat"
                  >
                    + NEW CHAT
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                  <SessionView
                    session={selSession}
                    onBack={() => setSelected({ type: 'buddy' })}
                    onNewChat={() => {
                      resetConversation();
                      setSelected({ type: 'buddy' });
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                {/* chat window header */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b-[3px] border-[#141414] bg-[#FFC900] shrink-0">
                  <BlobBuddy size={40} mood={buddyTyping ? 'thinking' : 'happy'} className="!animate-none shrink-0" />
                  <div className="min-w-0">
                    <div className="font-black text-[17px] leading-tight flex items-center gap-1.5 text-[#141414]" style={{ fontFamily: '"Bungee", sans-serif' }}>
                      Buddy
                      <span className="w-2 h-2 rounded-full bg-[#2fbf4f] border border-[#141414] inline-block" />
                    </div>
                    <div className="text-[11.5px] font-bold text-[#141414]/55 leading-tight">
                      {buddyTyping ? <span className="animate-pulse">Typing…</span> : buddyBusyLabel ?? 'Online'}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-flex toon-chip !text-[9px] !bg-white">🔒 KEYS STAY IN WALLET</span>
                    <div className="relative">
                      <button
                        onClick={() => setHistOpen((v) => !v)}
                        className="relative w-9 h-9 rounded-full bg-white border-[2.5px] border-[#141414] flex items-center justify-center hover:bg-[#CCFF00] transition-colors"
                        style={{ boxShadow: '2px 2px 0 #141414' }}
                        title="Chat history"
                      >
                        <span className="material-symbols-outlined text-[18px]">history</span>
                        {sessions.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-[#141414] text-[#CCFF00] text-[9px] font-mono font-bold flex items-center justify-center pointer-events-none">
                            {sessions.length > 9 ? '9+' : sessions.length}
                          </span>
                        )}
                      </button>
                      {histOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setHistOpen(false)} />
                          <div
                            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] max-w-[80vw] toon-card p-2 !rounded-2xl pop-in max-h-[380px] overflow-y-auto custom-scrollbar"
                            style={{ background: '#fffaf0' }}
                          >
                            <button
                              onClick={() => {
                                setSelected({ type: 'buddy' });
                                setHistOpen(false);
                              }}
                              className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl font-bold text-[13px] hover:bg-[#CCFF00]/40 transition-colors"
                            >
                              <BlobBuddy size={30} mood="happy" className="!animate-none shrink-0" />
                              <span>
                                Buddy
                                <span className="block font-mono text-[9px] text-[#141414]/50">live chat — swaps + gossip</span>
                              </span>
                            </button>
                            <div className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#141414]/50 px-2.5 pt-2 pb-1">
                              ★ OLD CHATS ({sessions.length})
                            </div>
                            {sessions.length === 0 && (
                              <div className="px-2.5 pb-2 font-mono text-[10px] font-bold text-[#141414]/45">
                                no old chats yet — go chat with Buddy!
                              </div>
                            )}
                            {sessions.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  setSelected({ type: 'session', id: s.id });
                                  setHistOpen(false);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-xl transition-colors hover:bg-[#CCFF00]/40"
                                style={selSession?.id === s.id ? { background: '#CCFF00' } : undefined}
                              >
                                <span className="block font-black text-[13px] leading-tight truncate">
                                  {sessionTitle(s)}
                                </span>
                                <span className="block font-mono text-[9px] text-[#141414]/50 leading-tight">
                                  {s.status === 'executed' ? '★ Swapped' : s.status === 'failed' ? '✖ Failed' : '○ Simulated'} · {timeAgo(s.timestamp)} ago
                                </span>
                              </button>
                            ))}
                            <Link
                              to="/activity"
                              onClick={() => setHistOpen(false)}
                              className="mt-1.5 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl font-mono text-[10px] font-bold tracking-[0.12em] bg-[#FFC900] border-2 border-[#141414] hover:bg-[#FF90E8] transition-colors"
                            >
                              ♥ FULL STICKER BOOK →
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                    <Link
                      to="/activity"
                      className="relative w-9 h-9 rounded-full bg-white border-[2.5px] border-[#141414] flex items-center justify-center hover:bg-[#FFC900] transition-colors"
                      style={{ boxShadow: '2px 2px 0 #141414' }}
                      title="Sticker book"
                    >
                      <span className="material-symbols-outlined text-[18px]">notifications</span>
                      {sessions.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff6b6b] border-2 border-[#141414] pointer-events-none" />
                      )}
                    </Link>
                  </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col relative">
                  <ConversationPanel
              tokenSuggestion={tokenSuggestion}
              onSelectToken={applyTokenCandidate}
              selectedCoinType={selectedCoinType}
              swapError={swapError}
              sourceLogo={sourceLogo}
              destLogo={destLogo}
              alternativeSource={alternativeSource}
              onSelectAlternative={applyAlternativeSource}
              received={receivedAmount}
              receivedToken={destToken}
              receivedLogo={destLogo}
              appState={appState}
              processStep={processStep}
              executionState={executionState}
              intentInput={intentInput}
              setIntentInput={setIntentInput}
              submittedIntent={submittedIntent}
              amount={amount}
              sourceToken={sourceToken}
              destToken={destToken}
              estOutput={estOutput}
              fee={slippage && slippage !== '...' ? (slippage.includes('%') ? slippage : `${slippage}%`) : "0.02%"}
              guardianChecks={guardianChecks}
              ptbSteps={ptbSteps}
              isSafe={isSafe}
              routeNodes={routeNodes}
              sourceAddress={sourceAddress}
              destAddress={destAddress}
              txHash={txHash}
              handleSimulate={handleSimulate}
              handleExecute={handleExecute}
              isGuardianModalOpen={isGuardianModalOpen}
              setIsGuardianModalOpen={setIsGuardianModalOpen}
              onConfirmGuardian={() => {
                setIsGuardianModalOpen(false);
                handleExecute();
              }}
              onBackToParse={() => {
                setProcessStep(1);
              }}
              onForwardToRoute={() => {
                setProcessStep(3);
              }}
              onForwardToFlow={() => {
                setProcessStep(4);
              }}
              onResetAll={resetConversation}
              walletAddress={walletAddress}
              balanceText={sourceTokenBalance}
              onSubmitText={(text) => runIntent(text)}
              onOpenVault={() => setTokenModalMode('source')}
            />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <TokenSelectorModal
        isOpen={tokenModalMode !== null}
        onClose={() => setTokenModalMode(null)}
        selectedToken={tokenModalMode === 'source' ? sourceToken : destToken}
        onSelect={(token) => {
          if (tokenModalMode === 'source') {
            setIntentInput(`Swap ${amount} ${token} to ${destToken}`);
          } else if (tokenModalMode === 'dest') {
            setIntentInput(`Swap ${amount} ${sourceToken} to ${token}`);
          }
        }}
      />

      <IntentConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => { setIsConflictModalOpen(false); setPendingIntent(null); setComparisonData(null); }}
        swapAIntent={submittedIntent}
        swapBIntent={pendingIntent?.opts?.displayText || pendingIntent?.text || ''}
        onKeepA={handleKeepA}
        onSwitchToB={handleSwitchToB}
        onCompare={handleCompare}
        comparison={comparisonData}
        isComparing={isComparing}
        onSelectSwap={handleSelectSwap}
        onCancelBoth={handleCancelBoth}
      />
    </section>
  );
};
