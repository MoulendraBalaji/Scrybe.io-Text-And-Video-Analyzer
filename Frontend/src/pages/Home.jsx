/* ============================================================
   Home — landing page. Hero anchors on the idle Pulse Orb.
   Stats, features, and testimonials are clay cards with staggered
   scroll-reveal. Copy kept from the original build.
   ============================================================ */

import { useNavigate } from 'react-router-dom';
import { PulseOrb } from '../components/motion/PulseOrb';
import { Reveal, RevealGroup } from '../components/motion/Reveal';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

const STATS = [
  { value: '99.2%', label: 'Transcription Accuracy' },
  { value: '2.4M+', label: 'Minutes Processed' },
  { value: '50K+', label: 'Active Users' },
  { value: '4.9/5', label: 'User Satisfaction' },
];

const FEATURES = [
  { icon: 'Mic', title: 'Transcript Generation', desc: 'High-fidelity speech-to-text with speaker diarization, timestamps, and multi-language support powered by Whisper AI.' },
  { icon: 'Camera', title: 'Frame Analyzer', desc: 'Real-time visual analysis detecting faces, objects, scene changes, and OCR text extraction from video frames.' },
  { icon: 'Brain', title: 'AI Summarization', desc: 'Intelligent extractive and abstractive summarization that distills key insights, action items, and highlights.' },
  { icon: 'Waveform', title: 'Similarity Detection', desc: 'Semantic embedding comparison using Sentence Transformers for accurate content overlap and confidence scoring.' },
  { icon: 'Screens', title: 'Live Screen Capture', desc: 'Capture screens, tabs, or windows with real-time frame analysis, telemetry, and live transcription.' },
  { icon: 'Chart', title: 'AI Insights Dashboard', desc: 'Comprehensive analytics with visual reports, deep dives, keyword analysis, and exportable results.' },
];

const TESTIMONIALS = [
  { text: '"Scrybe transformed how we evaluate interview responses. The similarity scoring is remarkably accurate."', author: 'Sarah Chen', role: 'VP of Talent, ScaleAI' },
  { text: '"The frame analysis combined with transcription gives us insights we never had before. Game changer."', author: 'Marcus Rivera', role: 'CTO, EduTech Solutions' },
  { text: '"We use Scrybe to analyze training videos. The AI summaries alone save us 20+ hours per week."', author: 'Priya Sharma', role: 'Learning & Development, GlobalCorp' },
];

export default function Home() {
  const navigate = useNavigate();
  const goWorkspace = () => navigate('/eval');

  return (
    <div className="clay-container">
      {/* ---------- HERO ---------- */}
      <section className="clay-section" aria-label="Scrybe intro">
        <div className="home-hero">
          <div className="home-hero__copy">
            <Reveal>
              <span className="clay-chip clay-chip--dot">Now powered by AI Intelligence Engine v2.0</span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="display display--xl" style={{ marginTop: '1.1rem' }}>
                Transform speech into<br />
                <span className="text-signal">actionable intelligence</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="home-hero__sub">
                Scrybe analyzes video responses with enterprise-grade AI — transcribing speech,
                detecting visual presence, and measuring semantic similarity against reference
                answers in real time.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="home-hero__actions">
                <Button variant="primary" magnetic onClick={goWorkspace}>
                  Start Analyzing
                  <Icon name="ArrowRight" size={18} color="#0C0E14" weight="bold" />
                </Button>
                <Button variant="ghost" onClick={() => navigate('/about')}>
                  Learn More
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="home-hero__orb">
            <PulseOrb mode="idle" size={clampOrb()} label={null} />
          </Reveal>
        </div>
      </section>

      {/* ---------- STATS ---------- */}
      <section className="clay-section--tight" aria-label="Platform stats">
        <div className="stats-grid">
          <RevealGroup stagger={0.09}>
            {STATS.map((s) => (
              <Card key={s.label} interactive className="stat-card">
                <div className="mono-value stat-card__value">{s.value}</div>
                <div className="stat-card__label">{s.label}</div>
              </Card>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="clay-section" aria-label="Features">
        <div className="clay-section-header">
          <Reveal>
            <span className="eyebrow">Features</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display display--md">AI-powered intelligence</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p style={{ color: 'var(--text-tertiary)' }}>
              Everything you need to analyze, understand, and improve video-based communication.
            </p>
          </Reveal>
        </div>

        <div className="features-grid">
          <RevealGroup stagger={0.08}>
            {FEATURES.map((f) => (
              <Card key={f.title} interactive className="feature-card">
                <span className="clay-icon">
                  <Icon name={f.icon} size={24} />
                </span>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__desc">{f.desc}</p>
              </Card>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <section className="clay-section--tight" aria-label="Testimonials" style={{ paddingBottom: '5rem' }}>
        <div className="clay-section-header">
          <Reveal>
            <span className="eyebrow eyebrow--blue">Testimonials</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display display--md">Trusted by teams worldwide</h2>
          </Reveal>
        </div>

        <div className="testimonials-grid">
          <RevealGroup stagger={0.1}>
            {TESTIMONIALS.map((t) => (
              <Card key={t.author} interactive className="testimonial-card">
                <span className="testimonial-card__stars" aria-label="5 out of 5 stars">
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i} style={{ color: 'var(--clay-amber)' }}>{s}</span>
                  ))}
                </span>
                <p className="testimonial-card__text">{t.text}</p>
                <div className="testimonial-card__author">{t.author}</div>
                <div className="testimonial-card__role">{t.role}</div>
              </Card>
            ))}
          </RevealGroup>
        </div>
      </section>
    </div>
  );
}

function clampOrb() {
  if (typeof window === 'undefined') return 340;
  return window.innerWidth < 480 ? 240 : 340;
}
