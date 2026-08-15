/* ============================================================
   AnswerDNA — radial fingerprint of the hybrid similarity result.
   Matched concepts are solid clay nodes converging on the hub;
   missing concepts are pale ghost nodes. An upgrade over the
   plain "82% similar" number and the two <ul> lists.
   ============================================================ */

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const RING_R = 92;

export function AnswerDNA({ matched = [], missing = [], score = 0 }) {
  const nodes = useMemo(() => {
    const cappedMatched = matched.slice(0, 9);
    const cappedMissing = missing.slice(0, 9);
    const all = [
      ...cappedMatched.map((label) => ({ label, matched: true })),
      ...cappedMissing.map((label) => ({ label, matched: false })),
    ];
    return all.map((node, i) => {
      const angle = (i / all.length) * Math.PI * 2 - Math.PI / 2;
      const x = 100 + RING_R * Math.cos(angle);
      const y = 100 + RING_R * Math.sin(angle);
      return { ...node, x, y, angle };
    });
  }, [matched, missing]);

  return (
    <div className="dna-wrap">
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
          {/* guide rings */}
          <circle cx="100" cy="100" r={RING_R} fill="none" stroke="var(--clay-edge)" strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="100" cy="100" r={RING_R * 0.62} fill="none" stroke="var(--clay-edge)" strokeWidth="1" strokeDasharray="2 5" opacity="0.5" />

          <defs>
            <radialGradient id="dnaHub" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="var(--signal-red)" />
              <stop offset="100%" stopColor="var(--ink-blue)" />
            </radialGradient>
          </defs>

          {/* spokes */}
          {nodes.map((n, i) => (
            <line
              key={`spoke-${i}`}
              x1="100"
              y1="100"
              x2={n.x}
              y2={n.y}
              stroke={n.matched ? 'rgba(224,67,91,0.28)' : 'rgba(255,255,255,0.07)'}
              strokeWidth="1"
            />
          ))}

          {/* hub */}
          <motion.circle
            cx="100" cy="100" r="20"
            fill="url(#dnaHub)"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: 'drop-shadow(0 0 12px rgba(53,84,232,0.5))' }}
          />

          {/* concept nodes */}
          {nodes.map((n, i) => (
            <motion.g
              key={n.label + i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.12 + i * 0.045, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            >
              {n.matched ? (
                <>
                  <circle
                    cx={n.x} cy={n.y} r="9.5"
                    fill="var(--gradient-signal)"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(224,67,91,0.55))' }}
                  />
                  <circle cx={n.x} cy={n.y} r="9.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" opacity="0.8" />
                </>
              ) : (
                <circle
                  cx={n.x} cy={n.y} r="9.5"
                  fill="rgba(255,255,255,0.04)"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}
            </motion.g>
          ))}
        </svg>

        {/* center readout */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1 }}>{Math.round(score)}%</div>
          <div style={{ fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Hybrid</div>
        </div>
      </div>

      {/* legend */}
      <div className="dna-legend">
        <span><span className="dna-dot" style={{ background: 'var(--gradient-signal)' }} />Matched</span>
        <span><span className="dna-dot" style={{ background: 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)' }} />Missing</span>
      </div>
    </div>
  );
}
