import React from 'react';
import { Link } from 'react-router-dom';
import { BuddyLogo } from '../toon/Toon';

export const Footer = () => (
  <footer className="w-full border-t-[3px] border-[#141414] bg-[#FFC900]">
    <div className="max-w-[1180px] mx-auto px-5 md:px-8 py-8 flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
      <BuddyLogo size={34} />
      <nav className="flex flex-wrap gap-2 font-mono text-[11px] font-bold tracking-[0.15em] uppercase">
        <Link to="/" className="toon-chip">★ SIGNAL</Link>
        <Link to="/app" className="toon-chip toon-chip-neon">→ CONSOLE</Link>
        <Link to="/activity" className="toon-chip toon-chip-sky">♥ ACTIVITY</Link>
      </nav>
      <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#141414]/60 uppercase">© 2026 WAPCHAT CLUB ★ BE KIND, SWAP SAFE</span>
    </div>
  </footer>
);
