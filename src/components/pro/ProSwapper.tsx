import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAccount, useSendTransaction, usePublicClient, useChainId, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Wallet, Sparkles, ExternalLink, Info, History as HistoryIcon, Check, ArrowRightLeft, Landmark, Vault, Waves, Download, Upload, Send, ArrowDownToLine, ArrowUp, User } from 'lucide-react';
import { ProHeader } from './ProHeader';
import { ProRouteVisualizer } from './ProRouteVisualizer';
import { ProGuardianRadar } from './ProGuardianRadar';
import { HistoryPanel } from './HistoryPanel';
import { GenerativeInkCanvas } from './GenerativeInkCanvas';
import type { RiskCheck, RouteNode, PtbStep, SwapSnapshot } from '../../types/shared';
import { makeHistoryId, txExplorerUrl } from '../../utils/explorer';
import { ZERO_ADDRESS } from '../../constants';
import { marketApi, type PoolDto } from '../../services/mezoApi';
import { mezoTestnet } from '../../mezo-chain';

const HISTORY_KEY = 'soka:swap-history';
const LEGACY_HISTORY_KEY = 'adidahood:swap-history';
const MAX_HISTORY = 12;

const MiniStat: React.FC<{ label: string; value: string; accent?: boolean; warn?: boolean; danger?: boolean }> = ({ label, value, accent, warn, danger }) => (
  <div className="p-3 rounded-2xl bg-white border border-[#2C1924]/[0.08] text-left shadow-2xs">
    <div className="font-meta text-[9px] font-bold uppercase tracking-[0.12em] text-[#845D74]/75">{label}</div>
    <div className={`mt-1 truncate font-mono text-[14px] font-bold ${danger ? "text-[#ef4444]" : warn ? "text-[#f59e0b]" : accent ? "text-[#DF7AA7]" : "text-[#2C1924]"}`} title={value}>{value}</div>
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
    // No demo seeding: history only contains the user's real on-chain activity.
    return normalized.slice(0, MAX_HISTORY);
  } catch { return []; }
}

