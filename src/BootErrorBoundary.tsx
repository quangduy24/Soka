import React from 'react';

/**
 * Boot error UI — last line of defense against a blank page.
 * NOTE: this file must stay dependency-free (never import wagmi-config or
 * anything that can throw at module load), or the guards below die with it.
 */

function copyText(text: string) {
  if (navigator.clipboard && text) {
    navigator.clipboard.writeText(text).catch(() => undefined);
  }
}

function BootShell({
  errorText,
  showEnvSteps,
}: {
  errorText: string;
  showEnvSteps: boolean;
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FDF2F2',
        color: '#2C1924',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          background: '#fff',
          border: '1px solid rgba(44,25,36,0.1)',
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 8px 32px rgba(44,25,36,0.08)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', color: '#DF7AA7', marginBottom: 8 }}>
          SOKA — STARTUP ERROR
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>The app could not start</div>
        <code
          style={{
            display: 'block',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            background: '#FAF8FA',
            border: '1px solid rgba(44,25,36,0.08)',
            borderRadius: 12,
            padding: '10px 12px',
            wordBreak: 'break-word',
            marginBottom: 12,
          }}
        >
          {errorText}
        </code>
        {showEnvSteps && (
          <ol style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 20, margin: '0 0 12px' }}>
            <li>
              Check the key exists in <code>.env</code> (see <code>.env.example</code>).
            </li>
            <li>
              Restart the dev server — Vite reads <code>.env</code> once at startup (
              <code>npm run dev</code>).
            </li>
            <li>Hard-refresh the browser (Ctrl+F5) to drop cached modules.</li>
          </ol>
        )}
        <button
          onClick={() => copyText(errorText)}
          style={{
            border: '1px solid rgba(44,25,36,0.12)',
            background: '#FAF8FA',
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Copy error
        </button>
      </div>
    </div>
  );
}

function toErrorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : `Startup failure: ${String(error)}`;
}

/**
 * Static boot-error screen (no boundary needed). Used by main.tsx when even
 * module evaluation fails (e.g. wagmi-config throws at import time), where an
 * Error Boundary can never mount.
 */
export function BootStaticError({ error }: { error: unknown }) {
  const text = toErrorText(error);
  return <BootShell errorText={text} showEnvSteps={/VITE_[A-Z_]+/.test(text)} />;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere below (providers, routes, widgets).
 */
export class BootErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[Soka] boot failed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <BootStaticError error={error} />;
  }
}
