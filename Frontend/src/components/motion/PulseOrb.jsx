/* ============================================================
   PulseOrb — the Scrybe signature element.
   A soft clay-extruded 3D blob that idly breathes on the hero and
   becomes the live confidence meter in the recording workspace.
   Its color shifts along the red→blue gradient and its surface
   deforms in real time from the WebSocket telemetry stream.

   R3F scene is lazy-loaded; on low-end/mobile or reduced-motion
   devices we fall back to a CSS blob so the app stays usable.
   ============================================================ */

import { Suspense, lazy, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, deviceSupports3D } from '../../hooks/useReducedMotion';
import { orbSignal } from '../../utils/pulse';

const R3FOrb = lazy(() => import('./R3FOrb'));

export function PulseOrb({
  mode = 'idle',
  telemetry,
  confidence = 0.5,
  size = 320,
  label,
  className = '',
}) {
  const reducedMotion = useReducedMotion();
  const canDo3D = useMemo(() => deviceSupports3D(), []);

  const signal = orbSignal(telemetry, confidence);
  const use3D = canDo3D && !reducedMotion;

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      role="img"
      aria-label={label || (mode === 'live' ? 'Live confidence meter' : 'Scrybe Pulse orb')}
    >
      {/* halo glow */}
      <div
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '50%',
          background: mode === 'live'
            ? `radial-gradient(circle, rgba(53,84,232,${0.1 + signal * 0.16}) 0%, rgba(224,67,91,0.05) 55%, transparent 75%)`
            : 'radial-gradient(circle, rgba(224,67,91,0.12) 0%, rgba(53,84,232,0.05) 55%, transparent 75%)',
          filter: 'blur(8px)',
          animation: reducedMotion ? 'none' : 'orb-pulse-glow 6s ease-in-out infinite',
        }}
      />

      {use3D ? (
        <Suspense fallback={<CssOrb mode={mode} signal={signal} reducedMotion />}>
          <R3FOrb mode={mode} signal={signal} />
        </Suspense>
      ) : (
        <CssOrb mode={mode} signal={signal} reducedMotion={reducedMotion} />
      )}

      {mode === 'live' && label && (
        <div
          className="mono"
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--clay-surface-alt)',
            border: '1px solid var(--clay-edge)',
            boxShadow: 'var(--clay-shadow-pressed-sm)',
            borderRadius: 'var(--radius-full)',
            padding: '0.3rem 0.9rem',
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--signal-red)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/* ---------- CSS/SVG fallback orb (works everywhere) ---------- */
function CssOrb({ mode, signal, reducedMotion }) {
  const color = `rgb(${Math.round(53 + signal * 171)}, ${Math.round(84 - signal * 17)}, ${Math.round(232 - signal * 141)})`;

  return (
    <motion.div
      animate={reducedMotion ? undefined : { borderRadius: ['42% 58% 55% 45% / 48% 42% 58% 52%', '55% 45% 42% 58% / 42% 58% 42% 58%', '42% 58% 55% 45% / 48% 42% 58% 52%'] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: '72%',
        height: '72%',
        background: `radial-gradient(circle at 32% 28%, ${color} 0%, ${color} 38%, rgba(20,21,26,0.9) 100%)`,
        borderRadius: '42% 58% 55% 45% / 48% 42% 58% 52%',
        boxShadow:
          '-14px -14px 26px var(--clay-highlight), 18px 18px 44px var(--clay-shadow), 0 0 46px rgba(53,84,232,0.35)',
        position: 'relative',
        transform: mode === 'live' ? `scale(${0.94 + signal * 0.1})` : undefined,
        transition: 'transform 0.5s ease, background 0.8s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '24%',
          top: '20%',
          width: '26%',
          height: '18%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          filter: 'blur(10px)',
        }}
      />
    </motion.div>
  );
}
