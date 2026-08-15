/* ============================================================
   useReducedMotion — prefers-reduced-motion + device capability
   Used to skip heavy R3F scenes and disable rotation/tilt/parallax.
   ============================================================ */

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getPrefersReduced() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(QUERY).matches;
}

function getSnapshot() {
  return getPrefersReduced();
}

/* Detect low-end / small viewport so we can drop the 3D scene
   and fall back to the CSS/SVG orb. */
export function deviceSupports3D() {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < 720) return false;
  const cores = (navigator.hardwareConcurrency || 8);
  if (cores <= 4) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      : '';
    if (/swiftshader|software|llvmpipe/i.test(renderer)) return false;
  } catch {
    return false;
  }
  return true;
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
