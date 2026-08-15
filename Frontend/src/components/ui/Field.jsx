/* ============================================================
   Field — labelled clay input family (input / textarea / select)
   Concave inset style: pressed into the surface.
   ============================================================ */

import { forwardRef, useId } from 'react';
import { Icon } from './Icon';

export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId();
  return (
    <div className={`clay-field ${className}`}>
      {label && (
        <label className="clay-field__label" htmlFor={id}>
          {label} {required && <span style={{ color: 'var(--signal-red)' }}>*</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {hint && !error && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{hint}</span>}
      {error && (
        <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--clay-rose)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`clay-input ${className}`.trim()} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`clay-textarea ${className}`.trim()} {...rest} />;
});

export const Select = forwardRef(function Select({ className = '', ...rest }, ref) {
  return <select ref={ref} className={`clay-select ${className}`.trim()} {...rest} />;
});

/* Inset input with a leading icon (username, password, etc.) */
export function InputWithIcon({ icon, iconProps, children }) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && (
        <span
          style={{
            position: 'absolute',
            left: '0.95rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            pointerEvents: 'none',
          }}
        >
          <Icon name={icon} size={18} {...iconProps} />
        </span>
      )}
      {children}
    </div>
  );
}
