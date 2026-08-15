/* ============================================================
   Progress — improvement dashboard. Custom SVG line charts
   (no chart library needed): one per rubric dimension plus the
   weighted overall, with trend deltas and the latest snapshot.
   ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { meApi } from '../services/api';
import { gradeColor, gradeFor } from '../types';

const DIMENSIONS = [
  { key: 'content_accuracy', label: 'Content accuracy', color: 'var(--signal-red)' },
  { key: 'structure', label: 'Structure', color: 'var(--ink-blue)' },
  { key: 'filler_words', label: 'Filler words', color: 'var(--clay-amber)' },
  { key: 'pace', label: 'Pace', color: '#7C5CFC' },
  { key: 'visual_presence', label: 'Visual presence', color: 'var(--clay-green, #3FB87E)' },
];

function LineChart({ points, color, height = 120, width = 320 }) {
  if (!points || points.length < 2) {
    return (
      <div className="prog-chart prog-chart--empty" style={{ height }}>
        Not enough sessions to chart yet.
      </div>
    );
  }

  const pad = 6;
  const vals = points.map((p) => p.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(100, ...vals);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + ((max - p.value) / range) * (height - pad * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${height - pad} L${coords[0].x.toFixed(1)},${height - pad} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="prog-chart" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`prog-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#prog-fill-${color.replace('#', '')})`} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {last && <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--clay-base)" strokeWidth="2" />}
      </svg>
    </div>
  );
}

function TrendTag({ delta }) {
  if (delta === null || delta === undefined) return null;
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <span className={`trend-tag${up ? ' trend-tag--up' : flat ? '' : ' trend-tag--down'}`}>
      {up ? '▲' : flat ? '—' : '▼'} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

export default function Progress() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await meApi.progress());
    } catch (err) {
      setError(err.message || 'Your progress could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trends = data?.trends || {};
  const latest = data?.latest || {};
  const overallPoints = data?.overall || [];

  const dimRows = DIMENSIONS.map((d) => {
    const series = data?.dimensions?.[d.key] || [];
    const lastVal = series.length ? series[series.length - 1].value : null;
    return { ...d, series, lastVal, delta: trends[d.key] };
  });

  return (
    <div className="clay-container clay-section">
      <div className="clay-section-header clay-section-header--left">
        <span className="eyebrow eyebrow--blue">Improvement Dashboard</span>
        <h1 className="display display--lg">Your Progress</h1>
        <p style={{ color: 'var(--text-tertiary)' }}>Track each rubric dimension across your last sessions</p>
      </div>

      {loading ? (
        <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner light />
        </Card>
      ) : error ? (
        <Card padded={false} className="result-empty" style={{ minHeight: '220px' }}>
          <p>{error}</p>
        </Card>
      ) : !data || data.total === 0 ? (
        <Card padded={false} className="result-empty" style={{ minHeight: '240px' }}>
          <span className="clay-icon clay-icon--blue" style={{ width: 56, height: 56, fontSize: '1.5rem' }}>
            <Icon name="Chart" size={26} />
          </span>
          <p>No evaluations yet — complete a session in the workspace and your trends will appear here.</p>
        </Card>
      ) : (
        <>
          <div className="stats-grid">
            <Card className="stat-card">
              <div className="stat-card__value" style={{ color: gradeColor(latest.score ?? 0) }}>{latest.score ?? '—'}</div>
              <div className="stat-card__label">Latest overall</div>
              <TrendTag delta={trends.overall} />
            </Card>
            <Card className="stat-card">
              <div className="stat-card__value">{data.total}</div>
              <div className="stat-card__label">Sessions tracked</div>
            </Card>
            {dimRows
              .slice()
              .sort((a, b) => (b.lastVal ?? -1) - (a.lastVal ?? -1))
              .slice(0, 2)
              .map((d, i) => (
                <Card key={d.key} className="stat-card">
                  <div className="stat-card__value" style={{ color: d.color }}>{d.lastVal ?? '—'}</div>
                  <div className="stat-card__label">{i === 0 ? 'Strongest dimension' : 'Needs attention'}</div>
                </Card>
              ))}
          </div>

          {/* Overall trend chart */}
          <Card style={{ marginTop: '1.4rem' }}>
            <div className="prog-head">
              <div>
                <div style={{ fontWeight: 600 }}>Overall trajectory</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  {overallPoints.length} sessions · {gradeFor(latest.score ?? 0)}
                </div>
              </div>
              <TrendTag delta={trends.overall} />
            </div>
            <LineChart points={overallPoints} color="var(--signal-red)" height={160} width={640} />
          </Card>

          {/* Per-dimension charts */}
          <div className="prog-dim-grid">
            {dimRows.map((d) => (
              <Card key={d.key} className="prog-dim">
                <div className="prog-head">
                  <div className="prog-dim__title">
                    <span className="prog-dim__dot" style={{ background: d.color }} aria-hidden="true" />
                    <span>{d.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="mono" style={{ fontSize: '0.9rem', color: gradeColor(d.lastVal ?? 0) }}>{d.lastVal ?? '—'}</span>
                    <TrendTag delta={d.delta} />
                  </div>
                </div>
                <LineChart points={d.series} color={d.color} height={110} width={320} />
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
