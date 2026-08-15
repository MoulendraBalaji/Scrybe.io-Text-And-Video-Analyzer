/* ============================================================
   Scrybe — shared constants & enums
   Mirrors the backend schema lookups (SubscriptionTiers,
   ProcessingStatus, NotificationTypes) and the WS protocol.
   ============================================================ */

const resolveBase = () => {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
};

export const API_BASE = resolveBase();

export const WS_BASE = () => resolveBase().replace(/^http/, 'ws');

/* ---- SubscriptionTiers (database/schema_mysql.sql) ---- */
export const SubscriptionTiers = {
  FREE: { id: 1, name: 'free', maxProjects: 3, maxVideoSizeMB: 100, dailyApiCalls: 10, hasRealTimeProcessing: false, hasBatchProcessing: false },
  PRO: { id: 2, name: 'pro', maxProjects: 25, maxVideoSizeMB: 1000, dailyApiCalls: 500, hasRealTimeProcessing: true, hasBatchProcessing: false },
  ENTERPRISE: { id: 3, name: 'enterprise', maxProjects: 9999, maxVideoSizeMB: 5000, dailyApiCalls: 99999, hasRealTimeProcessing: true, hasBatchProcessing: true },
};

export const TIER_BY_ID = {
  1: SubscriptionTiers.FREE,
  2: SubscriptionTiers.PRO,
  3: SubscriptionTiers.ENTERPRISE,
};

/* ---- ProcessingStatus ---- */
export const ProcessingStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/* ---- NotificationTypes ---- */
export const NotificationTypes = {
  EVALUATION_COMPLETE: 'evaluation_complete',
  PROCESSING_ERROR: 'processing_error',
  SYSTEM_ALERT: 'system_alert',
  WELCOME: 'welcome',
};

/* ---- WebSocket protocol ---- */
export const WS_MSG = {
  CLIENT: {
    PING: 'ping',
    FRAME_ANALYSIS: 'frame_analysis',
    TELEMETRY: 'telemetry',
    TRANSCRIBE: 'transcribe',
  },
  SERVER: {
    PONG: 'pong',
    FRAME_RESULT: 'frame_result',
    TELEMETRY_RESULT: 'telemetry_result',
    COACH_NUDGE: 'coach_nudge',
    TRANSCRIPTION_RESULT: 'transcription_result',
  },
};

/* ---- Coach nudge types (backend thresholds) ---- */
export const NUDGE = {
  LIGHTING: 'lighting',
  CONTRAST: 'contrast',
  EDGE_DENSITY: 'edge_density',
  SILENCE: 'silence',
  DRIFT: 'semantic_drift',
  STREAK: 'streak',
};

/* ---- Score grading ---- */
export const gradeFor = (score) => {
  if (score >= 90) return 'Grade A';
  if (score >= 80) return 'Grade B';
  if (score >= 70) return 'Grade C';
  if (score >= 60) return 'Grade D';
  return 'Grade F';
};

export const gradeColor = (score) => {
  if (score >= 80) return 'var(--signal-red)';
  if (score >= 60) return 'var(--clay-amber)';
  return 'var(--clay-rose)';
};
