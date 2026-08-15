/* ============================================================
   Footer — quiet clay footer
   ============================================================ */

import { Logo } from '../ui/Logo';

export function Footer() {
  return (
    <footer className="clay-footer">
      <div className="clay-footer__inner">
        <div className="clay-footer__brand">
          <Logo size={34} wordmarkSize="1rem" />
        </div>
        <div>
          © {new Date().getFullYear()} Scrybe AI. All rights reserved.
        </div>
        <div className="clay-footer__links">
          {['Privacy', 'Terms', 'Security', 'Docs'].map((label) => (
            <button key={label} className="clay-footer__link" role="link" tabIndex={0}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
