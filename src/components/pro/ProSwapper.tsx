import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Wallet, Sparkles, ExternalLink, Info, History as HistoryIcon, Check, ArrowRightLeft, Landmark, Vault, Waves, Download, Upload, Send, ArrowDownToLine, ArrowUp, User } from 'lucide-react';
import { ProHeader } from './ProHeader';
import { ProRouteVisualizer } from './ProRouteVisualizer';
import { ProGuardianRadar } from './ProGuardianRadar';
import { HistoryPanel } from './HistoryPanel';
import { GenerativeInkCanvas } from './GenerativeInkCanvas';
import type { RiskCheck, RouteNode, PtbStep, SwapSnapshot } from '../../types/shared';
import { makeHistoryId } from '../../utils/explorer';

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

function buildDemoHistory(): SwapSnapshot[] {
  const now = Date.now();
  const checks = (impact: "SAFE" | "WARNING" | "DANGER"): RiskCheck[] => [
    { name: "Price Impact", status: impact, message: "Effective impact vs slippage curve" },
    { name: "Liquidity Risk", status: impact === "DANGER" ? "DANGER" : impact === "WARNING" ? "WARNING" : "SAFE", message: "Trade size vs pool depth" },
    { name: "DEX Verification", status: impact === "DANGER" ? "WARNING" : "SAFE", message: "Creator matches audited protocol" },
    { name: "Liquidity Health", status: impact === "WARNING" ? "WARNING" : impact === "DANGER" ? "DANGER" : "SAFE", message: "Pool age verified on-chain" },
  ];
  const ptb = (n: number, dex = "mezo_pools", fromBtc = true): PtbStep[] => {
    const steps: PtbStep[] = [];
    steps.push(fromBtc ? { index: 1, command: "GasReserve", description: "Reserve native BTC gas + approve swap input" } : { index: 1, command: "TokenApprove", description: "Approve token spending for Mezo Pools" });
    let i = 2;
    for (let h = 0; h < n; h++) steps.push({ index: i++, command: "ContractCall", target: `MezoPools::swapExactInputSingle`, description: `MezoPools concentrated AMM tick route` });
    steps.push({ index: i, command: "TransferAssets", description: "Settle output to your Mezo wallet" });
    return steps;
  };
  const route = (arr: Array<[string, number, number]>): RouteNode[] =>
    arr.map(([dex, ratio, fee], i) => ({ dex, ratio, fee, weight: ratio, liquidityUsd: 1250000 + i * 290000, poolAddress: "0x" + (i + 1).toString(16).padStart(4, "0") + "eabed72c53f027380872d35c6301cc6a7dc9dfe5e9f1fdc4c3f1a2b3c4d5e" + (i + 7).toString(16) }));
  return [
    { id: makeHistoryId(), prompt: "Swap 0.05 BTC to MUSD", status: "CONFIRMED", createdAt: now - 33 * 864e5, amount: "0.05", sourceSymbol: "BTC", destSymbol: "MUSD", expectedOutput: "4625.50", executionImpact: "0.04%", slippage: "0.08%", gasEstimate: "0.00012 BTC", guardianScore: 96, guardianRiskLevel: "LOW", guardianSafe: true, txDigest: "0x8f3a", routeNodes: route([["MEZO POOLS", 100, 0.003]]), checks: checks("SAFE"), ptbSteps: ptb(2, "mezo_pools") },
    { id: makeHistoryId(), prompt: "Swap 500 MUSD for MEZO", status: "SIMULATED", createdAt: now - 2 * 36e5, amount: "500", sourceSymbol: "MUSD", destSymbol: "MEZO", expectedOutput: "1284.52", executionImpact: "0.8%", slippage: "1.2%", gasEstimate: "0.00015 BTC", guardianScore: 82, guardianRiskLevel: "LOW", guardianSafe: true, routeNodes: route([["MEZO POOLS", 70, 0.003], ["MEZO POOLS (HOP)", 30, 0.005]]), checks: checks("SAFE"), ptbSteps: ptb(2, "mezo_pools") },
    { id: makeHistoryId(), prompt: "Swap 1.5 BTC to MEZO", status: "SIMULATED", createdAt: now - 90 * 60e3, amount: "1.5", sourceSymbol: "BTC", destSymbol: "MEZO", expectedOutput: "389200", executionImpact: "4.8%", slippage: "8.5%", gasEstimate: "0.00025 BTC", guardianScore: 28, guardianRiskLevel: "CRITICAL", guardianSafe: false, routeNodes: route([["MEZO POOLS", 60, 0.003], ["MEZO POOLS (SECONDARY)", 40, 0.01]]), checks: checks("DANGER"), ptbSteps: ptb(3, "mezo_pools") },
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
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const { openConnectModal } = useConnectModal();
  const walletAddress = isConnected && address ? address : null;
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
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

  // Mock vault data
  const vaultBalance = { totalDeposited: 12450.80, avgApr: 8.25, deposits: 3 };
  const vaults = [
    { id: "btc", name: "BTC Yield Vault", featured: true, address: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12", depositToken: "BTC", receiptToken: "xBTC", operator: "Mezo Staking", withdrawalFee: "0.1%", withdrawalTimelock: "24h", yieldAsset: "BTC", apr: 5.2, tvl: 12500000 },
    { id: "musd", name: "MUSD Savings Vault", featured: false, address: "0x9876543210fedcba0987654321fedcba09876543", depositToken: "MUSD", receiptToken: "sMUSD", operator: "Mezo Stability Pool", withdrawalFee: "0.0%", withdrawalTimelock: "0h", yieldAsset: "MUSD", apr: 8.5, tvl: 8500000 },
    { id: "mezo", name: "MEZO Governance Vault", featured: false, address: "0xmezo1234567890abcdefmezo1234567890abcdef", depositToken: "MEZO", receiptToken: "vMEZO", operator: "Mezo DAO", withdrawalFee: "0.2%", withdrawalTimelock: "12h", yieldAsset: "MEZO", apr: 15.3, tvl: 3200000 },
    { id: "tbtc", name: "tBTC Bridge Vault", featured: false, address: "0x1234567890abcdef1234567890abcdef12345678", depositToken: "tBTC", receiptToken: "stBTC", operator: "Threshold Network", withdrawalFee: "0.0%", withdrawalTimelock: "0h", yieldAsset: "tBTC", apr: 6.1, tvl: 5200000 },
    { id: "usdc", name: "USDC Lending Vault", featured: false, address: "0xabcdef1234567890abcdef1234567890abcdef12", depositToken: "USDC", receiptToken: "lUSDC", operator: "Lending Pool", withdrawalFee: "0.0%", withdrawalTimelock: "0h", yieldAsset: "USDC", apr: 7.5, tvl: 2100000 },
  ];

  // Pool state - chat flow
  const [poolStep, setPoolStep] = useState<"idle" | "list" | "details" | "addLiquidity" | "addIncentive" | "removeLiquidity" | "success">("idle");
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [incentiveAmount, setIncentiveAmount] = useState("");
  const [removeAmount, setRemoveAmount] = useState("");

  // Mock pool data
  const pools = [
    { id: "musdc-musd", name: "mUSDC/MUSD", feeTier: 10, type: "Concentrated Stable", tvl: 279800, volume: 139.90, apr: 2.68, tvlFormatted: "$279.80K", volumeFormatted: "$139.90", aprFormatted: "2.68%", feeFormatted: "0.13%", token0: "mUSDC", token1: "MUSD" },
    { id: "btc-musd", name: "BTC/MUSD", feeTier: 200, type: "Concentrated Volatile", tvl: 210560, volume: 631.68, apr: 96.18, tvlFormatted: "$210.56K", volumeFormatted: "$631.68", aprFormatted: "96.18%", feeFormatted: "30.35%", token0: "BTC", token1: "MUSD" },
    { id: "musdc-btc", name: "mUSDC/BTC", feeTier: 200, type: "Concentrated Volatile", tvl: 55140, volume: 165.42, apr: 81.83, tvlFormatted: "$55.14K", volumeFormatted: "$165.42", aprFormatted: "81.83%", feeFormatted: "17.03%", token0: "mUSDC", token1: "BTC" },
    { id: "mezo-musd", name: "MEZO/MUSD", feeTier: 200, type: "Concentrated Volatile", tvl: 11900, volume: 35.71, apr: 709.65, tvlFormatted: "$11.90K", volumeFormatted: "$35.71", aprFormatted: "709.65%", feeFormatted: "33.27%", token0: "MEZO", token1: "MUSD" },
    { id: "btc-musd-basic", name: "BTC/MUSD", feeTier: 0, type: "Basic Volatile", tvl: 11820, volume: 35.46, apr: 31.67, tvlFormatted: "$11.82K", volumeFormatted: "$35.46", aprFormatted: "31.67%", feeFormatted: "0.44%", token0: "BTC", token1: "MUSD" },
  ];

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
    setVaultStep("idle");
    setSelectedVault(null);
    setDepositAmount("");
    setVaultAcknowledged(false);
    setPoolStep("idle");
    setSelectedPool(null);
    setLiquidityAmount("");
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
  const handleBorrowAmountSubmit = () => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !borrowToken) return;
    setBorrowStep("review");
    const collateralValueUsd = parseFloat(collateralAmount) * 92000;
    const borrowAmount = collateralValueUsd * 0.75;
    const interestRate = borrowToken === "MUSD" ? 4.5 : 3.8;
    const liquidationPrice = borrowAmount / (parseFloat(collateralAmount) * 0.85);
    setSokaMessage(`📋 Borrow Summary:\n\n• Borrow: ${borrowAmount.toFixed(2)} ${borrowToken}\n• Collateral: ${collateralAmount} BTC ($${collateralValueUsd.toFixed(2)})\n• LTV: 75.00%\n• Interest Rate: ${interestRate}% APR\n• Liquidation LTV: 85%\n• Liquidation Price: $${liquidationPrice.toFixed(2)}\n\n⚠️ If BTC drops to $${liquidationPrice.toFixed(2)}, your collateral will be liquidated. Please acknowledge the risks to proceed.`);
  };
  const handleBorrowConfirm = () => {
    setBorrowStep("success");
    setSokaMessage(`✅ Borrow Successful!\n\nYou borrowed ${borrowAmount.toFixed(2)} ${borrowToken} with ${collateralAmount} BTC as collateral.\n\nYour position is now active. You can repay at any time.`);
  };
  const handleBorrowCancel = () => {
    setBorrowStep("idle");
    setCollateralAmount("");
    setBorrowToken(null);
    setBorrowAcknowledged(false);
    setSokaMessage("Borrow cancelled. Is there anything else I can help you with?");
  };
  // Calculated borrow values
  const collateralValueUsd = parseFloat(collateralAmount || "0") * 0.68;
  const maxLtv = 0.75;
  const borrowAmount = collateralValueUsd * maxLtv;
  const interestRate = borrowToken === "MUSD" ? 4.5 : borrowToken === "MUSDC" ? 3.8 : 0;
  const liquidationLtv = 0.85;
  const liquidationPrice = collateralAmount && parseFloat(collateralAmount) > 0 ? borrowAmount / (parseFloat(collateralAmount) * liquidationLtv) : 0;
  // Vault handlers - chat flow
  const handleOpenVault = () => {
    setVaultStep("list");
    setSokaMessage("Here's your vault overview and available vaults. Select a vault to view details or deposit.");
  };
  const handleSelectVault = (vaultId: string) => {
    setSelectedVault(vaultId);
    setVaultStep("details");
    const vault = vaults.find(v => v.id === vaultId);
    if (vault) {
      setSokaMessage(`📋 ${vault.name} Details:\n\n• Vault Address: ${vault.address.slice(0, 10)}...${vault.address.slice(-8)}\n• Deposit Token: ${vault.depositToken}\n• Receipt Token: ${vault.receiptToken}\n• Operator: ${vault.operator}\n• Withdrawal Fee: ${vault.withdrawalFee}\n• Withdrawal Time-lock: ${vault.withdrawalTimelock}\n• Yield Asset: ${vault.yieldAsset}\n• APR: ${vault.apr}%\n• TVL: $${(vault.tvl / 1000000).toFixed(1)}M\n\nClick Deposit to proceed.`);
    }
  };
  const handleDepositVault = () => {
    setVaultStep("deposit");
    const vault = vaults.find(v => v.id === selectedVault);
    setSokaMessage(`How much ${vault?.depositToken || "token"} would you like to deposit into ${vault?.name || "vault"}?`);
  };
  const handleDepositAmountSubmit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setVaultStep("confirm");
    const vault = vaults.find(v => v.id === selectedVault);
    const receiptAmount = parseFloat(depositAmount) * 0.98; // Mock conversion
    setSokaMessage(`📋 Deposit Summary:\n\n• Vault: ${vault?.name}\n• Deposit: ${depositAmount} ${vault?.depositToken}\n• You'll receive: ${receiptAmount.toFixed(2)} ${vault?.receiptToken}\n• APR: ${vault?.apr}%\n• Yield Asset: ${vault?.yieldAsset}\n\nPlease acknowledge to confirm deposit.`);
  };
  const handleVaultConfirm = () => {
    setVaultStep("success");
    const vault = vaults.find(v => v.id === selectedVault);
    setSokaMessage(`✅ Deposit Successful!\n\nYou deposited ${depositAmount} ${vault?.depositToken} into ${vault?.name}.\n\nYour deposit is now earning ${vault?.apr}% APR.`);
  };
  const handleVaultCancel = () => {
    setVaultStep("idle");
    setSelectedVault(null);
    setDepositAmount("");
    setVaultAcknowledged(false);
    setSokaMessage("Vault action cancelled. Is there anything else I can help you with?");
  };
  // Pool handlers - chat flow
  const handleOpenPool = () => {
    setPoolStep("list");
    setSokaMessage("Here are the available pools. Select a pool to view details, add liquidity, add incentives, or remove liquidity.");
  };
  const handleSelectPool = (poolId: string) => {
    setSelectedPool(poolId);
    setPoolStep("details");
    const pool = pools.find(p => p.id === poolId);
    if (pool) {
      setSokaMessage(`📋 ${pool.name} Pool:\n\n• Type: ${pool.type}\n• Fee Tier: ${pool.feeFormatted}\n• TVL: ${pool.tvlFormatted}\n• Volume: ${pool.volumeFormatted}\n• APR: ${pool.aprFormatted}\n\nChoose an action: Add Liquidity, Add Incentive, or Remove Liquidity.`);
    }
  };
  const handleAddLiquidity = () => {
    setPoolStep("addLiquidity");
    const pool = pools.find(p => p.id === selectedPool);
    setSokaMessage(`How much liquidity would you like to add to ${pool?.name}?`);
  };
  const handleAddIncentive = () => {
    setPoolStep("addIncentive");
    const pool = pools.find(p => p.id === selectedPool);
    setSokaMessage(`How much incentive token would you like to add to ${pool?.name}?`);
  };
  const handleRemoveLiquidity = () => {
    setPoolStep("removeLiquidity");
    const pool = pools.find(p => p.id === selectedPool);
    setSokaMessage(`How much liquidity would you like to remove from ${pool?.name}?`);
  };
  const handleLiquiditySubmit = () => {
    if (!liquidityAmount || parseFloat(liquidityAmount) <= 0) return;
    setPoolStep("success");
    const pool = pools.find(p => p.id === selectedPool);
    setSokaMessage(`✅ Liquidity Added!\n\nYou added $${liquidityAmount} to ${pool?.name} pool.\n\nYou're now earning ${pool?.aprFormatted} APR on your liquidity.`);
  };
  const handleIncentiveSubmit = () => {
    if (!incentiveAmount || parseFloat(incentiveAmount) <= 0) return;
    setPoolStep("success");
    const pool = pools.find(p => p.id === selectedPool);
    setSokaMessage(`✅ Incentive Added!\n\nYou added ${incentiveAmount} incentive tokens to ${pool?.name} pool.\n\nEarned: ${pool?.aprFormatted} APR.`);
  };
  const handleRemoveSubmit = () => {
    if (!removeAmount || parseFloat(removeAmount) <= 0) return;
    setPoolStep("success");
    const pool = pools.find(p => p.id === selectedPool);
    setSokaMessage(`✅ Liquidity Removed!\n\nYou removed ${removeAmount} from ${pool?.name} pool.`);
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
      setSokaMessage("I found the best vault options for you on Mezo. Here's your vault overview:");

      // Auto-select vault if token mentioned
      let vaultId = null;
      if (btcMatch) vaultId = "btc";
      else if (musdMatch) vaultId = "musd";
      else if (mezoMatch) vaultId = "mezo";
      else if (tbtcMatch) vaultId = "tbtc";
      else if (usdcMatch) vaultId = "usdc";

      if (vaultId) {
        const vault = vaults.find(v => v.id === vaultId);
        setTimeout(() => {
          setSelectedVault(vaultId);
          setVaultStep("deposit");
          setDepositAmount(extractedAmount || "");
          setSokaMessage(`📋 ${vault?.name} Details:\n\n• Deposit Token: ${vault?.depositToken}\n• APR: ${vault?.apr}%\n• TVL: $${((vault?.tvl || 0) / 1000000).toFixed(2)}M\n\n${extractedAmount ? `You want to deposit ${extractedAmount} ${vault?.depositToken}. Click to confirm.` : `How much ${vault?.depositToken} would you like to deposit?`}`);
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

      // Auto-select pool if mentioned
      let poolId = null;
      if (lowerPrompt.includes("btc") || lowerPrompt.includes("bitcoin")) poolId = "btc-musd";
      else if (lowerPrompt.includes("musdc") || lowerPrompt.includes("mush") || lowerPrompt.includes("stable")) poolId = "musdc-musd";
      else if (lowerPrompt.includes("mezo")) poolId = "mezo-musd";

      if (poolId) {
        const pool = pools.find(p => p.id === poolId);
        setTimeout(() => {
          setSelectedPool(poolId);
          if (isRemove) {
            setPoolStep("removeLiquidity");
            setRemoveAmount(extractedAmount || "");
            setSokaMessage(`📋 ${pool?.name} Pool:\n\n• APR: ${pool?.aprFormatted}\n• TVL: ${pool?.tvlFormatted}\n\n${extractedAmount ? `You want to remove ${extractedAmount}. Click to confirm.` : "How much liquidity would you like to remove?"}`);
          } else if (isIncentive) {
            setPoolStep("addIncentive");
            setIncentiveAmount(extractedAmount || "");
            setSokaMessage(`📋 ${pool?.name} Pool:\n\n• APR: ${pool?.aprFormatted}\n• TVL: ${pool?.tvlFormatted}\n\n${extractedAmount ? `You want to add ${extractedAmount} incentive. Click to confirm.` : "How much incentive would you like to add?"}`);
          } else {
            setPoolStep("addLiquidity");
            setLiquidityAmount(extractedAmount || "");
            setSokaMessage(`📋 ${pool?.name} Pool:\n\n• APR: ${pool?.aprFormatted}\n• TVL: ${pool?.tvlFormatted}\n\n${extractedAmount ? `You want to add ${extractedAmount}. Click to confirm.` : "How much liquidity would you like to add?"}`);
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
    setIsProcessing(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setCancelMsg(null); setSokaMessage(null); setBorrowStep("idle"); setBorrowToken(null); setCollateralAmount(""); setBorrowAcknowledged(false); setVaultStep("idle"); setSelectedVault(null); setDepositAmount(""); setVaultAcknowledged(false); setPoolStep("idle"); setSelectedPool(null); setLiquidityAmount("");
    try {
      const res = await fetch("/api/process-intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, senderAddress: walletAddress || "0x0000000000000000000000000000000000000000000000000000000000000000" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process intent");
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
      else setIsWalletModalOpen(true);
      return;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build transaction");

      let target = (data.to || data.target) as `0x${string}`;
      let txData = (data.data || "0x") as `0x${string}`;
      let txVal = BigInt(data.value || "0");
      let gasLim = data.gasLimit ? BigInt(data.gasLimit) : undefined;

      if (data.transactionData) {
        try {
          const parsed = JSON.parse(data.transactionData);
          if (parsed.to) target = parsed.to;
          if (parsed.data) txData = parsed.data;
          if (parsed.value) txVal = BigInt(parsed.value);
          if (parsed.gasLimit) gasLim = BigInt(parsed.gasLimit);
        } catch {
          // fallback
        }
      }

      const hash = await sendTransactionAsync({
        to: target,
        data: txData,
        value: txVal,
        gas: gasLim,
      });

      if (!hash) throw new Error("No transaction hash returned from wallet.");
      setTxDigest(hash);

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

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

  const quickPrompts = ["Swap 0.05 BTC to MUSD", "Borrow MUSD with BTC", "Mezo Pools TVL", "Gasless Meta-Tx"];
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

      <ProHeader onOpenWalletModal={() => setIsWalletModalOpen(true)} />

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
                            <span className="font-mono text-[11px] text-[#845D74]">≈ ${collateralValueUsd.toFixed(2)}</span>
                            <div className="flex gap-1 font-mono">
                              {[25, 50, 75, 100].map(pct => (
                                <button key={pct} onClick={() => setCollateralAmount((1000 * pct / 100).toString())} className="px-2.5 py-1 rounded-lg bg-white border border-[#2C1924]/10 text-[10px] font-bold text-[#845D74] hover:border-[#DF7AA7] hover:text-[#DF7AA7] transition-all cursor-pointer">{pct}%</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {collateralAmount && parseFloat(collateralAmount) > 0 && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
                            <div className="font-mono text-[12px] text-emerald-800">Borrow up to <span className="font-bold">{borrowAmount.toFixed(2)} {borrowToken}</span></div>
                          </div>
                        )}
                        <button onClick={handleBorrowAmountSubmit} disabled={!collateralAmount || parseFloat(collateralAmount) <= 0} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-[#DF7AA7] hover:bg-[#D46A98] shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">Review</button>
                        <button onClick={() => setBorrowStep("select_token")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-[#DF7AA7] hover:underline cursor-pointer">← Change token</button>
                      </>
                    )}

                    {/* Step 3: Review */}
                    {borrowStep === "review" && (
                      <>
                        <div className="space-y-2.5 mb-4">
                          <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                            <span className="font-meta text-[12px] font-semibold text-[#845D74]">Borrow</span>
                            <span className="font-display text-[15px] font-bold text-[#DF7AA7]">{borrowAmount.toFixed(2)} {borrowToken}</span>
                          </div>
                          <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                            <span className="font-meta text-[12px] font-semibold text-[#845D74]">Collateral</span>
                            <span className="font-display text-[15px] font-bold text-[#2C1924]">{collateralAmount} BTC</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                            <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">LTV</div>
                              <div className="font-display text-[14px] font-bold text-emerald-600">75%</div>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Rate</div>
                              <div className="font-display text-[14px] font-bold text-[#2C1924]">{interestRate}%</div>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Liq. Price</div>
                              <div className="font-display text-[14px] font-bold text-[#ef4444]">${liquidationPrice.toFixed(4)}</div>
                            </div>
                          </div>
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
                        {/* Balance Summary */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-3 font-meta">
                          <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] shadow-2xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Total Deposited</div>
                            <div className="font-display text-[14px] font-bold text-[#DF7AA7] mt-0.5">${vaultBalance.totalDeposited.toLocaleString()}</div>
                          </div>
                          <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] shadow-2xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Avg APR</div>
                            <div className="font-display text-[14px] font-bold text-emerald-600 mt-0.5">{vaultBalance.avgApr}%</div>
                          </div>
                          <div className="text-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] shadow-2xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#845D74]">Deposits</div>
                            <div className="font-display text-[14px] font-bold text-[#2C1924] mt-0.5">{vaultBalance.deposits}</div>
                          </div>
                        </div>
                        {/* Vault List */}
                        <div className="font-meta text-[10px] font-bold uppercase tracking-wider text-[#845D74] mb-2">Available Vaults</div>
                        <div className="space-y-2">
                          {vaults.map(vault => (
                            <button key={vault.id} onClick={() => handleSelectVault(vault.id)} className={`w-full p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer shadow-2xs ${vault.featured ? "border-amber-300/80 bg-amber-50/70 hover:bg-amber-100/80" : "border-[#2C1924]/[0.08] bg-[#FAF8FA] hover:bg-white hover:border-[#DF7AA7]/60"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {vault.featured && <span className="px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-mono text-[8px] font-bold">FEATURED</span>}
                                  <span className="font-display text-[13.5px] font-bold text-[#2C1924]">{vault.name}</span>
                                </div>
                                <span className="font-display text-[13.5px] font-bold text-emerald-600">{vault.apr}%</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 font-mono">
                                <span className="text-[10px] text-[#845D74]">TVL: ${(vault.tvl / 1000000).toFixed(1)}M</span>
                                <span className="text-[10px] text-[#845D74]">Fee: {vault.withdrawalFee}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Vault Details */}
                    {vaultStep === "details" && selectedVault && (() => {
                      const vault = vaults.find(v => v.id === selectedVault);
                      return vault ? (
                        <>
                          <div className="space-y-2 mb-3.5 font-meta">
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Vault Address</span>
                              <span className="font-mono text-[11px] font-bold text-[#2C1924]">{vault.address.slice(0, 8)}...{vault.address.slice(-6)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Deposit Token</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{vault.depositToken}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Receipt Token</span>
                              <span className="font-display text-[12.5px] font-bold text-[#DF7AA7]">{vault.receiptToken}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Operator</span>
                              <span className="text-[11.5px] font-bold text-[#2C1924]">{vault.operator}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Withdrawal Fee</span>
                              <span className="text-[11.5px] font-bold text-[#2C1924]">{vault.withdrawalFee}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Yield Asset</span>
                              <span className="text-[11.5px] font-bold text-[#2C1924]">{vault.yieldAsset}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[11px] font-bold text-emerald-800">APR</span>
                              <span className="font-display text-[15px] font-bold text-emerald-600">{vault.apr}%</span>
                            </div>
                          </div>
                          <div className="flex gap-2.5 font-meta">
                            <button onClick={() => setVaultStep("list")} className="flex-1 py-2.5 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[13px] text-[#845D74] hover:bg-[#FAF8FA] transition-all cursor-pointer">← Back</button>
                            <button onClick={handleDepositVault} className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all cursor-pointer">Deposit</button>
                          </div>
                        </>
                      ) : null;
                    })()}

                    {/* Deposit Amount */}
                    {vaultStep === "deposit" && (() => {
                      const vault = vaults.find(v => v.id === selectedVault);
                      return vault ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Amount ({vault.depositToken})</label>
                            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-emerald-500 focus:bg-white transition-all" />
                          </div>
                          {depositAmount && parseFloat(depositAmount) > 0 && (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 mb-3.5">
                              <div className="font-meta text-[11.5px] text-emerald-900">You'll receive ~ <span className="font-bold text-emerald-700">{(parseFloat(depositAmount) * 0.98).toFixed(2)} {vault.receiptToken}</span></div>
                            </div>
                          )}
                          <button onClick={handleDepositAmountSubmit} disabled={!depositAmount || parseFloat(depositAmount) <= 0} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">Review Deposit</button>
                          <button onClick={() => setVaultStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-emerald-700 hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Confirm Deposit */}
                    {vaultStep === "confirm" && (() => {
                      const vault = vaults.find(v => v.id === selectedVault);
                      return vault ? (
                        <>
                          <div className="space-y-2.5 mb-3.5 font-meta">
                            <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[12px] font-semibold text-[#845D74]">Deposit</span>
                              <span className="font-display text-[14px] font-bold text-[#2C1924]">{depositAmount} {vault.depositToken}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[12px] font-semibold text-[#845D74]">Receive</span>
                              <span className="font-display text-[14px] font-bold text-emerald-700">{(parseFloat(depositAmount || "0") * 0.98).toFixed(2)} {vault.receiptToken}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[12px] font-bold text-emerald-800">APR</span>
                              <span className="font-display text-[14px] font-bold text-emerald-600">{vault.apr}%</span>
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
                      const vault = vaults.find(v => v.id === selectedVault);
                      return vault ? (
                        <div className="text-center py-4">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                          </div>
                          <div className="font-display text-[18px] font-bold text-[#2C1924] mb-1">Deposit Successful!</div>
                          <div className="font-meta text-[13px] text-[#845D74] mb-3">Your deposit is now earning yield on Mezo</div>
                          <div className="p-3.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] inline-block mb-4 shadow-2xs">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Deposited</div>
                                <div className="font-display text-[15px] font-bold text-emerald-700">{depositAmount} {vault.depositToken}</div>
                              </div>
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">APR</div>
                                <div className="font-display text-[15px] font-bold text-emerald-600">{vault.apr}%</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-center font-meta">
                            <button onClick={handleVaultCancel} className="px-5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-[12px] hover:bg-rose-100/80 transition-all cursor-pointer">Withdraw</button>
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
                        <div className="space-y-2">
                          {pools.map(pool => (
                            <button key={pool.id} onClick={() => handleSelectPool(pool.id)} className="w-full p-3 rounded-xl border border-[#2C1924]/[0.08] bg-[#FAF8FA] hover:bg-white hover:border-[#DF7AA7]/60 text-left transition-all duration-200 hover:shadow-xs hover:-translate-y-0.5 cursor-pointer shadow-2xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-display text-[13.5px] font-bold text-[#2C1924]">{pool.name}</span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#DF7AA7]/10 text-[#DF7AA7] font-mono text-[9px] font-bold">{pool.type}</span>
                                </div>
                                <span className="font-display text-[13.5px] font-bold text-emerald-600">{pool.aprFormatted}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 font-mono">
                                <span className="text-[10px] text-[#845D74]">TVL: {pool.tvlFormatted}</span>
                                <span className="text-[10px] text-[#845D74]">Fee: {pool.feeFormatted}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Pool Details */}
                    {poolStep === "details" && selectedPool && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="space-y-2 mb-3.5 font-meta">
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Pool</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{pool.name}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Type</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{pool.type}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Fee Tier</span>
                              <span className="font-display text-[12.5px] font-bold text-[#2C1924]">{pool.feeFormatted}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">TVL</span>
                              <span className="font-display text-[13px] font-bold text-[#2C1924]">{pool.tvlFormatted}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08]">
                              <span className="text-[11px] font-semibold text-[#845D74]">Volume</span>
                              <span className="font-display text-[13px] font-bold text-[#2C1924]">{pool.volumeFormatted}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[11px] font-bold text-emerald-800">APR</span>
                              <span className="font-display text-[15px] font-bold text-emerald-600">{pool.aprFormatted}</span>
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
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Amount (USD)</label>
                            <input type="number" value={liquidityAmount} onChange={(e) => setLiquidityAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-[#DF7AA7] focus:bg-white transition-all" />
                          </div>
                          {liquidityAmount && parseFloat(liquidityAmount) > 0 && (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 mb-3.5">
                              <div className="font-meta text-[11.5px] text-emerald-900">Est. APR: <span className="font-bold text-emerald-700">{pool.aprFormatted}</span></div>
                            </div>
                          )}
                          <button onClick={handleLiquiditySubmit} disabled={!liquidityAmount || parseFloat(liquidityAmount) <= 0} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-[#DF7AA7] hover:bg-[#D46A98] shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">Add Liquidity</button>
                          <button onClick={() => setPoolStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-[#DF7AA7] hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Add Incentive */}
                    {poolStep === "addIncentive" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Incentive Token Amount</label>
                            <input type="number" value={incentiveAmount} onChange={(e) => setIncentiveAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-amber-500 focus:bg-white transition-all" />
                          </div>
                          {incentiveAmount && parseFloat(incentiveAmount) > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-3.5">
                              <div className="font-meta text-[11.5px] text-amber-800">Est. Reward APR: <span className="font-bold">{pool.aprFormatted}</span></div>
                            </div>
                          )}
                          <button onClick={handleIncentiveSubmit} disabled={!incentiveAmount || parseFloat(incentiveAmount) <= 0} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-amber-500 hover:bg-amber-600 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">Add Incentive</button>
                          <button onClick={() => setPoolStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-amber-700 hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Remove Liquidity */}
                    {poolStep === "removeLiquidity" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-meta text-[11px] font-bold uppercase tracking-wider text-[#845D74] mb-1.5 block">Amount to Remove (USD)</label>
                            <input type="number" value={removeAmount} onChange={(e) => setRemoveAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.09] font-mono text-[17px] text-[#2C1924] outline-none placeholder:text-[#845D74]/50 focus:border-rose-400 focus:bg-white transition-all" />
                          </div>
                          {removeAmount && parseFloat(removeAmount) > 0 && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 mb-3.5">
                              <div className="font-meta text-[11.5px] text-rose-800">You will receive: <span className="font-bold">${removeAmount}</span></div>
                            </div>
                          )}
                          <button onClick={handleRemoveSubmit} disabled={!removeAmount || parseFloat(removeAmount) <= 0} className="w-full py-2.5 rounded-xl font-bold text-[13.5px] text-white bg-rose-500 hover:bg-rose-600 shadow-xs disabled:opacity-50 transition-all font-meta cursor-pointer">Remove Liquidity</button>
                          <button onClick={() => setPoolStep("details")} className="w-full py-1.5 mt-2 font-meta text-[11.5px] font-bold text-rose-700 hover:underline cursor-pointer">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Success */}
                    {poolStep === "success" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <div className="text-center py-4">
                          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                          </div>
                          <div className="font-display text-[18px] font-bold text-[#2C1924] mb-1">Success!</div>
                          <div className="font-meta text-[13px] text-[#845D74] mb-3">Action completed on {pool.name}</div>
                          <div className="p-3.5 rounded-xl bg-[#FAF8FA] border border-[#2C1924]/[0.08] inline-block mb-4 shadow-2xs">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">Pool</div>
                                <div className="font-display text-[15px] font-bold text-[#DF7AA7]">{pool.name}</div>
                              </div>
                              <div>
                                <div className="font-meta text-[10px] text-[#845D74] uppercase tracking-wider font-bold">APR</div>
                                <div className="font-display text-[15px] font-bold text-emerald-600">{pool.aprFormatted}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2.5 justify-center font-meta">
                            <button onClick={() => setPoolStep("details")} className="px-5 py-2 rounded-xl border border-[#2C1924]/10 bg-white font-bold text-[12px] text-[#2C1924] hover:bg-[#FAF8FA] transition-all cursor-pointer">View Pool</button>
                            <button onClick={handlePoolCancel} className="px-5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-[12px] hover:bg-rose-100/80 transition-all cursor-pointer">Close</button>
                          </div>
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
                      <a href={`https://explorer.mezo.org/tx/${txDigest}`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#DF7AA7] hover:bg-[#DF7AA7]/90 px-3 py-1 text-[11px] font-bold text-white inline-flex items-center gap-1 shadow-2xs transition-all">Mezo Explorer <ExternalLink className="h-3 w-3" /></a>
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
