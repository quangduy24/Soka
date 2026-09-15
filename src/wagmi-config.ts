/**
 * Soka Intent Engine — Wagmi & RainbowKit Configuration
 * Configures EVM wallet connectors, chains, and transports for Mezo Testnet.
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { mezoTestnet } from './mezo-chain.js';

const projectId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID) ||
  'c4f79cc821944d9680842e34466bfb';

export const wagmiConfig = getDefaultConfig({
  appName: 'Soka Intent Engine',
  projectId,
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http('https://rpc.test.mezo.org'),
  },
  ssr: false,
});
