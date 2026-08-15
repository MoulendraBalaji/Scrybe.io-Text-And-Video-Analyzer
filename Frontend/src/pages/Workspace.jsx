/* ============================================================
   Workspace — the Scrybe Pulse recording + evaluation flow.
   Setup column (upload + live capture + reference) drives the
   results column. During capture we stream frames over the
   WebSocket (not REST polling) and render live coach nudges.
   ============================================================ */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { ScoreRing } from '../components/ui/ScoreRing';
import { AnswerDNA } from '../components/workspace/AnswerDNA';
import { ReplayTimeline } from '../components/workspace/ReplayTimeline';
import { LivePanel } from '../components/workspace/LivePanel';
import { RubricPanel } from '../components/workspace/RubricPanel';
import { useSocket } from '../hooks/useSocket';
import { sendFrame, subscribe } from '../services/socket';
import { evaluationApi, queriesApi, questionsApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { gradeFor } from '../types';

const STOP_WORDS = new Set(["the", "and", "that", "this", "for", "with", "you", "not", "have", "are", "was", "but", "their", "from", "then", "there", "what", "how", "who", "will", "would"]);

export default function Workspace() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const [question, setQuestion] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [historyCount, setHistoryCount] = useState(null);

  /* ---- live capture state ---- */
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [telemetry, setTelemetry] = useState({ brightness: null, contrast: null, edge_density: null, info_rate: null });
  const [nudges, setNudges] = useState([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [followUp, setFollowUp] = useState(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  /* ---- question library prefill (arrived with navigation state) ---- */
  useEffect(() => {
    const st = location.state;
    if (st && st.libraryPrompt) {
      setQuestion(st.libraryPrompt);
      if (st.libraryReference) setReferenceAnswer(st.libraryReference);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /* ---- recording consent gate (Section 1.5) ---- */
  const [consentOpen, setConsentOpen] = useState(false);

  /* ---- trust/privacy UI ---- */
  const [showScoredHow, setShowScoredHow] = useState(false);

  const captureCanvasRef = useRef(null);
  const videoStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const clientId = useMemo(
    () => (user && user.username ? user.username : `guest-${Math.random().toString(36).slice(2, 9)}`),
    [user]
  );
  const { connected } = useSocket(isRecording ? clientId : null);

  /* ---- live socket message handling ---- */
  const handleSocketMessage = useCallback((message) => {
    if (!message || !message.type) return;

    if (message.type === 'frame_result' || message.type === 'telemetry_result') {
      const d = message.data || message;
      setTelemetry((prev) => ({
        ...prev,
        brightness: d.brightness ?? prev.brightness,
        contrast: d.contrast ?? prev.contrast,
        edge_density: d.edge_density ?? prev.edge_density,
        info_rate: d.info_rate ?? prev.info_rate,
      }));
    } else if (message.type === 'coach_nudge') {
      setNudges((prev) => {
        const latest = prev[0];
        if (latest && latest.type === message.nudge_type) return prev;
        const next = [
          { id: Date.now() + Math.random(), type: message.nudge_type, message: message.message },
          ...prev,
        ];
        return next.slice(0, 6);
      });
    } else if (message.type === 'transcription_result') {
      setPartialTranscript((prev) => (prev ? `${prev} ${message.data?.text || ''}`.trim() : message.data?.text || ''));
    }
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const off = subscribe(handleSocketMessage);
    return off;
  }, [isRecording, handleSocketMessage]);

  /* ---- history count for the stat row ---- */
  useEffect(() => {
    if (!user) return;
    queriesApi.list(user.username).then((d) => setHistoryCount((d.queries || []).length)).catch(() => {});
  }, [user]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setError(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- screen capture (gated behind explicit consent) ---- */
  const openConsent = () => setConsentOpen(true);
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setMediaStream(stream);
      requestAnimationFrame(() => {
        if (videoStreamRef.current) videoStreamRef.current.srcObject = stream;
      });
      setIsRecording(true);
      setNudges([]);
      stream.getVideoTracks()[0].onended = () => stopScreenCapture();
    } catch {
      setError('Screen capture needs your permission to begin. Grant access and try again.');
    }
  };

  const stopScreenCapture = useCallback(() => {
    if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    setMediaStream(null);
    setIsRecording(false);
  }, [mediaStream]);

  /* ---- frame streaming loop over the socket ---- */
  useEffect(() => {
    if (!isRecording) return;
    let interval;

    const tick = async () => {
      const video = videoStreamRef.current;
      const canvas = captureCanvasRef.current;
      if (!video || !canvas || !(video.videoWidth > 0)) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);

      const sent = sendFrame(dataUrl);
      if (!sent) {
        // graceful fallback to REST if the live link dropped
        try {
          const tData = await evaluationApi.analyzeFrame(dataUrl);
          setTelemetry((prev) => ({ ...prev, ...tData }));
        } catch { /* quiet — telemetry is best-effort */ }
      }
    };

    interval = setInterval(tick, 1500);
    return () => clearInterval(interval);
  }, [isRecording]);

  /* ---- file handling ---- */
  const handleVideoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    } else {
      setError('That file type is not supported. Upload a video or audio file.');
    }
  };

  /* ---- scoring helpers ---- */
  const calculateKeywordOverlap = (transcript, reference) => {
    if (!transcript || !reference) return 0;
    const tWords = new Set(transcript.toLowerCase().match(/\b\w{3,}\b/g) || []);
    const rWords = new Set(reference.toLowerCase().match(/\b\w{3,}\b/g) || []);
    if (rWords.size === 0) return 0;
    const intersection = [...tWords].filter((x) => rWords.has(x)).length;
    return (intersection / rWords.size) * 100;
  };

  const getKeywordsAnalysis = useCallback(() => {
    if (!result || !result.transcript || !referenceAnswer) return { matched: [], missing: [] };
    const refWords = Array.from(new Set(referenceAnswer.toLowerCase().match(/\b\w{4,}\b/g) || []))
      .filter((w) => !STOP_WORDS.has(w))
      .slice(0, 15);
    const transText = (result.transcript || '').toLowerCase();
    const matched = [];
    const missing = [];
    refWords.forEach((word) => {
      const isMatch = transText.includes(word) || (word.length > 5 && transText.includes(word.substring(0, word.length - 2)));
      if (isMatch) matched.push(word);
      else missing.push(word);
    });
    return { matched, missing };
  }, [result, referenceAnswer]);

  /* ---- evaluate ---- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile || !referenceAnswer) {
      setError('Provide a reference answer and a video file before evaluating.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setFollowUp(null);

    try {
      const data = await evaluationApi.evaluate(videoFile, referenceAnswer, question);
      if (data.error) throw new Error(data.error);

      const scorePercentage = Math.round((data.score || 0));
      const keywordOverlap = calculateKeywordOverlap(data.transcript, referenceAnswer);

      const finalResult = {
        ...data,
        score: scorePercentage,
        breakdown: {
          semantic: scorePercentage,
          keyword: Math.round(keywordOverlap),
          hybrid: Math.round((scorePercentage + keywordOverlap) / 2),
          confidence: Math.round(85 + scorePercentage * 0.15),
        },
        grade: gradeFor(scorePercentage),
      };

      setResult(finalResult);
      setActiveTab('overview');

      if (user) {
        try {
          await queriesApi.create(user.username, {
            query_text: question || 'General Speech Scan',
            response_text: JSON.stringify({
              score: finalResult.score,
              rubric: finalResult.rubric,
              transcript: finalResult.transcript,
              summary: finalResult.summary,
              visual_feedback: finalResult.visual_feedback,
              feedback: finalResult.feedback,
              breakdown: finalResult.breakdown,
              grade: finalResult.grade,
              source: 'practice',
            }),
          });
          setHistoryCount((c) => (c ?? 0) + 1);
        } catch { /* history save is best-effort */ }
      }
    } catch (err) {
      setError(err.message || 'The evaluation engine could not be reached. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  /* ---- follow-up question (Phase 4) ---- */
  const requestFollowUp = async () => {
    const { missing } = getKeywordsAnalysis();
    setFollowUpLoading(true);
    setError(null);
    try {
      const data = await evaluationApi.followUp({
        transcript: result?.transcript || '',
        missing_concepts: missing,
        reference_answer: referenceAnswer,
      });
      setFollowUp(data.question || data.follow_up_question || 'What else could you add?');
    } catch (err) {
      setError(err.message || 'The follow-up coach is unavailable right now.');
    } finally {
      setFollowUpLoading(false);
    }
  };

  /* ---- export ---- */
  const downloadTranscript = (format) => {
    if (!result || !result.transcript) return;
    const timestamp = new Date().toLocaleDateString();
    const fileName = `Scrybe_Report_${new Date().getTime()}`;

    if (format === 'txt') {
      const content =
        `S C R Y B E  |  E V A L U A T I O N   R E P O R T\n` +
        `==================================================\n` +
        `Date: ${timestamp}\n` +
        `Target Question: ${question || 'General Speech Analysis'}\n` +
        `Performance Grade: ${result.grade}\n` +
        `Golden Score Similarity: ${result.score}%\n\n` +
        `TRANSCRIPT:\n-----------\n${result.transcript}\n\n` +
        `AI SUMMARY:\n-----------\n${result.summary || 'N/A'}\n\n` +
        `FEEDBACK SUMMARY:\n-----------------\nStrengths:\n${(result.feedback?.strengths || []).map((s) => ` - ${s}`).join('\n') || 'None'}\n\nMissing Concepts:\n${(result.feedback?.missing || []).map((m) => ` - ${m}`).join('\n') || 'None'}`;
      const element = document.createElement('a');
      element.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      element.download = `${fileName}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === 'pdf') {
      import('jspdf').then(({ jsPDF }) => {
        const doc = new jsPDF();
        doc.setFont('Helvetica');
        doc.setFontSize(22);
        doc.setTextColor(22, 22, 23);
        doc.text('S | Scrybe Speech Analysis', 15, 20);
        doc.setFontSize(10);
        doc.setTextColor(110, 110, 115);
        doc.text(`Report Generated: ${timestamp} | Score: ${result.score}% (${result.grade})`, 15, 28);
        doc.line(15, 32, 195, 32);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Question: ${question || 'General Speech Analysis'}`, 15, 40);
        doc.setFontSize(12);
        doc.setFont('Helvetica', 'bold');
        doc.text('Speech Transcript', 15, 52);
        doc.setFont('Helvetica', 'normal');
        doc.text(doc.splitTextToSize(result.transcript, 170), 15, 58);
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('AI Core Summary', 15, 20);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(doc.splitTextToSize(result.summary || 'No summary provided.', 170), 15, 28);

        // Rubric breakdown — the legible five-dimension report
        const dims = result.rubric?.dimensions;
        if (dims) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setFont('Helvetica', 'bold');
          doc.text('Delivery Rubric', 15, 20);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(`Weighted overall: ${result.score}% (${result.grade})`, 15, 28);
          let y = 38;
          Object.values(dims).forEach((dim) => {
            doc.setFont('Helvetica', 'bold');
            doc.text(`${dim.label}: ${Math.round(dim.score ?? 0)}/100`, 15, y);
            doc.setFont('Helvetica', 'normal');
            doc.text(doc.splitTextToSize(dim.feedback || '', 160), 15, y + 5);
            y += 16;
          });
        }
        doc.save(`${fileName}.pdf`);
      });
    }
  };

  const keywords = getKeywordsAnalysis();

  return (
    <div className="clay-container">
      {/* ---- stat strip ---- */}
      <div className="ws-stats">
        <Card padded={false} className="ws-stat">
          <span className="clay-icon clay-icon--sm"><Icon name="Fingerprint" size={18} /></span>
          <div>
            <div className="ws-stat__value mono">{result ? `${result.score}%` : '—'}</div>
            <div className="ws-stat__label">Accuracy Score</div>
          </div>
        </Card>
        <Card padded={false} className="ws-stat">
          <span className="clay-icon clay-icon--sm clay-icon--blue"><Icon name="FileText" size={18} /></span>
          <div>
            <div className="ws-stat__value" style={{ fontSize: '0.88rem' }}>{videoFile ? trimName(videoFile.name) : '—'}</div>
            <div className="ws-stat__label">Active File</div>
          </div>
        </Card>
        <Card padded={false} className="ws-stat">
          <span className="clay-icon clay-icon--sm clay-icon--amber"><Icon name="Chart" size={18} /></span>
          <div>
            <div className="ws-stat__value mono">{historyCount ?? '—'}</div>
            <div className="ws-stat__label">Total Evaluations</div>
          </div>
        </Card>
        <Card padded={false} className="ws-stat">
          <span className="clay-icon clay-icon--sm clay-icon--rose"><Icon name="Pulse" size={18} /></span>
          <div>
            <div className="ws-stat__value" style={{ fontSize: '0.88rem' }}>
              {isRecording ? 'Live link' : connected ? 'Online' : user ? 'Ready' : 'Signed out'}
            </div>
            <div className="ws-stat__label">System Status</div>
          </div>
        </Card>
      </div>

      <AnimatePresence mode="wait">
        {result && activeTab === 'deep-dive' ? (
          <motion.div key="deep" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'tween', duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            <div className="ai-hub-header">
              <div>
                <span className="eyebrow">Analytics Engine</span>
                <h2 className="display display--md" style={{ marginTop: '0.2rem' }}>Analytical Deep Dive</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('overview')}>
                <Icon name="ArrowLeft" size={15} /> Back to Report
              </Button>
            </div>

            <div className="deep-dive-grid">
              <Card>
                <h3 style={{ fontSize: '1.05rem' }}>Comprehensive Performance Analysis</h3>
                <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '0.8rem 0 1.2rem', fontSize: '0.88rem' }}>
                  Based on keyword analysis, your answer captured <strong style={{ color: 'var(--signal-red)' }}>{keywords.matched.length}</strong> out of{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{keywords.matched.length + keywords.missing.length || 1}</strong> primary concepts from the reference answer.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="metric-block">
                    <div className="metric-block__label">Contextual Accuracy</div>
                    <div className="metric-block__value" style={{ color: 'var(--signal-red)' }}>{result.breakdown.semantic}%</div>
                  </div>
                  <div className="metric-block">
                    <div className="metric-block__label">Term Fluidity</div>
                    <div className="metric-block__value" style={{ color: 'var(--ink-blue)' }}>{result.breakdown.keyword}%</div>
                  </div>
                </div>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Card>
                  <h3 style={{ fontSize: '1rem' }}>Synced Replay Timeline</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0.4rem 0 0.9rem' }}>
                    Jump straight to the moment clarity or lighting dropped.
                  </p>
                  <ReplayTimeline segments={result.transcript_segments} duration={result.duration_seconds} telemetry={result.telemetry} />
                </Card>

                <Card>
                  <h3 style={{ fontSize: '1rem' }}>Actionable Insights</h3>
                  <div>
                    {(result.feedback?.suggestions || []).map((item, idx) => (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-item__title">{item.type || 'General'}</div>
                        <div className="timeline-item__desc">{item.content || item}</div>
                      </div>
                    ))}
                    {(result.feedback?.suggestions || []).length === 0 && (
                      <div className="timeline-item">
                        <div className="timeline-item__title">General</div>
                        <div className="timeline-item__desc">Review the reference answer and incorporate missing concepts.</div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div className="strength-badge" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--signal-red)' }}>Key Strengths</div>
                      <ul className="strength-list" style={{ marginTop: '0.5rem' }}>
                        {(result.feedback?.strengths || []).map((item, idx) => <li key={idx}>{item}</li>)}
                        {(result.feedback?.strengths || []).length === 0 && <li>General match.</li>}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--clay-rose)' }}>Improvement Areas</div>
                      <ul className="missing-list" style={{ marginTop: '0.5rem' }}>
                        {(result.feedback?.missing || []).map((item, idx) => <li key={idx}>{item}</li>)}
                        {(result.feedback?.missing || []).length === 0 && <li>No major missing points.</li>}
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'tween', duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            <div className="ws-grid">
              {/* ---- LEFT: SETUP ---- */}
              <div>
                <div className="ws-column__heading">
                  <span className="eyebrow">01 · Setup</span>
                  <h2 className="display">Input Specifications</h2>
                </div>

                <Card>
                  <form onSubmit={handleSubmit}>
                    <Field label="Candidate Video Response" required>
                      {!videoPreview ? (
                        <div
                          className={`upload-area${dragActive ? ' upload-area--drag' : ''}`}
                          onClick={() => fileInputRef.current.click()}
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current.click()}
                          aria-label="Upload video file"
                        >
                          <span className="clay-icon"><Icon name="Upload" size={26} /></span>
                          <span className="upload-area__text">Drag &amp; drop or browse</span>
                          <span className="upload-area__hint">MP4, WEBM, WAV, or MP3 supported</span>
                        </div>
                      ) : (
                        <div className="video-preview-wrap">
                          <video src={videoPreview} controls />
                          <Button size="sm" variant="ghost" onClick={() => fileInputRef.current.click()}
                            style={{ position: 'absolute', bottom: '0.7rem', right: '0.7rem' }}>
                            Replace
                          </Button>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" onChange={handleVideoChange} style={{ display: 'none' }} accept="video/*,audio/*" />
                    </Field>

                    <hr className="clay-divider" />

                    {/* Live panel */}
                    <Field label="Live Screen Capture">
                      <LivePanel
                        isRecording={isRecording}
                        connected={connected}
                        telemetry={telemetry}
                        nudges={nudges}
                        onStart={openConsent}
                        onStop={stopScreenCapture}
                        videoStreamRef={videoStreamRef}
                        captureCanvasRef={captureCanvasRef}
                      />
                    </Field>

                    <Field label="Interview Question" hint="Optional — used as the report title">
                      <Input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g. Can you explain how async/await works?"
                      />
                    </Field>

                    <Field label="Reference Answer" required hint="The expected keywords or answer Scrybe scores against">
                      <Textarea
                        value={referenceAnswer}
                        onChange={(e) => setReferenceAnswer(e.target.value)}
                        placeholder="Provide the expected keywords or reference answer for similarity comparison..."
                        rows={4}
                        required
                      />
                    </Field>

                    <Button type="submit" variant="primary" fullWidth loading={loading} style={{ marginTop: '0.4rem' }}>
                      {loading ? 'Evaluating your answer…' : 'Evaluate my answer'}
                    </Button>

                    {error && (
                      <div role="alert" style={{ color: 'var(--clay-rose)', fontSize: '0.84rem', marginTop: '0.9rem', textAlign: 'center', lineHeight: 1.5 }}>
                        {error}
                      </div>
                    )}
                  </form>
                </Card>

                {/* trust + disclaimer (Section 1.5) */}
                <Card className="trust-card">
                  <div className="trust-card__row">
                    <Icon name="Shield" size={18} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Your video is deleted after processing</div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.6, marginTop: '0.25rem' }}>
                        Uploads are analyzed, scored, and removed immediately. Only the transcript, the
                        five-dimension rubric, and the summary are kept in your history — never the raw file.
                      </p>
                    </div>
                  </div>
                  <p className="trust-card__disclaimer">
                    Scrybe measures how well your spoken answer covers a reference answer. It is a delivery
                    and content coach — not a hiring decision-maker. Scores are directional, not absolute,
                    and should never be treated as a formal assessment of ability.
                  </p>
                </Card>
              </div>

              {/* ---- RIGHT: RESULTS ---- */}
              <div>
                <div className="ws-column__heading">
                  <span className="eyebrow eyebrow--blue">02 · Results</span>
                  <h2 className="display">Analysis Report</h2>
                </div>

                {!result ? (
                  <Card className="result-empty">
                    <span className="clay-icon clay-icon--blue" style={{ width: 64, height: 64, fontSize: '1.7rem' }}>
                      <Icon name="Chart" size={30} />
                    </span>
                    <p>Awaiting input specifications to generate report.</p>
                    <p style={{ fontSize: '0.82rem' }}>Upload a video and provide a reference answer to begin.</p>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <Card className="result-hero">
                      <ScoreRing score={result.score} grade={result.grade} />
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                        Evaluation completed successfully
                      </p>
                      <div className="result-actions">
                        <Button variant="ghost" size="sm" onClick={() => downloadTranscript('pdf')}>
                          <Icon name="Download" size={16} /> PDF Report
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadTranscript('txt')}>
                          <Icon name="FileText" size={16} /> Transcript
                        </Button>
                      </div>
                    </Card>

                    {/* Answer DNA fingerprint */}
                    <Card>
                      <div className="ai-hub-header">
                        <div>
                          <div style={{ fontWeight: 600 }}>Answer DNA Fingerprint</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                            {keywords.matched.length} concepts matched · {keywords.missing.length} missing
                          </div>
                        </div>
                      </div>
                      <AnswerDNA matched={keywords.matched} missing={keywords.missing} score={result.breakdown.hybrid} />
                    </Card>

                    {/* Five-dimension rubric */}
                    {result.rubric && (
                      <Card>
                        <div className="ai-hub-header">
                          <div>
                            <div style={{ fontWeight: 600 }}>Delivery Rubric</div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                              Five dimensions, each scored and explained — no more single opaque number
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setShowScoredHow((v) => !v)}>
                            {showScoredHow ? 'Hide' : 'How this is calculated'}
                          </Button>
                        </div>

                        <RubricPanel rubric={result.rubric} />

                        {showScoredHow && (
                          <div className="scored-how">
                            <p>
                              The overall score is a weighted blend of five dimensions:{' '}
                              {Object.entries(result.rubric.weights || {})
                                .map(([k, w]) => `${k.replace(/_/g, ' ')} ${w}%`)
                                .join(' · ')}
                              . Each dimension is scored against its own measurement — the content
                              dimension uses semantic + keyword similarity to your reference answer,
                              pace is measured in words-per-minute from the transcript timestamps,
                              filler words are counted per minute, and visual presence comes from the
                              on-camera face signal.
                            </p>
                          </div>
                        )}
                      </Card>
                    )}

                    {/* AI Intelligence Hub */}
                    <Card>
                      <div className="ai-hub-header">
                        <h3 style={{ fontSize: '1.05rem' }}>AI Intelligence Hub</h3>
                        <Button size="sm" variant="ghost" onClick={() => setActiveTab('deep-dive')}>
                          Deep Dive <Icon name="ArrowRight" size={14} />
                        </Button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <span className="eyebrow eyebrow--blue" style={{ marginBottom: '0.5rem' }}>Summary</span>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                            {result.summary || 'Summary generation completed.'}
                          </p>
                        </div>
                        <div>
                          <span className="eyebrow" style={{ marginBottom: '0.5rem' }}>Full Transcript</span>
                          <div className="transcript-box">
                            {result.transcript || 'No transcripted content available.'}
                          </div>
                        </div>
                      </div>

                      <hr className="clay-divider" />
                      <span className="eyebrow" style={{ marginBottom: '0.5rem' }}>Visual Presence Analysis</span>
                      <div className="visual-log">
                        {result.visual_feedback || 'No visual verification log generated.'}
                      </div>

                      {partialTranscript && (
                        <>
                          <hr className="clay-divider" />
                          <span className="eyebrow" style={{ marginBottom: '0.5rem' }}>Live Transcript (session)</span>
                          <div className="transcript-box">{partialTranscript}</div>
                        </>
                      )}

                      {/* Follow-up question */}
                      <hr className="clay-divider" />
                      <div className="followup-card">
                        <span className="clay-icon clay-icon--sm clay-icon--amber"><Icon name="ChatCircleText" size={18} /></span>
                        <div style={{ flex: 1 }}>
                          {followUp ? (
                            <>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Follow-up probe</div>
                              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '0.3rem' }}>
                                {followUp}
                              </p>
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Keep the conversation going</div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                Scrybe can generate one targeted follow-up on your weakest missing concept.
                              </p>
                              <Button size="sm" variant="ghost" loading={followUpLoading} onClick={requestFollowUp} style={{ marginTop: '0.6rem' }}>
                                <Icon name="Question" size={15} /> Ask the follow-up
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- recording consent modal (Section 1.5) ---- */}
      <AnimatePresence>
        {consentOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConsentOpen(false)}
          >
            <motion.div
              className="consent-modal"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="consent-title"
            >
              <span className="clay-icon clay-icon--sm clay-icon--red"><Icon name="Mic" size={20} /></span>
              <h3 id="consent-title" style={{ fontSize: '1.15rem', margin: '0.6rem 0' }}>Ready to record?</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Screen capture will stream frames to Scrybe's live coach while you speak.
                Your screen and audio stay in this session — nothing is stored on our servers,
                and the recording ends the moment you stop.
              </p>
              <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button variant="ghost" size="sm" onClick={() => setConsentOpen(false)}>Not now</Button>
                <Button variant="primary" size="sm" onClick={() => { setConsentOpen(false); startScreenCapture(); }}>
                  <Icon name="Play" size={15} /> I consent — start
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function trimName(name) {
  if (!name) return '—';
  return name.length > 15 ? `${name.slice(0, 12)}…` : name;
}
