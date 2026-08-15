/* ============================================================
   Profile — the signed-in user's account: photo, details,
   streak, subscription tier, and privacy controls. Details and
   avatar are editable inline; changes persist to /me and flow
   straight back into the navbar avatar.
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Inset } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Avatar } from '../components/ui/Avatar';
import { LogoMark } from '../components/ui/Logo';
import { authApi, meApi, queriesApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

function readAndResizeAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error('That image could not be read.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [profile, setProfile] = useState(null);
  const [streak, setStreak] = useState(null);
  const [tier, setTier] = useState(null);
  const [evalCount, setEvalCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ---- avatar upload ---- */
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);

  /* ---- details editing ---- */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ first_name: '', last_name: '', email: '' });
  const [detailsSaving, setDetailsSaving] = useState(false);

  /* ---- privacy ---- */
  const [privacyMsg, setPrivacyMsg] = useState(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, streakData, tierData, queries] = await Promise.all([
        authApi.me(),
        meApi.streak().catch(() => null),
        meApi.tier().catch(() => null),
        queriesApi.list(user.username).catch(() => null),
      ]);
      setProfile(me);
      setStreak(streakData);
      setTier(tierData);
      setEvalCount((queries?.queries || []).length);
    } catch (err) {
      setError(err.message || 'Your profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || 'Scrybe user';

  /* ---- avatar handlers ---- */
  const onPickAvatar = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    setAvatarMsg(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarMsg('That image is larger than 3 MB — pick a smaller one.');
      return;
    }
    try {
      setAvatarPreview(await readAndResizeAvatar(file));
    } catch (err) {
      setAvatarMsg(err.message);
    }
  };

  const saveAvatar = async () => {
    if (!avatarPreview) return;
    setAvatarSaving(true);
    setAvatarMsg(null);
    try {
      const res = await meApi.updateAvatar(avatarPreview);
      updateUser(res.user);
      setProfile(res.user);
      setAvatarPreview(null);
      setAvatarMsg('Avatar updated.');
    } catch (err) {
      setAvatarMsg(err.message || 'Your avatar could not be saved.');
    } finally {
      setAvatarSaving(false);
    }
  };

  /* ---- details handlers ---- */
  const toggleEdit = () => {
    if (editing) {
      setEditing(false);
      return;
    }
    setDraft({
      first_name: profile?.first_name || user?.first_name || '',
      last_name: profile?.last_name || user?.last_name || '',
      email: profile?.email || user?.email || '',
    });
    setEditing(true);
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    if (!draft.first_name.trim() || !draft.last_name.trim()) {
      setError('First and last name are required.');
      return;
    }
    setDetailsSaving(true);
    setError(null);
    try {
      const res = await meApi.updateProfile({
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        email: draft.email.trim() || null,
      });
      updateUser(res.user);
      setProfile(res.user);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Your details could not be saved.');
    } finally {
      setDetailsSaving(false);
    }
  };

  /* ---- privacy handlers ---- */
  const exportData = async () => {
    setPrivacyBusy(true);
    setPrivacyMsg(null);
    try {
      const data = await meApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scrybe-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPrivacyMsg('Your data export has been downloaded.');
    } catch (err) {
      setPrivacyMsg(err.message || 'Export failed.');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const deleteData = async () => {
    if (!window.confirm('Delete ALL stored evaluations, notes, and invite results? This cannot be undone.')) return;
    setPrivacyBusy(true);
    setPrivacyMsg(null);
    try {
      const res = await meApi.deleteData();
      setPrivacyMsg(res.message || 'Your stored data was deleted.');
      setEvalCount(0);
      load();
    } catch (err) {
      setPrivacyMsg(err.message || 'Delete failed.');
    } finally {
      setPrivacyBusy(false);
    }
  };

  return (
    <div className="clay-container clay-section">
      <div className="clay-section-header clay-section-header--left">
        <span className="eyebrow">Your Scrybe</span>
        <h1 className="display display--lg">Profile</h1>
        <p style={{ color: 'var(--text-tertiary)' }}>Your identity, streak, and subscription at a glance</p>
      </div>

      {loading ? (
        <Card padded={false} style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner light />
        </Card>
      ) : error && !profile ? (
        <Card padded={false} className="result-empty" style={{ minHeight: '220px' }}>
          <p>{error}</p>
        </Card>
      ) : (
        <div className="profile-grid">
          {/* ---- Identity card ---- */}
          <Card className="profile-identity">
            <div className="profile-avatar-wrap">
              <Avatar user={avatarPreview ? { ...user, avatar: avatarPreview } : { ...user, avatar: profile?.avatar }} size={96} className="profile-avatar" />
              <button type="button" className="profile-avatar__edit" onClick={() => avatarInputRef.current?.click()} aria-label="Change profile photo">
                <Icon name="Camera" size={16} />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickAvatar} />
            </div>

            {avatarPreview && (
              <div className="profile-avatar__actions">
                <Button size="sm" variant="primary" loading={avatarSaving} onClick={saveAvatar}>
                  <Icon name="Check" size={15} /> Save photo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAvatarPreview(null); setAvatarMsg(null); }}>
                  Cancel
                </Button>
              </div>
            )}
            {avatarMsg && <p className="profile-msg">{avatarMsg}</p>}

            <h2 className="profile-identity__name">{displayName}</h2>
            <p className="profile-identity__handle">@{profile?.username || '—'}</p>

            <div className="profile-identity__meta">
              <div className="profile-meta-row">
                <span className="profile-meta-row__icon"><Icon name="User" size={16} /></span>
                <span className="profile-meta-row__label">Role</span>
                <span className="profile-meta-row__value">{profile?.role || 'Member'}</span>
              </div>
              <div className="profile-meta-row">
                <span className="profile-meta-row__icon"><Icon name="Envelope" size={16} /></span>
                <span className="profile-meta-row__label">Email</span>
                <span className="profile-meta-row__value">{profile?.email || 'Not set'}</span>
              </div>
              <div className="profile-meta-row">
                <span className="profile-meta-row__icon"><Icon name="Crown" size={16} /></span>
                <span className="profile-meta-row__label">Plan</span>
                <span className="profile-meta-row__value" style={{ textTransform: 'capitalize' }}>
                  {tier?.name || 'free'}
                </span>
              </div>
              <div className="profile-meta-row">
                <span className="profile-meta-row__icon"><Icon name="Flame" size={16} /></span>
                <span className="profile-meta-row__label">Streak</span>
                <span className="profile-meta-row__value">{streak?.current ?? 0} days</span>
              </div>
            </div>
          </Card>

          {/* ---- Right column ---- */}
          <div className="profile-main">
            {/* Stats */}
            <div className="profile-stats">
              <Card className="profile-stat">
                <span className="profile-stat__icon profile-stat__icon--red"><Icon name="Flame" size={22} /></span>
                <div>
                  <div className="profile-stat__value">{streak?.current ?? 0}</div>
                  <div className="profile-stat__label">Current streak</div>
                </div>
              </Card>
              <Card className="profile-stat">
                <span className="profile-stat__icon profile-stat__icon--blue"><Icon name="Chart" size={22} /></span>
                <div>
                  <div className="profile-stat__value">{streak?.longest ?? 0}</div>
                  <div className="profile-stat__label">Longest streak</div>
                </div>
              </Card>
              <Card className="profile-stat">
                <span className="profile-stat__icon profile-stat__icon--amber"><Icon name="Check" size={22} /></span>
                <div>
                  <div className="profile-stat__value">{streak?.total ?? 0}</div>
                  <div className="profile-stat__label">Days practiced</div>
                </div>
              </Card>
              <Card className="profile-stat">
                <span className="profile-stat__icon profile-stat__icon--rose"><Icon name="FileText" size={22} /></span>
                <div>
                  <div className="profile-stat__value">{evalCount ?? 0}</div>
                  <div className="profile-stat__label">Evaluations</div>
                </div>
              </Card>
            </div>

            {/* Details (editable) */}
            <Card className="profile-details">
              <div className="profile-card-head">
                <div>
                  <span className="eyebrow">Account</span>
                  <h3 style={{ fontSize: '1.05rem', marginTop: '0.25rem' }}>Your details</h3>
                </div>
                <Button size="sm" variant="ghost" onClick={toggleEdit}>
                  <Icon name={editing ? 'X' : 'User'} size={15} /> {editing ? 'Cancel' : 'Edit'}
                </Button>
              </div>

              {editing ? (
                <form onSubmit={saveDetails} className="profile-details__form">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <Field label="First name" required>
                      <Input value={draft.first_name} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} required />
                    </Field>
                    <Field label="Last name" required>
                      <Input value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} required />
                    </Field>
                  </div>
                  <Field label="Email">
                    <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="you@example.com" />
                  </Field>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <Button type="submit" size="sm" variant="primary" loading={detailsSaving}>
                      <Icon name="Check" size={15} /> Save changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Discard</Button>
                  </div>
                </form>
              ) : (
                <div className="profile-details__view">
                  <div className="profile-detail-row">
                    <span className="profile-detail-row__label">First name</span>
                    <span className="profile-detail-row__value">{profile?.first_name || user?.first_name || '—'}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-row__label">Last name</span>
                    <span className="profile-detail-row__value">{profile?.last_name || user?.last_name || '—'}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-row__label">Email</span>
                    <span className="profile-detail-row__value">{profile?.email || 'Not set'}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-row__label">Username</span>
                    <span className="profile-detail-row__value">{profile?.username || '—'}</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Subscription tier */}
            <Card className="profile-tier">
              <div className="profile-card-head">
                <div>
                  <span className="eyebrow">Subscription</span>
                  <h3 style={{ fontSize: '1.05rem', marginTop: '0.25rem', textTransform: 'capitalize' }}>
                    {tier?.name || 'Free'} tier
                  </h3>
                </div>
                <Chip tone={tier?.name === 'enterprise' ? 'red' : tier?.name === 'pro' ? 'blue' : ''}>
                  {tier?.name || 'free'}
                </Chip>
              </div>

              <div className="profile-tier__limits">
                <div className="profile-limit">
                  <span className="profile-limit__label">Max projects</span>
                  <span className="profile-limit__value">{tier?.maxProjects ?? '—'}</span>
                </div>
                <div className="profile-limit">
                  <span className="profile-limit__label">Max video size</span>
                  <span className="profile-limit__value">{tier ? `${tier.maxVideoSizeMB} MB` : '—'}</span>
                </div>
                <div className="profile-limit">
                  <span className="profile-limit__label">Daily API calls</span>
                  <span className="profile-limit__value">{tier?.dailyApiCalls ?? '—'}</span>
                </div>
                <div className="profile-limit">
                  <span className="profile-limit__label">Live processing</span>
                  <span className="profile-limit__value">{tier?.hasRealTimeProcessing ? 'Included' : '—'}</span>
                </div>
                <div className="profile-limit">
                  <span className="profile-limit__label">Batch processing</span>
                  <span className="profile-limit__value">{tier?.hasBatchProcessing ? 'Included' : '—'}</span>
                </div>
              </div>
            </Card>

            {/* Privacy & data */}
            <Card className="profile-account">
              <div className="profile-card-head">
                <div>
                  <span className="eyebrow">Privacy</span>
                  <h3 style={{ fontSize: '1.05rem', marginTop: '0.25rem' }}>Your data</h3>
                </div>
                <span className="clay-icon clay-icon--sm clay-icon--blue"><Icon name="Shield" size={18} /></span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: 1.65 }}>
                Raw videos are deleted right after processing; only transcripts, rubrics, and summaries are kept.
              </p>
              <Inset className="profile-account__inset" small>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  <div className="profile-account__row">
                    <span style={{ fontSize: '0.85rem' }}>Download everything we hold</span>
                    <Button size="sm" variant="ghost" onClick={exportData} loading={privacyBusy}>
                      <Icon name="Download" size={15} /> Export
                    </Button>
                  </div>
                  <div className="profile-account__row">
                    <span style={{ fontSize: '0.85rem' }}>Permanently erase my data</span>
                    <Button size="sm" variant="danger" onClick={deleteData} loading={privacyBusy}>
                      <Icon name="Trash" size={15} /> Delete
                    </Button>
                  </div>
                  {privacyMsg && (
                    <span style={{ fontSize: '0.8rem', color: privacyMsg.toLowerCase().includes('fail') ? 'var(--clay-rose)' : 'var(--clay-green, #3FB87E)' }}>
                      {privacyMsg}
                    </span>
                  )}
                </div>
              </Inset>
            </Card>

            {/* Account meta */}
            <Card className="profile-account">
              <div className="profile-account__brand">
                <LogoMark size={36} />
                <div>
                  <div style={{ fontWeight: 600 }}>Scrybe account</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Signed in as @{profile?.username || user?.username}</div>
                </div>
              </div>
              <Inset className="profile-account__inset">
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Scrybe stores your practice history privately. Your streak resets only if you take a day off — keep the flame alive.
                </span>
              </Inset>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
