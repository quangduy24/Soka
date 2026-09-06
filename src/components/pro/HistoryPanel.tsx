import React from 'react';
import {
  ChevronDown, ChevronUp, ArrowRight, ExternalLink, ShieldCheck, AlertTriangle,
  XCircle, CheckCircle2, Droplets, Layers, ArrowDownCircle, ArrowUpCircle, Activity, Trash2, History as HistoryIcon, Gauge, X
} from 'lucide-react';
import SokaCharacter from './SokaCharacter';
import type { SwapSnapshot, RiskCheck, PtbStep, RouteNode } from '../../types/shared';
import { suiscanUrl, shortenRef, timeAgo } from '../../utils/explorer';

interface HistoryPanelProps {
  history: SwapSnapshot[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onRerun: (snap: SwapSnapshot) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/* ── tiny helpers ─────────────────────────────────────────────── */

const PairBadge: React.FC<{ a?: string; b?: string }> = ({ a = 'SUI', b = 'USDC' }) => {
  const short = (s: string) => {
    const tail = s.split('::').pop() || s;
    return tail.length > 6 ? tail.slice(0, 3).toUpperCase() : tail.toUpperCase();
  };
  return (
    <div className="flex items-center shrink-0">
      <span className="w-7 h-7 rounded-full bg-[#F05391]/20 border border-[#F05391]/30 flex items-center justify-center font-black text-[9px] text-[#F05391]">{short(a)}</span>
      <span className="-ml-1.5 w-7 h-7 rounded-full bg-[#BE8CC2]/20 border border-[#BE8CC2]/30 flex items-center justify-center font-black text-[9px] text-[#BE8CC2]">{short(b)}</span>
    </div>
  );
};

const StatusBadge: React.FC<{ status: SwapSnapshot['status'] }> = ({ status }) => {
  if (status === 'CONFIRMED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/25 text-[#10b981] font-mono text-[9px] font-bold shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> CONFIRMED
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#ef4444] font-mono text-[9px] font-bold shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> FAILED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F05391]/10 border border-[#F05391]/25 text-[#F05391] font-mono text-[9px] font-bold shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-[#F05391]" /> SIMULATED
    </span>
  );
};

const statusTone = (status: string) => {
  switch (status) {
    case 'DANGER': return { txt: 'text-[#ef4444]', chip: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/25' };
    case 'WARNING': return { txt: 'text-[#f59e0b]', chip: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/25' };
    default: return { txt: 'text-[#10b981]', chip: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/25' };
  }
};
const statusIcon = (status: string) => {
  switch (status) {
    case 'DANGER': return <XCircle className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />;
    case 'WARNING': return <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />;
    default: return <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />;
  }
};

const Metric: React.FC<{ label: string; value?: string | number; unit?: string; accent?: boolean }> = ({ label, value, unit, accent }) => (
  <div className="metric text-left">
    <div className="text-[8px] font-mono font-bold tracking-wider text-[#0f172a]/30 uppercase truncate">{label}</div>
    <div className="mt-1 flex items-baseline gap-1 min-w-0">
      <span className={`font-mono text-[15px] font-black truncate ${accent ? 'text-[#F05391]' : 'text-[#0f172a]'}`}>
        {value !== undefined && value !== null && value !== '' ? value : '—'}
      </span>
      {unit && <span className="font-mono text-[10px] font-bold text-[#0f172a]/40 shrink-0">{unit}</span>}
    </div>
  </div>
);

const GuardianRow: React.FC<{ chk: RiskCheck }> = ({ chk }) => {
  const tone = statusTone(chk.status);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/30 bg-white/20 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {statusIcon(chk.status)}
        <span className="font-mono text-[11px] font-bold text-[#0f172a]/80 truncate">{chk.name}</span>
      </div>
      <span className={`shrink-0 rounded-lg border px-1.5 py-0.5 font-mono text-[9px] font-bold ${tone.chip}`}>
        {chk.status}
      </span>
    </div>
  );
};

const RouteRow: React.FC<{ node: RouteNode; idx: number }> = ({ node, idx }) => (
  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/30 bg-white/20 px-3 py-2">
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F05391]/15 border border-[#F05391]/25 font-mono text-[9px] font-bold text-[#F05391]">{idx + 1}</span>
      <Droplets className="h-3.5 w-3.5 shrink-0 text-[#BE8CC2]" />
      <span className="font-mono text-[11px] font-bold text-[#0f172a]/80 truncate">{(node.dex || 'Cetus CLMM') + ' Pool'}</span>
    </div>
    <div className="flex shrink-0 items-center gap-2.5 font-mono text-[10px] text-[#0f172a]/50">
      {node.poolAddress && (
        <a href={suiscanUrl({ type: 'object', value: node.poolAddress, label: 'pool' })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[#F05391] hover:underline" title={node.poolAddress}>
          {shortenRef(node.poolAddress)} <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      <span className="font-bold text-[#0f172a]">{node.ratio ?? 100}%</span>
      <span className="text-[#0f172a]/40">fee {node.fee ?? 0.01}%</span>
    </div>
  </div>
);

const PtbRow: React.FC<{ step: PtbStep; idx: number }> = ({ step, idx }) => {
  const isCoinOp = /split|merge|coin/i.test(step.command);
  const isCall = /movecall|::/i.test(step.command);
  const isTransfer = /transfer/i.test(step.command);
  const Icon = isTransfer ? ArrowUpCircle : isCoinOp ? ArrowDownCircle : isCall ? Layers : Activity;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/30 bg-white/20 px-3 py-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F05391]/15 border border-[#F05391]/25 font-mono text-[9px] font-bold text-[#F05391]">{idx + 1}</span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#BE8CC2]" />
      <span className="font-mono text-[11px] font-bold text-[#0f172a]/80 capitalize">{step.command || 'Step'}</span>
      <span className="truncate font-mono text-[10px] text-[#0f172a]/40">{step.description || step.target}</span>
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-[#0f172a]/40">
    {icon}
    <span>{title}</span>
    {right && <span className="ml-auto normal-case tracking-normal">{right}</span>}
  </div>
);

/* ── single task card ─────────────────────────────────────────── */

const TaskCard: React.FC<{ snap: SwapSnapshot; expanded: boolean; onToggle: () => void; onRerun: () => void; onDelete: () => void }> = ({ snap, expanded, onToggle, onRerun, onDelete }) => {
  const source = snap.sourceSymbol || 'SUI';
  const dest = snap.destSymbol || 'USDC';
  const amountStr = snap.amount ? String(snap.amount) : '';
  const outStr = snap.expectedOutput ? String(snap.expectedOutput) : '';
  const slipStr = snap.slippage ? String(snap.slippage).replace('%', '') : '';
  const gasMatch = snap.gasEstimate ? String(snap.gasEstimate).match(/([\d.]+)\s*SUI/i) : null;
  const gasNum = gasMatch ? gasMatch[1] : snap.gasEstimate ? String(snap.gasEstimate) : '';

  const worst = snap.checks.some(c => c.status === 'DANGER') ? 'DANGER' : snap.checks.some(c => c.status === 'WARNING') ? 'WARNING' : null;
  const worstTone = worst ? statusTone(worst) : null;

  const GUARDIAN_CATEGORIES = [
    { name: 'Price Impact', match: /price impact/i },
    { name: 'Liquidity Risk', match: /liquidity risk/i },
    { name: 'DEX Verification', match: /dex verification|dex creator|verification/i },
    { name: 'Liquidity Health', match: /liquidity health|pool safety|pool age|stale|pool activity/i },
  ] as const;
  const guardianRows = GUARDIAN_CATEGORIES.map(cat => {
    const found = snap.checks.find(c => cat.match.test(c.name));
    return { label: cat.name, check: found ?? null };
  });
  const extraChecks = snap.checks.filter(c => !GUARDIAN_CATEGORIES.some(cat => cat.match.test(c.name)));

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/30 bg-white/20 backdrop-blur-sm transition-all ${expanded ? '' : 'hover:bg-white/30'}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <PairBadge a={source} b={dest} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-[13px] text-[#0f172a] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {amountStr ? `${amountStr} ${source} → ${dest}` : `${source} → ${dest}`}
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-[#0f172a]/40">
            {timeAgo(snap.createdAt)}
            {snap.txDigest ? ` · ${shortenRef(snap.txDigest)}` : ''}
          </div>
        </div>
        <StatusBadge status={snap.status} />
        {worst && worstTone && (
          <span className={`hidden sm:inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 font-mono text-[8px] font-bold ${worstTone.chip}`}>
            <AlertTriangle className="h-2.5 w-2.5" /> {worst}
          </span>
        )}
        <button onClick={onDelete} title="Delete this task" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/20 text-[#ef4444] transition-colors hover:bg-[#ef4444]/15">
          <X className="h-4 w-4" />
        </button>
        <button onClick={onToggle} title={expanded ? 'Collapse' : 'Expand details'} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 bg-[#F05391]/15 text-[#F05391] transition-colors hover:bg-[#F05391]/25">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3.5 border-t border-white/20 bg-white/10 px-3 py-3.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Amount" value={amountStr} unit={source} />
            <Metric label="Est. Output" value={outStr} unit={dest} accent />
            <Metric label="Slippage" value={slipStr} unit="%" />
            <Metric label="Gas" value={gasNum} unit="SUI" />
          </div>

          {snap.txDigest && (
            <a href={`https://suiscan.xyz/mainnet/tx/${snap.txDigest}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start rounded-xl border border-white/30 bg-white/20 px-2.5 py-1.5 font-mono text-[10px] font-bold text-[#0f172a] hover:bg-white/30">
              <ExternalLink className="h-3 w-3" /> View transaction {shortenRef(snap.txDigest)}
            </a>
          )}

          <div className="flex flex-col gap-1.5">
            <SectionTitle icon={<ShieldCheck className="h-3.5 w-3.5 text-[#10b981]" />} title="Guardian Checks" right={typeof snap.guardianScore === 'number' ? <span className="font-mono text-[10px] font-bold text-[#0f172a]/60">Score {snap.guardianScore}/100 · {snap.guardianRiskLevel || '—'}</span> : undefined} />
            {guardianRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/10 px-3 py-2.5 font-mono text-[10px] text-[#0f172a]/40">No guardian checks recorded for this swap.</div>
            ) : (
              <>
                {guardianRows.map((g) => (
                  g.check ? <GuardianRow key={g.label} chk={g.check} /> : (
                    <div key={g.label} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-white/20 bg-white/10 px-3 py-2 opacity-70">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-white/30" />
                        <span className="font-mono text-[11px] font-bold text-[#0f172a]/50 truncate">{g.label}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[9px] font-bold text-[#0f172a]/30">—</span>
                    </div>
                  )
                ))}
                {extraChecks.length > 0 && (
                  <div className="mt-0.5 flex flex-col gap-1.5 border-t border-dashed border-white/15 pt-1.5">
                    {extraChecks.map((chk, i) => <GuardianRow key={i} chk={chk} />)}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <SectionTitle icon={<Layers className="h-3.5 w-3.5 text-[#BE8CC2]" />} title="Route" />
            {snap.routeNodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/10 px-3 py-2.5 font-mono text-[10px] text-[#0f172a]/40">Route not recorded.</div>
            ) : snap.routeNodes.map((n, i) => <RouteRow key={i} node={n} idx={i} />)}
          </div>

          <div className="flex flex-col gap-1.5">
            <SectionTitle icon={<Activity className="h-3.5 w-3.5 text-[#BE8CC2]" />} title="PTB Steps" />
            {snap.ptbSteps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/10 px-3 py-2.5 font-mono text-[10px] text-[#0f172a]/40">PTB steps not recorded.</div>
            ) : snap.ptbSteps.map((s, i) => <PtbRow key={i} step={s} idx={i} />)}
          </div>

          <button onClick={onRerun} className="self-end inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-[#F05391]/15 px-3 py-1.5 font-mono text-[11px] font-bold text-[#F05391] transition-all hover:bg-[#F05391]/25">
            Run again <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

/* ── panel ────────────────────────────────────────────────────── */

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, expandedId, onToggle, onRerun, onDelete, onClear, onClose }) => {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-[#0f172a]/30 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(88vh,780px)] w-full max-w-[720px] flex-col overflow-hidden glass-strong">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/20 bg-white/20 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-[#F05391]" />
            <span className="font-bold text-[15px] text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>SOKA History</span>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button onClick={onClear} title="Clear history" className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/20 px-2.5 py-1 font-mono text-[10px] font-bold text-[#ef4444] transition-colors hover:bg-[#ef4444]/15">
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
            <button onClick={onClose} title="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/20 font-bold text-[#0f172a] transition-colors hover:bg-white/40">
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-white/10 p-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <SokaCharacter size={84} />
              <div className="font-bold text-[16px] text-[#0f172a]/60" style={{ fontFamily: 'var(--font-display)' }}>No swaps yet</div>
              <p className="font-mono text-[11px] text-[#0f172a]/40">Go ask SOKA for a swap — it will show up here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#0f172a]/35">
                <Gauge className="h-3 w-3" /> {history.length} task{history.length === 1 ? '' : 's'} · tap to expand
              </div>
              {history.map((h) => (
                <TaskCard key={h.id} snap={h} expanded={expandedId === h.id} onToggle={() => onToggle(h.id)} onRerun={() => onRerun(h)} onDelete={() => onDelete(h.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
