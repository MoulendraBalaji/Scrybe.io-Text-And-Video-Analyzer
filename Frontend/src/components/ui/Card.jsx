/* ============================================================
   Card — extruded clay surface, optional subtle tilt on hover.
   ============================================================ */

import { forwardRef } from 'react';
import { useTilt } from '../../hooks/useTilt';

export const Card = forwardRef(function Card(
  { as = 'div', tilt = false, hero = false, interactive = false, padded = true, className = '', children, ...rest },
  forwardedRef
) {
  const tiltRef = useTilt(tilt);
  const ref = tilt ? tiltRef : forwardedRef;

  const classes = [
    'clay-card',
    hero ? 'clay-card--hero' : '',
    interactive ? 'clay-card--interactive' : '',
    padded ? 'clay-card--padding' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Tag = as;
  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  );
});

export function Inset({ as = 'div', small = false, className = '', children, ...rest }) {
  const Tag = as;
  return (
    <Tag className={`clay-inset${small ? ' clay-inset--sm' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
