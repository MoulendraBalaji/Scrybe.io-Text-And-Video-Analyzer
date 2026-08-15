/* ============================================================
   Login — claymorphism showcase. Inset inputs, extruded primary
   button, ambient blurred blobs behind the inflated clay card.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthShell, AuthBanner } from '../components/layout/AuthShell';
import { Field, Input, InputWithIcon } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { useAuthStore } from '../stores/useAuthStore';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const redirect = params.get('redirect');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setError(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Enter your username and password to sign in.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password, rememberMe);
      navigate(redirect || '/eval', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Check the backend and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where your practice left off"
    >
      {error && <AuthBanner kind="error">{error}</AuthBanner>}

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Username" required>
          {(id) => (
            <InputWithIcon icon="User">
              <Input
                id={id}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your username"
                required
                autoComplete="username"
                style={{ paddingLeft: '2.6rem' }}
              />
            </InputWithIcon>
          )}
        </Field>

        <Field label="Password" required>
          {(id) => (
            <InputWithIcon icon="Lock">
              <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ paddingLeft: '2.6rem', paddingRight: '2.8rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '0.7rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  padding: '0.35rem',
                }}
              >
                <Icon name={showPassword ? 'EyeSlash' : 'Eye'} size={18} />
              </button>
            </InputWithIcon>
          )}
        </Field>

        <div className="auth-options">
          <label>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember me
          </label>
          <button type="button" className="auth-link" onClick={() => setError('Password reset is coming soon. For now, reach out on the docs.')}>
            Forgot password?
          </button>
        </div>

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Sign In
        </Button>
      </form>

      <div className="auth-divider"><span>or continue with</span></div>

      <div className="social-auth">
        <Button variant="ghost" onClick={() => setError('Google sign-in is not wired up yet — use your Scrybe account.')}>
          Google
        </Button>
        <Button variant="ghost" onClick={() => setError('GitHub sign-in is not wired up yet — use your Scrybe account.')}>
          GitHub
        </Button>
      </div>

      <p style={{ marginTop: '1.4rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
        New to Scrybe?{' '}
        <Link to="/register" className="auth-link">Create your account</Link>
      </p>
    </AuthShell>
  );
}
