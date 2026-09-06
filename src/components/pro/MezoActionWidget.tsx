import React, { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Send, Link2, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { mezoApi, MezoTransaction } from '../../services/mezoApi';

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
  const [tx, setTx] = useState<MezoTransaction | null>(null);
  const [copied, setCopied] = useState(false);

  const actionConfig = {
    deposit: { icon: <ArrowDownCircle className="w-5 h-5" />, title: 'Deposit', color: '#10b981', placeholder: 'Amount to deposit' },
    withdraw: { icon: <ArrowUpCircle className="w-5 h-5" />, title: 'Withdraw', color: '#F05391', placeholder: 'Amount to withdraw' },
    send: { icon: <Send className="w-5 h-5" />, title: 'Send', color: '#6366f1', placeholder: 'Amount to send' },
    claim_link: { icon: <Link2 className="w-5 h-5" />, title: 'Create Claim Link', color: '#BE8CC2', placeholder: 'Amount for claim link' },
  };

  const config = actionConfig[action];

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

  return (
    <div className="glass-strong p-5 max-w-md w-full">
      {step === 'form' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl" style={{ backgroundColor: config.color + '15', color: config.color }}>
              {config.icon}
            </div>
            <h3 className="font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>{config.title}</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#0f172a]/50 mb-1 block">Token</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full input-glass text-sm"
              >
                <option value="SUI">SUI</option>
                <option value="USDC">USDC</option>
                <option value="CETUS">CETUS</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-[#0f172a]/50 mb-1 block">Amount</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={config.placeholder}
                className="w-full input-glass text-sm"
              />
            </div>

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
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={onClose} className="flex-1 btn-ghost text-sm py-2">Cancel</button>
            <button onClick={() => setStep('confirm')} className="flex-1 btn-primary text-sm py-2">Continue</button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <h3 className="font-bold text-[#0f172a] mb-4" style={{ fontFamily: 'var(--font-display)' }}>Confirm {config.title}</h3>
          <div className="metric p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#0f172a]/50">Amount</span>
              <span className="font-bold text-[#0f172a]">{amount} {token}</span>
            </div>
            {(action === 'send' || action === 'withdraw') && recipient && (
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-[#0f172a]/50">To</span>
                <span className="font-mono text-xs text-[#0f172a]">{recipient.slice(0, 10)}...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('form')} className="flex-1 btn-ghost text-sm py-2">Back</button>
            <button onClick={handleSubmit} className="flex-1 btn-primary text-sm py-2">Confirm</button>
          </div>
        </>
      )}

      {step === 'processing' && (
        <div className="text-center py-8">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#F05391]" />
          <p className="font-bold text-[#0f172a]" style={{ fontFamily: 'var(--font-display)' }}>Processing...</p>
          <p className="text-sm text-[#0f172a]/50 mt-1">Please wait</p>
        </div>
      )}

      {step === 'success' && tx && (
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-[#10b981]" />
          <h3 className="font-bold text-[#0f172a] mb-2" style={{ fontFamily: 'var(--font-display)' }}>Success!</h3>
          <p className="text-sm text-[#0f172a]/50 mb-4">{config.title} completed</p>
          
          {tx.claimLink && (
            <div className="metric p-3 mb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-[#0f172a]/70 truncate">{tx.claimLink}</span>
                <button onClick={() => copyToClipboard(tx.claimLink!)} className="p-1 hover:bg-white/30 rounded">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4 text-[#0f172a]/50" />}
                </button>
              </div>
            </div>
          )}

          <div className="metric p-3 mb-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-[#0f172a]/50">Tx Hash</span>
              <span className="font-mono text-xs text-[#0f172a]">{tx.txHash?.slice(0, 10)}...</span>
            </div>
          </div>

          <button onClick={onClose} className="w-full btn-primary text-sm py-2">Done</button>
        </div>
      )}
    </div>
  );
};
