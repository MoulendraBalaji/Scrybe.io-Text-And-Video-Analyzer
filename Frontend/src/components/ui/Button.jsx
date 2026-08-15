/* ============================================================
   Button — clay-extruded button. Primary CTA carries the
   signature gradient + magnetic hover. :active presses inward.
   ============================================================ */

import { forwardRef } from 'react';
import { useMagnetic } from '../../hooks/useTilt';
import { Spinner } from './Spinner';

export const Button = forwardRef(function Button(
  {
    as = 'button',
    variant = 'default',
    size = 'md',
    loading = false,
    magnetic = false,
    children,
    className = '',
    type = 'button',
    ...rest
  },
  forwardedRef
) {
  const magnetRef = useMagnetic(magnetic ? 0.18 : 0);
  const ref = magnetic ? magnetRef : forwardedRef;

  const classes = [
    'clay-btn',
    variant === 'primary' ? 'clay-btn--primary' : '',
    variant === 'ghost' ? 'clay-btn--ghost' : '',
    variant === 'danger' ? 'clay-btn--danger' : '',
    size === 'sm' ? 'clay-btn--sm' : '',
    rest.fullWidth ? 'clay-btn--full' : '',
    magnetic ? 'clay-btn__magnet' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = loading ? (
    <>
      <Spinner light={variant === 'primary'} /> {children}
    </>
  ) : (
    children
  );

  if (as === 'a') {
    return (
      <a ref={ref} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button ref={ref} className={classes} type={type} disabled={loading || rest.disabled} {...rest}>
      {content}
    </button>
  );
});
