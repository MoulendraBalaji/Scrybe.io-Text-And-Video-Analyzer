/* ============================================================
   Avatar — circular clay avatar. Renders the user's uploaded
   photo when present, otherwise their initials on the signature
   gradient. Clickable when onClick is provided.
   ============================================================ */

export function Avatar({ user, size = 34, onClick, className = '', 'aria-label': ariaLabel }) {
  const initials = (() => {
    const first = (user?.first_name || '')[0] || '';
    const last = (user?.last_name || '')[0] || '';
    return `${first}${last}`.toUpperCase() || (user?.username || '?')[0].toUpperCase();
  })();

  const inner = user?.avatar ? (
    <img src={user.avatar} alt="" className="avatar-img" draggable={false} />
  ) : (
    initials
  );

  const cls = `avatar ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        aria-label={ariaLabel || 'User menu'}
        style={{ width: size, height: size }}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={cls} aria-hidden="true" style={{ width: size, height: size }}>
      {inner}
    </span>
  );
}
