/* ============================================================
   AuthShell — shared login/register frame: ambient clay blobs +
   inflated clay card with header, progress, and banners.
   ============================================================ */

import { ClayBlobBackground } from '../motion/ClayBlobBackground';
import { LogoMark } from '../ui/Logo';

export function AuthShell({ title, subtitle, step, children }) {
  return (
    <div className="auth-layout">
      <ClayBlobBackground />
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__mark" aria-hidden="true"><LogoMark size={34} /></div>
          <h1 className="display display--md auth-card__title">{title}</h1>
          <p className="auth-card__sub">{subtitle}</p>
        </div>

        {step && (
          <div className="auth-progress" aria-label="Registration progress">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`auth-progress__dot${s === step ? ' auth-progress__dot--active' : ''}${s < step ? ' auth-progress__dot--done' : ''}`}
              />
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export function AuthBanner({ kind = 'error', children }) {
  return (
    <div className={`auth-banner auth-banner--${kind}`} role="alert">
      <span aria-hidden="true">{kind === 'success' ? '✓' : '!'}</span>
      <span>{children}</span>
    </div>
  );
}
