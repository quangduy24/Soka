/**
 * Soka Intent Engine — Frontend Runtime Configuration
 * Single source of truth for all environment-driven values.
 * No network addresses, defaults, timeouts, or thresholds are hardcoded in
 * components — everything flows through here with documented fallbacks.
 */

/**
 * CRITICAL: Vite only inlines env vars through STATIC member access
 * (`import.meta.env.VITE_X`) at transform time — in dev AND build.
 * Dynamic access (`import.meta.env[name]`) and optional chaining
 * (`import.meta?.env`) are left untouched and evaluate to `undefined` in the
 * browser, which once blank-screened the entire app at boot. Never use them.
 * Every key below must also be documented in `.env.example`.
 */
function str(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : fallback;
}

function opt(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
}

function num(raw: unknown, fallback: number): number {
  if (typeof raw !== 'string') return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

// Static reads so Vite can inline values (see note above).
const E = {
  chainId: import.meta.env.VITE_MEZO_CHAIN_ID,
  rpcHttp: import.meta.env.VITE_MEZO_RPC_HTTP,
  rpcWs: import.meta.env.VITE_MEZO_RPC_WS,
  explorer: import.meta.env.VITE_MEZO_EXPLORER_URL,
  wcProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  defaultSource: import.meta.env.VITE_DEFAULT_SOURCE,
  defaultDest: import.meta.env.VITE_DEFAULT_DEST,
  defaultAmount: import.meta.env.VITE_DEFAULT_AMOUNT,
  defaultSlippage: import.meta.env.VITE_DEFAULT_SLIPPAGE,
  quickPrompts: import.meta.env.VITE_QUICK_PROMPTS,
  historyLimit: import.meta.env.VITE_HISTORY_LIMIT,
  historyDedupMs: import.meta.env.VITE_HISTORY_DEDUP_MS,
  autoSelectDelayMs: import.meta.env.VITE_AUTO_SELECT_DELAY_MS,
  txConfirmTimeoutMs: import.meta.env.VITE_TX_CONFIRM_TIMEOUT_MS,
  poolsLimit: import.meta.env.VITE_POOLS_LIMIT,
  poolsStaleMs: import.meta.env.VITE_POOLS_STALE_MS,
  poolsRetry: import.meta.env.VITE_POOLS_RETRY,
  walletRefreshMs: import.meta.env.VITE_WALLET_REFRESH_MS,
  walletStaleMs: import.meta.env.VITE_WALLET_STALE_MS,
  marketRefreshMs: import.meta.env.VITE_MARKET_REFRESH_MS,
  copyResetMs: import.meta.env.VITE_COPY_RESET_MS,
  maxRouteNodes: import.meta.env.VITE_MAX_ROUTE_NODES,
  maxChecksShown: import.meta.env.VITE_MAX_CHECKS_SHOWN,
  maxAdviseExamples: import.meta.env.VITE_MAX_ADVISE_EXAMPLES,
  quoteDecimals: import.meta.env.VITE_QUOTE_DECIMALS,
  maxSlippagePct: import.meta.env.VITE_MAX_SLIPPAGE_PCT,
};

export const CHAIN = {
  id: num(E.chainId, 31611),
  name: 'Mezo Testnet',
  rpcHttp: str(E.rpcHttp, 'https://rpc.test.mezo.org'),
  rpcWs: str(E.rpcWs, 'wss://rpc-ws.test.mezo.org'),
  explorer: str(E.explorer, 'https://explorer.test.mezo.org'),
} as const;

export const WALLETCONNECT_PROJECT_ID = opt(E.wcProjectId) ?? '';

export const SWAP_DEFAULTS = {
  sourceSymbol: str(E.defaultSource, 'BTC'),
  destSymbol: str(E.defaultDest, 'MUSD'),
  /** Prefilled input amount (user-editable, never treated as a quote) */
  tradeAmount: str(E.defaultAmount, '0.05'),
  slippagePct: str(E.defaultSlippage, '0.50%'),
} as const;

export const DEMO_PROMPT = 'Swap 0.05 BTC to MUSD, safest route';
export const COMPOSER_PLACEHOLDER = 'Try "Swap 0.05 BTC to MUSD..." or "What can you do?"';

export const QUICK_PROMPTS: string[] = (() => {
  const raw = opt(E.quickPrompts);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) return parsed;
    } catch {
      // fall through to defaults
    }
  }
  return ['Swap 0.05 BTC to MUSD', 'Borrow MUSD with BTC', 'Show MUSD pools'];
})();

export const HISTORY = {
  key: 'soka:swap-history',
  legacyKey: 'adidahood:swap-history',
  /** Max snapshots kept */
  limit: num(E.historyLimit, 12),
  /** Duplicate-submit suppression window (ms) */
  dedupWindowMs: num(E.historyDedupMs, 5000),
} as const;

export const TIMING = {
  /** Delay before auto-selecting a venue once pools arrive */
  autoSelectDelayMs: num(E.autoSelectDelayMs, 500),
  /** Wallet tx confirmation wait (ms) */
  txConfirmTimeoutMs: num(E.txConfirmTimeoutMs, 60000),
  /** Pools list page size */
  poolsLimit: num(E.poolsLimit, 30),
  /** React-query freshness for pools */
  poolsStaleMs: num(E.poolsStaleMs, 30000),
  poolsRetry: num(E.poolsRetry, 1),
  /** Wallet balance polling */
  walletRefreshMs: num(E.walletRefreshMs, 15000),
  walletStaleMs: num(E.walletStaleMs, 5000),
  /** Market sidebar refresh */
  marketRefreshMs: num(E.marketRefreshMs, 60000),
  /** Copy-to-clipboard reset */
  copyResetMs: num(E.copyResetMs, 2000),
} as const;

export const UI_LIMITS = {
  /** Route hops shown before collapsing */
  maxRouteNodesShown: num(E.maxRouteNodes, 3),
  /** Guardian checks shown before collapsing */
  maxChecksShown: num(E.maxChecksShown, 4),
  /** Fallback advise examples shown */
  maxAdviseExamplesShown: num(E.maxAdviseExamples, 3),
  /** Price-impact warn threshold (%) for display coloring */
  impactWarnPct: 1,
  impactDangerPct: 5,
  impactAmberPct: 2,
  /** Quote output decimals (display only; execution uses full precision) */
  quoteDecimals: num(E.quoteDecimals, 4),
} as const;

/** Slippage input bounds mirror the backend schema (display validation only). */
export const SLIPPAGE_BOUNDS = {
  min: 0,
  max: num(E.maxSlippagePct, 50),
} as const;

/** Guardian score bands (display only — backend guardian is authoritative). */
export const GUARDIAN_BANDS = {
  low: 80,
  medium: 60,
  high: 30,
  max: 100,
} as const;

export const EVM_ADDRESS_LENGTH = 42;

/** Head/tail lengths for truncated hashes and addresses in the UI. */
export const TRUNCATE = {
  head: 8,
  tail: 6,
  labelHead: 10,
} as const;

export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test((value || '').trim());
}

/** Middle-truncated identifier for display (0x12345678…abcdef). */
export function truncateMiddle(value: string, head = TRUNCATE.head, tail = TRUNCATE.tail): string {
  const v = value || '';
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}
