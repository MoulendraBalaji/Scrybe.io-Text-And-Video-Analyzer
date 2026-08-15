/* ============================================================
   LivePanel — the Scrybe Pulse recording workspace.
   The Pulse Orb becomes the live confidence meter here: its color
   and deformation track the WebSocket telemetry stream, and coach
   nudges surface the moment a threshold is crossed.
   ============================================================ */

import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PulseOrb } from '../motion/PulseOrb';
import { orbSignal } from '../../utils/pulse';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/Chip';

const NUDGE_TONE = {
  lighting: '',
  contrast: '',
  edge_density: '',
  silence: 'warn',
  semantic_drift: 'info',
  streak: '',
};

export const LivePanel = forwardRef(function LivePanel(
  { isRecording, connected, telemetry, nudges, onStart, onStop, videoStreamRef, captureCanvasRef },
  forwardedRef
) {
  const signal = orbSignal(telemetry, 0.5);

  return (
    <div className="live-panel" ref={forwardedRef}>
      <div className="live-panel__head">
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Scrybe Pulse</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
            Coaching in the moment, not a grade afterward
          </div>
        </div>
        <StatusBadge state={isRecording ? 'live' : connected ? 'online' : 'offline'}>
          {isRecording ? 'Recording' : connected ? 'Live link' : 'Idle'}
        </StatusBadge>
      </div>

      {/* capture preview */}
      <div className="capture-video-wrap" style={{ position: 'relative' }}>
        <video ref={videoStreamRef} autoPlay playsInline muted className="capture-video" style={{ opacity: isRecording ? 1 : 0.25 }} />
        {!isRecording && (
          <div className="capture-placeholder" style={{ position: 'absolute', inset: 0 }}>
            <span className="clay-icon"><Icon name="Screens" size={26} /></span>
            <span>Start recording to stream frame telemetry over the live link</span>
          </div>
        )}
      </div>
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      {/* orb + readouts */}
      <div className="live-panel__orb clay-inset">
        <PulseOrb
          mode={isRecording ? 'live' : 'idle'}
          telemetry={telemetry}
          confidence={isRecording ? 0.45 + signal * 0.4 : 0.5}
          size={220}
          label={isRecording ? 'Live confidence' : 'Awaiting signal'}
        />
        <div className="telemetry-row">
          {[
            ['Brightness', telemetry.brightness, '—'],
            ['Contrast', telemetry.contrast, '—'],
            ['Edge density', telemetry.edge_density, '—'],
            ['Info rate', telemetry.info_rate, '—'],
          ].map(([label, value]) => (
            <div key={label} className="telemetry-cell">
              <span className="telemetry-cell__label">{label}</span>
              <span className="telemetry-cell__value">{value != null ? `${Math.round(value)}%` : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {!isRecording ? (
          <Button variant="primary" fullWidth onClick={onStart}>
            <Icon name="Play" size={16} color="#0C0E14" weight="fill" /> Start Recording
          </Button>
        ) : (
          <Button variant="danger" fullWidth onClick={onStop}>
            <Icon name="Stop" size={16} weight="fill" /> Stop Recording
          </Button>
        )}
      </div>

      {/* coach nudges */}
      <div className="nudge-stack" aria-live="polite">
        {nudges.length === 0 ? (
          <div className="nudge-stack__empty">
            {isRecording
              ? 'Nudges will appear here the moment a signal crosses its threshold.'
              : 'The live coach sits idle until you start recording.'}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {nudges.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={`coach-nudge coach-nudge--${NUDGE_TONE[n.type] || ''}`.trimEnd()}>
                  <Icon name="Pulse" size={18} color="var(--signal-red)" weight="bold" />
                  <span>{n.message}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
});
