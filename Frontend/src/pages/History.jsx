/* ============================================================
   History — past evaluations as clay cards, plus the Practice
   Journal surfaced from the previously-unused notes table.
   ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Inset } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Field } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { queriesApi, notesApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { RubricPanel } from '../components/workspace/RubricPanel';
import { gradeColor } from '../types';

function parseItem(item) {
  try {
    const evalResult = JSON.parse(item.response_text);
    return {
      dbId: item.id,
      date: new Date(item.created_at).toLocaleDateString(),
      question: item.query_text,
      ...evalResult,
    };
  } catch {
    return {
      dbId: item.id,
      date: new Date(item.created_at).toLocaleDateString(),
      question: item.query_text,
      score: 0,
      grade: 'Grade F',
      transcript: 'Unable to parse result.',
    };
  }
}

export default function History() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [openRubric, setOpenRubric] = useState(null);

  /* ---- practice journal (notes table) ---- */
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queriesApi.list(user.username);
      setItems((data.queries || []).map(parseItem));
    } catch (err) {
      setError(err.message || 'Your history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notesApi.list(user.username);
      setNotes(data.notes || []);
    } catch { /* journal is best-effort */ }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchNotes();
    }
  }, [user, fetchHistory, fetchNotes]);

  const deleteItem = async (dbId) => {
    try {
      await queriesApi.remove(dbId);
      fetchHistory();
    } catch (err) {
      setError(err.message || 'That record could not be deleted.');
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!noteDraft.trim()) return;
    setNoteSaving(true);
    try {
      await notesApi.create(user.username, noteDraft.trim());
      setNoteDraft('');
      fetchNotes();
    } catch (err) {
      setError(err.message || 'Your note could not be saved.');
    } finally {
      setNoteSaving(false);
    }
  };

  const filtered = items.filter(
    (item) =>
      item.question?.toLowerCase().includes(query.toLowerCase()) ||
      (item.transcript && item.transcript.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="clay-container clay-section">
      <div className="clay-section-header clay-section-header--left">
        <span className="eyebrow eyebrow--blue">Records Log</span>
        <h1 className="display display--lg">Evaluation History</h1>
        <p style={{ color: 'var(--text-tertiary)' }}>Your previous analysis results and reports</p>
      </div>

      {error && (
        <Card padded={false} className="result-empty" style={{ minHeight: '150px', marginBottom: '1.2rem' }}>
          <p>{error}</p>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.4rem', alignItems: 'start' }}>
        {/* history list */}
        <div>
          <div style={{ position: 'relative', marginBottom: '1.2rem', maxWidth: 420 }}>
            <span style={{ position: 'absolute', left: '0.95rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'inline-flex', pointerEvents: 'none' }}>
              <Icon name="Search" size={18} />
            </span>
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history by topic or keywords…"
              aria-label="Search history"
              style={{ paddingLeft: '2.7rem' }}
            />
          </div>

          {loading ? (
            <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Spinner light />
            </Card>
          ) : filtered.length === 0 ? (
            <Card padded={false} className="result-empty" style={{ minHeight: '220px' }}>
              <p>No history matches your criteria.</p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/eval')}>
                Evaluate an answer <Icon name="ArrowRight" size={14} />
              </Button>
            </Card>
          ) : (
            <div className="history-grid">
              {filtered.map((item, index) => (
                <Card key={item.dbId ?? index} interactive className="history-card">
                  <div>
                    <div className="history-card__date">{item.date}</div>
                    <h3 className="history-card__question">{item.question}</h3>
                    <p className="history-card__snippet">{item.transcript || 'No transcript text log.'}</p>
                  </div>
                  <div className="history-card__foot">
                    <div>
                      <div className="history-card__score" style={{ color: gradeColor(item.score) }}>{item.score}%</div>
                      <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{item.grade}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {item.rubric && (
                        <Button size="sm" variant="ghost" onClick={() => setOpenRubric(openRubric === item.dbId ? null : item.dbId)}>
                          <Icon name="Chart" size={15} /> Rubric
                        </Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => deleteItem(item.dbId)} aria-label="Delete history item">
                        <Icon name="Trash" size={15} />
                      </Button>
                    </div>
                  </div>
                  {openRubric === item.dbId && item.rubric && (
                    <div className="history-card__rubric">
                      <RubricPanel compact rubric={item.rubric} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* practice journal */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <span className="clay-icon clay-icon--sm clay-icon--amber"><Icon name="Notebook" size={18} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>Practice Journal</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>Streak notes between sessions</div>
            </div>
          </div>

          <form onSubmit={addNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
            <Textarea
              rows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What did you work on today?"
              style={{ minHeight: '64px' }}
            />
            <Button type="submit" size="sm" variant="ghost" loading={noteSaving}>
              <Icon name="Check" size={15} /> Log entry
            </Button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 360, overflowY: 'auto' }}>
            {notes.length === 0 && (
              <div className="nudge-stack__empty">No journal entries yet. Your notes persist across sessions.</div>
            )}
            {notes.map((note) => (
              <Inset key={note.id} small style={{ padding: '0.7rem 0.85rem' }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{note.content}</div>
                <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>{note.created_at}</div>
              </Inset>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
