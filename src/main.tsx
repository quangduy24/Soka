import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@rainbow-me/rainbowkit/styles.css';

import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BootErrorBoundary, BootStaticError } from './BootErrorBoundary.js';

const queryClient = new QueryClient();

/**
 * Boot with dynamic imports so a module-evaluation failure (e.g. missing
 * env in wagmi-config) renders a readable error screen instead of a blank
 * #root that no Error Boundary could ever catch.
 */
async function boot() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.textContent = 'Soka boot failed: missing #root element in index.html.';
    return;
  }
  try {
    const [{ wagmiConfig }, { default: App }] = await Promise.all([
      import('./wagmi-config.js'),
      import('./App.js'),
    ]);
    createRoot(rootEl).render(
      <StrictMode>
        <BootErrorBoundary>
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider
                theme={darkTheme({
                  accentColor: '#f7931a', // Bitcoin orange accent
                  accentColorForeground: 'white',
                  borderRadius: 'medium',
                })}
              >
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </BootErrorBoundary>
      </StrictMode>
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Soka] boot failed:', error);
    createRoot(rootEl).render(<BootStaticError error={error} />);
  }
}

void boot();
