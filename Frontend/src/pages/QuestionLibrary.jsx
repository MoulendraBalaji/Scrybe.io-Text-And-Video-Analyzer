/* ============================================================
   Question Library — curated prompts + model answers that kill
   the cold start. Public browse; signed-in users can contribute
   their own questions and practise any entry straight away.
   ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Inset } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea, Select } from '../components/ui/Field';
import { Chip } from '../components/ui/Chip';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { questionsApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

const CATEGORIES = [
  'Behavioral',
  'Technical/SWE',
  'Product/PM',
  'Academic Oral Exam',
  'Sales Pitch',
  'Public Speaking',
];

export default function QuestionLibrary() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [questions, setQuestions] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ---- custom-question form ---- */
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ category: 'Behavioral', prompt: '', model_answer: '', key_concepts: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cat) => {
    setLoading(true);
    setError(null);
    try {
      const data = await questionsApi.list(cat);
      setQuestions(data.questions || []);
    } catch (err) {
      setError(err.message || 'The question library could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(category);
  }, [load, category]);

  const practise = (q) => {
    navigate('/eval', {
      state: {
        libraryPrompt: q.prompt,
        libraryReference: q.model_answer || '',
      },
    });
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!draft.prompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await questionsApi.create({
        category: draft.category,
        prompt: draft.prompt.trim(),
        model_answer: draft.model_answer.trim(),
        key_concepts: draft.key_concepts
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setDraft({ category: 'Behavioral', prompt: '', model_answer: '', key_concepts: '' });
      setShowForm(false);
      load(category);
    } catch (err) {
      setError(err.message || 'Your question could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (id) => {
    setError(null);
    try {
      await questionsApi.remove(id);
      load(category);
    } catch (err) {
      setError(err.message || 'That question could not be deleted.');
    }
  };

  return (
    <div className="clay-container clay-section">
      <div className="clay-section-header clay-section-header--left">
        <div className="clay-section-header__row">
          <div>
            <span className="eyebrow">Question Bank</span>
            <h1 className="display display--lg">Question Library</h1>
            <p style={{ color: 'var(--text-tertiary)', maxWidth: 560 }}>
              Curated prompts with model answers and key concepts. Pick one, head to the workspace,
              and the reference answer is pre-filled — no more blank-page cold starts.
            </p>
          </div>
          {user && (
            <Button onClick={() => setShowForm((v) => !v)}>
              <Icon name="Plus" size={16} /> {showForm ? 'Close' : 'Add question'}
            </Button>
          )}
        </div>
      </div>

      {user && showForm && (
        <Card style={{ marginBottom: '1.4rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Contribute a question</h3>
          <form onSubmit={submitQuestion} style={{ display: 'grid', gap: '1rem' }}>
            <Field label="Category" required>
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Question prompt" required>
              <Textarea rows={3} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} placeholder="e.g. Walk me through how you would design a rate limiter." required />
            </Field>
            <Field label="Model answer" hint="The reference Scrybe scores against — be specific">
              <Textarea rows={4} value={draft.model_answer} onChange={(e) => setDraft({ ...draft, model_answer: e.target.value })} placeholder="The ideal response a strong candidate would give…" />
            </Field>
            <Field label="Key concepts" hint="Comma-separated — e.g. token bucket, sliding window, Redis">
              <Input value={draft.key_concepts} onChange={(e) => setDraft({ ...draft, key_concepts: e.target.value })} placeholder="token bucket, sliding window, Redis" />
            </Field>
            <div>
              <Button type="submit" variant="primary" loading={saving}>Save to library</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="lb-search">
        <div className="ql-cats" role="tablist" aria-label="Question categories">
          <button className={`ql-cat${!category ? ' ql-cat--active' : ''}`} onClick={() => setCategory('')}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`ql-cat${category === c ? ' ql-cat--active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card padded={false} className="result-empty" style={{ minHeight: '150px', margin: '1.2rem 0' }}>
          <p>{error}</p>
        </Card>
      )}

      {loading ? (
        <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner light />
        </Card>
      ) : (
        <div className="ql-grid">
          {questions.map((q) => {
            const mine = user && q.created_by === user.username;
            return (
              <Card key={q.id} className="ql-card">
                <div className="ql-card__top">
                  <Chip tone={q.category === 'Technical/SWE' ? 'blue' : q.category === 'Behavioral' ? 'red' : ''}>{q.category}</Chip>
                  {mine && <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>yours</span>}
                </div>
                <h3 className="ql-card__prompt">{q.prompt}</h3>
                <div className="ql-card__concepts">
                  {(q.key_concepts || []).slice(0, 5).map((c, i) => (
                    <span key={i} className="concept-chip">{c}</span>
                  ))}
                </div>
                {q.model_answer && (
                  <Inset small className="ql-card__answer">
                    <div className="mono" style={{ fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      MODEL ANSWER
                    </div>
                    <p>{q.model_answer}</p>
                  </Inset>
                )}
                <div className="ql-card__foot">
                  <Button size="sm" variant="primary" onClick={() => practise(q)}>
                    <Icon name="Pulse" size={15} /> Practise this
                  </Button>
                  {mine && (
                    <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)} aria-label="Delete question">
                      <Icon name="Trash" size={15} />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          {questions.length === 0 && (
            <Card padded={false} className="result-empty" style={{ minHeight: '220px' }}>
              <p>No questions in this category yet.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
