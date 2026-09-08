import { useState, useCallback, useEffect } from 'react';
import type { RiskCheck, PtbStep, RouteNode } from '../types/shared';

/**
 * SwapSession — full snapshot of a single intent → simulate → (optional) execute cycle.
 * Captured at insert points in SwapperSection so the HistoryPanel can replay it
 * without re-querying the backend.
 */
export interface SwapSession {
  id: string;
  timestamp: number;
  intent: string;
  sourceToken: string;
  destToken: string;
  amount: string;
  estOutput: string;
  fee: string;
  slippage: string;
  gasPrice: string;
  routeNodes: RouteNode[];
  guardianChecks: RiskCheck[];
  ptbSteps: PtbStep[];
  isSafe: boolean;
  status: 'simulated' | 'executed' | 'failed';
  txHash?: string | null;
  received?: string | null;
  sourceLogo?: string | null;
  destLogo?: string | null;
}

const STORAGE_KEY = 'dieps:swap-history';
const MAX_SESSIONS = 50;

function loadSessions(): SwapSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

function persistSessions(sessions: SwapSession[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    return true;
  } catch {
    // localStorage full or unavailable — try to make space by dropping up to 5 oldest items
    let trimmed = sessions.slice(0, MAX_SESSIONS);
    let success = false;
    for (let i = 0; i < 5 && trimmed.length > 1; i++) {
      trimmed = trimmed.slice(0, -1); // drop oldest
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        success = true;
        break;
      } catch (e) {
        // continue trying
      }
    }
    
    if (!success && sessions.length > 1) {
      // If dropping the oldest items didn't work, the newest session might be massive.
      // Drop the newest session (index 0) to preserve the rest of the old history.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(1, MAX_SESSIONS + 1)));
      } catch (e) {
        // ignore
      }
    }
    return false;
  }
}

/**
 * useSwapHistory — manages swap session snapshots in localStorage.
 * Sessions persist across page reloads; capped at MAX_SESSIONS (oldest dropped).
 */
export function useSwapHistory() {
  const [sessions, setSessions] = useState<SwapSession[]>([]);

  // Lazy-load from localStorage on mount (avoids SSR window access issues).
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const addSession = useCallback((session: SwapSession) => {
    setSessions(prev => {
      const next = [session, ...prev].slice(0, MAX_SESSIONS);
      const success = persistSessions(next);
      if (!success) {
        window.dispatchEvent(new CustomEvent('dieps:history-quota-exceeded'));
      }
      return next;
    });
  }, []);

  const updateSession = useCallback((id: string, patch: Partial<SwapSession>) => {
    setSessions(prev => {
      const next = prev.map(s => (s.id === id ? { ...s, ...patch } : s));
      const success = persistSessions(next);
      if (!success) {
        window.dispatchEvent(new CustomEvent('dieps:history-quota-exceeded'));
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSessions([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const filterByToken = useCallback(
    (symbol: string): SwapSession[] => {
      const q = symbol.trim().toUpperCase();
      if (!q) return sessions;
      return sessions.filter(
        s => s.sourceToken.toUpperCase().includes(q) || s.destToken.toUpperCase().includes(q)
      );
    },
    [sessions]
  );

  return { sessions, addSession, updateSession, clearHistory, filterByToken };
}
