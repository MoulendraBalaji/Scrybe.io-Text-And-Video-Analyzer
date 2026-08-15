/* ============================================================
   Navbar — floating pill-shaped clay bar.
   Brand left, links centered, account actions right. The user's
   avatar opens an account dropdown (Profile / Sign out) instead
   of a separate nav link. Leaderboard was retired from the bar.
   On the workspace route the bar auto-hides (pushed out of view)
   until the page is scrolled up / the pointer returns to the top.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { StreakBadge } from '../ui/Chip';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { LogoMark } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { motion, AnimatePresence } from 'framer-motion';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/eval', label: 'Workspace' },
  { to: '/questions', label: 'Library' },
  { to: '/progress', label: 'Progress' },
  { to: '/invites', label: 'Invites' },
  { to: '/history', label: 'History' },
  { to: '/about', label: 'About' },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, streak, refreshStreak } = useAuthStore();
  const isWorkspace = location.pathname === '/eval';
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(isWorkspace);
  const lastY = useRef(0);
  const menuRef = useRef(null);

  useEffect(() => {
    if (user && !streak) refreshStreak();
  }, [user, streak, refreshStreak]);

  useEffect(() => {
    setMenuOpen(false);
    setOpen(false);
  }, [location.pathname]);

  /* Auto-hide on the workspace: push the bar away once the user
     scrolls down or starts interacting; bring it back on scroll up. */
  useEffect(() => {
    if (!isWorkspace) return;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 6) return;
      if (y > lastY.current && y > 120) setHidden(true);
      else if (y < lastY.current) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isWorkspace]);

  /* Close the account dropdown on outside click / Escape. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  return (
    <header
      className={`clay-nav-wrap${hidden ? ' clay-nav-wrap--hidden' : ''}`}
      onMouseEnter={() => isWorkspace && setHidden(false)}
    >
      <nav className="clay-nav" role="navigation" aria-label="Main navigation">
        <Link to="/" className="clay-nav__brand" aria-label="Scrybe home">
          <LogoMark size={28} />
          <span>Scrybe</span>
        </Link>

        <div className={`clay-nav__links${open ? ' clay-nav__links--open' : ''}`}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `clay-nav__link${isActive ? ' clay-nav__link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="clay-nav__actions">
          {user ? (
            <div className="clay-nav__user" ref={menuRef}>
              <StreakBadge streak={streak} />
              <button
                type="button"
                className="clay-nav__account"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <Avatar user={user} size={34} />
                <span className="clay-nav__name">{user.first_name || user.username}</span>
                <Icon name="CaretDown" size={12} className="clay-nav__caret" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    className="clay-nav__menu"
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="clay-nav__menu-head">
                      <Avatar user={user} size={40} />
                      <div>
                        <div className="clay-nav__menu-name">{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}</div>
                        <div className="clay-nav__menu-handle">@{user.username}</div>
                      </div>
                    </div>
                    <Link to="/profile" className="clay-nav__menu-item" role="menuitem">
                      <Icon name="User" size={16} /> Profile
                    </Link>
                    <button type="button" className="clay-nav__menu-item" role="menuitem" onClick={handleLogout}>
                      <Icon name="SignOut" size={16} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          )}

          <button
            className="clay-nav__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <Icon name={open ? 'X' : 'List'} size={20} />
          </button>
        </div>
      </nav>
    </header>
  );
}
