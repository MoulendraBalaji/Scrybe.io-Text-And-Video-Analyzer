/* ============================================================
   Logo — calligraphy "S" monogram on the signature gradient.
   Rendered inline so the gradient + shadow survive anywhere
   (navbar, footer, auth pages). Mirrors public/logo.svg.
   ============================================================ */

import { useId } from 'react';

export function LogoMark({ size = 40, className = '' }) {
  const gid = useId().replace(/[:]/g, '');
  const sid = `${gid}s`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Scrybe"
    >
      <defs>
        <linearGradient id={gid} x1="10" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0435B" />
          <stop offset="0.55" stopColor="#D54A6A" />
          <stop offset="1" stopColor="#3554E8" />
        </linearGradient>
        <filter id={sid} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.6" floodColor="#0C0E14" floodOpacity="0.4" />
        </filter>
      </defs>

      <g transform="translate(-2.5 0)">
        <g filter={`url(#${sid})`}>
          <path d="M 56 6 C 54 7.2 52.2 9.2 50.8 11.6" stroke={`url(#${gid})`} strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M 50.5 12.5 C 44.5 6.8 35.5 5.6 28.5 9.6 C 22.5 12.9 19 18.8 19.4 25.5" stroke={`url(#${gid})`} strokeWidth="9.6" strokeLinecap="round" fill="none" />
          <path d="M 19.6 27.5 C 21 32.6 25.8 35.6 31.6 35.2" stroke={`url(#${gid})`} strokeWidth="4.6" strokeLinecap="round" fill="none" />
          <path d="M 32.6 34.8 C 38.6 34.2 42.8 38.6 42 44.6 C 41.2 50.6 34.5 54.4 27.5 53.4 C 22 52.6 19 48.5 20.4 43.8" stroke={`url(#${gid})`} strokeWidth="9.6" strokeLinecap="round" fill="none" />
          <path d="M 20 45 C 17.4 47.6 14.6 50.8 12.8 54.4" stroke={`url(#${gid})`} strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M 14.5 59 C 21 57.6 28.5 57.6 34.5 59.4" stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" opacity="0.55" fill="none" />
        </g>
      </g>
    </svg>
  );
}

export function Logo({ size = 40, withWordmark = true, wordmarkSize = '1.15rem', className = '' }) {
  return (
    <span className={`logo${className ? ` ${className}` : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
      <LogoMark size={size} />
      {withWordmark && (
        <span
          className="logo__wordmark"
          style={{
            fontWeight: 600,
            fontSize: wordmarkSize,
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
          }}
        >
          Scrybe
        </span>
      )}
    </span>
  );
}
