/* ============================================================
   ScoreRing — clay score ring. Stroke carries the signature
   gradient; the value sits inside in JetBrains Mono.
   ============================================================ */

import { motion } from 'framer-motion';
import { gradeColor } from '../../types';

const R = 84;
const CIRC = 2 * Math.PI * R;

export function ScoreRing({ score = 0, size = 200, label = 'SIMILARITY', grade }) {
  const clamped = Math.max(0, Math.min(100, score || 0));
  const color = gradeColor(clamped);

  return (
    <div className="score-ring" style={{ width: size, height: size, position: 'relative' }} aria-label={`Similarity score ${clamped} percent`}>
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--signal-red)" />
            <stop offset="100%" stopColor="var(--ink-blue)" />
          </linearGradient>
        </defs>

        {/* inset clay track */}
        <circle cx="100" cy="100" r={R} fill="var(--clay-surface-alt)" stroke="none" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="14"
        />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="var(--clay-highlight)"
          strokeWidth="14"
          strokeDasharray={CIRC}
          strokeDashoffset={0}
          opacity="0.55"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />

        {/* progress arc */}
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: CIRC - (CIRC * clamped) / 100 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', filter: 'drop-shadow(0 0 8px rgba(53,84,232,0.45))' }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.15rem',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="score-number"
          style={{ fontSize: '2.6rem', lineHeight: 1, fontWeight: 600 }}
        >
          {Math.round(clamped)}
          <span style={{ fontSize: '1.3rem', color: 'var(--text-tertiary)' }}>%</span>
        </motion.div>
        <span className="mono" style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        {grade && (
          <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 600, color }}>
            {grade}
          </span>
        )}
      </div>
    </div>
  );
}
