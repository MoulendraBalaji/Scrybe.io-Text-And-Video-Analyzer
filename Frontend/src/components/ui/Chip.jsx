/* ============================================================
   Chip — small clay pill
   ============================================================ */

export function Chip({ tone, dot = false, className = '', children, ...rest }) {
  const classes = [
    'clay-chip',
    tone === 'red' ? 'clay-chip--red' : '',
    tone === 'blue' ? 'clay-chip--blue' : '',
    dot ? 'clay-chip--dot' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

export function StatusBadge({ state = 'offline', children }) {
  const cls =
    state === 'online' ? 'status-badge status-badge--online' : state === 'live' ? 'status-badge status-badge--live' : 'status-badge';
  return <span className={cls}>{children || state}</span>;
}

export function StreakBadge({ streak }) {
  if (!streak || !streak.current) return null;
  return (
    <span className="streak-badge" title="Practice streak" aria-label={`${streak.current} day practice streak`}>
      <span style={{ display: 'inline-flex' }} aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 6 5 9.5 5 13a7 7 0 0 0 14 0c0-3.5-3-7-7-11Zm0 18a4.5 4.5 0 0 1-4.5-4.5c0-2.6 2.1-5 4.5-7.5 2.4 2.5 4.5 4.9 4.5 7.5A4.5 4.5 0 0 1 12 20Z" /></svg>
      </span>
      {streak.current} {streak.current === 1 ? 'day' : 'days'}
    </span>
  );
}
