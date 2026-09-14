import React, { useEffect, useRef } from 'react';

interface Plume {
  name: string;
  baseX: number;
  baseY: number;
  radius: number;
  colorCore: string;
  colorMid: string;
  colorEdge: string;
  phase: number;
  driftSpeed: number;
  frequency: number;
}

interface InkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  phase: number;
  baseRadius: number;
}

export function GenerativeInkCanvas({ scrollProgress }: { scrollProgress?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef(scrollProgress ?? 0);

  // Keep scrollRef in sync without tearing down the animation loop
  useEffect(() => {
    if (typeof scrollProgress === 'number') {
      scrollRef.current = scrollProgress;
    }
  }, [scrollProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // Exact requested color palette (ZERO BLACK):
    // Soft Cream White #FDF2F2, Pale Rose Blush #F7D1D7, Sweet Pink / Bubblegum #EE97C2,
    // Rose Orchid #DF7AA7, Peach Coral #F8B6A5, Warm Apricot Mist #F5C5B7
    const plumes: Plume[] = [
      {
        name: 'Sweet Pink / Bubblegum',
        baseX: 0.72,
        baseY: 0.35,
        radius: 460,
        colorCore: 'rgba(238, 151, 194, 0.52)', // #EE97C2
        colorMid: 'rgba(238, 151, 194, 0.28)',
        colorEdge: 'rgba(238, 151, 194, 0)',
        phase: 0.4,
        driftSpeed: 0.0018,
        frequency: 3,
      },
      {
        name: 'Rose Orchid',
        baseX: 0.82,
        baseY: 0.72,
        radius: 440,
        colorCore: 'rgba(223, 122, 167, 0.48)', // #DF7AA7
        colorMid: 'rgba(223, 122, 167, 0.24)',
        colorEdge: 'rgba(223, 122, 167, 0)',
        phase: 1.8,
        driftSpeed: 0.0016,
        frequency: 4,
      },
      {
        name: 'Peach Coral',
        baseX: 0.25,
        baseY: 0.76,
        radius: 450,
        colorCore: 'rgba(248, 182, 165, 0.52)', // #F8B6A5
        colorMid: 'rgba(248, 182, 165, 0.26)',
        colorEdge: 'rgba(248, 182, 165, 0)',
        phase: 3.2,
        driftSpeed: 0.0020,
        frequency: 3,
      },
      {
        name: 'Pale Rose Blush',
        baseX: 0.20,
        baseY: 0.42,
        radius: 480,
        colorCore: 'rgba(247, 209, 215, 0.58)', // #F7D1D7
        colorMid: 'rgba(247, 209, 215, 0.30)',
        colorEdge: 'rgba(247, 209, 215, 0)',
        phase: 4.6,
        driftSpeed: 0.0017,
        frequency: 5,
      },
      {
        name: 'Warm Apricot Mist',
        baseX: 0.50,
        baseY: 0.20,
        radius: 430,
        colorCore: 'rgba(245, 197, 183, 0.50)', // #F5C5B7
        colorMid: 'rgba(245, 197, 183, 0.25)',
        colorEdge: 'rgba(245, 197, 183, 0)',
        phase: 2.5,
        driftSpeed: 0.0015,
        frequency: 4,
      },
      {
        name: 'Sweet Pink Center Bloom',
        baseX: 0.55,
        baseY: 0.65,
        radius: 400,
        colorCore: 'rgba(238, 151, 194, 0.42)', // #EE97C2
        colorMid: 'rgba(248, 182, 165, 0.20)', // #F8B6A5
        colorEdge: 'rgba(238, 151, 194, 0)',
        phase: 5.4,
        driftSpeed: 0.0019,
        frequency: 3,
      }
    ];

    // Swirling ink micro-droplets and pigment particles
    const particleColors = [
      'rgba(238, 151, 194, ', // #EE97C2
      'rgba(223, 122, 167, ', // #DF7AA7
      'rgba(248, 182, 165, ', // #F8B6A5
      'rgba(245, 197, 183, ', // #F5C5B7
      'rgba(247, 209, 215, ', // #F7D1D7
    ];

    const particleCount = 45;
    const particles: InkParticle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const baseR = 2.5 + Math.random() * 5.5;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: baseR,
        baseRadius: baseR,
        color: particleColors[i % particleColors.length],
        alpha: 0.35 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let currentScroll = 0;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min(32, time - lastTime);
      lastTime = time;

      // Smooth scroll lerp
      const targetScroll = typeof scrollProgress === 'number'
        ? scrollRef.current
        : (window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
      currentScroll += (targetScroll - currentScroll) * 0.08;

      // 1. Draw base ground in Soft Cream White (#FDF2F2) - zero black!
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#FDF2F2';
      ctx.fillRect(0, 0, width, height);

      // Global fluid time parameter (visibly alive at 60fps)
      const t = time * 0.0015;
      const scrollOffset = currentScroll * 0.4;

      // 2. Draw organic fluid ink plumes with curling harmonic contours
      plumes.forEach((p, idx) => {
        // Fluid vortex drifting
        const plumeTime = t * (p.driftSpeed * 1000);
        const driftX = Math.sin(plumeTime + p.phase) * 0.10 + Math.cos(plumeTime * 0.6 + p.phase) * 0.05;
        const driftY = Math.cos(plumeTime * 0.8 + p.phase) * 0.09 + Math.sin(plumeTime * 0.5 + p.phase) * 0.04;
        
        // Parallax vertical shift on scroll
        const scrollDrift = ((idx * 0.16 + 0.2) * scrollOffset) % 1.2;

        const posX = (p.baseX + driftX) * width;
        const posY = ((p.baseY + driftY + scrollDrift) % 1.3 - 0.15) * height;

        // Dynamic breathing fluid pulse
        const breathe = 1 + 0.16 * Math.sin(t * 1.6 + p.phase) + 0.08 * Math.cos(t * 2.4 + p.phase);
        const currentRadius = p.radius * breathe;

        // Multi-stop radial gradient for the dye core
        const grad = ctx.createRadialGradient(
          posX,
          posY,
          currentRadius * 0.05,
          posX,
          posY,
          currentRadius
        );

        grad.addColorStop(0, p.colorCore);
        grad.addColorStop(0.35, p.colorMid);
        grad.addColorStop(0.70, p.colorMid.replace(/[\d.]+\)$/, '0.08)'));
        grad.addColorStop(1, p.colorEdge);

        // Draw organic fluid droplet contour with 36 harmonic control points
        ctx.beginPath();
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          
          // Fluid eddies and expanding dye frontiers
          const harmonic = Math.sin(angle * p.frequency + t * 2.2 + p.phase) * 0.16
                         + Math.cos(angle * (p.frequency + 2) - t * 1.8 + p.phase) * 0.10
                         + Math.sin(angle * 2 + t * 0.9) * 0.12;

          const r = currentRadius * (1 + harmonic);
          const px = posX + Math.cos(angle) * r;
          const py = posY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // 3. Draw flowing ink ribbons / curling dye streamlines in water
      for (let s = 0; s < 3; s++) {
        const streamPhase = s * 2.1;
        const startX = width * (0.15 + s * 0.35);
        const startY = height * (0.1 + ((s * 0.3 + currentScroll * 0.3) % 0.9));

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        const segments = 24;
        const streamLength = height * 0.55;

        for (let j = 1; j <= segments; j++) {
          const progress = j / segments;
          const currY = startY + progress * streamLength;
          const waveX = Math.sin(progress * Math.PI * 3 + t * 2 + streamPhase) * (50 + progress * 70);
          const currX = startX + waveX;
          ctx.lineTo(currX, currY);
        }

        const streamColor = s % 2 === 0 ? 'rgba(238, 151, 194, 0.18)' : 'rgba(248, 182, 165, 0.18)';
        ctx.strokeStyle = streamColor;
        ctx.lineWidth = 28 * (1 + 0.2 * Math.sin(t + streamPhase));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // 4. Draw swirling ink particles / dye micro-droplets
      particles.forEach((pt) => {
        // Fluid curl velocity field
        const angle = Math.sin(pt.x * 0.0025 + t) * Math.PI + Math.cos(pt.y * 0.0025 + t * 0.8) * Math.PI;
        pt.vx += Math.cos(angle) * 0.08;
        pt.vy += Math.sin(angle) * 0.08;

        // Friction / viscosity damping in water
        pt.vx *= 0.95;
        pt.vy *= 0.95;

        // Apply velocities
        pt.x += pt.vx;
        pt.y += pt.vy - (scrollRef.current - currentScroll) * 3;

        // Wrap boundaries
        if (pt.x < -20) pt.x = width + 20;
        if (pt.x > width + 20) pt.x = -20;
        if (pt.y < -20) pt.y = height + 20;
        if (pt.y > height + 20) pt.y = -20;

        // Pulsing droplet radius
        const rPulse = pt.baseRadius * (1 + 0.25 * Math.sin(t * 3 + pt.phase));

        // Draw soft particle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, rPulse, 0, Math.PI * 2);
        ctx.fillStyle = `${pt.color}${pt.alpha * (0.8 + 0.2 * Math.sin(t * 2 + pt.phase))})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#FDF2F2]">
      {/* 1. Hardware-accelerated dynamic canvas (Fluid Ink & Swirling Droplets at 60-120fps) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover will-change-transform"
      />

      {/* 2. Soft pastel micro-highlights dispersion */}
      <div 
        className="absolute inset-0 opacity-[0.20] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 35%, rgba(223,122,167,0.55) 1.2px, transparent 1.5px),
                            radial-gradient(circle at 70% 60%, rgba(248,182,165,0.60) 1.5px, transparent 2px),
                            radial-gradient(circle at 40% 80%, rgba(238,151,194,0.55) 1.2px, transparent 1.5px)`,
          backgroundSize: '140px 140px, 200px 200px, 170px 170px'
        }}
      />

      {/* 3. Soft warm apricot / rose blush peripheral vignette (ZERO BLACK) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(253,244,242,0) 0%, rgba(247,209,215,0.22) 65%, rgba(245,197,183,0.38) 100%)'
        }}
      />

      {/* 4. Fine paper grain texture - lightweight hardware-accelerated CSS pattern (zero GPU re-rasterization) */}
      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: 'radial-gradient(rgba(44, 25, 36, 0.4) 1px, transparent 1px)',
          backgroundSize: '8px 8px'
        }}
      />
    </div>
  );
}
