/* ============================================================
   ReplayTimeline — one scrubber for video + word-level transcript
   + telemetry graph. Renders real bars when word timestamps are
   available; otherwise a lightweight placeholder silhouette so
   the workflow still makes sense today.
   ============================================================ */

import { useMemo, useState } from 'react';

export function ReplayTimeline({ segments = [], duration = 0, telemetry = [] }) {
  const [position, setPosition] = useState(0);

  const bars = useMemo(() => {
    if (Array.isArray(telemetry) && telemetry.length > 0) {
      return telemetry;
    }
    if (Array.isArray(segments) && segments.length > 0) {
      const count = Math.min(48, segments.length);
      return segments.slice(0, count);
    }
    // placeholder silhouette (no data yet)
    return Array.from({ length: 40 }, (_, i) => ({
      v: 0.35 + 0.5 * Math.abs(Math.sin(i * 1.31)) + 0.15 * Math.sin(i * 0.7),
      t: i / 40,
    }));
  }, [telemetry, segments]);

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="clay-inset clay-inset--sm" style={{ padding: '1rem' }}>
      <div className="replay-timeline" role="slider" aria-label="Replay timeline" tabIndex={0}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          setPosition((duration || 1) * f);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setPosition((p) => Math.min(duration || 1, p + 0.5));
          if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 0.5));
        }}
      >
        {bars.map((bar, i) => {
          const h = Array.isArray(segments) && segments.length > 0
            ? 20 + (bar.v ?? 0.5) * 80
            : 18 + (bar.v ?? 0.5) * 90;
          return (
            <div
              key={i}
              className="replay-timeline__bar"
              style={{
                left: `${(i / Math.max(1, bars.length - 1)) * 100}%`,
                height: `${h}%`,
                opacity: bar.v != null ? 0.4 + bar.v * 0.55 : 0.5,
              }}
            />
          );
        })}
        <div className="replay-timeline__scrub" style={{ left: `${pct}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{position.toFixed(1)}s</span>
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{duration ? `${duration.toFixed(0)}s` : '—'}</span>
      </div>
    </div>
  );
}
