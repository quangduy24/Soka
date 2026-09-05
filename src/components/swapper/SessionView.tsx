import React from 'react';
import { Link } from 'react-router-dom';
import type { SwapSession } from '../../hooks/useSwapHistory';
import { HistoryDetail } from './history/HistoryDetail';

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const shortTok = (raw: string) =>
  raw?.includes('::') ? raw.split('::').pop() || raw : raw || '?';

export function sessionTitle(s: SwapSession): string {
  return `${shortTok(s.sourceToken)} → ${shortTok(s.destToken)}`;
}

interface SessionViewProps {
  session: SwapSession;
  onBack: () => void;
  onNewChat: () => void;
}

const STATUS_CHIP: Record<string, string> = {
  executed: '★ SWAPPED!',
  failed: '✖ FAILED',
  simulated: '○ SIMULATED',
};

/** Read-only replay of a past swap, shown in the main pane like an old chat. */
export const SessionView: React.FC<SessionViewProps> = ({ session, onBack, onNewChat }) => (
  <div className="w-full max-w-[640px] mx-auto flex flex-col gap-3 px-2 pt-4 pb-8">
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="toon-chip hover:!bg-[#CCFF00] transition-colors" title="Back to Buddy">
        ← BUDDY
      </button>
      <span className="toon-chip toon-chip-sunny">★ OLD CHAT REPLAY</span>
    </div>

    {/* original intent as a user bubble */}
    <div className="flex flex-col items-end ml-auto max-w-[88%]">
      <div className="chat-bubble-user px-4 py-3 text-[14px] font-bold">{session.intent}</div>
      <span className="font-mono text-[9px] font-bold text-[#141414]/45 mt-1 mr-1">
        {timeAgo(session.timestamp)} AGO
      </span>
    </div>

    {/* buddy's saved answer */}
    <div className="toon-card p-5" style={{ background: '#fffaf0' }}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className="w-11 h-11 rounded-full border-[2.5px] border-[#141414] flex items-center justify-center font-black text-[16px] shrink-0"
          style={{ background: '#FFC900' }}
        >
          {(session.destToken.includes('::') ? session.destToken.split('::').pop() || '?' : session.destToken).slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="font-black text-[18px] leading-tight" style={{ fontFamily: '"Bungee", sans-serif' }}>
            {sessionTitle(session)}
          </div>
          <div className="font-mono text-[10px] font-bold text-[#141414]/50">
            {new Date(session.timestamp).toLocaleString()}
          </div>
        </div>
        <span
          className="ml-auto font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border-2 border-[#141414]"
          style={{ background: session.status === 'executed' ? '#CCFF00' : session.status === 'failed' ? '#ff6b6b' : '#fff', color: session.status === 'failed' ? '#fff' : '#141414' }}
        >
          {STATUS_CHIP[session.status] ?? session.status.toUpperCase()}
        </span>
      </div>

      <div className="mt-3 rounded-2xl border-[2.5px] border-[#141414] bg-white p-3">
        <HistoryDetail session={session} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onNewChat} className="toon-btn !py-2.5 !px-5 text-[14px]">
          → NEW CHAT WITH BUDDY
        </button>
        <Link to="/activity" className="toon-chip toon-chip-pink !py-2.5 self-center">
          ♥ STICKER BOOK
        </Link>
      </div>
    </div>
  </div>
);
