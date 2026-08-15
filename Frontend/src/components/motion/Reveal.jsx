/* ============================================================
   Reveal — staggered clay-card entrances. Spring-driven opacity +
   translateY + scale + subtle rotate, once per element.
   ============================================================ */

import { motion } from 'framer-motion';

export function Reveal({ children, delay = 0, y = 26, rotate = 2, className = '', ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, scale: 0.97, rotate }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: '-50px 0px' }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 24,
        mass: 0.9,
        delay,
      }}
      style={{ transformOrigin: 'center' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function RevealGroup({ children, stagger = 0.09, className = '' }) {
  return (
    <div className={className} style={{ display: 'contents' }}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <Reveal key={i} delay={i * stagger} y={30} rotate={i % 2 === 0 ? 2 : -2}>
              {child}
            </Reveal>
          ))
        : children}
    </div>
  );
}
