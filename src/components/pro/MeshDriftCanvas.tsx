import React, { useEffect, useRef, useState } from 'react';

/**
 * Mesh Drift WebGL Fragment Shader Background
 * 
 * Spec:
 * - Five colours weighted by inverse distance (IDW)
 * - Five drifting points each carry a colour; field changes direction & value
 * - Shared GLSL preamble: hashed value noise, six-octave fbm, two-level domain-warp helper
 * - Smoothed pointer-intensity uniform (rises on pointer movement, relaxes when it leaves)
 * - Ground #FDF2F2 with accents ["#F5C7B8", "#C9D8F0"]
 * - Fallback panel if WebGL context is unavailable
 * - Reduced-motion single-frame path (prefers-reduced-motion)
 */

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_pointer_intensity;

// --- GLSL Preamble: Hashed value noise, 6-octave FBM, 2-level Domain Warp ---
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm6(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; ++i) {
    v += a * vnoise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// Two-level domain warp helper
float domainWarp(vec2 p, out vec2 q, out vec2 r, float t) {
  q = vec2(
    fbm6(p + vec2(0.0, 0.0) + 0.04 * t),
    fbm6(p + vec2(5.2, 1.3) + 0.05 * t)
  );
  r = vec2(
    fbm6(p + 3.0 * q + vec2(1.7, 9.2) + 0.08 * t),
    fbm6(p + 3.0 * q + vec2(8.3, 2.8) + 0.07 * t)
  );
  return fbm6(p + 3.0 * r);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Compute domain warp
  vec2 q;
  vec2 r;
  float warpVal = domainWarp(p * 1.5, q, r, u_time);

  // Pointer position in aspect coordinates
  vec2 ptr = vec2(u_pointer.x * aspect, u_pointer.y);
  float ptrDist = length(p - ptr);
  float ptrGlow = exp(-ptrDist * 3.2) * u_pointer_intensity;

  // Modulate warp with pointer intensity
  vec2 warpedP = p + (r - 0.5) * (0.12 + 0.18 * u_pointer_intensity) + (q - 0.5) * 0.06;

  // 5 Drifting points across aspect space
  // Points drift smoothly with out-of-phase trigonometric loops
  float t = u_time * 0.22;
  vec2 p0 = vec2((0.25 + 0.18 * sin(t * 0.9 + 0.2)) * aspect, 0.28 + 0.20 * cos(t * 1.1 + 1.0));
  vec2 p1 = vec2((0.75 + 0.16 * cos(t * 0.8 + 2.5)) * aspect, 0.32 + 0.18 * sin(t * 1.0 + 0.5));
  vec2 p2 = vec2((0.50 + 0.22 * sin(t * 0.7 + 4.1)) * aspect, 0.72 + 0.19 * cos(t * 0.9 + 3.2));
  vec2 p3 = vec2((0.22 + 0.15 * cos(t * 1.2 + 5.0)) * aspect, 0.68 + 0.17 * sin(t * 0.8 + 2.0));
  vec2 p4 = vec2((0.80 + 0.18 * sin(t * 1.0 + 1.7)) * aspect, 0.75 + 0.16 * cos(t * 1.2 + 4.6));

  // Attract drifting points subtly toward cursor under high intensity
  if (u_pointer_intensity > 0.01) {
    vec2 pDiff = ptr - p2;
    p2 += pDiff * 0.08 * u_pointer_intensity;
  }

  // Palette: Ground #FDF2F2 with accents ["#F5C7B8", "#C9D8F0"]
  // 5 colours restricted to these 2-3 hues to read as a single cohesive material:
  vec3 c_ground  = vec3(0.992, 0.949, 0.949); // #FDF2F2
  vec3 c_accent1 = vec3(0.961, 0.780, 0.722); // #F5C7B8 (warm peach accent)
  vec3 c_accent2 = vec3(0.788, 0.847, 0.941); // #C9D8F0 (cool periwinkle accent)
  vec3 c_blend1  = mix(c_ground, c_accent1, 0.65); // Soft warm tone
  vec3 c_blend2  = mix(c_ground, c_accent2, 0.60); // Soft cool tone

  // Inverse Distance Weighting (IDW) of the 5 points
  float d0 = length(warpedP - p0) + 0.08;
  float d1 = length(warpedP - p1) + 0.08;
  float d2 = length(warpedP - p2) + 0.08;
  float d3 = length(warpedP - p3) + 0.08;
  float d4 = length(warpedP - p4) + 0.08;

  float power = 1.85;
  float w0 = 1.0 / pow(d0, power);
  float w1 = 1.0 / pow(d1, power);
  float w2 = 1.0 / pow(d2, power);
  float w3 = 1.0 / pow(d3, power);
  float w4 = 1.0 / pow(d4, power);

  float totalW = w0 + w1 + w2 + w3 + w4;

  vec3 idwColor = (
    c_ground  * w0 +
    c_accent1 * w1 +
    c_accent2 * w2 +
    c_blend1  * w3 +
    c_blend2  * w4
  ) / totalW;

  // Blend into ground committed field
  // Strengthens under cursor and relaxes when it leaves
  float fieldStrength = 0.70 + 0.25 * u_pointer_intensity + 0.15 * ptrGlow;
  vec3 color = mix(c_ground, idwColor, fieldStrength);

  // Subtle luminance breathing from domain warp
  color += (warpVal - 0.5) * 0.035;

  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function MeshDriftCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Detect prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        renderSingleFrame();
      }
    };
    motionQuery.addEventListener('change', handleMotionChange);

    // Create WebGL context
    const gl = (
      canvas.getContext('webgl', { antialias: true, alpha: false, depth: false }) ||
      canvas.getContext('experimental-webgl', { antialias: true, alpha: false, depth: false })
    ) as WebGLRenderingContext | null;

    if (!gl) {
      setWebGlSupported(false);
      return;
    }

    const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    if (!program) {
      setWebGlSupported(false);
      return;
    }

    // Set up full-screen quad geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPositionLoc = gl.getAttribLocation(program, 'a_position');
    const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uPointerLoc = gl.getUniformLocation(program, 'u_pointer');
    const uPointerIntensityLoc = gl.getUniformLocation(program, 'u_pointer_intensity');

    // Pointer state with smooth tracking & intensity decay
    const pointer = {
      x: 0.5,
      y: 0.5,
      targetIntensity: 0.0,
      currentIntensity: 0.0,
      lastMoveTime: 0,
    };

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      pointer.x = e.clientX / window.innerWidth;
      // Invert Y for WebGL bottom-left coordinate system
      pointer.y = 1.0 - (e.clientY / window.innerHeight);
      pointer.targetIntensity = 1.0;
      pointer.lastMoveTime = performance.now();

      if (prefersReducedMotion) {
        renderSingleFrame();
      }
    };

    const handlePointerLeave = () => {
      pointer.targetIntensity = 0.0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    // Handle resizing
    const resizeCanvas = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const displayWidth = Math.round(width * dpr);
      const displayHeight = Math.round(height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Render single frame for reduced-motion or static draw
    const renderSingleFrame = () => {
      if (!gl || !program) return;
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(uTimeLoc, 1.5);
      gl.uniform2f(uPointerLoc, pointer.x, pointer.y);
      gl.uniform1f(uPointerIntensityLoc, pointer.currentIntensity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Animation Loop
    let animId: number;
    let startTime = performance.now();

    const animate = (now: number) => {
      if (prefersReducedMotion) {
        return; // Reduced-motion stops continuous loop
      }

      const elapsed = (now - startTime) * 0.001;

      // Pointer intensity relaxation: relaxes if no movement for > 800ms
      const timeSinceMove = now - pointer.lastMoveTime;
      if (timeSinceMove > 600) {
        pointer.targetIntensity *= 0.95;
      }
      // Smooth lerp towards target intensity
      pointer.currentIntensity += (pointer.targetIntensity - pointer.currentIntensity) * 0.08;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uPointerLoc, pointer.x, pointer.y);
      gl.uniform1f(uPointerIntensityLoc, pointer.currentIntensity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animId = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      renderSingleFrame();
    } else {
      animId = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', resizeCanvas);
      motionQuery.removeEventListener('change', handleMotionChange);
      if (gl) {
        gl.deleteBuffer(positionBuffer);
        gl.deleteProgram(program);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none -z-10">
      {/* Hidden Fallback Panel when no WebGL context can be created */}
      {!webGlSupported && (
        <div 
          id="webgl-fallback-panel"
          className="absolute inset-0 w-full h-full bg-[#FDF2F2] flex items-center justify-center pointer-events-auto z-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 25%, #F5C7B8 0%, #FDF2F2 50%, #C9D8F0 100%)',
          }}
        >
          <div className="text-center p-6 max-w-sm rounded-2xl bg-white/80 backdrop-blur-md border border-[#F5C7B8] shadow-sm">
            <p className="text-sm font-semibold text-[#845D74]">WebGL context unavailable</p>
            <p className="text-xs text-[#845D74]/80 mt-1">Falling back to soft gradient mesh.</p>
          </div>
        </div>
      )}

      {/* Full-viewport Mesh Drift WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 w-full h-full block transition-opacity duration-700 ${
          webGlSupported ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ margin: 0, padding: 0 }}
      />
    </div>
  );
}