export const ProSwapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const { openConnectModal } = useConnectModal();
  const walletAddress = isConnected && address ? address : null;
  const [intentPrompt, setIntentPrompt] = useState<string>(searchParams.get("intent") || "");
  const [submittedUserPrompt, setSubmittedUserPrompt] = useState<string | null>(searchParams.get("intent") || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [history, setHistory] = useState<SwapSnapshot[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const activeSwapRef = useRef<SwapSnapshot | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (bloomRef.current) {
        bloomRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  const [sourceSymbol, setSourceSymbol] = useState("BTC");
  const [destSymbol, setDestSymbol] = useState("MUSD");
  const [tradeAmount, setTradeAmount] = useState("0.05");
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
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showTransactionMenu, setShowTransactionMenu] = useState(false);
  const [sokaMessage, setSokaMessage] = useState<string | null>(null);
  // Borrow state - chat flow
  const [borrowToken, setBorrowToken] = useState<"MUSD" | "MUSDC" | null>(null);
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowStep, setBorrowStep] = useState<"idle" | "select_token" | "enter_amount" | "review" | "success">("idle");
  const [borrowAcknowledged, setBorrowAcknowledged] = useState(false);
  // Vault state - chat flow
  const [vaultStep, setVaultStep] = useState<"idle" | "list" | "details" | "deposit" | "confirm" | "success">("idle");
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [vaultAcknowledged, setVaultAcknowledged] = useState(false);

  // Real on-chain pools are wired below (after pool/vault step state).

  // Pool state - chat flow
  const [poolStep, setPoolStep] = useState<"idle" | "list" | "details" | "addLiquidity" | "addIncentive" | "removeLiquidity" | "success">("idle");
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [incentiveAmount, setIncentiveAmount] = useState("");
  const [removeAmount, setRemoveAmount] = useState("");

  // Borrow quote state (real on-chain valuation via /api/borrow-quote)
  const [borrowQuote, setBorrowQuote] = useState<any>(null);
  const [borrowQuoteLoading, setBorrowQuoteLoading] = useState(false);
  const [borrowQuoteError, setBorrowQuoteError] = useState<string | null>(null);

  // Pool execution state (real quotes + unsigned transactions)
  const [liqQuote, setLiqQuote] = useState<any>(null);
  const [liqQuoteLoading, setLiqQuoteLoading] = useState(false);
  const [liqQuoteError, setLiqQuoteError] = useState<string | null>(null);

  // Real on-chain pools (Mezo Swap factory). Loaded on demand for Pool/Vault flows.
  const poolsEnabled = poolStep !== "idle" || vaultStep !== "idle";
  const poolsQuery = useQuery({
    queryKey: ['soka-pools', walletAddress ?? 'disconnected'],
    queryFn: () => marketApi.getPools({ limit: 30, offset: 0, wallet: walletAddress ?? undefined }),
    enabled: poolsEnabled,
    staleTime: 30_000,
    retry: 1,
  });
  const pools: PoolDto[] = poolsQuery.data?.pools ?? [];
  const poolsTotal = poolsQuery.data?.totalPairs ?? 0;

  const findPoolByTokens = (a: string, b: string): PoolDto | undefined => {
    const la = a.toLowerCase(), lb = b.toLowerCase();
    return pools.find((p) => {
      const s0 = p.token0.symbol.toLowerCase(), s1 = p.token1.symbol.toLowerCase();
      return (s0 === la && s1 === lb) || (s0 === lb && s1 === la);
    });
  };

  const poolDisplayName = (p: PoolDto): string => `${p.token0.symbol}/${p.token1.symbol}`;
  const fmtUsd = (v: number | null | undefined): string =>
    v == null ? "—" : v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(2)}K` : `$${v.toFixed(2)}`;

  const upsertHistory = (id: string, patch: Partial<SwapSnapshot>) => {
    setHistory(prev => { const n = prev.map(x => (x.id === id ? { ...x, ...patch } : x)); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
    if (activeSwapRef.current?.id === id) activeSwapRef.current = { ...activeSwapRef.current, ...patch };
  };
  const clearHistory = () => { setHistory([]); setExpandedHistory(null); setSubmittedUserPrompt(null); try { localStorage.removeItem(HISTORY_KEY); } catch { /* */ } };
  // Reset all features to initial state
  const resetAllFeatures = () => {
    setShowTransactionMenu(false);
    setSokaMessage(null);
    setBorrowStep("idle");
    setBorrowToken(null);
    setCollateralAmount("");
    setBorrowAcknowledged(false);
    setBorrowQuote(null);
    setBorrowQuoteError(null);
    setVaultStep("idle");
    setSelectedVault(null);
    setDepositAmount("");
    setVaultAcknowledged(false);
    setPoolStep("idle");
    setSelectedPool(null);
    setLiquidityAmount("");
    setIncentiveAmount("");
    setRemoveAmount("");
    setLiqQuote(null);
    setLiqQuoteError(null);
    setActiveAction(null);
  };
  const handleCancelSwap = () => { setRouteNodes([]); setGuardianChecks([]); setGuardianSafe(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setHasConfirmedSettings(false); resetAllFeatures(); activeSwapRef.current = null; setSubmittedUserPrompt(null); setCancelMsg("Order cancelled. Try another swap? \u26a1"); };
  const handleSelectSubAction = (action: string) => {
    setShowTransactionMenu(false);
    const actionLabels: Record<string, string> = { deposit: "Deposit", withdraw: "Withdraw", send: "Send", receive: "Receive" };
    setSubmittedUserPrompt(`Action: ${actionLabels[action]}`);
    setSokaMessage(`You selected ${actionLabels[action]}. Please tell me the amount and token you'd like to ${action}.`);
    setIntentPrompt("");
  };
  // Borrow handlers - chat flow
  const handleOpenBorrow = () => {
    setBorrowStep("select_token");
    setCollateralAmount("");
    setBorrowToken(null);
    setBorrowAcknowledged(false);
    setSokaMessage("Which token would you like to borrow? Select MUSD or MUSDC:");
  };
  const handleSelectBorrowToken = (token: "MUSD" | "MUSDC") => {
    setBorrowToken(token);
    setBorrowStep("enter_amount");
    setSokaMessage(`You selected ${token}. How much BTC would you like to deposit as collateral?`);
  };
  const handleBorrowAmountSubmit = async () => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !borrowToken) return;
    setBorrowQuoteLoading(true);
    setBorrowQuoteError(null);
    try {
      const quote = await marketApi.borrowQuote({
        walletAddress: walletAddress ?? undefined,
        collateralSymbol: "BTC",
        collateralAmount,
        debtSymbol: borrowToken,
      });
      setBorrowQuote(quote);
      setBorrowStep("review");
      const maxBorrow = quote.maxBorrowAmount ?? "—";
      const liqPrice = quote.liquidationPriceUsd != null ? `$${Number(quote.liquidationPriceUsd).toFixed(2)}` : "—";
      const apr = quote.aprPct != null ? `${quote.aprPct}% APR` : "rate unavailable on-chain";
      setSokaMessage(`📋 Borrow Quote (live on-chain valuation):\n\n• Borrow up to: ${maxBorrow} ${borrowToken}\n• Collateral: ${collateralAmount} BTC${quote.collateralValueUsd != null ? ` ($${Number(quote.collateralValueUsd).toFixed(2)})` : " (price unavailable)"}\n• Max LTV: ${(quote.maxLtv * 100).toFixed(0)}%\n• Interest Rate: ${apr}\n• Liquidation Price: ${liqPrice}\n\n⚠️ Execution is unavailable: no lending pool contract exists on Mezo testnet. This quote is advisory only.`);
    } catch (err: any) {
      setBorrowQuoteError(err.message || "Failed to fetch borrow quote");
      setSokaMessage(`Borrow quote failed: ${err.message || "backend unreachable"}. Check that the backend is running and the wallet has BTC for collateral valuation.`);
    } finally {
      setBorrowQuoteLoading(false);
    }
  };
  const handleBorrowConfirm = () => {
    // No lending pool contract exists on Mezo testnet: never fabricate success.
    setSokaMessage(`Borrow execution is unavailable: no lending pool contract exists on Mezo testnet. Your quote (${borrowQuote?.maxBorrowAmount ?? "—"} ${borrowToken ?? ""}) remains advisory only.`);
  };
  const handleBorrowCancel = () => {
    setBorrowStep("idle");
    setCollateralAmount("");
    setBorrowToken(null);
    setBorrowAcknowledged(false);
    setBorrowQuote(null);
    setBorrowQuoteError(null);
    setSokaMessage("Borrow cancelled. Is there anything else I can help you with?");
  };
  // Borrow figures always come from the live quote (never local estimates).
  const collateralValueUsd = borrowQuote?.collateralValueUsd != null ? Number(borrowQuote.collateralValueUsd) : 0;
  const maxLtv = borrowQuote?.maxLtv ?? 0;
  const borrowAmount = borrowQuote?.maxBorrowAmount != null ? Number(borrowQuote.maxBorrowAmount) : 0;
  const interestRate = borrowQuote?.aprPct;
  const liquidationLtv = borrowQuote?.liquidationLtv ?? 0;
  const liquidationPrice = borrowQuote?.liquidationPriceUsd != null ? Number(borrowQuote.liquidationPriceUsd) : 0;
  // Vault handlers - venues are REAL on-chain pools; deposits execute as
  // add-liquidity through the wallet (no mock vault contracts exist).
  const handleOpenVault = () => {
    setVaultStep("list");
    setSokaMessage("Here are live Mezo Swap pools as yield venues (on-chain TVL and reserves). Select a venue to supply liquidity.");
  };
  const handleSelectVault = (poolAddress: string) => {
    const pool = pools.find(p => p.address.toLowerCase() === poolAddress.toLowerCase());
    if (!pool) return;
    setSelectedVault(poolAddress);
    setSelectedPool(poolAddress);
    setVaultStep("details");
    setSokaMessage(`📋 ${poolDisplayName(pool)} Venue (live):\n\n• Pool: ${pool.address}\n• Type: ${pool.stable == null ? "Unknown" : pool.stable ? "Stable" : "Volatile"}\n• Fee: ${pool.feePct != null ? `${pool.feePct}%` : "—"}\n• TVL: ${fmtUsd(pool.tvlUsd)}\n• Reserves: ${pool.token0.reserve} ${pool.token0.symbol} / ${pool.token1.reserve} ${pool.token1.symbol}${pool.userLpBalance != null ? `\n• Your LP: ${pool.userLpBalance} (${pool.userSharePct != null ? pool.userSharePct.toFixed(4) : "—"}%)` : ""}\n\n supplying liquidity mints real LP tokens to your wallet.`);
  };
  const handleDepositVault = () => {
    setVaultStep("deposit");
    const pool = pools.find(p => p.address === selectedVault);
    setSokaMessage(`How much ${pool?.token0.symbol || "token"} (paired with ${pool?.token1.symbol || "token"}) would you like to supply to ${pool ? poolDisplayName(pool) : "the pool"}? Amounts are quoted on-chain before signing.`);
  };
  const handleDepositAmountSubmit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !selectedVault) return;
    const pool = pools.find(p => p.address === selectedVault);
    if (!pool) return;
    setLiqQuoteLoading(true);
    setLiqQuoteError(null);
    try {
      // Quote token0 leg; the router prices the paired leg from live reserves.
      const quote = await marketApi.quoteAddLiquidity({
        tokenA: pool.token0.address,
        tokenB: pool.token1.address,
        stable: pool.stable ?? false,
        amountADesired: depositAmount,
        amountBDesired: depositAmount,
      });
      setLiqQuote({ ...quote, poolAddress: pool.address, tokenA: pool.token0, tokenB: pool.token1 });
      setVaultStep("confirm");
      setSokaMessage(`📋 Supply Preview (live quote):\n\n• Pool: ${poolDisplayName(pool)}\n• You supply: ${quote.quotedAmountA} ${pool.token0.symbol} + ${quote.quotedAmountB} ${pool.token1.symbol}\n• LP tokens: ${quote.liquidityTokens}\n\nSign with your wallet to execute on Mezo testnet.`);
    } catch (err: any) {
      setLiqQuoteError(err.message || "Quote failed");
      setSokaMessage(`Supply quote failed: ${err.message || "backend unreachable"}.`);
    } finally {
      setLiqQuoteLoading(false);
    }
  };
  const handleVaultConfirm = async () => {
    if (!walletAddress) {
      if (openConnectModal) openConnectModal();
      return;
    }
    if (!selectedVault || !liqQuote) return;
    setIsExecuting(true);
    try {
      const tx = await marketApi.addLiquidity({
        senderAddress: walletAddress,
        tokenA: liqQuote.tokenA.address,
        tokenB: liqQuote.tokenB.address,
        stable: pools.find(p => p.address === selectedVault)?.stable ?? false,
        amountADesired: liqQuote.quotedAmountA,
        amountBDesired: liqQuote.quotedAmountB,
      });
      await executeUnsignedTx(tx, `Supply to ${selectedVault.slice(0, 10)}…`);
      setVaultStep("success");
      setSokaMessage(`✅ Liquidity supplied on Mezo testnet. LP tokens are now in your wallet.`);
      poolsQuery.refetch();
    } catch (err: any) {
      setSokaMessage(`Supply failed: ${err.message || "wallet rejected the transaction"}.`);
    } finally {
      setIsExecuting(false);
    }
  };
  const handleVaultCancel = () => {
    setVaultStep("idle");
    setSelectedVault(null);
    setDepositAmount("");
    setVaultAcknowledged(false);
    setLiqQuote(null);
    setLiqQuoteError(null);
    setSokaMessage("Vault action cancelled. Is there anything else I can help you with?");
  };
  // Shared on-chain executor for unsigned backend transactions.
  const executeUnsignedTx = async (tx: any, label: string): Promise<string> => {
    if (chainId !== mezoTestnet.id) {
      throw new Error(`Wrong network: switch your wallet to Mezo Testnet (chain ${mezoTestnet.id})`);
    }
    let target = (tx.to || tx.target) as `0x${string}`;
    let txData = (tx.data || "0x") as `0x${string}`;
    let txVal = BigInt(tx.value || "0");
    let gasLim = tx.gasLimit ? BigInt(tx.gasLimit) : undefined;
    if (tx.transactionData) {
      try {
        const parsed = JSON.parse(tx.transactionData);
        if (parsed.to) target = parsed.to;
        if (parsed.data) txData = parsed.data;
        if (parsed.value) txVal = BigInt(parsed.value);
        if (parsed.gasLimit) gasLim = BigInt(parsed.gasLimit);
      } catch { /* use top-level fields */ }
    }
    if (!target || !target.startsWith('0x') || target.length !== 42) {
      throw new Error(`Backend returned an invalid transaction target for ${label}`);
    }
    const hash = await sendTransactionAsync({ to: target, data: txData, value: txVal, gas: gasLim });
    if (!hash) throw new Error("No transaction hash returned from wallet.");
    if (publicClient) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status === 'reverted') throw new Error(`Transaction reverted on-chain: ${hash}`);
    }
    setTxDigest(hash);
    return hash;
  };
  // Pool handlers - all data and execution are live on Mezo testnet.
  const handleOpenPool = () => {
    setPoolStep("list");
    setSokaMessage("Here are live Mezo Swap pools from the on-chain factory. Select a pool to view reserves, quote, add or remove liquidity.");
  };
  const handleSelectPool = (poolAddress: string) => {
    const pool = pools.find(p => p.address.toLowerCase() === poolAddress.toLowerCase());
    if (!pool) return;
    setSelectedPool(pool.address);
    setPoolStep("details");
    setSokaMessage(`📋 ${poolDisplayName(pool)} Pool (live):\n\n• Type: ${pool.stable == null ? "Unknown" : pool.stable ? "Stable" : "Volatile"}\n• Fee: ${pool.feePct != null ? `${pool.feePct}%` : "—"}\n• TVL: ${fmtUsd(pool.tvlUsd)}\n• Reserves: ${pool.token0.reserve} ${pool.token0.symbol} / ${pool.token1.reserve} ${pool.token1.symbol}${pool.userLpBalance != null ? `\n• Your LP: ${pool.userLpBalance} (${pool.userSharePct != null ? pool.userSharePct.toFixed(4) : "—"}%)` : ""}\n\nChoose an action: Add Liquidity or Remove Liquidity.`);
  };
  const handleAddLiquidity = () => {
    if (!selectedPool) return;
    setPoolStep("addLiquidity");
    setLiqQuote(null);
    setLiqQuoteError(null);
    const pool = pools.find(p => p.address === selectedPool);
    setSokaMessage(`How much ${pool?.token0.symbol} (paired with ${pool?.token1.symbol} at live reserves) would you like to add to ${pool ? poolDisplayName(pool) : "the pool"}?`);
  };
  const handleRemoveLiquidity = () => {
    if (!selectedPool) return;
    setPoolStep("removeLiquidity");
    setLiqQuote(null);
    setLiqQuoteError(null);
    const pool = pools.find(p => p.address === selectedPool);
    setSokaMessage(`How much LP token would you like to remove from ${pool ? poolDisplayName(pool) : "the pool"}?${pool?.userLpBalance != null ? ` Your balance: ${pool.userLpBalance}.` : ""}`);
  };
  const handleAddIncentive = () => {
    // No incentive/gauge contracts are wired on testnet: keep the entry point
    // visible but honest instead of fabricating rewards.
    setSokaMessage("Incentive gauges are not wired on Mezo testnet yet. Add liquidity to earn swap fees; gauge emissions will appear here once a gauge contract is configured.");
  };
  const handleLiquiditySubmit = async () => {
    if (!liquidityAmount || parseFloat(liquidityAmount) <= 0 || !selectedPool) return;
    const pool = pools.find(p => p.address === selectedPool);
    if (!pool) return;
    setLiqQuoteLoading(true);
    setLiqQuoteError(null);
    try {
      const quote = await marketApi.quoteAddLiquidity({
        tokenA: pool.token0.address,
        tokenB: pool.token1.address,
        stable: pool.stable ?? false,
        amountADesired: liquidityAmount,
        amountBDesired: liquidityAmount,
      });
      setLiqQuote({ ...quote, poolAddress: pool.address, tokenA: pool.token0, tokenB: pool.token1 });
      setSokaMessage(`📋 Add-liquidity Preview (live quote):\n\n• Pool: ${poolDisplayName(pool)}\n• You supply: ${quote.quotedAmountA} ${pool.token0.symbol} + ${quote.quotedAmountB} ${pool.token1.symbol}\n• LP tokens: ${quote.liquidityTokens}\n\nUse Confirm below to sign with your wallet.`);
    } catch (err: any) {
      setLiqQuoteError(err.message || "Quote failed");
      setSokaMessage(`Add-liquidity quote failed: ${err.message || "backend unreachable"}.`);
    } finally {
      setLiqQuoteLoading(false);
    }
  };
  const handleLiquidityConfirm = async () => {
    if (!walletAddress) {
      if (openConnectModal) openConnectModal();
      return;
    }
    if (!liqQuote) return;
    setIsExecuting(true);
    try {
      const tx = await marketApi.addLiquidity({
        senderAddress: walletAddress,
        tokenA: liqQuote.tokenA.address,
        tokenB: liqQuote.tokenB.address,
        stable: pools.find(p => p.address === liqQuote.poolAddress)?.stable ?? false,
        amountADesired: liqQuote.quotedAmountA,
        amountBDesired: liqQuote.quotedAmountB,
      });
      await executeUnsignedTx(tx, "add liquidity");
      setPoolStep("success");
      setSokaMessage(`✅ Liquidity added on Mezo testnet. LP tokens are now in your wallet.`);
      poolsQuery.refetch();
    } catch (err: any) {
      setSokaMessage(`Add liquidity failed: ${err.message || "wallet rejected the transaction"}.`);
    } finally {
      setIsExecuting(false);
    }
  };
  const handleIncentiveSubmit = () => {
    setSokaMessage("Incentive gauges are not wired on Mezo testnet yet.");
  };
  const handleRemoveSubmit = async () => {
    if (!removeAmount || parseFloat(removeAmount) <= 0 || !selectedPool) return;
    setLiqQuoteLoading(true);
    setLiqQuoteError(null);
    try {
      const quote = await marketApi.quoteRemoveLiquidity({ poolAddress: selectedPool, liquidity: removeAmount });
      setLiqQuote({ ...quote });
      setSokaMessage(`📋 Remove Preview (live quote):\n\n• You receive: ${quote.quotedAmountA} + ${quote.quotedAmountB}\n\nUse Confirm below to sign with your wallet.`);
    } catch (err: any) {
      setLiqQuoteError(err.message || "Quote failed");
      setSokaMessage(`Remove quote failed: ${err.message || "backend unreachable"}.`);
    } finally {
      setLiqQuoteLoading(false);
    }
  };
  const handleRemoveConfirm = async () => {
    if (!walletAddress) {
      if (openConnectModal) openConnectModal();
      return;
    }
    if (!liqQuote?.poolAddress || !removeAmount) return;
    setIsExecuting(true);
    try {
      const tx = await marketApi.removeLiquidity({
        senderAddress: walletAddress,
        poolAddress: liqQuote.poolAddress,
        liquidity: removeAmount,
      });
      await executeUnsignedTx(tx, "remove liquidity");
      setPoolStep("success");
      setSokaMessage(`✅ Liquidity removed on Mezo testnet. Underlying tokens are back in your wallet.`);
      poolsQuery.refetch();
    } catch (err: any) {
      setSokaMessage(`Remove liquidity failed: ${err.message || "wallet rejected the transaction"}.`);
    } finally {
      setIsExecuting(false);
    }
  };
  const handlePoolCancel = () => {
    setPoolStep("idle");
    setSelectedPool(null);
    setLiquidityAmount("");
    setIncentiveAmount("");
    setRemoveAmount("");
    setSokaMessage("Pool action cancelled. Is there anything else I can help you with?");
  };
  const deleteHistoryEntry = (id: string) => { setHistory(prev => { const n = prev.filter(x => x.id !== id); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch { /* */ } return n; }); setExpandedHistory(prev => (prev === id ? null : prev)); if (activeSwapRef.current?.id === id) activeSwapRef.current = null; };

  useEffect(() => { const ii = searchParams.get("intent"); if (ii) handleProcessIntent(ii); }, [searchParams]);

  // Parse user intent and route to appropriate feature
  const parseUserIntent = (prompt: string) => {
    const lowerPrompt = prompt.toLowerCase();

    // Extract amount from prompt (e.g., "1000", "1000 USDC", "1000$")
    const amountMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:usd|usdc|btc|sui|mush|mezo|wal|deep|musd|musdc|\$)?/);
    const extractedAmount = amountMatch ? amountMatch[1] : null;

    // Cancel/Reset intents
    if (lowerPrompt.includes("cancel") || lowerPrompt.includes("stop") || lowerPrompt.includes("clear") || lowerPrompt.includes("reset") || lowerPrompt.includes("go back") || lowerPrompt.includes("back") || lowerPrompt.includes("nevermind") || lowerPrompt.includes("never mind")) {
      resetAllFeatures();
      setSokaMessage("All actions cleared. What would you like to do next?");
      return true;
    }

    // Vault/Deposit intents - only when vault/stake/earn is explicitly mentioned
    if (lowerPrompt.includes("vault") || lowerPrompt.includes("stake") || lowerPrompt.includes("earn yield") || lowerPrompt.includes("earn interest") || lowerPrompt.includes("provide liquidity")) {
      const btcMatch = lowerPrompt.match(/btc|bitcoin/);
      const mushMatch = lowerPrompt.match(/mush/);
      const usdcMatch = lowerPrompt.match(/usdc/);
      const mezoMatch = lowerPrompt.match(/mezo/);
      const musdMatch = lowerPrompt.match(/musd/);
      const tbtcMatch = lowerPrompt.match(/tbtc/);

      resetAllFeatures();
      setActiveAction("vault");
      setVaultStep("list");
      setSokaMessage("Live Mezo Swap pools as yield venues are loading on-chain. Select a venue to supply liquidity and mint real LP tokens.");

      // Auto-select venue if tokens mentioned (matches against live pools)
      const mentions = [btcMatch && "btc", mushMatch && "mush", usdcMatch && "usdc", mezoMatch && "mezo", musdMatch && "musd", tbtcMatch && "tbtc"].filter(Boolean) as string[];

      if (mentions.length > 0) {
        setTimeout(() => {
          const venue = pools.find((p) =>
            mentions.some((m) => p.token0.symbol.toLowerCase().includes(m) || p.token1.symbol.toLowerCase().includes(m))
          ) ?? pools[0];
          if (!venue) {
            setSokaMessage("No live pools are available yet. Check that the backend is running and the factory is reachable.");
            return;
          }
          handleSelectVault(venue.address);
          if (extractedAmount) setDepositAmount(extractedAmount);
        }, 500);
      }
      return true;
    }

    // Deposit money (nạp tiền) - show transaction deposit flow
    if (lowerPrompt.includes("deposit") || lowerPrompt.includes("nạp") || lowerPrompt.includes("put money") || lowerPrompt.includes("add money") || lowerPrompt.includes("add funds")) {
      resetAllFeatures();
      setActiveAction("transaction");
      setShowTransactionMenu(true);
      setSokaMessage("I can help you deposit funds. Select Deposit from the options below:");
      return true;
    }

    // Borrow intents - various phrasings
    if (lowerPrompt.includes("borrow") || lowerPrompt.includes("loan") || lowerPrompt.includes("lend me") || lowerPrompt.includes("get loan") || lowerPrompt.includes("take loan") || lowerPrompt.includes("need money") || lowerPrompt.includes("need cash") || lowerPrompt.includes("get funds")) {
      const musdMatch = lowerPrompt.match(/\bmusd\b/);
      const musdcMatch = lowerPrompt.match(/\bmusdc\b/);

      resetAllFeatures();
      setActiveAction("borrow");
      setBorrowStep("enter_amount");
      setBorrowAcknowledged(false);

      if (musdMatch) {
        setBorrowToken("MUSD");
        setCollateralAmount(extractedAmount || "");
        setSokaMessage(`You want to borrow ${extractedAmount || ""} MUSD. Please enter collateral amount in BTC:`);
      } else if (musdcMatch) {
        setBorrowToken("MUSDC");
        setCollateralAmount(extractedAmount || "");
        setSokaMessage(`You want to borrow ${extractedAmount || ""} MUSDC. Please enter collateral amount in BTC:`);
      } else {
        setBorrowStep("select_token");
        setBorrowToken(null);
        setSokaMessage("I can help you borrow tokens. Which token would you like to borrow? Select MUSD or MUSDC:");
      }
      return true;
    }

    // Pool/Liquidity intents - various phrasings
    if (lowerPrompt.includes("pool") || lowerPrompt.includes("liquidity") || lowerPrompt.includes("add liquidity") || lowerPrompt.includes("remove liquidity") || lowerPrompt.includes("provide liquidity") || lowerPrompt.includes("withdraw liquidity") || lowerPrompt.includes("earn fees") || lowerPrompt.includes("incentive") || lowerPrompt.includes("reward")) {
      const isRemove = lowerPrompt.includes("remove") || lowerPrompt.includes("withdraw");
      const isIncentive = lowerPrompt.includes("incentive") || lowerPrompt.includes("reward");
      resetAllFeatures();
      setActiveAction("pool");
      setPoolStep("list");
      setSokaMessage("Here are the available pools. Select a pool to view details:");

      // Auto-select pool from live data if tokens mentioned
      const mentionsPool = [
        (lowerPrompt.includes("btc") || lowerPrompt.includes("bitcoin")) && "btc",
        (lowerPrompt.includes("musdc") || lowerPrompt.includes("mush") || lowerPrompt.includes("stable")) && "musdc",
        lowerPrompt.includes("musdt") && "musdt",
        lowerPrompt.includes("mezo") && "mezo",
        lowerPrompt.includes("musd") && "musd",
      ].filter(Boolean) as string[];

      if (mentionsPool.length > 0) {
        setTimeout(() => {
          const pool = pools.find((p) =>
            mentionsPool.some((m) => p.token0.symbol.toLowerCase().includes(m) || p.token1.symbol.toLowerCase().includes(m))
          ) ?? pools[0];
          if (!pool) {
            setSokaMessage("No live pools are available yet. Check that the backend is running and the factory is reachable.");
            return;
          }
          handleSelectPool(pool.address);
          if (isRemove) {
            setPoolStep("removeLiquidity");
            setRemoveAmount(extractedAmount || "");
            setSokaMessage(`📋 ${poolDisplayName(pool)} Pool (live):\n\n• TVL: ${fmtUsd(pool.tvlUsd)}\n\n${extractedAmount ? `You want to remove ${extractedAmount} LP. Review the live quote to confirm.` : "How much LP token would you like to remove?"}`);
          } else if (isIncentive) {
            setSokaMessage("Incentive gauges are not wired on Mezo testnet yet. Select Add Liquidity to earn swap fees from live pools.");
          } else {
            setPoolStep("addLiquidity");
            setLiquidityAmount(extractedAmount || "");
            setSokaMessage(`📋 ${poolDisplayName(pool)} Pool (live):\n\n• TVL: ${fmtUsd(pool.tvlUsd)}\n\n${extractedAmount ? `You want to add ${extractedAmount}. Review the live quote to confirm.` : "How much liquidity would you like to add?"}`);
          }
        }, 500);
      }
      return true;
    }

    // Swap/Transaction intents
    if (lowerPrompt.includes("swap") || lowerPrompt.includes("trade") || lowerPrompt.includes("exchange") || lowerPrompt.includes("convert") || lowerPrompt.includes("buy") || lowerPrompt.includes("sell")) {
      // Let the existing swap flow handle this
      return false;
    }

    return false;
  };

  const handleProcessIntent = async (promptToRun?: string) => {
    const prompt = promptToRun || intentPrompt;
    if (!prompt.trim() || isProcessing) return;

    setSubmittedUserPrompt(prompt);

    // Try to parse intent locally first
    const handled = parseUserIntent(prompt);
    if (handled) {
      setIntentPrompt("");
      return;
    }
    const swapId = makeHistoryId();
    const snapshot: SwapSnapshot = { id: swapId, prompt, status: "SIMULATED", createdAt: Date.now(), routeNodes: [], checks: [], ptbSteps: [] };
    activeSwapRef.current = snapshot;
    setHistory(prev => { const a = prev[0]; const dup = !!a && a.prompt === prompt && a.status === "SIMULATED" && a.routeNodes.length === 0 && Date.now() - a.createdAt < 5000; if (dup) { activeSwapRef.current = a; return prev; } const n = [snapshot, ...prev.filter(x => x.id !== snapshot.id)].slice(0, MAX_HISTORY); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
    setIsProcessing(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setCancelMsg(null); setSokaMessage(null); setBorrowStep("idle"); setBorrowToken(null); setCollateralAmount(""); setBorrowAcknowledged(false); setBorrowQuote(null); setBorrowQuoteError(null); setVaultStep("idle"); setSelectedVault(null); setDepositAmount(""); setVaultAcknowledged(false); setPoolStep("idle"); setSelectedPool(null); setLiquidityAmount(""); setLiqQuote(null); setLiqQuoteError(null);
    try {
      const res = await fetch("/api/process-intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, senderAddress: walletAddress || ZERO_ADDRESS }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray((data as any)?.details)
          ? (data as any).details.map((d: any) => d?.message || d?.field).filter(Boolean).join("; ")
          : "";
        throw new Error(details ? `${(data as any)?.error || "Failed to process intent"}: ${details}` : (data as any)?.error || "Failed to process intent");
      }
      if (data.tokenSuggestion) { setTokenSuggestion(data.tokenSuggestion); setIsProcessing(false); upsertHistory(swapId, { status: "FAILED" }); return; }
      if (data.alternativeSource) setAlternativeSource(data.alternativeSource);
      if (data.intent) { setSourceSymbol(data.intent.source_token_symbol || "BTC"); setDestSymbol(data.intent.destination_token_symbol || "MUSD"); setTradeAmount(data.intent.trade_amount || "0.05"); }
      const patch: Partial<SwapSnapshot> = { sourceSymbol: data.intent?.source_token_symbol || undefined, destSymbol: data.intent?.destination_token_symbol || undefined, amount: data.intent?.trade_amount || undefined };
      if (data.route) { setRouteNodes(data.route.route || []); setExpectedOutput(Number(data.route.expected_output || 0).toFixed(4)); setExecutionImpact(data.route.execution_impact || "0.05%"); patch.routeNodes = data.route.route || []; patch.expectedOutput = Number(data.route.expected_output || 0).toFixed(4); patch.executionImpact = data.route.execution_impact || "0.05%"; }
      if (data.guardian) { setGuardianSafe(data.guardian.safe); setGuardianScore(data.guardian.score || 90); setGuardianRiskLevel(data.guardian.riskLevel || "LOW"); setGuardianChecks(data.guardian.checks || []); patch.guardianSafe = !!data.guardian.safe; patch.guardianScore = data.guardian.score || 90; patch.guardianRiskLevel = data.guardian.riskLevel || "LOW"; patch.checks = data.guardian.checks || []; }
      upsertHistory(swapId, patch);
    } catch (err: any) { setErrorMessage(err.message || "Error communicating with SOKA"); upsertHistory(swapId, { status: "FAILED" }); }
    finally { setIsProcessing(false); }
  };

  const handleExecuteSwap = async () => {
    if (!walletAddress) {
      if (openConnectModal) openConnectModal();
      return;
    }
    if (chainId !== mezoTestnet.id) {
      try {
        await switchChain({ chainId: mezoTestnet.id });
      } catch {
        setErrorMessage(`Wrong network: switch your wallet to Mezo Testnet (chain ${mezoTestnet.id})`);
        return;
      }
    }
    if (isExecuting) return;
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/execute-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderAddress: walletAddress,
          sourceSymbol,
          destSymbol,
          amount: tradeAmount,
          slippage: parseFloat(optimalSlippage.replace("%", "")) || 0.5,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray((data as any)?.details)
          ? (data as any).details.map((d: any) => d?.message || d?.field).filter(Boolean).join("; ")
          : "";
        throw new Error(details ? `${(data as any)?.error || "Failed to build transaction"}: ${details}` : (data as any)?.error || "Failed to build transaction");
      }

      const hash = await executeUnsignedTx(data, `swap ${tradeAmount} ${sourceSymbol} to ${destSymbol}`);

      if (activeSwapRef.current) {
        upsertHistory(activeSwapRef.current.id, {
          status: "CONFIRMED",
          txDigest: hash,
          txHash: hash,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Swap failed.");
      if (activeSwapRef.current) upsertHistory(activeSwapRef.current.id, { status: "FAILED" });
    } finally {
      setIsExecuting(false);
    }
  };

  const quickPrompts = ["Swap 0.05 BTC to MUSD", "Borrow MUSD with BTC", "Show MUSD pools"];
  const hasResult = routeNodes.length > 0 || guardianChecks.length > 0;
  const hasRiskWarnings = guardianChecks.some(c => c.status === "WARNING" || c.status === "DANGER") || !guardianSafe;

  return (
    <div className="h-[100dvh] w-full bg-[#FDF2F2] text-[#2C1924] flex flex-col overflow-hidden relative selection:bg-[#EE97C2] selection:text-white">
      {/* Full-viewport Generative Ink Canvas (identical to Landing Page) */}
      <GenerativeInkCanvas />

      {/* Interactive Cursor Dye Bloom */}
      <div 
        ref={bloomRef}
        className="fixed pointer-events-none z-0 w-[480px] h-[480px] rounded-full mix-blend-multiply opacity-40 blur-3xl transition-transform duration-100 ease-out hidden md:block"
        style={{
          top: 0,
          left: 0,
          background: 'radial-gradient(circle, #EE97C2 0%, rgba(253,242,242,0) 70%)',
          willChange: 'transform'
        }}
      />

      <ProHeader />

      <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3.5 sm:py-5 relative z-10 flex flex-col">
        {/* Main Chat Card - Crisp, Soft & Clean Redesign */}
        <div className="h-full bg-white rounded-[26px] sm:rounded-[30px] flex flex-col overflow-hidden relative border border-[#2C1924]/[0.09] shadow-[0_16px_44px_-10px_rgba(44,25,36,0.07),0_2px_8px_rgba(44,25,36,0.03)]">
          {/* Subtle Top Specular Light Highlight */}
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#2C1924]/[0.06] to-transparent pointer-events-none z-20 rounded-t-[26px] sm:rounded-t-[30px]" />

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#2C1924]/[0.07] bg-white shrink-0 rounded-t-[26px] sm:rounded-t-[30px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center shadow-xs">
                <img src="/icon-chatbox.png" alt="SOKA AI" className="w-8 h-8 object-contain drop-shadow-2xs transition-transform hover:scale-105" />
              </div>
              <div>
                <div className="font-extrabold text-[15px] tracking-tight text-[#2C1924]" style={{ fontFamily: "var(--font-display)" }}>SOKA AI</div>
                <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 font-meta">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" /> 
                  Online · Mezo Network
                </div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 font-meta">
              <button onClick={() => setHistoryOpen(v => !v)} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${historyOpen ? "bg-[#DF7AA7] text-white border-[#DF7AA7] shadow-xs" : "bg-[#FAF8FA] text-[#2C1924] border-[#2C1924]/10 hover:border-[#DF7AA7]/60 hover:text-[#DF7AA7] hover:bg-white"}`}>
                <HistoryIcon className={`w-3.5 h-3.5 ${historyOpen ? 'text-white' : 'text-[#DF7AA7]'}`} />
                <span className="hidden sm:inline">History</span>
                {history.length > 0 && <span className={`ml-1 min-w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center ${historyOpen ? 'bg-white text-[#DF7AA7]' : 'bg-[#DF7AA7] text-white'}`}>{history.length > 9 ? "9+" : history.length}</span>}
              </button>
              <button onClick={() => { setIntentPrompt(""); setSubmittedUserPrompt(null); setRouteNodes([]); setGuardianChecks([]); setErrorMessage(null); setTxDigest(null); activeSwapRef.current = null; }} className="w-8 h-8 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center hover:bg-white hover:border-[#DF7AA7]/60 text-[#2C1924] hover:text-[#DF7AA7] font-bold transition-all shadow-2xs cursor-pointer" title="New Session">
                <span className="text-base font-bold">+</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5 bg-[#FCFAFA]">
            <div className="flex flex-col gap-4 w-full">
              {/* Intro */}
              <div className="flex items-end gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#2C1924]/10 flex items-center justify-center shadow-2xs shrink-0">
                  <img src="/icon-chatbox.png" alt="Soka" className="w-7 h-7 object-contain" />
                </div>
                <div className="p-4 sm:p-4.5 rounded-[22px] rounded-tl-[6px] bg-white border border-[#2C1924]/[0.08] shadow-[0_2px_12px_-2px_rgba(44,25,36,0.05)] max-w-[85%] relative overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="font-meta text-[10px] font-bold tracking-[0.12em] text-[#DF7AA7] uppercase">SOKA AI</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#DF7AA7]" />
                    <span className="font-meta text-[9px] font-semibold text-[#845D74]/80">Intent Engine</span>
                  </div>
                  <div className="text-[14.5px] font-medium text-[#2C1924] leading-relaxed">Tell me your dream swap. I sniff the route &amp; run 7 checks — no jargon, just vibes ⚡</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2 ml-0 sm:ml-12">
                <button 
                  onClick={() => { resetAllFeatures(); setActiveAction("transaction"); setShowTransactionMenu(true); }} 
                  className={`group relative flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-200 select-none cursor-pointer ${
                    activeAction === "transaction" 
                      ? "bg-[#FFF6F9] border-[#DF7AA7] text-[#DF7AA7] font-bold shadow-xs" 
                      : "bg-white hover:bg-[#FAF8FA] border-[#2C1924]/[0.08] text-[#2C1924] font-medium hover:border-[#DF7AA7]/50 hover:text-[#DF7AA7] shadow-2xs hover:-translate-y-0.5"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shadow-2xs shrink-0 ${
                    activeAction === "transaction" 
                      ? "bg-[#DF7AA7] text-white" 
                      : "bg-[#FAF8FA] text-[#DF7AA7] group-hover:bg-[#DF7AA7] group-hover:text-white"
                  }`}>
                    <ArrowRightLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-180" />
                  </div>
                  <span className="text-[12.5px] font-semibold tracking-tight font-meta">Transaction</span>
                </button>

                <button 
                  onClick={() => { resetAllFeatures(); setActiveAction("borrow"); handleOpenBorrow(); }} 
                  className={`group relative flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-200 select-none cursor-pointer ${
                    activeAction === "borrow" 
                      ? "bg-[#FFF6F9] border-[#DF7AA7] text-[#DF7AA7] font-bold shadow-xs" 
                      : "bg-white hover:bg-[#FAF8FA] border-[#2C1924]/[0.08] text-[#2C1924] font-medium hover:border-[#DF7AA7]/50 hover:text-[#DF7AA7] shadow-2xs hover:-translate-y-0.5"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shadow-2xs shrink-0 ${
                    activeAction === "borrow" 
                      ? "bg-[#DF7AA7] text-white" 
                      : "bg-[#FAF8FA] text-[#DF7AA7] group-hover:bg-[#DF7AA7] group-hover:text-white"
                  }`}>
                    <Landmark className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
                  </div>
                  <span className="text-[12.5px] font-semibold tracking-tight font-meta">Borrow</span>
                </button>

                <button 
                  onClick={() => { resetAllFeatures(); setActiveAction("vault"); handleOpenVault(); }} 
                  className={`group relative flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-200 select-none cursor-pointer ${
                    activeAction === "vault" 
                      ? "bg-emerald-50/70 border-emerald-500 text-emerald-700 font-bold shadow-xs" 
                      : "bg-white hover:bg-[#FAF8FA] border-[#2C1924]/[0.08] text-[#2C1924] font-medium hover:border-emerald-400 hover:text-emerald-700 shadow-2xs hover:-translate-y-0.5"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shadow-2xs shrink-0 ${
                    activeAction === "vault" 
                      ? "bg-emerald-600 text-white" 
                      : "bg-[#FAF8FA] text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
                  }`}>
                    <Vault className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-12" />
                  </div>
                  <span className="text-[12.5px] font-semibold tracking-tight font-meta">Vault</span>
                </button>

                <button 
                  onClick={() => { resetAllFeatures(); setActiveAction("pool"); handleOpenPool(); }} 
                  className={`group relative flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-200 select-none cursor-pointer ${
                    activeAction === "pool" 
                      ? "bg-[#FFF6F9] border-[#DF7AA7] text-[#DF7AA7] font-bold shadow-xs" 
                      : "bg-white hover:bg-[#FAF8FA] border-[#2C1924]/[0.08] text-[#2C1924] font-medium hover:border-[#DF7AA7]/50 hover:text-[#DF7AA7] shadow-2xs hover:-translate-y-0.5"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shadow-2xs shrink-0 ${
                    activeAction === "pool" 
                      ? "bg-[#DF7AA7] text-white" 
                      : "bg-[#FAF8FA] text-[#DF7AA7] group-hover:bg-[#DF7AA7] group-hover:text-white"
                  }`}>
                    <Waves className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <span className="text-[12.5px] font-semibold tracking-tight font-meta">Pool</span>
                </button>
              </div>

              {/* Transaction Sub-menu */}
              {showTransactionMenu && (
                <div className="mt-2 ml-0 sm:ml-12">
                  <div className="border border-[#2C1924]/[0.08] rounded-2xl p-4 shadow-[0_4px_16px_-4px_rgba(44,25,36,0.06)] bg-white max-w-full sm:max-w-[90%]">
                    {/* Header & Close Button */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2C1924]/[0.07]">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#2C1924] font-meta">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-[#DF7AA7]" />
                        <span>Transaction Actions</span>
                      </div>
                      <button 
                        onClick={() => { setShowTransactionMenu(false); setActiveAction(null); }} 
                        className="w-6 h-6 rounded-full bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center hover:bg-white text-[#845D74] hover:text-[#2C1924] transition-all cursor-pointer"
                        title="Close sub-menu"
                      >
                        <span className="text-xs font-bold">✕</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-meta">
                      <button 
                        onClick={() => handleSelectSubAction("deposit")} 
                        className="group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600 transition-transform group-hover:-translate-y-0.5" />
                        <span className="text-xs font-bold">Deposit</span>
                      </button>
                      <button 
                        onClick={() => handleSelectSubAction("withdraw")} 
                        className="group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-amber-200/80 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-600 transition-transform group-hover:-translate-y-0.5" />
                        <span className="text-xs font-bold">Withdraw</span>
                      </button>
                      <button 
                        onClick={() => handleSelectSubAction("send")} 
                        className="group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-pink-200/80 bg-pink-50/70 text-[#DF7AA7] hover:bg-pink-100 hover:border-[#DF7AA7] hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-[#DF7AA7] transition-transform group-hover:translate-x-0.5" />
                        <span className="text-xs font-bold">Send</span>
                      </button>
                      <button 
                        onClick={() => handleSelectSubAction("receive")} 
                        className="group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-purple-200/80 bg-purple-50/70 text-purple-800 hover:bg-purple-100 hover:border-purple-300 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5 text-purple-600 transition-transform group-hover:translate-y-0.5" />
                        <span className="text-xs font-bold">Receive</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Soka Action Message */}
              {sokaMessage && !isProcessing && (
                <div className="flex items-end gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#2C1924]/10 flex items-center justify-center shadow-2xs shrink-0">
                    <img src="/icon-chatbox.png" alt="Soka" className="w-7 h-7 object-contain" />
                  </div>
                  <div className="p-4 sm:p-4.5 rounded-[22px] rounded-tl-[6px] bg-white border border-[#2C1924]/[0.08] shadow-[0_2px_12px_-2px_rgba(44,25,36,0.05)] max-w-[85%] relative overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="font-meta text-[10px] font-bold tracking-[0.12em] text-[#DF7AA7] uppercase">SOKA AI</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#DF7AA7]" />
                      <span className="font-meta text-[9px] font-semibold text-[#845D74]/80">Execution Agent</span>
                    </div>
                    <div className="text-[14px] font-medium text-[#2C1924] whitespace-pre-line leading-relaxed">{sokaMessage}</div>
                  </div>
                </div>
              )}

              {/* Borrow Card - Clean Soft Design */}
              {borrowStep !== "idle" && (
                <div className="mt-2 ml-0 sm:ml-12">
                  <div className="p-5 rounded-2xl border border-[#2C1924]/[0.08] shadow-[0_4px_16px_-4px_rgba(44,25,36,0.06)] bg-white max-w-full sm:max-w-[85%]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2C1924]/[0.07]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center shadow-2xs">
                          <Landmark className="w-4.5 h-4.5 text-[#DF7AA7]" />
                        </div>
                        <div>
                          <h3 className="font-display text-[15px] font-bold text-[#2C1924]">Borrow</h3>
                          <p className="font-meta text-[11.5px] text-[#845D74]">{(borrowStep === "select_token" && "Select token") || (borrowStep === "enter_amount" && `Borrow ${borrowToken}`) || (borrowStep === "review" && "Review") || (borrowStep === "success" && "Done")}</p>
                        </div>
                      </div>
                      <button onClick={() => { setBorrowStep("idle"); setActiveAction(null); }} className="w-6 h-6 rounded-full bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center hover:bg-white text-[#845D74] hover:text-[#2C1924] transition-all cursor-pointer">
                        <span className="text-xs font-bold">✕</span>
                      </button>
                    </div>

                    {/* Step 1: Token Selection */}
                    {borrowStep === "select_token" && (
                      <div className="grid grid-cols-2 gap-3 font-meta">
                        <button onClick={() => handleSelectBorrowToken("MUSD")} className="p-3.5 rounded-xl border border-[#2C1924]/[0.08] bg-[#FAF8FA] hover:bg-white hover:border-[#DF7AA7]/60 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer shadow-2xs">
                          <div className="font-display text-[17px] font-bold text-[#2C1924]">MUSD</div>
                          <div className="font-mono text-[11px] font-bold text-emerald-600 mt-1">4.5% APR</div>
                        </button>
                        <button onClick={() => handleSelectBorrowToken("MUSDC")} className="p-3.5 rounded-xl border border-[#2C1924]/[0.08] bg-[#FAF8FA] hover:bg-white hover:border-[#DF7AA7]/60 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer shadow-2xs">
                          <div className="font-display text-[17px] font-bold text-[#2C1924]">MUSDC</div>
                          <div className="font-mono text-[11px] font-bold text-emerald-600 mt-1">3.8% APR</div>
                        </button>
                      </div>
                    )}

                    {/* Step 2: Collateral Amount */}
                    {borrowStep === "enter_amount" && (
                      <>
                        <div className="mb-4">
                          <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Collateral (BTC)</label>
                          <input type="number" value={collateralAmount} onChange={(e) => setCollateralAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-[#DF7AA7] focus:bg-white transition-all" />
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-mono text-[11px] text-[#845D74]">≈ ${borrowQuote ? collateralValueUsd.toFixed(2) : "—"} (live oracle)</span>
                          <div className="flex gap-1 font-mono">
                            {[25, 50, 75, 100].map(pct => (
                              <button key={pct} onClick={() => setCollateralAmount((1000 * pct / 100).toString())} className="px-2.5 py-1 rounded-lg bg-white border border-[#2C1924]/10 text-[10px] font-bold text-[#845D74] hover:border-[#DF7AA7] hover:text-[#DF7AA7] transition-all cursor-pointer">{pct}%</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {borrowQuoteError && <div className="font-mono text-[11px] text-[#ef4444] mb-2">{borrowQuoteError}</div>}
                      {collateralAmount && parseFloat(collateralAmount) > 0 && borrowQuote && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
                          <div className="font-mono text-[12px] text-emerald-800">Borrow up to <span className="font-bold">{borrowQuote.maxBorrowAmount ?? "—"} {borrowToken}</span></div>
                        </div>
                      )}
                      <button onClick={handleBorrowAmountSubmit} disabled={!collateralAmount || parseFloat(collateralAmount) <= 0 || borrowQuoteLoading} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-[#DF7AA7] hover:bg-[#D46A98] shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">{borrowQuoteLoading ? "Quoting on-chain…" : "Review"}</button>
                        <button onClick={() => setBorrowStep("select_token")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-[#DF7AA7] hover:underline cursor-pointer">← Change token</button>
                      </>
                    )}

                    {/* Step 3: Review */}
                    {borrowStep === "review" && (
                      <>
                        <div className="space-y-2.5 mb-4">
                          <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                            <span className="font-meta text-[12px] font-semibold text-[#845D74]">Borrow (max, live quote)</span>
                            <span className="font-display text-[15px] font-bold text-[#DF7AA7]">{borrowQuote?.maxBorrowAmount ?? "—"} {borrowToken}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                            <span className="font-meta text-[12px] font-semibold text-[#845D74]">Collateral</span>
                            <span className="font-display text-[15px] font-bold text-[#2C1924]">{collateralAmount} BTC{borrowQuote?.collateralValueUsd != null ? ` ($${Number(borrowQuote.collateralValueUsd).toFixed(2)})` : ""}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                            <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Max LTV</div>
                              <div className="font-display text-[14px] font-bold text-emerald-600">{borrowQuote ? `${(borrowQuote.maxLtv * 100).toFixed(0)}%` : "—"}</div>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Rate</div>
                              <div className="font-display text-[14px] font-bold text-[#2C1924]">{interestRate != null ? `${interestRate}%` : "—"}</div>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Liq. Price</div>
                              <div className="font-display text-[14px] font-bold text-[#ef4444]">{borrowQuote?.liquidationPriceUsd != null ? `$${Number(borrowQuote.liquidationPriceUsd).toFixed(2)}` : "—"}</div>
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 mb-4 font-meta text-[11.5px] text-amber-900">
                          Execution unavailable: no lending pool contract exists on Mezo testnet. Quotes are advisory only.
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 cursor-pointer mb-4 select-none" onClick={() => setBorrowAcknowledged(!borrowAcknowledged)}>
                          <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-colors ${borrowAcknowledged ? "bg-emerald-600 border-emerald-600" : "bg-white border-amber-300"}`}>
                            {borrowAcknowledged && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="font-meta text-[11.5px] font-semibold text-amber-900">I acknowledge the liquidation risk</span>
                        </div>
                        <div className="flex gap-2.5 font-meta">
                          <button onClick={handleBorrowCancel} className="flex-1 py-2.5 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[13px] text-[#845D74] hover:bg-[#FAF8FA] transition-all cursor-pointer">Cancel</button>
                          <button onClick={handleBorrowConfirm} disabled={!borrowAcknowledged} className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all cursor-pointer">Confirm</button>
                        </div>
                      </>
                    )}

                    {/* Step 4: Success */}
                    {borrowStep === "success" && (
                      <div className="text-center py-4">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
                          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div className="font-display text-[18px] font-bold text-[#2C1924] mb-1">Borrow Successful!</div>
                        <div className="font-meta text-[13px] text-[#845D74] mb-3">Your position is now active on Mezo</div>
                        <div className="p-3.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] inline-block mb-4 shadow-2xs">
                          <div className="grid grid-cols-2 gap-4 text-left">
                            <div>
                              <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Borrowed</div>
                              <div className="font-display text-[15px] font-bold text-[#DF7AA7]">{borrowAmount.toFixed(2)} {borrowToken}</div>
                            </div>
                            <div>
                              <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Collateral</div>
                              <div className="font-display text-[15px] font-bold text-[#2C1924]">{collateralAmount} BTC</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 justify-center font-meta">
                          <button onClick={handleBorrowCancel} className="px-5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-[12px] hover:bg-rose-100/80 transition-all cursor-pointer">Cancel Position</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vault Card - Clean Soft Design */}
              {vaultStep !== "idle" && (
                <div className="mt-2 ml-0 sm:ml-12">
                  <div className="p-5 rounded-2xl border border-[#2C1924]/[0.08] shadow-[0_4px_16px_-4px_rgba(44,25,36,0.06)] bg-white max-w-full sm:max-w-[85%]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2C1924]/[0.07]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-2xs">
                          <Vault className="w-4.5 h-4.5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-display text-[15px] font-bold text-[#2C1924]">Vaults</h3>
                          <p className="font-meta text-[11.5px] text-[#845D74]">{(vaultStep === "list" && "Your overview") || (vaultStep === "details" && "Vault details") || (vaultStep === "deposit" && "Deposit") || (vaultStep === "confirm" && "Confirm") || (vaultStep === "success" && "Done")}</p>
                        </div>
                      </div>
                      <button onClick={() => { setVaultStep("idle"); setActiveAction(null); setSelectedVault(null); setDepositAmount(""); }} className="w-6 h-6 rounded-full bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center hover:bg-white text-[#845D74] hover:text-[#2C1924] transition-all cursor-pointer">
                        <span className="text-xs font-bold">✕</span>
                      </button>
                    </div>

                    {/* Vault Balance Overview */}
                    {vaultStep === "list" && (
                      <>
                        {/* Live venues summary */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-3 font-meta">
                          <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] shadow-2xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Live Pools</div>
                            <div className="font-display text-[14px] font-bold text-[#DF7AA7] mt-0.5">{poolsQuery.isLoading ? "…" : poolsTotal}</div>
                          </div>
                          <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] shadow-2xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Venues Shown</div>
                            <div className="font-display text-[14px] font-bold text-emerald-600 mt-0.5">{pools.length}</div>
                          </div>
                          <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] shadow-2xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Your LP Positions</div>
                            <div className="font-display text-[14px] font-bold text-[#2C1924] mt-0.5">{pools.filter(p => p.userLpBalance != null && parseFloat(p.userLpBalance) > 0).length}</div>
                          </div>
                        </div>
                        {/* Vault List */}
                        <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74] mb-2">Yield Venues (live Mezo Swap pools)</div>
                        {poolsQuery.isLoading && (
                          <div className="p-4 text-center font-mono text-[12px] text-[#845D74]">Loading live pools from Mezo testnet…</div>
                        )}
                        {poolsQuery.isError && (
                          <div className="p-4 text-center font-mono text-[12px] text-[#ef4444]">Failed to load pools: {(poolsQuery.error as Error)?.message || "backend unreachable"}</div>
                        )}
                        {!poolsQuery.isLoading && !poolsQuery.isError && pools.length === 0 && (
                          <div className="p-4 text-center font-mono text-[12px] text-[#845D74]">No pools found on-chain.</div>
                        )}
                        <div className="space-y-2">
                          {pools.map(pool => (
                            <button key={pool.address} onClick={() => handleSelectVault(pool.address)} className="w-full p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer shadow-2xs border-[#2C1924]/[0.08] bg-[#FAF8FA] hover:bg-white hover:border-[#DF7AA7]/60">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-display text-[13.5px] font-bold text-[#2C1924]">{poolDisplayName(pool)}</span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-[#2C1924]/10 font-mono text-[8px] font-bold text-[#845D74]">{pool.stable == null ? "—" : pool.stable ? "STABLE" : "VOLATILE"}</span>
                                </div>
                                <span className="font-display text-[13.5px] font-bold text-emerald-600">{pool.feePct != null ? `${pool.feePct}% fee` : "fee —"}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 font-mono">
                                <span className="text-[10px] text-[#845D74]">TVL: {fmtUsd(pool.tvlUsd)}</span>
                                {pool.userLpBalance != null && <span className="text-[10px] text-emerald-700">Your LP: {pool.userLpBalance}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Vault Details */}
                    {vaultStep === "details" && selectedVault && (() => {
                      const pool = pools.find(p => p.address === selectedVault);
                      return pool ? (
                        <>
                          <div className="space-y-2 mb-3.5 font-meta">
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Pool Address</span>
                              <span className="font-mono text-[11px] font-bold text-[#2C1924]">{pool.address.slice(0, 8)}...{pool.address.slice(-6)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Pair</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{poolDisplayName(pool)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Type</span>
                              <span className="font-display text-[12.5px] font-bold text-[#DF7AA7]">{pool.stable == null ? "Unknown" : pool.stable ? "Stable" : "Volatile"}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Fee</span>
                              <span className="text-[11.5px] font-bold text-[#2C1924]">{pool.feePct != null ? `${pool.feePct}%` : "—"}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">TVL (live)</span>
                              <span className="text-[11.5px] font-bold text-[#2C1924]">{fmtUsd(pool.tvlUsd)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Reserves (live)</span>
                              <span className="text-[11.5px] font-bold text-[#2C1924]">{pool.token0.reserve} / {pool.token1.reserve}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[11px] font-bold text-emerald-800">Your LP Position</span>
                              <span className="font-display text-[15px] font-bold text-emerald-600">{pool.userLpBalance ?? "—"}</span>
                            </div>
                          </div>
                          <div className="flex gap-2.5 font-meta">
                            <button onClick={() => setVaultStep("list")} className="flex-1 py-2.5 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[13px] text-[#845D74] hover:bg-[#FAF8FA] transition-all cursor-pointer">← Back</button>
                            <button onClick={handleDepositVault} className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all cursor-pointer">Supply</button>
                          </div>
                        </>
                      ) : null;
                    })()}

                    {/* Deposit Amount */}
                    {vaultStep === "deposit" && (() => {
                      const pool = pools.find(p => p.address === selectedVault);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Amount ({pool.token0.symbol}, paired at live reserves)</label>
                            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-emerald-500 focus:bg-white transition-all" />
                          </div>
                          <button onClick={handleDepositAmountSubmit} disabled={!depositAmount || parseFloat(depositAmount) <= 0 || liqQuoteLoading} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">{liqQuoteLoading ? "Quoting on-chain…" : "Review Supply"}</button>
                          {liqQuoteError && <div className="mt-2 font-mono text-[11px] text-[#ef4444]">{liqQuoteError}</div>}
                          <button onClick={() => setVaultStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-emerald-700 hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Confirm Deposit */}
                    {vaultStep === "confirm" && (() => {
                      const pool = pools.find(p => p.address === selectedVault);
                      return pool && liqQuote ? (
                        <>
                          <div className="space-y-2.5 mb-3.5 font-meta">
                            <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[12px] font-semibold text-[#845D74]">Supply</span>
                              <span className="font-display text-[14px] font-bold text-[#2C1924]">{liqQuote.quotedAmountA} {pool.token0.symbol} + {liqQuote.quotedAmountB} {pool.token1.symbol}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[12px] font-semibold text-[#845D74]">Receive (LP)</span>
                              <span className="font-display text-[14px] font-bold text-emerald-700">{liqQuote.liquidityTokens}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[12px] font-bold text-emerald-800">Pool Fee</span>
                              <span className="font-display text-[14px] font-bold text-emerald-600">{pool.feePct != null ? `${pool.feePct}%` : "—"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 cursor-pointer mb-3.5 select-none" onClick={() => setVaultAcknowledged(!vaultAcknowledged)}>
                            <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-colors ${vaultAcknowledged ? "bg-emerald-600 border-emerald-600" : "bg-white border-amber-300"}`}>
                              {vaultAcknowledged && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-meta text-[11.5px] font-semibold text-amber-900">I acknowledge the deposit terms</span>
                          </div>
                          <div className="flex gap-2.5 font-meta">
                            <button onClick={handleVaultCancel} className="flex-1 py-2.5 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[13px] text-[#845D74] hover:bg-[#FAF8FA] transition-all cursor-pointer">Cancel</button>
                            <button onClick={handleVaultConfirm} disabled={!vaultAcknowledged} className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all cursor-pointer">Confirm</button>
                          </div>
                        </>
                      ) : null;
                    })()}

                    {/* Success */}
                    {vaultStep === "success" && (() => {
                      const pool = pools.find(p => p.address === selectedVault);
                      return pool ? (
                        <div className="text-center py-4">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                          </div>
                          <div className="font-display text-[18px] font-bold text-[#2C1924] mb-1">Liquidity Supplied!</div>
                          <div className="font-meta text-[13px] text-[#845D74] mb-3">LP tokens are now in your wallet on Mezo testnet</div>
                          <div className="p-3.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] inline-block mb-4 shadow-2xs">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Pool</div>
                                <div className="font-display text-[15px] font-bold text-emerald-700">{poolDisplayName(pool)}</div>
                              </div>
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Tx</div>
                                <div className="font-mono text-[11px] font-bold text-[#2C1924]">{txDigest ? `${txDigest.slice(0, 8)}…${txDigest.slice(-6)}` : "—"}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-center font-meta">
                            <button onClick={handleVaultCancel} className="px-5 py-2 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[12px] text-[#2C1924] hover:bg-[#FAF8FA] transition-all cursor-pointer">Close</button>
                            {txDigest && <a href={txExplorerUrl(txDigest)} target="_blank" rel="noreferrer" className="px-5 py-2 rounded-xl bg-[#DF7AA7] text-white font-bold text-[12px] inline-flex items-center gap-1">Mezo Explorer <ExternalLink className="h-3 w-3" /></a>}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Pool Card - Clean Soft Design */}
              {poolStep !== "idle" && (
                <div className="mt-2 ml-0 sm:ml-12">
                  <div className="p-5 rounded-2xl border border-[#2C1924]/[0.08] shadow-[0_4px_16px_-4px_rgba(44,25,36,0.06)] bg-white max-w-full sm:max-w-[85%]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2C1924]/[0.07]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center shadow-2xs">
                          <Waves className="w-4.5 h-4.5 text-[#DF7AA7]" />
                        </div>
                        <div>
                          <h3 className="font-display text-[15px] font-bold text-[#2C1924]">Pools</h3>
                          <p className="font-meta text-[11.5px] text-[#845D74]">{(poolStep === "list" && "Available pools") || (poolStep === "details" && "Pool details") || (poolStep === "addLiquidity" && "Add liquidity") || (poolStep === "success" && "Success")}</p>
                        </div>
                      </div>
                      <button onClick={() => { setPoolStep("idle"); setActiveAction(null); setSelectedPool(null); setLiquidityAmount(""); }} className="w-6 h-6 rounded-full bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center hover:bg-white text-[#845D74] hover:text-[#2C1924] transition-all cursor-pointer">
                        <span className="text-xs font-bold">✕</span>
                      </button>
                    </div>

                    {/* Pool List */}
                    {poolStep === "list" && (
                      <>
                        {poolsQuery.isLoading && (
                          <div className="p-4 text-center font-mono text-[12px] text-[#845D74]">Loading live pools from Mezo testnet…</div>
                        )}
                        {poolsQuery.isError && (
                          <div className="p-4 text-center font-mono text-[12px] text-[#ef4444]">Failed to load pools: {(poolsQuery.error as Error)?.message || "backend unreachable"}</div>
                        )}
                        {!poolsQuery.isLoading && !poolsQuery.isError && pools.length === 0 && (
                          <div className="p-4 text-center font-mono text-[12px] text-[#845D74]">No pools found on-chain.</div>
                        )}
                        {!poolsQuery.isLoading && !poolsQuery.isError && pools.length > 0 && (
                          <div className="font-mono text-[10px] text-[#845D74] mb-2">{poolsTotal} pools on-chain · showing {pools.length}</div>
                        )}
                        <div className="space-y-2">
                          {pools.map(pool => (
                            <button key={pool.address} onClick={() => handleSelectPool(pool.address)} className="w-full p-3 rounded-xl border border-[#2C1924]/[0.08] bg-[#FAF8FA] hover:bg-white hover:border-[#DF7AA7]/60 text-left transition-all duration-200 hover:shadow-xs hover:-translate-y-0.5 cursor-pointer shadow-2xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-display text-[13.5px] font-bold text-[#2C1924]">{poolDisplayName(pool)}</span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#DF7AA7]/10 text-[#DF7AA7] font-mono text-[9px] font-bold">{pool.stable == null ? "—" : pool.stable ? "STABLE" : "VOLATILE"}</span>
                                </div>
                                <span className="font-display text-[13.5px] font-bold text-emerald-600">{pool.feePct != null ? `${pool.feePct}% fee` : "fee —"}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 font-mono">
                                <span className="text-[10px] text-[#845D74]">TVL: {fmtUsd(pool.tvlUsd)}</span>
                                {pool.userLpBalance != null && <span className="text-[10px] text-emerald-700">Your LP: {pool.userLpBalance}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Pool Details */}
                    {poolStep === "details" && selectedPool && (() => {
                      const pool = pools.find(p => p.address === selectedPool);
                      return pool ? (
                        <>
                          <div className="space-y-2 mb-3.5 font-meta">
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Pool</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{poolDisplayName(pool)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Type</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{pool.stable == null ? "Unknown" : pool.stable ? "Stable" : "Volatile"}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Fee (on-chain)</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{pool.feePct != null ? `${pool.feePct}%` : "—"}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">TVL (live)</span>
                              <span className="font-display text-[13px] font-bold text-[#2C1924]">{fmtUsd(pool.tvlUsd)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Reserves (live)</span>
                              <span className="font-display text-[13px] font-bold text-[#2C1924]">{pool.token0.reserve} / {pool.token1.reserve}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[11px] font-bold text-emerald-800">Your LP Position</span>
                              <span className="font-display text-[15px] font-bold text-emerald-600">{pool.userLpBalance ?? "—"}</span>
                            </div>
                          </div>
                          {/* Action Buttons */}
                          <div className="grid grid-cols-3 gap-2 font-meta">
                            <button onClick={handleAddLiquidity} className="p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] hover:bg-white hover:border-[#DF7AA7]/60 transition-all text-center group cursor-pointer shadow-2xs">
                              <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-white border border-[#2C1924]/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Download className="w-3.5 h-3.5 text-[#DF7AA7]" />
                              </div>
                              <span className="text-[11px] font-bold text-[#2C1924] group-hover:text-[#DF7AA7]">Add Liquidity</span>
                            </button>
                            <button onClick={handleAddIncentive} className="p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] hover:bg-white hover:border-amber-400 transition-all text-center group cursor-pointer shadow-2xs">
                              <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-white border border-[#2C1924]/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <span className="text-[11px] font-bold text-[#2C1924] group-hover:text-amber-700">Add Incentive</span>
                            </button>
                            <button onClick={handleRemoveLiquidity} className="p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] hover:bg-white hover:border-rose-400 transition-all text-center group cursor-pointer shadow-2xs">
                              <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-white border border-[#2C1924]/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Upload className="w-3.5 h-3.5 text-rose-600" />
                              </div>
                              <span className="text-[11px] font-bold text-[#2C1924] group-hover:text-rose-700">Remove</span>
                            </button>
                          </div>
                          <button onClick={() => setPoolStep("list")} className="w-full py-1.5 mt-2.5 font-meta text-[11.5px] font-bold text-[#DF7AA7] hover:underline cursor-pointer">← Back to pools</button>
                        </>
                      ) : null;
                    })()}

                    {/* Add Liquidity */}
                    {poolStep === "addLiquidity" && (() => {
                      const pool = pools.find(p => p.address === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Amount ({pool.token0.symbol}, paired at live reserves)</label>
                            <input type="number" value={liquidityAmount} onChange={(e) => setLiquidityAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-[#DF7AA7] focus:bg-white transition-all" />
                          </div>
                          {liqQuote && (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 mb-3.5">
                              <div className="font-meta text-[11.5px] text-emerald-900">Live quote: supply <span className="font-bold text-emerald-700">{liqQuote.quotedAmountA} {pool.token0.symbol} + {liqQuote.quotedAmountB} {pool.token1.symbol}</span> for <span className="font-bold">{liqQuote.liquidityTokens}</span> LP</div>
                            </div>
                          )}
                          <button onClick={handleLiquiditySubmit} disabled={!liquidityAmount || parseFloat(liquidityAmount) <= 0 || liqQuoteLoading} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-[#DF7AA7] hover:bg-[#D46A98] shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">{liqQuoteLoading ? "Quoting on-chain…" : "Quote Add Liquidity"}</button>
                          {liqQuoteError && <div className="mt-2 font-mono text-[11px] text-[#ef4444]">{liqQuoteError}</div>}
                          {liqQuote && (
                            <button onClick={handleLiquidityConfirm} disabled={isExecuting} className="w-full py-2.5 mt-2 rounded-xl font-bold text-[13.5px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">{isExecuting ? "Signing…" : "Confirm & Sign"}</button>
                          )}
                          <button onClick={() => setPoolStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-[#DF7AA7] hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Add Incentive */}
                    {poolStep === "addIncentive" && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 font-meta text-[12px] text-amber-900">
                        Incentive gauges are not wired on Mezo testnet yet. Add liquidity to earn swap fees from live pools.
                        <button onClick={() => setPoolStep("details")} className="block w-full py-1.5 mt-2 text-[11.5px] font-bold text-amber-700 hover:underline cursor-pointer">← Back to details</button>
                      </div>
                    )}

                    {/* Remove Liquidity */}
                    {poolStep === "removeLiquidity" && (() => {
                      const pool = pools.find(p => p.address === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">LP Amount to Remove{pool.userLpBalance != null ? ` (balance: ${pool.userLpBalance})` : ""}</label>
                            <input type="number" value={removeAmount} onChange={(e) => setRemoveAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-rose-400 focus:bg-white transition-all" />
                          </div>
                          {liqQuote && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 mb-3.5">
                              <div className="font-meta text-[11.5px] text-rose-800">Live quote: receive <span className="font-bold">{liqQuote.quotedAmountA} + {liqQuote.quotedAmountB}</span></div>
                            </div>
                          )}
                          <button onClick={handleRemoveSubmit} disabled={!removeAmount || parseFloat(removeAmount) <= 0 || liqQuoteLoading} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-rose-500 hover:bg-rose-600 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">{liqQuoteLoading ? "Quoting on-chain…" : "Quote Remove"}</button>
                          {liqQuoteError && <div className="mt-2 font-mono text-[11px] text-[#ef4444]">{liqQuoteError}</div>}
                          {liqQuote && (
                            <button onClick={handleRemoveConfirm} disabled={isExecuting} className="w-full py-2.5 mt-2 rounded-xl font-bold text-[13.5px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">{isExecuting ? "Signing…" : "Confirm & Sign"}</button>
                          )}
                          <button onClick={() => setPoolStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-rose-700 hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Success */}
                    {poolStep === "success" && (() => {
                      const pool = pools.find(p => p.address === selectedPool);
                      return pool ? (
                        <div className="text-center py-4">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                          </div>
                          <div className="font-display text-[18px] font-bold text-[#2C1924] mb-1">Success!</div>
                          <div className="font-meta text-[13px] text-[#845D74] mb-3">Action completed on {poolDisplayName(pool)} (Mezo testnet)</div>
                          <div className="p-3.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] inline-block mb-4 shadow-2xs">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Pool</div>
                                <div className="font-display text-[15px] font-bold text-[#DF7AA7]">{poolDisplayName(pool)}</div>
                              </div>
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">TVL (live)</div>
                                <div className="font-display text-[15px] font-bold text-emerald-600">{fmtUsd(pool.tvlUsd)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2.5 justify-center font-meta">
                            <button onClick={() => setPoolStep("details")} className="px-5 py-2 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[12px] text-[#2C1924] hover:bg-[#FAF8FA] transition-all cursor-pointer">View Pool</button>
                            <button onClick={handlePoolCancel} className="px-5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-[12px] hover:bg-rose-100/80 transition-all cursor-pointer">Close</button>
                          </div>
                          {txDigest && <a href={txExplorerUrl(txDigest)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-[#DF7AA7] hover:underline">View on Mezo Explorer <ExternalLink className="h-3 w-3" /></a>}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* User Message Bubble */}
              {(submittedUserPrompt || (intentPrompt.trim() !== "" && isProcessing)) && (
                <div className="flex justify-end items-end gap-2.5">
                  <div className="p-3.5 sm:p-4 rounded-[22px] rounded-tr-[6px] bg-[#DC759E] text-white shadow-[0_3px_14px_rgba(220,117,158,0.28)] max-w-[85%]">
                    <div className="flex items-center justify-end gap-1.5 font-meta text-[10px] font-bold tracking-[0.1em] text-white/90 mb-1">
                      <span>YOU</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                    <div className="text-[14.5px] font-medium text-white break-words leading-relaxed">
                      {submittedUserPrompt || intentPrompt}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/10 flex items-center justify-center shrink-0 shadow-2xs text-[#DC759E]">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Token suggestion */}
              {!hasResult && !isProcessing && (tokenSuggestion || alternativeSource) && (
                <div className="flex flex-col gap-3 w-full">
                  {tokenSuggestion && (
                    <div className="p-4 rounded-2xl border border-[#2C1924]/[0.08] bg-white shadow-2xs">
                      <div className="flex items-center gap-2 mb-2 font-meta">
                        <Info className="w-4 h-4 text-[#DF7AA7]" />
                        <span className="text-[12px] font-bold text-[#2C1924]">Pick the exact token</span>
                      </div>
                      <p className="font-meta text-[12px] text-[#845D74] mb-3">{tokenSuggestion.message}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tokenSuggestion.candidates?.map((c: any, i: number) => (
                          <button key={i} onClick={() => { if (c.retryPrompt) { setIntentPrompt(c.retryPrompt); handleProcessIntent(c.retryPrompt); } }} className="p-3 rounded-2xl bg-[#FAF8FA] hover:bg-white border border-[#2C1924]/[0.08] hover:border-[#DF7AA7] text-left transition-all cursor-pointer shadow-2xs">
                            <span className="block font-bold text-[#2C1924] font-display text-[13px]">{c.symbol} ({c.name})</span>
                            <span className="text-[11px] text-[#845D74]/70 break-all font-mono">{c.coinType.slice(0, 34)}…</span>
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
                    <div className="flex items-center gap-2 flex-wrap rounded-2xl border border-[#2C1924]/[0.08] bg-[#FAF8FA] px-4 py-2.5 shadow-2xs">
                      <span className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Route</span>
                      <span className="font-mono text-[12px] font-bold text-[#2C1924]">{tradeAmount} {sourceSymbol}</span>
                      <span className="text-[#845D74]/40">→</span>
                      {routeNodes.slice(0, 3).map((n, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="rounded-lg bg-white border border-[#2C1924]/[0.08] px-2 py-0.5 font-mono text-[10px] font-bold text-[#DF7AA7]">{n.dex}</span>
                          {i < Math.min(routeNodes.length, 3) - 1 && <span className="text-[#845D74]/40">→</span>}
                        </span>
                      ))}
                      <span className="text-[#845D74]/40">→</span>
                      <span className="font-mono text-[12px] font-bold text-[#10b981]">{expectedOutput} {destSymbol}</span>
                    </div>
                  )}
                  {guardianChecks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      {guardianChecks.slice(0, 4).map((c, i) => (
                        <span key={i} className={`rounded-xl border px-2.5 py-1 text-[10px] font-bold shadow-2xs ${c.status === "DANGER" ? "border-rose-200 bg-rose-50 text-rose-700" : c.status === "WARNING" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                          {c.name}: {c.status}
                        </span>
                      ))}
                    </div>
                  )}
                  {errorMessage && <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 font-meta text-[12px] font-bold text-rose-700 shadow-2xs"><AlertCircle className="h-4 w-4 shrink-0" /> {errorMessage}</div>}
                  {txDigest && (
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 font-meta text-[12px] shadow-2xs">
                      <span className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4 text-[#10b981]" /> Swap confirmed!</span>
                      <a href={txExplorerUrl(txDigest)} target="_blank" rel="noreferrer" className="rounded-xl bg-[#DF7AA7] hover:bg-[#DF7AA7]/90 px-3 py-1 text-[11px] font-bold text-white inline-flex items-center gap-1 shadow-2xs transition-all">Mezo Explorer <ExternalLink className="h-3 w-3" /></a>
                    </div>
                  )}
                  {hasRiskWarnings && (
                    <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 cursor-pointer select-none hover:bg-rose-50 transition-all shadow-2xs" onClick={() => setHasConfirmedSettings(!hasConfirmedSettings)}>
                      <button role="checkbox" aria-checked={hasConfirmedSettings} onClick={(e) => { e.stopPropagation(); setHasConfirmedSettings(!hasConfirmedSettings); }} className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${hasConfirmedSettings ? "bg-[#10b981] border-[#10b981]" : "bg-white border-rose-300"}`}>
                        <Check className="w-3 h-3 text-white" />
                      </button>
                      <span className="font-meta text-[12px] font-bold text-rose-700">I acknowledge the on-chain risk warnings.</span>
                    </div>
                  )}
                  <div className="flex items-stretch gap-2 font-meta">
                    <button onClick={handleExecuteSwap} disabled={isExecuting || (!guardianSafe && !hasConfirmedSettings)} className={`flex-1 py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer ${!guardianSafe && !hasConfirmedSettings ? "bg-white/50 text-[#845D74]/50 border border-[#2C1924]/10 cursor-not-allowed" : "bg-gradient-to-r from-[#DF7AA7] to-[#EE97C2] text-white shadow-[0_4px_16px_rgba(223,122,167,0.3)] hover:opacity-95 active:scale-[0.99]"}`}>
                      {isExecuting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Signing...</> : !address ? <><Wallet className="w-4 h-4" /> Connect Wallet</> : !guardianSafe && !hasConfirmedSettings ? <span>Acknowledge Risk</span> : <><span>Execute ({tradeAmount} {sourceSymbol} → {destSymbol})</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                    <button onClick={() => setShowDetails(v => !v)} className="px-4 py-3 rounded-2xl border border-[#2C1924]/10 bg-white font-bold text-[12px] text-[#2C1924] hover:bg-[#FAF8FA] transition-colors cursor-pointer shadow-2xs">{showDetails ? "Hide" : "Details"}</button>
                    <button onClick={handleCancelSwap} className="px-4 py-3 rounded-2xl border border-rose-200 bg-rose-50 font-bold text-[12px] text-rose-700 hover:bg-rose-100/80 transition-colors cursor-pointer shadow-2xs">Cancel</button>
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
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#2C1924]/10 flex items-center justify-center shadow-2xs shrink-0">
                    <img src="/icon-chatbox.png" alt="Soka" className="w-7 h-7 object-contain" />
                  </div>
                  <div className="p-4 rounded-2xl border border-[#2C1924]/[0.08] bg-white shadow-2xs max-w-[85%]">
                    <div className="font-meta text-[10px] font-bold tracking-[0.1em] text-[#DF7AA7] mb-1">SOKA ★</div>
                    <div className="text-[14px] font-medium text-[#2C1924] leading-relaxed">{cancelMsg}</div>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-end gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#2C1924]/10 flex items-center justify-center shadow-2xs shrink-0">
                    <img src="/icon-chatbox.png" alt="Soka" className="w-7 h-7 object-contain" />
                  </div>
                  <div className="p-4 rounded-2xl border border-[#2C1924]/[0.08] bg-white shadow-2xs">
                    <div className="flex items-center gap-2 font-mono text-[13px] font-bold text-[#845D74]">
                      <span className="w-2 h-2 rounded-full bg-[#DF7AA7] animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-[#EE97C2] animate-pulse" style={{ animationDelay: "0.15s" }} />
                      <span className="w-2 h-2 rounded-full bg-[#F7D1D7] animate-pulse" style={{ animationDelay: "0.3s" }} />
                      sniffing pools…
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="px-5 pb-4 pt-3.5 shrink-0 border-t border-[#2C1924]/[0.07] bg-white rounded-b-[26px] sm:rounded-b-[30px]">
            <form onSubmit={(e) => { e.preventDefault(); handleProcessIntent(); }} className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={intentPrompt} 
                  onChange={(e) => setIntentPrompt(e.target.value)} 
                  placeholder={"Try \"Swap 0.05 BTC to MUSD, safest route\"\u2026"} 
                  className="w-full px-4.5 py-3 sm:py-3.5 pr-10 rounded-xl bg-[#F8F7F8] border border-[#2C1924]/[0.08] focus:border-[#DF7AA7] focus:bg-white text-[#2C1924] font-medium text-[14.5px] outline-none placeholder:text-[#845D74]/60 shadow-2xs transition-all" 
                />
                <span className="absolute right-3.5 bottom-1/2 translate-y-1/2 text-[11px] font-mono text-[#845D74]/60 pointer-events-none hidden sm:block">↵</span>
              </div>
              <button 
                type="submit" 
                disabled={isProcessing} 
                onClick={(e) => {
                  if (!intentPrompt.trim() && !isProcessing) {
                    e.preventDefault();
                    const demoPrompt = "Swap 0.05 BTC to MUSD, safest route";
                    setIntentPrompt(demoPrompt);
                    handleProcessIntent(demoPrompt);
                  }
                }}
                className={`relative group w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200 cursor-pointer select-none bg-[#DF7AA7] hover:bg-[#D46A98] text-white shadow-[0_2px_10px_rgba(223,122,167,0.25)] hover:scale-105 active:scale-95 border-0`}
                title={intentPrompt.trim() ? "Send Intent (Enter)" : "Click to test 'Swap 0.05 BTC to MUSD'"}
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <ArrowUp 
                    className="w-4.5 h-4.5 stroke-[2.5] transition-transform duration-200 group-hover:-translate-y-0.5 text-white" 
                  />
                )}
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {quickPrompts.map((q) => (
                <button 
                  key={q} 
                  type="button" 
                  disabled={isProcessing} 
                  onClick={() => { setIntentPrompt(q); handleProcessIntent(q); }} 
                  className="text-[11px] font-semibold font-meta text-[#2C1924]/75 hover:text-[#DF7AA7] bg-[#FAF8FA] hover:bg-white border border-[#2C1924]/[0.08] hover:border-[#DF7AA7]/40 rounded-full px-3 py-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {historyOpen && <HistoryPanel history={history} expandedId={expandedHistory} onToggle={(id) => setExpandedHistory(expandedHistory === id ? null : id)} onRerun={(snap) => { setIntentPrompt(snap.prompt); setHistoryOpen(false); handleProcessIntent(snap.prompt); }} onDelete={deleteHistoryEntry} onClear={clearHistory} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
};
