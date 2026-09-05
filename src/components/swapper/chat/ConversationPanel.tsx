import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SystemMessage } from './SystemMessage';
import { UserMessage } from './UserMessage';
import { ConsoleHero } from '../ConsoleHero';
import { IntentParserCard } from './IntentParserCard';
import { RouteSummaryCard } from './RouteSummaryCard';
import { ExecutionFlowCard } from './ExecutionFlowCard';
import { SuccessCard } from './SuccessCard';
import { InputBar } from './InputBar';
import { TokenSuggestionCard } from './TokenSuggestionCard';
import { ErrorMessage } from './ErrorMessage';
import { AlternativeSourceCard } from './AlternativeSourceCard';
import { RiskReviewCard } from './RiskReviewCard';
import type { RiskCheck, PtbStep, RouteNode } from '../../../types/shared';

interface ConversationPanelProps {
  appState: 'idle' | 'processing' | 'done';
  processStep: number;
  executionState: 'idle' | 'signing' | 'executing' | 'success';
  intentInput: string;
  setIntentInput: (val: string) => void;
  submittedIntent: string;
  amount: string;
  sourceToken: string;
  destToken: string;
  estOutput: string;
  fee: string;
  ptbSteps: PtbStep[];
  txHash: string | null;
  handleSimulate: (e: React.FormEvent) => void;
  handleExecute: () => void;
  onBackToParse: () => void;
  onForwardToRoute: () => void;
  onForwardToFlow: () => void;
  tokenSuggestion?: any;
  onSelectToken?: (candidate: any) => void;
  selectedCoinType?: string | null;
  swapError?: string | null;
  sourceLogo?: string | null;
  destLogo?: string | null;
  alternativeSource?: any;
  onSelectAlternative?: (candidate: any) => void;
  received?: string | null;
  receivedToken?: string;
  receivedLogo?: string | null;
  guardianChecks?: RiskCheck[];
  isSafe?: boolean;
  isGuardianModalOpen?: boolean;
  setIsGuardianModalOpen?: (val: boolean) => void;
  onConfirmGuardian?: () => void;
  routeNodes?: RouteNode[];
  sourceAddress?: string;
  destAddress?: string;
  onResetAll?: () => void;
  walletAddress?: string | null;
  balanceText?: string;
  onSubmitText?: (text: string) => void;
  onOpenVault?: () => void;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  appState,
  processStep,
  executionState,
  intentInput,
  setIntentInput,
  submittedIntent,
  amount,
  sourceToken,
  destToken,
  estOutput,
  fee,
  ptbSteps,
  txHash,
  handleSimulate,
  handleExecute,
  onBackToParse,
  onForwardToRoute,
  onForwardToFlow,
  tokenSuggestion,
  onSelectToken,
  selectedCoinType,
  swapError,
  sourceLogo,
  destLogo,
  alternativeSource,
  onSelectAlternative,
  received,
  receivedToken,
  receivedLogo,
  guardianChecks,
  isSafe,
  routeNodes,
  sourceAddress,
  destAddress,
  onResetAll,
  walletAddress,
  balanceText,
  onSubmitText,
  onOpenVault
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [isAnimationDone, setIsAnimationDone] = useState(false);
  const animationStartTime = useRef<number>(0);
  const [riskReviewAcknowledged, setRiskReviewAcknowledged] = useState(false);

  useEffect(() => {
    if (appState === 'processing') {
      setShowHistory(false);
    }
  }, [appState]);

  // Reset acknowledgment and risk summary ref when user goes back to earlier steps
  useEffect(() => {
    if (processStep < 4) {
      setRiskReviewAcknowledged(false);
    }
    // When user starts a new swap (back to step 0), reset the fetch guard
    // so the next guardianChecks update triggers a fresh risk summary.
    if (processStep === 0) {
      riskSummaryFetchedRef.current = false;
    }
  }, [processStep]);

