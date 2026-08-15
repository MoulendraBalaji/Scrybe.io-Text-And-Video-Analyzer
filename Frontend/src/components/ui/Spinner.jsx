/* ============================================================
   Spinner — clay loading indicator
   ============================================================ */

export function Spinner({ light = false, size = 20 }) {
  return (
    <span
      className={light ? 'clay-spinner clay-spinner--light' : 'clay-spinner'}
      style={{ width: size, height: size, flex: 'none' }}
      aria-hidden="true"
    />
  );
}
