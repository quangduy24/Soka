import { parseUnits } from 'viem';

async function testExecuteSwap() {
  const req = {
    senderAddress: '0x1234567890123456789012345678901234567890',
    sourceSymbol: 'BTC',
    destSymbol: 'MUSD',
    amount: '0.05',
    slippage: 0.5,
  };

  const res = await fetch('http://localhost:3000/api/execute-swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });

  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", text);
}

testExecuteSwap();
