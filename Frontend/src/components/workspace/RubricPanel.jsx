/* ============================================================
   RubricPanel — the five-dimension delivery rubric. Each
   dimension renders a labeled bar, its sub-score, and the
   specific feedback the engine wrote for it.
   ============================================================ */

const DIM_COLORS = {
  content_accuracy: 'var(--signal-red)',
  structure: 'var(--ink-blue)',
  filler_words: 'var(--clay-amber)',
  pace: '#7C5CFC',
  visual_presence: '#3FB87E',
};

export function RubricPanel({ rubric, compact = false }) {
  if (!rubric || !rubric.dimensions) return null;

  const dims = Object.entries(rubric.dimensions);

  return (
    <div className={`rubric-grid${compact ? ' rubric-grid--compact' : ''}`}>
      {dims.map(([key, dim]) => {
        const color = DIM_COLORS[key] || 'var(--signal-red)';
        const score = Math.max(0, Math.min(100, dim.score ?? 0));
        return (
          <div key={key} className="rubric-dim">
            <div className="rubric-dim__row">
              <span className="rubric-dim__label" style={{ color }}>{dim.label || key}</span>
              <span className="mono rubric-dim__score">{Math.round(score)}</span>
            </div>
            <div className="rubric-bar" role="progressbar" aria-valuenow={Math.round(score)} aria-valuemin={0} aria-valuemax={100} aria-label={dim.label || key}>
              <div className="rubric-bar__fill" style={{ width: `${score}%`, background: color }} />
            </div>
            <p className="rubric-dim__feedback">
              {dim.feedback}
              {dim.detail ? <span className="rubric-dim__detail"> · {dim.detail}</span> : null}
            </p>
          </div>
        );
      })}
    </div>
  );
}
