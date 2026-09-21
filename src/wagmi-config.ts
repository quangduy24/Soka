/**
 * Soka Intent Engine — Wagmi & RainbowKit Configuration
 * Configures EVM wallet connectors, chains, and transports for Mezo Testnet.
 * No hardcoded project ID or RPC URL: both come from src/config.ts.
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { mezoTestnet } from './mezo-chain.js';
import { WALLETCONNECT_PROJECT_ID, CHAIN } from './config';

if (!WALLETCONNECT_PROJECT_ID) {
  throw new Error(
    'Missing VITE_WALLETCONNECT_PROJECT_ID. Set it in your .env file (see .env.example).'
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Soka Intent Engine',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http(mezoTestnet.rpcUrls.default.http[0] ?? CHAIN.rpcHttp),
  },
  ssr: false,
});
