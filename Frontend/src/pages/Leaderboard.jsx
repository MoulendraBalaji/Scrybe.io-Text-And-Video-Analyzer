/* ============================================================
   Leaderboard — data-dense page. JetBrains Mono treatment on
   every score/grade; rows are inset clay strips; top ranks get
   real clay-relief medallions.
   ============================================================ */

import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { RankBadge } from '../components/ui/RankBadge';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { queriesApi } from '../services/api';
import { gradeColor } from '../types';

export default function Leaderboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await queriesApi.leaderboard();
        setItems(data.leaderboard || []);
      } catch (err) {
        setError(err.message || 'The leaderboard could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = items.filter(
    (item) =>
      item.name?.toLowerCase().includes(query.toLowerCase()) ||
      item.question?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="clay-container clay-section">
      <div className="clay-section-header clay-section-header--left">
        <span className="eyebrow">Performance Stats</span>
        <h1 className="display display--lg">Candidate Leaderboard</h1>
        <p style={{ color: 'var(--text-tertiary)' }}>Top performers ranked by similarity score</p>
      </div>

      <div className="lb-search">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '0.95rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'inline-flex', pointerEvents: 'none' }}>
            <Icon name="Search" size={18} />
          </span>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or question…"
            aria-label="Search leaderboard"
            style={{ paddingLeft: '2.7rem' }}
          />
        </div>
      </div>

      {loading ? (
        <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner light />
        </Card>
      ) : error ? (
        <Card padded={false} className="result-empty" style={{ minHeight: '220px' }}>
          <p>{error}</p>
        </Card>
      ) : (
        <>
          <div className="lb-head">
            <span>Rank</span><span>Candidate</span><span>Topic</span><span>Date</span><span>Score</span>
          </div>
          <div className="lb-list">
            {filtered.map((item, index) => (
              <div key={item.id ?? index} className="clay-table-row lb-row">
                <span className="lb-row__rank"><RankBadge rank={index} /></span>
                <span className="lb-row__name">{item.name}</span>
                <span className="lb-row__topic">{item.question}</span>
                <span className="lb-row__date">{item.date}</span>
                <span className="lb-row__score" style={{ color: gradeColor(item.score) }}>{item.score}%</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <Card padded={false} className="result-empty" style={{ minHeight: '180px' }}>
                <p>No submissions match that search.</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
