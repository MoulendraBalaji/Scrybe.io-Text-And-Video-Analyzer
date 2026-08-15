/* ============================================================
   CandidateInvite — public, account-free screening page.
   Candidates see the prompt, give consent, record or upload,
   and get the same five-dimension rubric back. No signup.
   Rendered OUTSIDE PageShell (own minimal chrome).
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { ScoreRing } from '../components/ui/ScoreRing';
import { CandidateRecorder } from '../components/workspace/CandidateRecorder';
import { invitesApi } from '../services/api';
import { LogoMark } from '../components/ui/Logo';
import { gradeFor } from '../types';

const DIM_COLORS = {
  content_accuracy: 'var(--signal-red)',
  structure: 'var(--ink-blue)',
  filler_words: 'var(--clay-amber)',
  pace: '#7C5CFC',
  visual_presence: '#3FB87E',
};

export default function CandidateInvite() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [consented, setConsented] = useState(false);
  const [mode, setMode] = useState(null); // 'record' | 'upload'
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await invitesApi.get(token);
        setInvite(data);
      } catch (err) {
        setError(err.message || 'This invite link is invalid.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const submit = async (videoFile) => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await invitesApi.submit(token, videoFile);
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Your response could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="cand-shell">
        <CandBrand />
        <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem', minWidth: 'min(720px, 92vw)' }}>
          <Spinner light />
        </Card>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="cand-shell">
        <CandBrand />
        <Card className="result-empty" style={{ minWidth: 'min(720px, 92vw)' }}>
          <span className="clay-icon clay-icon--rose" style={{ width: 54, height: 54, fontSize: '1.4rem' }}>
            <Icon name="Link" size={26} />
          </span>
          <p>{error}</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Back to Scrybe</Button>
        </Card>
      </div>
    );
  }

  const rubric = result?.rubric?.dimensions || {};
  const dims = Object.entries(rubric);

  return (
    <div className="cand-shell">
      <CandBrand />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: 'min(720px, 92vw)' }}
      >
        {!result ? (
          <Card>
            <span className="eyebrow">Screened response</span>
            <h1 className="display display--md" style={{ margin: '0.4rem 0 1rem' }}>{invite.prompt}</h1>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.86rem', lineHeight: 1.7 }}>
              Record a short spoken answer. Scrybe scores structure, content coverage, pace, filler
              usage, and on-camera presence — then the result is sent to the person who invited you.
            </p>

            {/* trust + consent */}
            <div className="cand-trust">
              <div className="cand-trust__row">
                <Icon name="Shield" size={18} />
                <span>Your recording is processed automatically and <strong>deleted immediately after analysis</strong>. It is never stored.</span>
              </div>
              <div className="cand-trust__row">
                <Icon name="Timer" size={18} />
                <span>Aim for 1–2 minutes. Only your spoken words and a few delivery metrics are sent back.</span>
              </div>
              <label className="cand-consent">
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
                <span>I understand my response will be recorded and analyzed by Scrybe's evaluation engine.</span>
              </label>
            </div>

            {consented && !mode && (
              <div className="cand-modes">
                <Button variant="primary" onClick={() => setMode('record')}>
                  <Icon name="Camera" size={16} /> Record with camera
                </Button>
                <Button variant="ghost" onClick={() => setMode('upload')}>
                  <Icon name="Upload" size={16} /> Upload a video
                </Button>
              </div>
            )}

            {consented && mode === 'record' && (
              <CandidateRecorder
                onRecorded={(f) => submit(f)}
                onCancel={() => setMode('upload')}
              />
            )}

            {consented && mode === 'upload' && (
              <div>
                {!file ? (
                  <div
                    className="upload-area"
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  >
                    <span className="clay-icon"><Icon name="Upload" size={24} /></span>
                    <span className="upload-area__text">Choose a video file</span>
                    <span className="upload-area__hint">MP4 or WEBM supported</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                      <Icon name="FileText" size={15} /> {file.name}
                    </p>
                    <div style={{ display: 'flex', gap: '0.7rem' }}>
                      <Button variant="primary" loading={submitting} onClick={() => submit(file)}>
                        <Icon name="Check" size={16} /> Submit for scoring
                      </Button>
                      <Button variant="ghost" onClick={() => setFile(null)}>Choose another</Button>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            )}

            {submitting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', color: 'var(--text-tertiary)', fontSize: '0.86rem', marginTop: '1rem' }}>
                <Spinner light /> Scoring your response…
              </div>
            )}

            {error && (
              <div role="alert" style={{ color: 'var(--clay-rose)', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</div>
            )}
          </Card>
        ) : (
          /* ---- result ---- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <Card className="result-hero">
              <ScoreRing score={Math.round(result.score || 0)} grade={gradeFor(result.score || 0)} label="OVERALL" />
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.84rem', textAlign: 'center', maxWidth: 420 }}>
                Thank you! Your response has been scored and sent to the person who invited you.
              </p>
            </Card>

            <Card>
              <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Delivery breakdown</div>
              <div className="rubric-grid">
                {dims.map(([key, dim]) => (
                  <div key={key} className="rubric-dim">
                    <div className="rubric-dim__row">
                      <span className="rubric-dim__label" style={{ color: DIM_COLORS[key] || 'var(--text-secondary)' }}>{dim.label || key}</span>
                      <span className="mono rubric-dim__score">{Math.round(dim.score ?? 0)}</span>
                    </div>
                    <div className="rubric-bar">
                      <div className="rubric-bar__fill" style={{ width: `${Math.min(100, Math.max(0, dim.score ?? 0))}%`, background: DIM_COLORS[key] || 'var(--signal-red)' }} />
                    </div>
                    <p className="rubric-dim__feedback">{dim.feedback}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function CandBrand() {
  return (
    <div className="cand-brand">
      <LogoMark size={34} />
      <span>Scrybe</span>
    </div>
  );
}
