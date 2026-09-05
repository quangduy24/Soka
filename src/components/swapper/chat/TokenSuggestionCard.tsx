import React from 'react';
import { motion } from 'framer-motion';
const TokenAvatar: React.FC<{ symbol: string; logoUrl?: string }> = ({ symbol, logoUrl }) => {
  const [failed, setFailed] = React.useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        onError={() => setFailed(true)}
        className="w-7 h-7 rounded-full bg-[#CCFF00]/5 object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#7AA500]/20 to-[#CCFF00]/20 border border-[#141414] flex items-center justify-center font-bold text-[10px] text-[#141414]/70">
      {symbol.substring(0, 2).toUpperCase()}
    </div>
  );
};
import { shortContract } from '../../../constants';

interface TokenSuggestionCardProps {
  tokenSuggestion: any;
  selectedCoinType?: string | null;
  onSelectToken?: (candidate: any) => void;
}

export const TokenSuggestionCard: React.FC<TokenSuggestionCardProps> = ({
  tokenSuggestion,
  selectedCoinType,
  onSelectToken
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (!tokenSuggestion || !tokenSuggestion.candidates) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col w-full max-w-[600px] mb-4 gap-2"
    >
      <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] text-[#141414] uppercase tracking-wider font-bold">
        <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
        Token Match Assistant
      </div>
      <div className="bg-[#CCFF00]/5 border-2 border-[#141414] rounded-2xl p-4 w-full h-[400px] overflow-y-auto custom-scrollbar shadow-[6px_6px_0_#141414] relative">
        <p className="font-body text-[#f1f5f9] leading-relaxed text-[13px] mb-4">
          {tokenSuggestion.message}
        </p>
        <div className="flex flex-col gap-2">
          {tokenSuggestion.candidates.map((c: any, i: number) => {
            const isSelected = !!selectedCoinType && c.coinType === selectedCoinType;
            const isSafe = c.isSafe !== undefined ? c.isSafe : c.verified;
            const issues = c.safetyChecks?.filter((chk: any) => chk.status === 'WARNING' || chk.status === 'DANGER') || [];
            const isExpanded = expandedId === c.coinType;

            return (
              <div
                key={c.coinType || i}
                className={`relative overflow-hidden flex flex-col rounded-[12px] border transition-all duration-200 ${isSelected
                    ? 'bg-[#CCFF00]/20 border-[#141414] ring-1 ring-inset ring-[#CCFF00]/30'
                    : isSafe
                      ? 'bg-[#CCFF00]/12 border-[#141414] ring-1 ring-inset ring-[#CCFF00]/25 shadow-[0_0_14px_rgba(204, 255, 0, 0.12)] hover:bg-[#CCFF00]/20'
                      : 'bg-[#CCFF00]/5 border-[#141414] hover:bg-[#CCFF00]/10 hover:border-[#141414]'
                  }`}
              >
                {/* Main Card Header / Button */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectToken?.(c)}
                  className="w-full text-left pl-4 pr-3 py-2.5 flex items-center gap-2.5 cursor-pointer"
                >
                  {isSafe && !isSelected && (
                    <span className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#E4FF70] to-[#CCFF00]"></span>
                  )}
                  <div className="w-5 h-5 rounded-md bg-[#CCFF00]/10 flex items-center justify-center text-[#141414] font-mono text-[10px] font-bold shrink-0 border border-[#141414]">
                    {i + 1}
                  </div>
                  <TokenAvatar symbol={c.symbol} logoUrl={c.logoUrl} />
                  <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <span className="text-[#141414] font-bold text-[12px] flex items-center gap-1.5 flex-wrap">
                      {c.symbol}
                      {c.name && c.name !== c.symbol && (
                        <span className="text-[#94a3b8] font-normal truncate">· {c.name}</span>
                      )}
                    </span>
                    <span className="text-[#64748b] font-mono text-[10px]">{shortContract(c.coinType)}</span>
                    <div className="mt-1 flex">
                      {isSafe ? (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#141414] bg-[#CCFF00]/20 border border-[#141414] px-2 py-0.5 rounded-full font-mono font-bold">
                          <span className="material-symbols-outlined text-[11px]">verified</span>
                          Verified
                        </span>
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : c.coinType);
                          }}
                          className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#fb923c] bg-[#ea580c]/20 border border-[#ea580c]/40 px-2 py-0.5 rounded-full font-mono font-bold cursor-pointer hover:bg-[#ea580c]/40 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[11px]">warning</span>
                          Warning with {issues.length} issue(s)
                          <span className="material-symbols-outlined text-[11px] ml-1">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </span>
                      )}
                    </div>
                  </span>
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isSelected ? 'text-[#2E7D00]' : isSafe ? 'text-[#141414]' : 'text-[#141414]/20'}`}>
                    {isSelected ? 'check_circle' : 'arrow_forward'}
                  </span>
                </div>

                {/* Expanded Warnings Section */}
                {isExpanded && !isSafe && (
                  <div className="px-4 pb-3 pt-1 flex flex-col gap-2 border-t border-[#141414] bg-black/20">
                    <div className="flex flex-col gap-3 mt-2">
                      {Object.entries(
                        issues.reduce((acc: any, issue: any) => {
                          const cat = issue.category || 'OTHER RISKS';
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(issue);
                          return acc;
                        }, {})
                      ).map(([category, catIssues]: [string, any], groupIdx) => {
                        const hasDanger = catIssues.some((i: any) => i.status === 'DANGER');
                        const hasWarning = catIssues.some((i: any) => i.status === 'WARNING');
                        const headerClass = hasDanger || hasWarning
                          ? 'text-pulse-purple'
                          : 'text-[#141414]/65';

                        return (
                          <div key={groupIdx} className="flex flex-col gap-1 mb-3 mt-1">
                            <div className={`text-[11px] font-bold uppercase tracking-wider w-full ${headerClass}`}>
                              {category}
                            </div>
                            <div className="flex flex-col relative pl-4 mt-1">
                              {/* Vertical connecting line */}
                              <div className="absolute left-[5px] top-0 bottom-3 w-[1px] bg-[#CCFF00]/30" />

                              {catIssues.map((issue: any, idx: number) => (
                                <div key={idx} className="flex gap-2 text-[11px] text-[#cbd5e1] font-body leading-relaxed relative mb-2 last:mb-0">
                                  {/* Horizontal connecting branch */}
                                  <div className="absolute -left-[11px] top-[7px] w-2 h-[1px] bg-[#CCFF00]/30" />

                                  <span className={`font-mono text-[10px] uppercase font-bold shrink-0 ${issue.status === 'DANGER' ? 'text-red-400' : 'text-orange-400'}`}>
                                    [{issue.status}]
                                  </span>
                                  <span><strong className="text-[#141414]/90">{issue.name}:</strong> {issue.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectToken?.(c);
                      }}
                      className="mt-3 w-full py-2 bg-gradient-to-r from-[#ea580c]/10 to-[#dc2626]/10 border border-[#ea580c]/30 hover:border-[#ea580c]/60 rounded-lg text-[#fb923c] font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <span>Select & Check Router / PTB</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="font-body text-[10px] text-[#94a3b8] leading-relaxed mt-3">
          {selectedCoinType
            ? 'Picked the wrong token? Tap another one above to switch — no need to retype.'
            : 'Pick the token you want. Always review unverified contracts before routing.'}
        </p>
      </div>
    </motion.div>
  );
};
