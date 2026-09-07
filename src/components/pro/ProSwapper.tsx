import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Wallet, Sparkles, ExternalLink, Info, History as HistoryIcon, Check, ArrowRightLeft, Landmark, Vault, Waves, Download, Upload, Send, ArrowDownToLine } from 'lucide-react';
import { ProHeader } from './ProHeader';
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
    { id: "btc", name: "BTC Vault", featured: true, address: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12", depositToken: "BTC", receiptToken: "xBTC", operator: "SOKA DAO", withdrawalFee: "0.1%", withdrawalTimelock: "24h", yieldAsset: "BTC", apr: 5.2, tvl: 1250000 },
    { id: "mush", name: "MUSH Savings Vault", featured: false, address: "0x9876543210fedcba0987654321fedcba09876543", depositToken: "MUSH", receiptToken: "sMUSH", operator: "MUSH Protocol", withdrawalFee: "0.5%", withdrawalTimelock: "48h", yieldAsset: "MUSH", apr: 12.8, tvl: 850000 },
    { id: "usdc", name: "USDC Lending Vault", featured: false, address: "0xabcdef1234567890abcdef1234567890abcdef12", depositToken: "USDC", receiptToken: "lUSDC", operator: "Lending Pool", withdrawalFee: "0.0%", withdrawalTimelock: "0h", yieldAsset: "USDC", apr: 7.5, tvl: 2100000 },
    { id: "sui", name: "SUI Savings Vault", featured: false, address: "0x1234567890abcdef1234567890abcdef12345678", depositToken: "SUI", receiptToken: "sSUI", operator: "SUI Staking", withdrawalFee: "0.0%", withdrawalTimelock: "0h", yieldAsset: "SUI", apr: 4.5, tvl: 5200000 },
    { id: "mezo", name: "MEZO Vault", featured: false, address: "0xmezo1234567890abcdefmezo1234567890abcdef", depositToken: "MEZO", receiptToken: "vMEZO", operator: "MEZO Finance", withdrawalFee: "0.2%", withdrawalTimelock: "12h", yieldAsset: "MEZO", apr: 15.3, tvl: 320000 },
    { id: "deep", name: "DEEP Vault", featured: false, address: "0xdeep1234567890abcdefdeep1234567890abcdef", depositToken: "DEEP", receiptToken: "vDEEP", operator: "DEEP Protocol", withdrawalFee: "0.1%", withdrawalTimelock: "6h", yieldAsset: "DEEP", apr: 22.7, tvl: 1800000 },
    { id: "wal", name: "WAL Vault", featured: false, address: "0xwal1234567890abcdefwal1234567890abcdef", depositToken: "WAL", receiptToken: "sWAL", operator: "WAL Staking", withdrawalFee: "0.0%", withdrawalTimelock: "0h", yieldAsset: "WAL", apr: 8.9, tvl: 2400000 },
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
  const clearHistory = () => { setHistory([]); setExpandedHistory(null); try { localStorage.removeItem(HISTORY_KEY); } catch { /* */ } };
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
  const handleCancelSwap = () => { setRouteNodes([]); setGuardianChecks([]); setGuardianSafe(true); setErrorMessage(null); setTxDigest(null); setTokenSuggestion(null); setAlternativeSource(null); setShowDetails(false); setHasConfirmedSettings(false); resetAllFeatures(); activeSwapRef.current = null; setCancelMsg("Order cancelled. Try another swap? \u26a1"); };
  const handleSelectSubAction = (action: string) => {
    setShowTransactionMenu(false);
    const actionLabels: Record<string, string> = { deposit: "Deposit", withdraw: "Withdraw", send: "Send", receive: "Receive" };
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
    setSokaMessage(`You selected ${token}. How much SUI would you like to deposit as collateral?`);
  };
  const handleBorrowAmountSubmit = () => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !borrowToken) return;
    setBorrowStep("review");
    const collateralValueUsd = parseFloat(collateralAmount) * 0.68;
    const borrowAmount = collateralValueUsd * 0.75;
    const interestRate = borrowToken === "MUSD" ? 4.5 : 3.8;
    const liquidationPrice = borrowAmount / (parseFloat(collateralAmount) * 0.85);
    setSokaMessage(`📋 Borrow Summary:\n\n• Borrow: ${borrowAmount.toFixed(2)} ${borrowToken}\n• Collateral: ${collateralAmount} SUI ($${collateralValueUsd.toFixed(2)})\n• LTV: 75.00%\n• Interest Rate: ${interestRate}% APR\n• Liquidation LTV: 85%\n• Liquidation Price: $${liquidationPrice.toFixed(4)}\n\n⚠️ If SUI drops to $${liquidationPrice.toFixed(4)}, your collateral will be liquidated. Please acknowledge the risks to proceed.`);
  };
  const handleBorrowConfirm = () => {
    setBorrowStep("success");
    setSokaMessage(`✅ Borrow Successful!\n\nYou borrowed ${borrowAmount.toFixed(2)} ${borrowToken} with ${collateralAmount} SUI as collateral.\n\nYour position is now active. You can repay at any time.`);
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
      const suiMatch = lowerPrompt.match(/\bsui\b/);
      const mezoMatch = lowerPrompt.match(/mezo/);
      const deepMatch = lowerPrompt.match(/deep/);
      const walMatch = lowerPrompt.match(/\bwal\b/);

      resetAllFeatures();
      setActiveAction("vault");
      setVaultStep("list");
      setSokaMessage("I found the best vault options for you. Here's your vault overview:");

      // Auto-select vault if token mentioned
      let vaultId = null;
      if (btcMatch) vaultId = "btc";
      else if (mushMatch) vaultId = "mush";
      else if (usdcMatch) vaultId = "usdc";
      else if (suiMatch) vaultId = "sui";
      else if (mezoMatch) vaultId = "mezo";
      else if (deepMatch) vaultId = "deep";
      else if (walMatch) vaultId = "wal";

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
        setSokaMessage(`You want to borrow ${extractedAmount || ""} MUSD. Please enter collateral amount in SUI:`);
      } else if (musdcMatch) {
        setBorrowToken("MUSDC");
        setCollateralAmount(extractedAmount || "");
        setSokaMessage(`You want to borrow ${extractedAmount || ""} MUSDC. Please enter collateral amount in SUI:`);
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

  const quickPrompts = ["Deposit SUI", "Withdraw USDC", "Send tokens", "Create claim link"];
  const hasResult = routeNodes.length > 0 || guardianChecks.length > 0;
  const hasRiskWarnings = guardianChecks.some(c => c.status === "WARNING" || c.status === "DANGER") || !guardianSafe;

  return (
    <div className="h-[100dvh] w-full mesh-texture text-[#0f172a] flex flex-col overflow-hidden">
      <div className="absolute top-[15%] left-[5%] w-[400px] h-[400px] rounded-full bg-[#F05391]/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#8b5cf6]/[0.04] blur-[100px] pointer-events-none" />

      <ProHeader onOpenWalletModal={() => setIsWalletModalOpen(true)} />

      <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 relative z-10">
        {/* Main Chat Card - Floating */}
        <div className="h-full glass-strong flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/40 bg-white/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/15 flex items-center justify-center">
                <img src="/icon-chatbox.png" alt="Soka" className="w-11 h-11 object-contain skull-glow" />
              </div>
              <div>
                <div className="font-bold text-[16px] text-[#0f172a]" style={{ fontFamily: "var(--font-display)" }}>SOKA AI</div>
                <div className="text-[11px] font-medium text-[#10b981] flex items-center gap-1.5"><span className="dot dot-success" /> Online</div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setHistoryOpen(v => !v)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-medium transition-all ${historyOpen ? "bg-[#F05391]/10 text-[#F05391] border-[#F05391]/20" : "bg-white/40 text-[#0f172a]/50 border-white/50 hover:bg-white/60"}`}>
                <HistoryIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">History</span>
                {history.length > 0 && <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-[#F05391] text-white text-[9px] font-bold flex items-center justify-center">{history.length > 9 ? "9+" : history.length}</span>}
              </button>
              <button onClick={() => { setIntentPrompt(""); setRouteNodes([]); setGuardianChecks([]); setErrorMessage(null); setTxDigest(null); activeSwapRef.current = null; }} className="w-9 h-9 rounded-xl bg-white/40 border border-white/50 flex items-center justify-center hover:bg-white/60 transition-all">
                <span className="text-[#0f172a]/50 text-sm font-medium">+</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.01) 100%)" }}>
            <div className="flex flex-col gap-4 w-full max-w-3xl">
              {/* Intro */}
              <div className="flex items-end gap-3">
                <img src="/icon-chatbox.png" alt="Soka" className="w-11 h-11 object-contain shrink-0" />
                <div className="glass p-4 max-w-[85%]">
                  <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#F05391] mb-1">SOKA ★</div>
                  <div className="text-[15px] font-medium text-[#0f172a]/80 leading-relaxed">Tell me your dream swap. I sniff the route &amp; run 7 checks — no jargon, just vibes ⚡</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4 ml-14">
                <button onClick={() => { resetAllFeatures(); setActiveAction("transaction"); setShowTransactionMenu(true); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${activeAction === "transaction" ? "bg-[#F05391]/15 border-[#F05391]/30 text-[#F05391]" : "bg-white/20 border-white/30 text-[#0f172a]/60 hover:bg-white/30"}`}>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Transaction</span>
                </button>
                <button onClick={() => { resetAllFeatures(); setActiveAction("borrow"); handleOpenBorrow(); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${activeAction === "borrow" ? "bg-[#F05391]/15 border-[#F05391]/30 text-[#F05391]" : "bg-white/20 border-white/30 text-[#0f172a]/60 hover:bg-white/30"}`}>
                  <Landmark className="w-4 h-4" />
                  <span className="text-sm font-medium">Borrow</span>
                </button>
                <button onClick={() => { resetAllFeatures(); setActiveAction("vault"); handleOpenVault(); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${activeAction === "vault" ? "bg-[#F05391]/15 border-[#F05391]/30 text-[#F05391]" : "bg-white/20 border-white/30 text-[#0f172a]/60 hover:bg-white/30"}`}>
                  <Vault className="w-4 h-4" />
                  <span className="text-sm font-medium">Vault</span>
                </button>
                <button onClick={() => { resetAllFeatures(); setActiveAction("pool"); handleOpenPool(); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${activeAction === "pool" ? "bg-[#F05391]/15 border-[#F05391]/30 text-[#F05391]" : "bg-white/20 border-white/30 text-[#0f172a]/60 hover:bg-white/30"}`}>
                  <Waves className="w-4 h-4" />
                  <span className="text-sm font-medium">Pool</span>
                </button>
              </div>

              {/* Transaction Sub-menu */}
              {showTransactionMenu && (
                <div className="mt-2 ml-14">
                  <div className="glass p-3 border border-[#F05391]/20 rounded-xl max-w-[85%]">
                    {/* Close Button */}
                    <div className="flex justify-end mb-2">
                      <button onClick={() => { setShowTransactionMenu(false); setActiveAction(null); }} className="w-6 h-6 rounded-full bg-white/40 border border-white/50 flex items-center justify-center hover:bg-white/60 transition-all">
                        <span className="text-[#0f172a]/50 text-xs">✕</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSelectSubAction("deposit")} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#10b981]/20 bg-[#10b981]/8 text-[#10b981] hover:bg-[#10b981]/15 transition-all">
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Deposit</span>
                      </button>
                      <button onClick={() => handleSelectSubAction("withdraw")} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/8 text-[#f59e0b] hover:bg-[#f59e0b]/15 transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Withdraw</span>
                      </button>
                      <button onClick={() => handleSelectSubAction("send")} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/8 text-[#8b5cf6] hover:bg-[#8b5cf6]/15 transition-all">
                        <Send className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Send</span>
                      </button>
                      <button onClick={() => handleSelectSubAction("receive")} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#06b6d4]/20 bg-[#06b6d4]/8 text-[#06b6d4] hover:bg-[#06b6d4]/15 transition-all">
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Receive</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Soka Action Message */}
              {sokaMessage && !isProcessing && (
                <div className="flex items-end gap-3">
                  <img src="/icon-chatbox.png" alt="Soka" className="w-11 h-11 object-contain shrink-0" />
                  <div className="glass p-4 max-w-[85%]">
                    <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#F05391] mb-1">SOKA ★</div>
                    <div className="text-[14px] font-medium text-[#0f172a]/80 whitespace-pre-line">{sokaMessage}</div>
                  </div>
                </div>
              )}

              {/* Borrow Card - Theme glassmorphism */}
              {borrowStep !== "idle" && (
                <div className="mt-2 ml-14">
                  <div className="glass p-5 max-w-[85%]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/20 flex items-center justify-center">
                          <Landmark className="w-5 h-5 text-[#F05391]" />
                        </div>
                        <div>
                          <h3 className="font-display text-[16px] font-bold text-[#0f172a]">Borrow</h3>
                          <p className="font-body text-[12px] text-[#0f172a]/50">{(borrowStep === "select_token" && "Select token") || (borrowStep === "enter_amount" && `Borrow ${borrowToken}`) || (borrowStep === "review" && "Review") || (borrowStep === "success" && "Done")}</p>
                        </div>
                      </div>
                      <button onClick={() => { setBorrowStep("idle"); setActiveAction(null); }} className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center hover:bg-white/70 transition-all">
                        <span className="text-[#0f172a]/50 text-sm">✕</span>
                      </button>
                    </div>

                    {/* Step 1: Token Selection */}
                    {borrowStep === "select_token" && (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleSelectBorrowToken("MUSD")} className="p-4 rounded-2xl border border-[#F05391]/20 bg-[#F05391]/5 hover:bg-[#F05391]/15 hover:border-[#F05391]/30 transition-all text-center">
                          <div className="font-display text-[18px] font-bold text-[#F05391]">MUSD</div>
                          <div className="font-mono text-[11px] text-[#0f172a]/50 mt-1">4.5% APR</div>
                        </button>
                        <button onClick={() => handleSelectBorrowToken("MUSDC")} className="p-4 rounded-2xl border border-[#F05391]/20 bg-[#F05391]/5 hover:bg-[#F05391]/15 hover:border-[#F05391]/30 transition-all text-center">
                          <div className="font-display text-[18px] font-bold text-[#F05391]">MUSDC</div>
                          <div className="font-mono text-[11px] text-[#0f172a]/50 mt-1">3.8% APR</div>
                        </button>
                      </div>
                    )}

                    {/* Step 2: Collateral Amount */}
                    {borrowStep === "enter_amount" && (
                      <>
                        <div className="mb-4">
                          <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0f172a]/40 mb-2 block">Collateral (SUI)</label>
                          <input type="number" value={collateralAmount} onChange={(e) => setCollateralAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-2xl bg-white/50 border border-white/60 font-mono text-[18px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/30" />
                          <div className="flex justify-between mt-2">
                            <span className="font-mono text-[11px] text-[#0f172a]/40">≈ ${collateralValueUsd.toFixed(2)}</span>
                            <div className="flex gap-1">
                              {[25, 50, 75, 100].map(pct => (
                                <button key={pct} onClick={() => setCollateralAmount((1000 * pct / 100).toString())} className="px-2 py-1 rounded-lg bg-white/50 border border-white/60 font-mono text-[10px] text-[#0f172a]/50 hover:bg-white/70">{pct}%</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {collateralAmount && parseFloat(collateralAmount) > 0 && (
                          <div className="p-3 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20 mb-4">
                            <div className="font-mono text-[12px] text-[#10b981]">Borrow up to <span className="font-bold">{borrowAmount.toFixed(2)} {borrowToken}</span></div>
                          </div>
                        )}
                        <button onClick={handleBorrowAmountSubmit} disabled={!collateralAmount || parseFloat(collateralAmount) <= 0} className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#F05391] hover:bg-[#F05391]/90 disabled:opacity-50 transition-all">Review</button>
                        <button onClick={() => setBorrowStep("select_token")} className="w-full py-2 mt-2 font-body text-[12px] text-[#F05391] hover:underline">← Change token</button>
                      </>
                    )}

                    {/* Step 3: Review */}
                    {borrowStep === "review" && (
                      <>
                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between items-center p-3 rounded-2xl bg-white/30 border border-white/40">
                            <span className="font-body text-[13px] text-[#0f172a]/60">Borrow</span>
                            <span className="font-display text-[16px] font-bold text-[#F05391]">{borrowAmount.toFixed(2)} {borrowToken}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-2xl bg-white/30 border border-white/40">
                            <span className="font-body text-[13px] text-[#0f172a]/60">Collateral</span>
                            <span className="font-display text-[16px] font-bold text-[#0f172a]">{collateralAmount} SUI</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-2xl bg-white/30 border border-white/40">
                              <div className="font-mono text-[10px] text-[#0f172a]/40">LTV</div>
                              <div className="font-display text-[15px] font-bold text-[#10b981]">75%</div>
                            </div>
                            <div className="text-center p-3 rounded-2xl bg-white/30 border border-white/40">
                              <div className="font-mono text-[10px] text-[#0f172a]/40">Rate</div>
                              <div className="font-display text-[15px] font-bold text-[#0f172a]">{interestRate}%</div>
                            </div>
                            <div className="text-center p-3 rounded-2xl bg-white/30 border border-white/40">
                              <div className="font-mono text-[10px] text-[#0f172a]/40">Liq. Price</div>
                              <div className="font-display text-[15px] font-bold text-[#ef4444]">${liquidationPrice.toFixed(4)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-2xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 cursor-pointer mb-4" onClick={() => setBorrowAcknowledged(!borrowAcknowledged)}>
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${borrowAcknowledged ? "bg-[#10b981] border-[#10b981]" : "bg-transparent border-[#f59e0b]/30"}`}>
                            {borrowAcknowledged && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="font-body text-[12px] text-[#f59e0b]">I acknowledge the liquidation risk</span>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={handleBorrowCancel} className="flex-1 py-3 rounded-2xl border border-white/50 bg-white/40 font-semibold text-[14px] text-[#0f172a]/60 hover:bg-white/60 transition-all">Cancel</button>
                          <button onClick={handleBorrowConfirm} disabled={!borrowAcknowledged} className="flex-1 py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#10b981] hover:bg-[#10b981]/90 disabled:opacity-50 transition-all">Confirm</button>
                        </div>
                      </>
                    )}

                    {/* Step 4: Success */}
                    {borrowStep === "success" && (
                      <div className="text-center py-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#10b981]/20 to-[#10b981]/5 border-2 border-[#10b981]/30 flex items-center justify-center shadow-lg shadow-[#10b981]/20">
                          <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
                        </div>
                        <div className="font-display text-[20px] font-bold text-[#0f172a] mb-2">Borrow Successful!</div>
                        <div className="font-body text-[14px] text-[#0f172a]/60 mb-4">Your position is now active</div>
                        <div className="p-4 rounded-2xl bg-white/30 border border-white/40 inline-block mb-4">
                          <div className="grid grid-cols-2 gap-4 text-left">
                            <div>
                              <div className="font-mono text-[10px] text-[#0f172a]/40 uppercase tracking-wider">Borrowed</div>
                              <div className="font-display text-[16px] font-bold text-[#F05391]">{borrowAmount.toFixed(2)} {borrowToken}</div>
                            </div>
                            <div>
                              <div className="font-mono text-[10px] text-[#0f172a]/40 uppercase tracking-wider">Collateral</div>
                              <div className="font-display text-[16px] font-bold text-[#0f172a]">{collateralAmount} SUI</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 justify-center">
                          <button onClick={handleBorrowCancel} className="px-6 py-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/8 text-[#ef4444] font-body text-[13px] hover:bg-[#ef4444]/15 transition-all">Cancel Position</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vault Card - Theme glassmorphism */}
              {vaultStep !== "idle" && (
                <div className="mt-2 ml-14">
                  <div className="glass p-5 max-w-[85%]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/20 flex items-center justify-center">
                          <Vault className="w-5 h-5 text-[#F05391]" />
                        </div>
                        <div>
                          <h3 className="font-display text-[16px] font-bold text-[#0f172a]">Vaults</h3>
                          <p className="font-body text-[12px] text-[#0f172a]/50">{(vaultStep === "list" && "Your overview") || (vaultStep === "details" && "Vault details") || (vaultStep === "deposit" && "Deposit") || (vaultStep === "confirm" && "Confirm") || (vaultStep === "success" && "Done")}</p>
                        </div>
                      </div>
                      <button onClick={() => { setVaultStep("idle"); setActiveAction(null); setSelectedVault(null); setDepositAmount(""); }} className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center hover:bg-white/70 transition-all">
                        <span className="text-[#0f172a]/50 text-sm">✕</span>
                      </button>
                    </div>

                    {/* Vault Balance Overview */}
                    {vaultStep === "list" && (
                      <>
                        {/* Balance Summary */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center p-3 rounded-2xl bg-white/30 border border-white/40">
                            <div className="font-mono text-[10px] text-[#0f172a]/40">Total Deposited</div>
                            <div className="font-display text-[15px] font-bold text-[#F05391]">${vaultBalance.totalDeposited.toLocaleString()}</div>
                          </div>
                          <div className="text-center p-3 rounded-2xl bg-white/30 border border-white/40">
                            <div className="font-mono text-[10px] text-[#0f172a]/40">Avg APR</div>
                            <div className="font-display text-[15px] font-bold text-[#10b981]">{vaultBalance.avgApr}%</div>
                          </div>
                          <div className="text-center p-3 rounded-2xl bg-white/30 border border-white/40">
                            <div className="font-mono text-[10px] text-[#0f172a]/40">Deposits</div>
                            <div className="font-display text-[15px] font-bold text-[#0f172a]">{vaultBalance.deposits}</div>
                          </div>
                        </div>
                        {/* Vault List */}
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#0f172a]/40 mb-2">Available Vaults</div>
                        <div className="space-y-2">
                          {vaults.map(vault => (
                            <button key={vault.id} onClick={() => handleSelectVault(vault.id)} className={`w-full p-3 rounded-2xl border text-left transition-all ${vault.featured ? "border-[#f59e0b]/30 bg-[#f59e0b]/5 hover:bg-[#f59e0b]/10" : "border-white/40 bg-white/30 hover:bg-white/40"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {vault.featured && <span className="px-1.5 py-0.5 rounded-lg bg-[#f59e0b]/20 text-[#f59e0b] font-mono text-[8px] font-bold">FEATURED</span>}
                                  <span className="font-body text-[13px] font-semibold text-[#0f172a]">{vault.name}</span>
                                </div>
                                <span className="font-display text-[14px] font-bold text-[#10b981]">{vault.apr}%</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="font-mono text-[9px] text-[#0f172a]/40">TVL: ${(vault.tvl / 1000000).toFixed(1)}M</span>
                                <span className="font-mono text-[9px] text-[#0f172a]/40">Fee: {vault.withdrawalFee}</span>
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
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Vault Address</span>
                              <span className="font-mono text-[10px] text-[#0f172a]">{vault.address.slice(0, 8)}...{vault.address.slice(-6)}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Deposit Token</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{vault.depositToken}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Receipt Token</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{vault.receiptToken}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Operator</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{vault.operator}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Withdrawal Fee</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{vault.withdrawalFee}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Time-lock</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{vault.withdrawalTimelock}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Yield Asset</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{vault.yieldAsset}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">APR</span>
                              <span className="font-display text-[16px] font-bold text-[#10b981]">{vault.apr}%</span>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setVaultStep("list")} className="flex-1 py-3 rounded-2xl border border-white/50 bg-white/40 font-semibold text-[14px] text-[#0f172a]/60 hover:bg-white/60 transition-all">← Back</button>
                            <button onClick={handleDepositVault} className="flex-1 py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#F05391] hover:bg-[#F05391]/90 transition-all">Deposit</button>
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
                            <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0f172a]/40 mb-2 block">Amount ({vault.depositToken})</label>
                            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-2xl bg-white/50 border border-white/60 font-mono text-[18px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/30" />
                          </div>
                          {depositAmount && parseFloat(depositAmount) > 0 && (
                            <div className="p-3 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/20 mb-4">
                              <div className="font-mono text-[12px] text-[#F05391]">You'll receive ~ <span className="font-bold">{(parseFloat(depositAmount) * 0.98).toFixed(2)} {vault.receiptToken}</span></div>
                            </div>
                          )}
                          <button onClick={handleDepositAmountSubmit} disabled={!depositAmount || parseFloat(depositAmount) <= 0} className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#F05391] hover:bg-[#F05391]/90 disabled:opacity-50 transition-all">Review Deposit</button>
                          <button onClick={() => setVaultStep("details")} className="w-full py-2 mt-2 font-body text-[12px] text-[#F05391] hover:underline">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Confirm Deposit */}
                    {vaultStep === "confirm" && (() => {
                      const vault = vaults.find(v => v.id === selectedVault);
                      return vault ? (
                        <>
                          <div className="space-y-3 mb-4">
                            <div className="flex justify-between p-3 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-body text-[12px] text-[#0f172a]/60">Deposit</span>
                              <span className="font-display text-[15px] font-bold text-[#0f172a]">{depositAmount} {vault.depositToken}</span>
                            </div>
                            <div className="flex justify-between p-3 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-body text-[12px] text-[#0f172a]/60">Receive</span>
                              <span className="font-display text-[15px] font-bold text-[#8b5cf6]">{(parseFloat(depositAmount || "0") * 0.98).toFixed(2)} {vault.receiptToken}</span>
                            </div>
                            <div className="flex justify-between p-3 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20">
                              <span className="font-body text-[12px] text-[#0f172a]/60">APR</span>
                              <span className="font-display text-[15px] font-bold text-[#10b981]">{vault.apr}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-2xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 cursor-pointer mb-4" onClick={() => setVaultAcknowledged(!vaultAcknowledged)}>
                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${vaultAcknowledged ? "bg-[#10b981] border-[#10b981]" : "bg-transparent border-[#f59e0b]/30"}`}>
                              {vaultAcknowledged && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-body text-[12px] text-[#f59e0b]">I acknowledge the deposit terms</span>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={handleVaultCancel} className="flex-1 py-3 rounded-2xl border border-white/50 bg-white/40 font-semibold text-[14px] text-[#0f172a]/60 hover:bg-white/60 transition-all">Cancel</button>
                            <button onClick={handleVaultConfirm} disabled={!vaultAcknowledged} className="flex-1 py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#10b981] hover:bg-[#10b981]/90 disabled:opacity-50 transition-all">Confirm</button>
                          </div>
                        </>
                      ) : null;
                    })()}

                    {/* Success */}
                    {vaultStep === "success" && (() => {
                      const vault = vaults.find(v => v.id === selectedVault);
                      return vault ? (
                        <div className="text-center py-4">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#10b981]/20 to-[#10b981]/5 border-2 border-[#10b981]/30 flex items-center justify-center shadow-lg shadow-[#10b981]/20">
                            <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
                          </div>
                          <div className="font-display text-[20px] font-bold text-[#0f172a] mb-2">Deposit Successful!</div>
                          <div className="font-body text-[14px] text-[#0f172a]/60 mb-4">Your deposit is now earning yield</div>
                          <div className="p-4 rounded-2xl bg-white/30 border border-white/40 inline-block mb-4">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              <div>
                                <div className="font-mono text-[10px] text-[#0f172a]/40 uppercase tracking-wider">Deposited</div>
                                <div className="font-display text-[16px] font-bold text-[#F05391]">{depositAmount} {vault.depositToken}</div>
                              </div>
                              <div>
                                <div className="font-mono text-[10px] text-[#0f172a]/40 uppercase tracking-wider">APR</div>
                                <div className="font-display text-[16px] font-bold text-[#10b981]">{vault.apr}%</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-center">
                            <button onClick={handleVaultCancel} className="px-6 py-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/8 text-[#ef4444] font-body text-[13px] hover:bg-[#ef4444]/15 transition-all">Withdraw</button>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Pool Card - Theme glassmorphism */}
              {poolStep !== "idle" && (
                <div className="mt-2 ml-14">
                  <div className="glass p-5 max-w-[85%]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/20 flex items-center justify-center">
                          <Waves className="w-5 h-5 text-[#F05391]" />
                        </div>
                        <div>
                          <h3 className="font-display text-[16px] font-bold text-[#0f172a]">Pools</h3>
                          <p className="font-body text-[12px] text-[#0f172a]/50">{(poolStep === "list" && "Available pools") || (poolStep === "details" && "Pool details") || (poolStep === "addLiquidity" && "Add liquidity") || (poolStep === "success" && "Success")}</p>
                        </div>
                      </div>
                      <button onClick={() => { setPoolStep("idle"); setActiveAction(null); setSelectedPool(null); setLiquidityAmount(""); }} className="w-7 h-7 rounded-full bg-white/50 border border-white/60 flex items-center justify-center hover:bg-white/70 transition-all">
                        <span className="text-[#0f172a]/50 text-sm">✕</span>
                      </button>
                    </div>

                    {/* Pool List */}
                    {poolStep === "list" && (
                      <>
                        <div className="space-y-2">
                          {pools.map(pool => (
                            <button key={pool.id} onClick={() => handleSelectPool(pool.id)} className="w-full p-3 rounded-2xl border border-white/40 bg-white/30 hover:bg-white/40 text-left transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-body text-[13px] font-semibold text-[#0f172a]">{pool.name}</span>
                                  <span className="px-1.5 py-0.5 rounded-lg bg-[#F05391]/10 text-[#F05391] font-mono text-[8px] font-bold">{pool.type}</span>
                                </div>
                                <span className="font-display text-[14px] font-bold text-[#10b981]">{pool.aprFormatted}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="font-mono text-[9px] text-[#0f172a]/40">TVL: {pool.tvlFormatted}</span>
                                <span className="font-mono text-[9px] text-[#0f172a]/40">Fee: {pool.feeFormatted}</span>
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
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Pool</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{pool.name}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Type</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{pool.type}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Fee Tier</span>
                              <span className="font-body text-[12px] font-semibold text-[#0f172a]">{pool.feeFormatted}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">TVL</span>
                              <span className="font-display text-[14px] font-bold text-[#0f172a]">{pool.tvlFormatted}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-white/30 border border-white/40">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">Volume</span>
                              <span className="font-display text-[14px] font-bold text-[#0f172a]">{pool.volumeFormatted}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20">
                              <span className="font-mono text-[10px] text-[#0f172a]/50">APR</span>
                              <span className="font-display text-[16px] font-bold text-[#10b981]">{pool.aprFormatted}</span>
                            </div>
                          </div>
                          {/* Action Buttons - Glassmorphism Style */}
                          <div className="grid grid-cols-3 gap-2">
                            <button onClick={handleAddLiquidity} className="p-3 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/20 hover:bg-[#F05391]/20 hover:border-[#F05391]/30 transition-all text-center group">
                              <div className="w-8 h-8 mx-auto mb-1 rounded-xl bg-[#F05391]/10 border border-[#F05391]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Download className="w-4 h-4 text-[#F05391]" />
                              </div>
                              <span className="font-body text-[11px] font-semibold text-[#F05391]">Add Liquidity</span>
                            </button>
                            <button onClick={handleAddIncentive} className="p-3 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 hover:bg-[#f59e0b]/20 hover:border-[#f59e0b]/30 transition-all text-center group">
                              <div className="w-8 h-8 mx-auto mb-1 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                              </div>
                              <span className="font-body text-[11px] font-semibold text-[#f59e0b]">Add Incentive</span>
                            </button>
                            <button onClick={handleRemoveLiquidity} className="p-3 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 hover:bg-[#ef4444]/20 hover:border-[#ef4444]/30 transition-all text-center group">
                              <div className="w-8 h-8 mx-auto mb-1 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload className="w-4 h-4 text-[#ef4444]" />
                              </div>
                              <span className="font-body text-[11px] font-semibold text-[#ef4444]">Remove</span>
                            </button>
                          </div>
                          <button onClick={() => setPoolStep("list")} className="w-full py-2 mt-3 font-body text-[12px] text-[#0f172a]/60 hover:underline">← Back to pools</button>
                        </>
                      ) : null;
                    })()}

                    {/* Add Liquidity */}
                    {poolStep === "addLiquidity" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0f172a]/40 mb-2 block">Amount (USD)</label>
                            <input type="number" value={liquidityAmount} onChange={(e) => setLiquidityAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-2xl bg-white/50 border border-white/60 font-mono text-[18px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/30" />
                          </div>
                          {liquidityAmount && parseFloat(liquidityAmount) > 0 && (
                            <div className="p-3 rounded-2xl bg-[#F05391]/10 border border-[#F05391]/20 mb-4">
                              <div className="font-mono text-[12px] text-[#F05391]">Est. APR: <span className="font-bold">{pool.aprFormatted}</span></div>
                            </div>
                          )}
                          <button onClick={handleLiquiditySubmit} disabled={!liquidityAmount || parseFloat(liquidityAmount) <= 0} className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#F05391] hover:bg-[#F05391]/90 disabled:opacity-50 transition-all">Add Liquidity</button>
                          <button onClick={() => setPoolStep("details")} className="w-full py-2 mt-2 font-body text-[12px] text-[#F05391] hover:underline">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Add Incentive */}
                    {poolStep === "addIncentive" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0f172a]/40 mb-2 block">Incentive Token Amount</label>
                            <input type="number" value={incentiveAmount} onChange={(e) => setIncentiveAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-2xl bg-white/50 border border-white/60 font-mono text-[18px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/30" />
                          </div>
                          {incentiveAmount && parseFloat(incentiveAmount) > 0 && (
                            <div className="p-3 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 mb-4">
                              <div className="font-mono text-[12px] text-[#f59e0b]">Est. Reward APR: <span className="font-bold">{pool.aprFormatted}</span></div>
                            </div>
                          )}
                          <button onClick={handleIncentiveSubmit} disabled={!incentiveAmount || parseFloat(incentiveAmount) <= 0} className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#f59e0b] hover:bg-[#f59e0b]/90 disabled:opacity-50 transition-all">Add Incentive</button>
                          <button onClick={() => setPoolStep("details")} className="w-full py-2 mt-2 font-body text-[12px] text-[#f59e0b] hover:underline">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Remove Liquidity */}
                    {poolStep === "removeLiquidity" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <>
                          <div className="mb-4">
                            <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0f172a]/40 mb-2 block">Amount to Remove (USD)</label>
                            <input type="number" value={removeAmount} onChange={(e) => setRemoveAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 rounded-2xl bg-white/50 border border-white/60 font-mono text-[18px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/30" />
                          </div>
                          {removeAmount && parseFloat(removeAmount) > 0 && (
                            <div className="p-3 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 mb-4">
                              <div className="font-mono text-[12px] text-[#ef4444]">You will receive: <span className="font-bold">${removeAmount}</span></div>
                            </div>
                          )}
                          <button onClick={handleRemoveSubmit} disabled={!removeAmount || parseFloat(removeAmount) <= 0} className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#ef4444]/90 disabled:opacity-50 transition-all">Remove Liquidity</button>
                          <button onClick={() => setPoolStep("details")} className="w-full py-2 mt-2 font-body text-[12px] text-[#ef4444] hover:underline">← Back to details</button>
                        </>
                      ) : null;
                    })()}

                    {/* Success */}
                    {poolStep === "success" && (() => {
                      const pool = pools.find(p => p.id === selectedPool);
                      return pool ? (
                        <div className="text-center py-4">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#10b981]/20 to-[#10b981]/5 border-2 border-[#10b981]/30 flex items-center justify-center shadow-lg shadow-[#10b981]/20">
                            <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
                          </div>
                          <div className="font-display text-[20px] font-bold text-[#0f172a] mb-2">Success!</div>
                          <div className="font-body text-[14px] text-[#0f172a]/60 mb-4">Action completed on {pool.name}</div>
                          <div className="p-4 rounded-2xl bg-white/30 border border-white/40 inline-block mb-4">
                            <div className="grid grid-cols-2 gap-4 text-left">
                              <div>
                                <div className="font-mono text-[10px] text-[#0f172a]/40 uppercase tracking-wider">Pool</div>
                                <div className="font-display text-[16px] font-bold text-[#F05391]">{pool.name}</div>
                              </div>
                              <div>
                                <div className="font-mono text-[10px] text-[#0f172a]/40 uppercase tracking-wider">APR</div>
                                <div className="font-display text-[16px] font-bold text-[#10b981]">{pool.aprFormatted}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-center">
                            <button onClick={() => setPoolStep("details")} className="px-6 py-2.5 rounded-xl border border-white/50 bg-white/40 font-body text-[13px] text-[#0f172a]/60 hover:bg-white/60 transition-all">View Pool</button>
                            <button onClick={handlePoolCancel} className="px-6 py-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/8 text-[#ef4444] font-body text-[13px] hover:bg-[#ef4444]/15 transition-all">Close</button>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {intentPrompt.trim() !== "" && (
                <div className="flex justify-end">
                  <div className="glass-accent p-4 max-w-[85%]">
                    <div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#F05391] mb-1 text-right">YOU ★</div>
                    <div className="text-[15px] font-medium text-[#0f172a]/80 break-words">{intentPrompt}</div>
                  </div>
                </div>
              )}

              {/* Token suggestion */}
              {!hasResult && !isProcessing && (tokenSuggestion || alternativeSource) && (
                <div className="flex flex-col gap-3 w-full">
                  {tokenSuggestion && (
                    <div className="glass p-4">
                      <div className="flex items-center gap-2 mb-2"><Info className="w-4 h-4 text-[#F05391]" /><span className="font-mono text-[12px] font-bold text-[#0f172a]">Pick the exact token</span></div>
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
                          <span className="rounded-lg bg-[#F05391]/10 border border-[#F05391]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#F05391]">{n.dex}</span>
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
                      <a href={`https://suiscan.xyz/mainnet/tx/${txDigest}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#F05391] px-2.5 py-1 text-[10px] font-bold text-white inline-flex items-center gap-1">Suiscan <ExternalLink className="h-3 w-3" /></a>
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
                  <img src="/icon-chatbox.png" alt="Soka" className="w-11 h-11 object-contain shrink-0" />
                  <div className="glass p-4 max-w-[85%]"><div className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#F05391] mb-1">SOKA ★</div><div className="text-[14px] font-medium text-[#0f172a]/80">{cancelMsg}</div></div>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-end gap-3">
                  <img src="/icon-chatbox.png" alt="Soka" className="w-11 h-11 object-contain shrink-0" />
                  <div className="glass p-4"><div className="flex items-center gap-2 font-mono text-[13px] font-medium text-[#0f172a]/50"><span className="w-2 h-2 rounded-full bg-[#F05391] animate-pulse" /><span className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" style={{ animationDelay: "0.15s" }} /><span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-pulse" style={{ animationDelay: "0.3s" }} />sniffing pools…</div></div>
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
                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><img src="/icon-chatbox.png" alt="Send" className="w-5 h-5" /></span>}
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
