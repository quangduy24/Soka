/**
 * Soka Intent Engine — Mezo Chain Definition
 * viem custom chain definition for Mezo Testnet.
 * All values come from src/config.ts (VITE_MEZO_* env), never hardcoded here.
 */

import { defineChain } from 'viem';
import { CHAIN } from './config';

export const mezoTestnet = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [CHAIN.rpcHttp],
      webSocket: [CHAIN.rpcWs],
    },
    public: {
      http: [CHAIN.rpcHttp],
      webSocket: [CHAIN.rpcWs],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Explorer',
      url: CHAIN.explorer,
    },
  },
  testnet: true,
});
