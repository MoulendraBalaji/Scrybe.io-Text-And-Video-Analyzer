/* ============================================================
   PageShell — nav + routed page + footer wrapper
   ============================================================ */

import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

function Page({ children }) {
  return (
    <motion.main
      className="clay-page"
      role="main"
      initial={{ opacity: 0, y: 18, scale: 0.99, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, scale: 0.995, filter: 'blur(3px)' }}
      transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.main>
  );
}

export function PageShell() {
  const location = useLocation();
  return (
    <div className="clay-shell">
      <Navbar key={location.pathname} />
      <AnimatePresence mode="wait" initial={false}>
        <Page key={location.pathname}>
          <Outlet />
        </Page>
      </AnimatePresence>
      <Footer />
    </div>
  );
}
