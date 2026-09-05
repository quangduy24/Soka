import { Routes, Route, Navigate } from 'react-router-dom';
import { ProLanding } from './components/pro/ProLanding';
import { ProSwapper } from './components/pro/ProSwapper';

/**
 * DIEPS Pro Studio — single-version app (no Toon playground).
 *   /       → Pro landing
 *   /app    → Pro terminal (chat-style swap console)
 *   /pro*   → legacy aliases, redirect to the canonical routes
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProLanding />} />
      <Route path="/app" element={<ProSwapper />} />
      <Route path="/pro" element={<Navigate to="/" replace />} />
      <Route path="/pro/app" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
