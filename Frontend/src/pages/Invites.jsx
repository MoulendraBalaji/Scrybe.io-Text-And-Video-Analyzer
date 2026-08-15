/* ============================================================
   Invites — send candidates a link to record their answer with
   no account needed. The graded result lands back on this
   dashboard (source = screened), reference answer included so
   the same engine that scores your practice scores them.
   ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea, Select } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { invitesApi, questionsApi } from '../services/api';

export default function Invites() {
  const [invites, setInvites] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const [draft, setDraft] = useState({
    useLibrary: true,
    question_id: '',
    prompt: '',
    reference_answer: '',
    expires_in_hours: 168,
    max_uses: 1,
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, qs] = await Promise.all([
        invitesApi.list(),
        questionsApi.list(),
      ]);
      setInvites(inv.invites || []);
      setQuestions(qs.questions || []);
    } catch (err) {
      setError(err.message || 'Invites could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedQuestion = questions.find((q) => String(q.id) === String(draft.question_id));

  const createInvite = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = {
        expires_in_hours: Number(draft.expires_in_hours),
        max_uses: Number(draft.max_uses),
      };
      if (draft.useLibrary && draft.question_id) {
        payload.question_id = Number(draft.question_id);
      } else {
        if (!draft.prompt.trim() || !draft.reference_answer.trim()) {
          throw new Error('Provide both a prompt and a reference answer for a custom invite.');
        }
        payload.prompt = draft.prompt.trim();
        payload.reference_answer = draft.reference_answer.trim();
      }
      await invitesApi.create(payload);
      setDraft((prev) => ({ ...prev, prompt: '', reference_answer: '' }));
      load();
    } catch (err) {
      setError(err.message || 'The invite could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (invite) => {
    const url = `${window.location.origin}/invite/${invite.token}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopied(invite.token);
    setTimeout(() => setCopied(null), 1800);
  };

  const statusOf = (inv) => {
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { label: 'Expired', cls: 'inv-status inv-status--expired' };
    if (inv.used_count >= inv.max_uses) return { label: 'Used up', cls: 'inv-status inv-status--expired' };
    return { label: 'Active', cls: 'inv-status' };
  };

  return (
    <div className="clay-container clay-section">
      <div className="clay-section-header clay-section-header--left">
        <span className="eyebrow">Screening</span>
        <h1 className="display display--lg">Candidate Invites</h1>
        <p style={{ color: 'var(--text-tertiary)', maxWidth: 560 }}>
          Generate a link, share it with a candidate, and get their scored response back here.
          They never need an account — your video and reference answer never leave your session.
        </p>
      </div>

      {error && (
        <Card padded={false} className="result-empty" style={{ minHeight: '130px', marginBottom: '1.2rem' }}>
          <p>{error}</p>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.4rem', alignItems: 'start' }}>
        {/* invite list */}
        <div>
          {loading ? (
            <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Spinner light />
            </Card>
          ) : invites.length === 0 ? (
            <Card padded={false} className="result-empty" style={{ minHeight: '220px' }}>
              <span className="clay-icon clay-icon--blue" style={{ width: 54, height: 54, fontSize: '1.4rem' }}>
                <Icon name="Share" size={26} />
              </span>
              <p>No invites yet. Create one on the right to start screening candidates.</p>
            </Card>
          ) : (
            <div className="inv-list">
              {invites.map((inv) => {
                const st = statusOf(inv);
                return (
                  <Card key={inv.token} interactive className="inv-card">
                    <div className="inv-card__top">
                      <span className="mono inv-card__token">{inv.token.slice(0, 14)}…</span>
                      <span className={st.cls}>{st.label}</span>
                    </div>
                    <p className="inv-card__prompt">{inv.prompt}</p>
                    <div className="inv-card__meta">
                      <span><Icon name="Timer" size={13} /> {inv.used_count}/{inv.max_uses} used</span>
                      <span><Icon name="Calendar" size={13} /> expires {inv.expires_at || '—'}</span>
                    </div>
                    <div className="inv-card__foot">
                      <Button size="sm" variant="primary" onClick={() => copyLink(inv)}>
                        <Icon name="Copy" size={15} /> {copied === inv.token ? 'Copied!' : 'Copy link'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* create form */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <span className="clay-icon clay-icon--sm clay-icon--red"><Icon name="Plus" size={18} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>New invite</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>A shareable candidate link</div>
            </div>
          </div>

          <form onSubmit={createInvite} style={{ display: 'grid', gap: '1rem' }}>
            <Field label="Question source">
              <Select value={draft.useLibrary ? 'library' : 'custom'} onChange={(e) => setDraft({ ...draft, useLibrary: e.target.value === 'library' })}>
                <option value="library">From question library</option>
                <option value="custom">Custom prompt</option>
              </Select>
            </Field>

            {draft.useLibrary ? (
              <Field label="Pick a question" hint="The model answer becomes the scoring reference">
                <Select value={draft.question_id} onChange={(e) => setDraft({ ...draft, question_id: e.target.value })}>
                  <option value="">Select a question…</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>{q.category} — {q.prompt.slice(0, 60)}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Prompt" required>
                  <Textarea rows={2} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} placeholder="e.g. Describe a time you handled a production incident." required />
                </Field>
                <Field label="Reference answer" required hint="Scored against this — include the concepts you want covered">
                  <Textarea rows={3} value={draft.reference_answer} onChange={(e) => setDraft({ ...draft, reference_answer: e.target.value })} placeholder="What a strong candidate should cover…" required />
                </Field>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <Field label="Expires (hours)">
                <Input type="number" min={1} max={8760} value={draft.expires_in_hours} onChange={(e) => setDraft({ ...draft, expires_in_hours: e.target.value })} />
              </Field>
              <Field label="Max uses">
                <Input type="number" min={1} max={1000} value={draft.max_uses} onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })} />
              </Field>
            </div>

            {selectedQuestion && draft.useLibrary && (
              <InsetNote>
                <strong>Reference:</strong> {selectedQuestion.model_answer || 'No model answer saved for this question.'}
              </InsetNote>
            )}

            <Button type="submit" variant="primary" loading={creating} disabled={draft.useLibrary && !draft.question_id}>
              <Icon name="Share" size={16} /> Generate invite link
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function InsetNote({ children }) {
  return (
    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--clay-surface-alt)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.85rem', lineHeight: 1.6 }}>
      {children}
    </div>
  );
}