  useEffect(() => {
    if (executionState === 'executing') {
      setIsAnimationDone(false);
      animationStartTime.current = Date.now();
    } else if (executionState === 'success') {
      const elapsed = Date.now() - animationStartTime.current;
      const requiredTime = (ptbSteps?.length || 1) * 1500 + 500; // 1.5s per step + 0.5s padding
      if (elapsed < requiredTime) {
        const timeout = setTimeout(() => setIsAnimationDone(true), requiredTime - elapsed);
        return () => clearTimeout(timeout);
      } else {
        setIsAnimationDone(true);
      }
    } else if (executionState === 'idle') {
      setIsAnimationDone(false);
    }
  }, [executionState, ptbSteps?.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [appState, processStep, executionState, showHistory, swapError]);

  // Risk summary data — fetched once, shared by step 4 and showHistory
  interface RiskSummaryData {
    summary: string;
    detailedAnalysis: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    hasHighRisk: boolean;
    uiLabels?: {
      slippageLabel: string;
      slippageSubLabel: string;
      distributionLabel: string;
      distributionSubLabel: string;
      poolsLabel: string;
      poolsSubLabel: string;
      category: string;
    };
  }
  const [riskSummaryData, setRiskSummaryData] = useState<RiskSummaryData | null>(null);
  const [riskSummaryLoading, setRiskSummaryLoading] = useState(false);
  const [riskSummaryError, setRiskSummaryError] = useState<string | null>(null);
  const riskSummaryFetchedRef = useRef(false);

  // Derive a short risk message from the risk summary data.
  // Previously this was a separate LLM call to /api/risk-advice, wasting ~3-4s.
  const hasHighRiskChecks = guardianChecks?.some(c => ['WARNING', 'DANGER'].includes(c.status)) ?? false;
  const routeRiskMessage = hasHighRiskChecks && riskSummaryData?.summary
    ? `⚠️ ${riskSummaryData.summary}`
    : null;

  useEffect(() => {
    if (!guardianChecks || guardianChecks.length === 0) {
      riskSummaryFetchedRef.current = false;
      setRiskSummaryData(null);
      setRiskSummaryLoading(false);
      setRiskSummaryError(null);
      return;
    }
    if (riskSummaryFetchedRef.current) return;

    let cancelled = false;
    const MIN_DELAY_MS = 1500;

    const fetchRiskSummary = async () => {
      try {
        setRiskSummaryLoading(true);
        const started = Date.now();

        const res = await fetch('/api/risk-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceToken,
            destToken,
            amount,
            guardianChecks,
            routeNodes: routeNodes || [],
          }),
        });
        if (!res.ok) throw new Error('Failed to fetch risk summary');
        const result: RiskSummaryData = await res.json();

        const elapsed = Date.now() - started;
        if (elapsed < MIN_DELAY_MS) {
          await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
        }

        if (!cancelled) {
          setRiskSummaryData(result);
          riskSummaryFetchedRef.current = true;
        }
      } catch (err: any) {
        if (!cancelled) setRiskSummaryError(err.message || 'Unable to load risk summary');
      } finally {
        if (!cancelled) setRiskSummaryLoading(false);
      }
    };
    fetchRiskSummary();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardianChecks]);

  // Note: The old /api/risk-advice useEffect was removed (Bug #3 fix).
  // routeRiskMessage is now derived from riskSummaryData.summary above,
  // eliminating a duplicate LLM call that added ~3-4s latency.

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 relative mx-auto w-full">
      {/* playful deep backdrop — dotted paper + color blobs + floating shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute inset-0 toon-dots opacity-40" />
        <div
          className="absolute -top-20 -left-24 w-80 h-80 rounded-full float-slow"
          style={{ background: 'radial-gradient(closest-side, rgba(255,144,232,0.18), transparent)' }}
        />
        <div
          className="absolute top-1/3 -right-28 w-96 h-96 rounded-full float-slower"
          style={{ background: 'radial-gradient(closest-side, rgba(125,220,255,0.20), transparent)' }}
        />
        <div
          className="absolute -bottom-24 left-1/4 w-[28rem] h-72 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(204, 255, 0, 0.20), transparent)' }}
        />
        <div
          className="absolute top-[16%] right-[8%] w-10 h-10 float-slow hidden sm:block"
          style={{ border: '3px solid rgba(20,20,20,0.12)', borderRadius: 12, transform: 'rotate(14deg)' }}
        />
        <div
          className="absolute bottom-[24%] left-[4%] w-7 h-7 rounded-full float-slower hidden sm:block"
          style={{ border: '3px solid rgba(20,20,20,0.10)' }}
        />
        <span
          className="absolute top-[8%] left-[10%] font-black text-[22px] doodle-twinkle hidden md:inline-block"
          style={{ color: 'rgba(20,20,20,0.12)' }}
        >
          +
        </span>
        <span
          className="absolute bottom-[12%] right-[12%] font-black text-[26px] doodle-twinkle hidden md:inline-block"
          style={{ color: 'rgba(20,20,20,0.10)', animationDelay: '1.3s' }}
        >
          ★
        </span>
      </div>
      {/* Scrollable Conversation Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative z-10 pb-[110px] pt-4 px-3 md:px-6"
      >
        {/* single centered chat column — like a messenger thread */}
        <div className="w-full max-w-[720px] mx-auto flex flex-col items-stretch">
        {appState === 'idle' && !tokenSuggestion && onSubmitText && onOpenVault ? (
          <ConsoleHero
            walletAddress={walletAddress ?? null}
            balanceText={balanceText ?? '0.00'}
            balanceSymbol={sourceToken}
            intentInput={intentInput}
            setIntentInput={setIntentInput}
            onSubmitText={onSubmitText}
            isBusy={executionState === 'executing' || executionState === 'signing'}
            onOpenVault={onOpenVault}
          />
        ) : (
          <>
            <SystemMessage
              text={
                <>
                  Hiya!! I'm <span className="font-black bg-[#CCFF00] px-1.5 py-0.5 rounded-lg border-2 border-[#141414]">BUDDY</span> ⚡<br />
                  Tell me your dream swap in plain words and I'll sniff out the safest route!
                </>
              }
            />
          </>
        )}

        {appState === 'idle' && tokenSuggestion && (
          <>
            <UserMessage text={submittedIntent || intentInput} />
            <TokenSuggestionCard
              tokenSuggestion={tokenSuggestion}
              onSelectToken={onSelectToken}
              selectedCoinType={selectedCoinType}
            />
          </>
        )}

        {appState !== 'idle' && (
          <>
            <UserMessage text={submittedIntent} />

            {/* Keep the token picker visible after a pick so a wrong choice can
                be switched without retyping. */}
            {tokenSuggestion && (
              <TokenSuggestionCard
                tokenSuggestion={tokenSuggestion}
                onSelectToken={onSelectToken}
                selectedCoinType={selectedCoinType}
              />
            )}

            {alternativeSource && (
              <AlternativeSourceCard
                alternativeSource={alternativeSource}
                onSelect={onSelectAlternative}
              />
            )}

            {/* Step 2.5: Thinking Indicator */}
            {appState === 'processing' && processStep === 0 && (
              <SystemMessage
                text={
                  <div className="flex items-center gap-1.5 h-5">
                    <motion.div
                      className="w-2 h-2 bg-[#CCFF00]"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-[#CCFF00]"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-[#CCFF00]"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                    <span className="ml-2 text-[12px] text-[#141414]/60 font-bold font-mono">sniffing pools…</span>
                  </div>
                }
              />
            )}

            {/* Step 3: Parsing */}
            {processStep === 1 && !showHistory && (
              <IntentParserCard
                action="Swap"
                amount={amount}
                sourceToken={sourceToken}
                destToken={destToken}
                sourceLogo={sourceLogo}
                destLogo={destLogo}
                showNext={parseFloat(estOutput) > 0}
                onNext={onForwardToRoute}
              />
            )}

            {/* Step 4: Route Summary & Plan */}
            {processStep === 3 && executionState === 'idle' && !showHistory && (
              <div className="flex flex-col w-full max-w-[600px] mb-4">
                <RouteSummaryCard
                  amount={amount}
                  sourceToken={sourceToken}
                  destToken={destToken}
                  estOutput={estOutput}
                  fee={fee}
                  isSafe={isSafe || false}
                  guardianChecks={guardianChecks || []}
                  routeNodes={routeNodes || []}
                  sourceAddress={sourceAddress}
                  destAddress={destAddress}
                  sourceLogo={sourceLogo}
                  destLogo={destLogo}
                  uiLabels={riskSummaryData?.uiLabels}
                  isLoading={riskSummaryLoading}
                  onConfirm={() => { }}
                  onBack={() => { }}
                />

                {riskSummaryLoading && (
                  <div className="mt-1.5 mb-1.5 w-full">
                    <SystemMessage text={
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#2E7D00] animate-spin">sync</span>
                        <span className="text-[#141414]/60 text-[13px] font-bold animate-pulse">Buddy is safety-checking… 🛡️</span>
                      </div>
                    } />
                  </div>
                )}

                {!riskSummaryLoading && routeRiskMessage && (
                  <div className="mt-1.5 mb-1.5 w-full">
                    <SystemMessage text={routeRiskMessage} />
                  </div>
                )}

                <div className="flex justify-between items-center mt-3 self-center w-full max-w-[520px] px-1">
                  <button
                    onClick={onBackToParse}
                    className="px-6 py-2.5 rounded-full bg-[#141414]/5 hover:bg-[#141414]/5 text-[#141414]/70 hover:text-[#141414] font-medium text-[14px] transition-all border border-[#141414]/15"
                  >
                    Back
                  </button>
                  <button
                    onClick={onForwardToFlow}
                    className="px-6 py-2.5 rounded-full text-[#04070a] font-bold text-[14px] transition-all bg-[#CCFF00] hover:brightness-110 border border-[rgba(204, 255, 0, 0.7)]"
                    style={{
                      borderRadius: '999px',
                      background: '#CCFF00',
                      boxShadow: '4px 4px 0 rgba(204, 255, 0, 0.4)'
                    }}
                  >
                    View Flow
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Execution Flow Preview */}
            {processStep === 4 && executionState === 'idle' && !showHistory && (
              <div className="flex flex-col w-full max-w-[600px] mb-4">
                <ExecutionFlowCard ptbSteps={ptbSteps} />

                {guardianChecks && guardianChecks.length > 0 && (
                  <RiskReviewCard
                    guardianChecks={guardianChecks}
                    data={riskSummaryData}
                    loading={riskSummaryLoading}
                    error={riskSummaryError}
                    onAcknowledge={setRiskReviewAcknowledged}
                  />
                )}

                <div className="flex justify-between items-center mt-3 self-center w-full max-w-[520px] px-1">
                  <button
                    onClick={onBackToParse}
                    className="px-6 py-2.5 rounded-full bg-[#141414]/5 hover:bg-[#141414]/5 text-[#141414]/70 hover:text-[#141414] font-medium text-[14px] transition-all border border-[#141414]/15"
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowHistory(true)}
                      className="px-6 py-2.5 rounded-full bg-[#141414]/5 hover:bg-[#141414]/5 text-[#141414]/70 hover:text-[#141414] font-medium text-[14px] transition-all border border-[#141414]/15"
                    >
                      View All
                    </button>
                    <button
                      onClick={handleExecute}
                      disabled={!riskReviewAcknowledged}
                      className={`px-6 py-2.5 text-[#060800] font-mono font-extrabold uppercase tracking-[0.12em] text-[12px] transition-all duration-150 border-2 border-[#141414] ${riskReviewAcknowledged
                        ? 'hover:opacity-90'
                        : 'opacity-30 cursor-not-allowed'
                        }`}
                      style={{
                        borderRadius: '999px',
                        background: '#CCFF00',
                        boxShadow: riskReviewAcknowledged ? '0 0 24px 0 rgba(204, 255, 0, 0.44)' : 'none'
                      }}
                    >
                      Confirm & Execute
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Show All History Mode */}
            {showHistory && (
              <div className="flex flex-col w-full max-w-[600px] mb-4 gap-6">
                <IntentParserCard
                  action="Swap"
                  amount={amount}
                  sourceToken={sourceToken}
                  destToken={destToken}
                  sourceLogo={sourceLogo}
                  destLogo={destLogo}
                  showNext={false}
                  onNext={() => { }}
                />

                <RouteSummaryCard
                  amount={amount}
                  sourceToken={sourceToken}
                  destToken={destToken}
                  estOutput={estOutput}
                  fee={fee}
                  isSafe={isSafe || false}
                  guardianChecks={guardianChecks || []}
                  routeNodes={routeNodes || []}
                  sourceAddress={sourceAddress}
                  destAddress={destAddress}
                  sourceLogo={sourceLogo}
                  destLogo={destLogo}
                  uiLabels={riskSummaryData?.uiLabels}
                  isLoading={riskSummaryLoading}
                  onConfirm={() => { }}
                  onBack={() => { }}
                />


                {!riskSummaryLoading && routeRiskMessage && (
                  <div className="mt-1.5 mb-1.5 w-full">
                    <SystemMessage text={routeRiskMessage} />
                  </div>
                )}

                <ExecutionFlowCard ptbSteps={ptbSteps} />

                {guardianChecks && guardianChecks.length > 0 && (
                  <RiskReviewCard
                    guardianChecks={guardianChecks}
                    data={riskSummaryData}
                    loading={riskSummaryLoading}
                    error={riskSummaryError}
                    onAcknowledge={setRiskReviewAcknowledged}
                  />
                )}

                {executionState === 'idle' && (
                <div className="flex justify-between items-center mt-3 self-center w-full max-w-[520px] px-1">
                    <button
                      onClick={() => setShowHistory(false)}
                      className="px-6 py-2.5 rounded-full bg-[#141414]/5 hover:bg-[#141414]/5 text-[#141414]/70 hover:text-[#141414] font-medium text-[14px] transition-all border border-[#141414]/15"
                    >
                      Collapse All
                    </button>
                    <button
                      onClick={handleExecute}
                      disabled={!riskReviewAcknowledged}
                      className={`px-6 py-2.5 text-[#060800] font-mono font-extrabold uppercase tracking-[0.12em] text-[12px] transition-all duration-150 border-2 border-[#141414] ${riskReviewAcknowledged
                        ? 'hover:opacity-90'
                        : 'opacity-30 cursor-not-allowed'
                        }`}
                      style={{
                        borderRadius: '999px',
                        background: '#CCFF00',
                        boxShadow: riskReviewAcknowledged ? '0 0 24px 0 rgba(204, 255, 0, 0.44)' : 'none'
                      }}
                    >
                      Confirm & Execute
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Execution */}
            {((executionState === 'signing' || executionState === 'executing') || (executionState === 'success' && !isAnimationDone)) && (
              <ExecutionFlowCard ptbSteps={ptbSteps} isExecuting={executionState === 'executing' || (executionState === 'success' && !isAnimationDone)} isSigning={executionState === 'signing'} />
            )}

            {/* Step 7: Success */}
            {executionState === 'success' && isAnimationDone && (
              <SuccessCard
                txHash={txHash}
                amount={amount}
                sourceToken={sourceToken}
                destToken={destToken}
                ptbSteps={ptbSteps}
                onShowAll={() => setShowHistory(!showHistory)}
                isExpanded={showHistory}
                received={received}
                receivedToken={receivedToken}
                receivedLogo={receivedLogo}
              />
            )}
          </>
        )}

        {swapError && <ErrorMessage text={swapError} />}
        </div>
      </div>

      {/* Input Bar pinned to bottom — hidden on the hero since it has its own big prompt box */}
      {!(appState === 'idle' && !tokenSuggestion) && (
        <div className="absolute bottom-4 left-0 right-0 px-2 z-20">
          <div className="max-w-[720px] mx-auto">
            <InputBar
              intentInput={intentInput}
              setIntentInput={setIntentInput}
              appState={appState}
              executionState={executionState}
              handleSimulate={handleSimulate}
              onReset={onResetAll}
            />
          </div>
        </div>
      )}
    </div>
  );
};
