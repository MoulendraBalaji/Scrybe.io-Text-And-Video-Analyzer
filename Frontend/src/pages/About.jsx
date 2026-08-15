/* ============================================================
   About — lower-motion page by design. States the Scrybe Pulse
   USP in plain language: the one page where a visitor reads.
   ============================================================ */

import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/motion/Reveal';
import { Icon } from '../components/ui/Icon';

const SPECS = [
  { label: 'Engine', value: 'Scrybe AI v2.0' },
  { label: 'Transcription', value: 'OpenAI Whisper (base)' },
  { label: 'Embeddings', value: 'all-mpnet-base-v2' },
  { label: 'Analysis', value: 'Semantic + Keyword Hybrid' },
  { label: 'Facial Detection', value: 'OpenCV Haarcascade' },
  { label: 'API Protocol', value: 'REST + WebSocket' },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="clay-container clay-section">
      <Reveal>
        <span className="eyebrow">About</span>
        <h1 className="display display--lg" style={{ marginTop: '0.3rem' }}>The Scrybe Platform</h1>
      </Reveal>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: '1.4rem', alignItems: 'start', marginTop: '1.6rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <Reveal>
            <Card hero>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1rem' }}>
                Scrybe is an enterprise-grade AI platform built to evaluate video and audio responses
                against reference answers — combining state-of-the-art speech recognition, computer
                vision, and natural language processing into one communication-intelligence engine.
              </p>
            </Card>
          </Reveal>

          <Reveal delay={0.08}>
            <Card hero>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.7rem' }}>
                <span className="clay-icon clay-icon--sm"><Icon name="Pulse" size={18} weight="bold" /></span>
                <h2 className="display display--md" style={{ fontSize: '1.4rem' }}>Scrybe Pulse — coaching in the moment</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.94rem' }}>
                Most speech tools grade you <em>afterward</em>: you record, you wait, you read a report.
                Scrybe Pulse coaches you <strong style={{ color: 'var(--signal-red)' }}>while you speak</strong>.
                A live link streams frame telemetry from your screen every second or two; the engine
                watches for lighting, contrast, and silence before they hurt your score, and sends a
                short nudge the instant a threshold is crossed —{" "}
                <em>"Move toward better light," "You've paused — keep going," "You're drifting from the core topic."</em>{" "}
                The Pulse Orb you see in the hero becomes the live confidence meter here, deforming in
                real time with your signal. That is the product: a coach that reacts, not a rubric that
                judges.
              </p>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <Card>
            <div className="about-spec-grid">
              {SPECS.map((s) => (
                <div key={s.label}>
                  <div className="about-spec__label">{s.label}</div>
                  <div className="about-spec__value">{s.value}</div>
                </div>
              ))}
            </div>
            <hr className="clay-divider" />
            <p style={{ fontSize: '0.86rem', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
              Every result also produces an Answer DNA fingerprint — a radial map of which reference
              concepts you hit and which you skipped — plus a targeted follow-up question on your
              weakest point, so a single submission becomes a short mock-interview thread.
            </p>
            <Button variant="primary" magnetic onClick={() => navigate('/eval')} style={{ marginTop: '1.2rem' }}>
              Try the live coach <Icon name="ArrowRight" size={18} color="#0C0E14" weight="bold" />
            </Button>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
