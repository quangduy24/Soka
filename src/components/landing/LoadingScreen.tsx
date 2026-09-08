import React, { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import { BlobBuddy } from '../toon/Toon';

interface LoadingScreenProps {
  onComplete: () => void;
  mode?: 'landing' | 'app';
}

const LANDING_STEPS = ['WAKING BUDDY…', 'SNIFFING POOLS…', 'CHECKING SAFETY…', 'READY-SET-GO!'];
const APP_STEPS = ['OPENING CHAT…', 'SYNCING WALLET…', 'CHAT READY!'];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, mode = 'landing' }) => {
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obj = { val: 0 };
    const steps = mode === 'landing' ? LANDING_STEPS : APP_STEPS;
    const onFinished = () => {
      gsap.to(containerRef.current, {
        yPercent: -100, duration: 0.8, ease: 'power4.inOut', onComplete,
      });
    };
    const tl = gsap.timeline({ onComplete: onFinished });
    tl.to(obj, {
      val: 100,
      duration: mode === 'landing' ? 2.2 : 1.4,
      ease: 'power1.inOut',
      onUpdate: () => {
        const v = Math.floor(obj.val);
        setPct(v);
        setStep(Math.min(steps.length - 1, Math.floor((v / 100) * steps.length)));
      },
    });

    // Safety net: gsap runs on requestAnimationFrame, which is throttled to a
    // stop when the tab is backgrounded or in odd embedded contexts. If the
    // timeline hasn't finished shortly after its expected runtime, force-finish
    // so the app UI is never stuck behind the splash.
    const durMs = (mode === 'landing' ? 2.2 : 1.4) * 1000 + 1200;
    const failSafe = setTimeout(() => {
      if (obj.val < 100) {
        obj.val = 100;
        setPct(100);
        setStep(steps.length - 1);
        tl.progress(1);
        onFinished();
      }
    }, durMs);

    return () => { tl.kill(); clearTimeout(failSafe); };
  }, [onComplete, mode]);

  const steps = mode === 'landing' ? LANDING_STEPS : APP_STEPS;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FFF4E0] toon-dots">
      <div className="toon-card px-10 py-8 flex flex-col items-center" style={{ background: '#fffaf0' }}>
        <BlobBuddy size={96} mood={pct > 70 ? 'wow' : 'thinking'} />
        <div className="mt-2 text-[34px]" style={{ fontFamily: '"Bungee", sans-serif' }}>{pct}%</div>
        <div className="mt-3 w-[240px] h-[18px] rounded-full border-[3px] border-[#141414] bg-white overflow-hidden">
          <div className="h-full bg-[#CCFF00] border-r-[3px] border-[#141414]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 font-mono text-[11px] font-bold tracking-[0.2em]">{steps[step]}</div>
      </div>
    </div>
  );
};
