import React, { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Send, Link2, CheckCircle2, Copy, ExternalLink, Loader2, QrCode } from 'lucide-react';
import { mezoApi, MezoTransaction } from '../../services/mezoApi';
import { mockTokens, mockContacts, formatAmount, formatUsd, shortenAddress, formatTime } from '../../services/mockData';

type ActionType = 'deposit' | 'withdraw' | 'send' | 'claim_link';

interface MezoActionWidgetProps {
  action: ActionType;
  onClose: () => void;
  onSuccess: (tx: MezoTransaction) => void;
}

export const MezoActionWidget: React.FC<MezoActionWidgetProps> = ({ action, onClose, onSuccess }) => {
  const [step, setStep] = useState<'form' | 'confirm' | 'processing' | 'success'>('form');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('SUI');
  const [recipient, setRecipient] = useState('');
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [tx, setTx] = useState<MezoTransaction | null>(null);
  const [copied, setCopied] = useState(false);

  const actionConfig = {
    deposit: { icon: <ArrowDownCircle className="w-5 h-5" />, title: 'Deposit', color: '#10b981', placeholder: '0.00', description: 'Deposit tokens to your Mezo account' },
    withdraw: { icon: <ArrowUpCircle className="w-5 h-5" />, title: 'Withdraw', color: '#F05391', placeholder: '0.00', description: 'Withdraw tokens to your wallet' },
    send: { icon: <Send className="w-5 h-5" />, title: 'Send', color: '#6366f1', placeholder: '0.00', description: 'Send tokens to another address' },
    claim_link: { icon: <Link2 className="w-5 h-5" />, title: 'Create Claim Link', color: '#BE8CC2', placeholder: '0.00', description: 'Create a link for others to claim tokens' },
  };

  const config = actionConfig[action];
  const selectedToken = mockTokens.find(t => t.symbol === token);
  const maxBalance = selectedToken?.balance ?? 0;

  const handleSubmit = async () => {
    setStep('processing');
    let result: MezoTransaction;
    
    switch (action) {
      case 'deposit':
        result = await mezoApi.deposit(amount, token);
        break;
      case 'withdraw':
        result = await mezoApi.withdraw(amount, token, recipient || undefined);
        break;
      case 'send':
        result = await mezoApi.send(amount, token, recipient);
        break;
      case 'claim_link':
        result = await mezoApi.createClaimLink(amount, token);
        break;
    }
    
    setTx(result);
    setStep('success');
    onSuccess(result);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setMaxAmount = () => setAmount(maxBalance.toString());

  return (
    <div className="glass-strong p-5 max-w-md w-full">
      {step === 'form' && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl" style={{ backgroundColor: config.color + '15', color: config.color }}>
              {config.icon}
            </div>
            <div>
              <h3 className="font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>{config.title}</h3>
              <p className="text-xs text-[#0f172a]/40">{config.description}</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {/* Token Selection */}
            <div>
              <label className="text-xs font-medium text-[#0f172a]/50 mb-1 block">Token</label>
              <div className="grid grid-cols-4 gap-2">
                {mockTokens.slice(0, 4).map((t) => (
                  <button
                    key={t.symbol}
                    onClick={() => setToken(t.symbol)}
                    className={`p-2 rounded-xl text-center transition-all ${token === t.symbol ? 'bg-[#F05391]/15 border border-[#F05391]/30' : 'bg-white/20 border border-white/30 hover:bg-white/30'}`}
                  >
                    <div className="text-lg">{t.icon}</div>
                    <div className="text-[10px] font-bold text-[#0f172a]">{t.symbol}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-[#0f172a]/50">Amount</label>
                <span className="text-xs text-[#0f172a]/40">Balance: {formatAmount(maxBalance)} {token}</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={config.placeholder}
                  className="w-full input-glass text-lg font-bold pr-16"
                />
                <button onClick={setMaxAmount} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#F05391] hover:text-[#C2185B]">
                  MAX
                </button>
              </div>
              {amount && selectedToken && (
                <div className="text-xs text-[#0f172a]/40 mt-1">≈ {formatUsd(parseFloat(amount) * selectedToken.usdPrice)}</div>
              )}
            </div>

            {/* Recipient (for Send/Withdraw) */}
            {(action === 'send' || action === 'withdraw') && (
              <div>
                <label className="text-xs font-medium text-[#0f172a]/50 mb-1 block">Recipient Address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full input-glass text-sm font-mono"
                />
                {action === 'send' && (
                  <div className="flex gap-2 mt-2">
                    {mockContacts.slice(0, 4).map((c, i) => (
                      <button
                        key={i}
                        onClick={() => { setRecipient(c.address); setSelectedContact(i); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${selectedContact === i ? 'bg-[#F05391]/15 border border-[#F05391]/30' : 'bg-white/20 border border-white/30'}`}
                      >
                        <span>{c.avatar}</span>
                        <span className="text-[#0f172a]">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={onClose} className="flex-1 btn-ghost text-sm py-2.5">Cancel</button>
            <button onClick={() => setStep('confirm')} className="flex-1 btn-primary text-sm py-2.5">Continue</button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <h3 className="font-bold text-[#0f172a] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Confirm {config.title}</h3>
          <div className="metric p-4 mb-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#0f172a]/50">Amount</span>
              <div className="text-right">
                <span className="font-bold text-[#0f172a] text-lg">{amount} {token}</span>
                {selectedToken && <div className="text-xs text-[#0f172a]/40">{formatUsd(parseFloat(amount) * selectedToken.usdPrice)}</div>}
              </div>
            </div>
            {(action === 'send' || action === 'withdraw') && recipient && (
              <div className="flex justify-between items-center pt-2 border-t border-white/20">
                <span className="text-sm text-[#0f172a]/50">To</span>
                <span className="font-mono text-sm text-[#0f172a]">{shortenAddress(recipient)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('form')} className="flex-1 btn-ghost text-sm py-2.5">Back</button>
            <button onClick={handleSubmit} className="flex-1 btn-primary text-sm py-2.5">Confirm</button>
          </div>
        </>
      )}

      {step === 'processing' && (
        <div className="text-center py-8">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#F05391]" />
          <p className="font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>Processing...</p>
          <p className="text-sm text-[#0f172a]/50 mt-1">Please wait while we process your transaction</p>
        </div>
      )}

      {step === 'success' && tx && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#10b981]/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-[#10b981]" />
          </div>
          <h3 className="font-bold text-[#0f172a] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Success!</h3>
          <p className="text-sm text-[#0f172a]/50 mb-4">{config.title} completed successfully</p>
          
          {tx.claimLink && (
            <div className="metric p-4 mb-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-medium text-[#0f172a]/50">Claim Link</span>
                <QrCode className="w-4 h-4 text-[#0f172a]/30" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-[#F05391] truncate">{tx.claimLink}</span>
                <button onClick={() => copyToClipboard(tx.claimLink!)} className="p-2 hover:bg-white/30 rounded-lg transition-all">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4 text-[#0f172a]/50" />}
                </button>
              </div>
            </div>
          )}

          <div className="metric p-3 mb-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-[#0f172a]/50">Transaction</span>
              <span className="font-mono text-xs text-[#F05391] flex items-center gap-1">
                {shortenAddress(tx.txHash || '')}
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-[#0f172a]/50">Time</span>
              <span className="text-[#0f172a]">{formatTime(tx.createdAt)}</span>
            </div>
          </div>

          <button onClick={onClose} className="w-full btn-primary text-sm py-2.5">Done</button>
        </div>
      )}
    </div>
  );
};
