import React from 'react';
import type { SwapSession } from '../../../hooks/useSwapHistory';

const shortToken = (raw: string) =>
  raw?.includes('::') ? (raw.split('::').pop() || raw) : (raw || '?');

const statusColor = (status?: string) => {
  if (status === 'DANGER') return 'text-red-400';
  if (status === 'WARNING') return 'text-amber-400';
  return 'text-[#2E7D00]';
};

/**
 * HistoryDetail — expanded inline view of a single session.
 * Shows mini guardian checks, PTB steps, and route nodes in a compact,
 * read-only layout. No interactivity — purely for reviewing past swaps.
 */
export const HistoryDetail: React.FC<{ session: SwapSession }> = ({ session }) => {
  const { guardianChecks, ptbSteps, routeNodes } = session;

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Meta row */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px] font-mono">
        <div className="flex flex-col">
          <span className="text-[#141414]/50 uppercase tracking-widest">Amount</span>
          <span className="text-[#141414] font-bold">{session.amount} {shortToken(session.sourceToken)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#141414]/50 uppercase tracking-widest">Est. Output</span>
          <span className="text-[#141414] font-bold">{session.estOutput} {shortToken(session.destToken)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#141414]/50 uppercase tracking-widest">Slippage</span>
          <span className="text-[#141414] font-bold">{session.slippage || '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#141414]/50 uppercase tracking-widest">Gas</span>
          <span className="text-[#141414] font-bold">{session.gasPrice ? `${session.gasPrice} SUI` : '—'}</span>
        </div>
      </div>

      {/* Guardian checks mini */}
      {guardianChecks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-widest text-[#141414]/60 font-bold">Guardian Checks</span>
          <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
            {guardianChecks.map((check, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono">
                <span className={`material-symbols-outlined text-[11px] ${statusColor(check.status)}`}>
                  {check.status === 'DANGER' ? 'error' : check.status === 'WARNING' ? 'warning' : 'check_circle'}
                </span>
                <span className="text-[#141414]/65 truncate flex-1">{check.name}</span>
                <span className={`${statusColor(check.status)} uppercase text-[7px] font-bold tracking-wider`}>{check.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route nodes mini */}
      {routeNodes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-widest text-[#141414]/60 font-bold">Route</span>
          <div className="flex flex-col gap-0.5">
            {routeNodes.map((node, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px] font-mono">
                <span className="material-symbols-outlined text-[10px] text-[#2E7D00]">water_drop</span>
                <span className="text-[#141414]/65 truncate flex-1">{node.dex || 'DEX'} Pool</span>
                <span className="text-[#141414]">{node.fee}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PTB steps mini */}
      {ptbSteps.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-widest text-[#141414]/60 font-bold">PTB Steps</span>
          <div className="flex flex-col gap-0.5 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
            {ptbSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[9px] font-mono">
                <span className="text-[#2E7D00]/40 w-3 shrink-0 text-right">{step.index ?? i + 1}</span>
                <span className="text-[#2E7D00] font-bold shrink-0">{step.command}</span>
                {step.target && <span className="text-[#141414]/50 truncate">{step.target}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executed info */}
      {session.status === 'executed' && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[#141414]">
          {session.received && (
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-[#141414]/50 uppercase tracking-widest">Received</span>
              <span className="text-[#141414] font-bold">{session.received} {shortToken(session.destToken)}</span>
            </div>
          )}
          {session.txHash && (
            <a
              href={`https://suiscan.xyz/mainnet/tx/${session.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between text-[9px] font-mono group"
            >
              <span className="text-[#141414]/50 uppercase tracking-widest">Tx Hash</span>
              <span className="text-[#141414] group-hover:underline truncate max-w-[140px]">
                {session.txHash.slice(0, 8)}...{session.txHash.slice(-6)}
                <span className="material-symbols-outlined text-[10px] ml-0.5 align-middle">open_in_new</span>
              </span>
            </a>
          )}
        </div>
      )}
    </div>
  );
};
