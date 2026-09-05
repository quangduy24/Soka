import React, { useState, useMemo } from 'react';
import { TOKENS } from '../constants';

export function TokenSelectorModal({ isOpen, onClose, onSelect, selectedToken }: { isOpen: boolean, onClose: () => void, onSelect: (token: string) => void, selectedToken: string }) {
  const [search, setSearch] = useState('');

  const filteredTokens = useMemo(() => {
    return TOKENS.filter(token =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141414]/50 px-4 pop-in">
      <div className="toon-card w-full max-w-[400px] p-6 relative flex flex-col h-[600px] max-h-[80vh]" style={{ background: '#fffaf0' }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#ff6b6b] border-[3px] border-[#141414] font-black leading-none" style={{ boxShadow: '3px 3px 0 #141414' }}>
          ✕
        </button>
        <span className="toon-chip toon-chip-sunny self-start">★ PICK ONE!</span>
        <h3 className="text-[26px] mt-2 mb-4" style={{ fontFamily: '"Bungee", sans-serif' }}>Token Toybox</h3>

        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#141414]/50 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search toys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border-[3px] border-[#141414] rounded-2xl py-3 pl-12 pr-4 text-[#141414] font-bold text-[15px] outline-none placeholder:text-[#141414]/35 placeholder:font-medium"
            style={{ boxShadow: '4px 4px 0 #141414' }}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-[#141414]/50 font-bold">No toys found!! 😢</div>
          ) : (
            filteredTokens.map(token => (
              <button
                key={token.symbol}
                onClick={() => { onSelect(token.symbol); onClose(); setSearch(''); }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border-[3px] transition-all"
                style={{
                  borderColor: '#141414',
                  background: selectedToken === token.symbol ? '#CCFF00' : '#fff',
                  boxShadow: '3px 3px 0 #141414',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#FFF4E0] border-2 border-[#141414] flex items-center justify-center">
                    {token.logoUrl ? (
                      <img src={token.logoUrl} alt={token.symbol} className="w-9 h-9 object-contain" />
                    ) : (
                      <span className="font-black text-[10px]">{token.symbol.slice(0, 3)}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-black text-[#141414]">{token.symbol}</span>
                    <span className="text-[12px] font-medium text-[#141414]/55">{token.name}</span>
                  </div>
                </div>
                {selectedToken === token.symbol && <span className="toon-chip toon-chip-neon !text-[9px]">✓ MINE</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
