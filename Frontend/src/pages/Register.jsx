/* ============================================================
   Register — 3-step clay registration flow with the same
   validation logic as the original build.
   ============================================================ */

import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthShell, AuthBanner } from '../components/layout/AuthShell';
import { Field, Input, InputWithIcon } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { useAuthStore } from '../stores/useAuthStore';

const STEP_MOTION = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
};

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const register = useAuthStore((s) => s.register);

  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { kind, text }

  const fail = (text) => setBanner({ kind: 'error', text });

  const toStep2 = () => {
    if (!firstName.trim() || !lastName.trim()) {
      fail('Tell us your name first — both fields are required.');
      return;
    }
    setBanner(null);
    setStep(2);
  };

  const toStep3 = () => {
    if (!username.trim() || username.length < 3) {
      fail('Pick a username that is at least 3 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      fail('Usernames can only contain letters, numbers, and underscores.');
      return;
    }
    if (password.length < 6) {
      fail('Your password needs at least 6 characters.');
      return;
    }
    setBanner(null);
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setBanner(null);
    try {
      await register({
        username: username.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      navigate('/login', {
        state: { registered: username.trim() },
        replace: true,
      });
    } catch (err) {
      fail(err.message || 'Registration failed. Check the backend and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start your AI-powered analysis journey"
      step={step}
    >
      {banner && <AuthBanner kind={banner.kind}>{banner.text}</AuthBanner>}

      <form onSubmit={handleSubmit} noValidate>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" {...STEP_MOTION}>
              <div className="auth-step-label">
                <span className="auth-step-label__num">1</span>
                <span className="auth-step-label__title">Personal Information</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <Field label="First Name" required>
                  {(id) => (
                    <Input
                      id={id}
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      required
                    />
                  )}
                </Field>
                <Field label="Last Name" required>
                  {(id) => (
                    <Input
                      id={id}
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  )}
                </Field>
              </div>
              <Button type="button" variant="primary" fullWidth onClick={toStep2} style={{ marginTop: '0.6rem' }}>
                Continue
                <Icon name="ArrowRight" size={16} color="#0C0E14" weight="bold" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" {...STEP_MOTION}>
              <div className="auth-step-label">
                <span className="auth-step-label__num">2</span>
                <span className="auth-step-label__title">Account Credentials</span>
              </div>

              <Field label="Username" required>
                {(id) => (
                  <InputWithIcon icon="User">
                    <Input
                      id={id}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      required
                      autoComplete="username"
                      style={{ paddingLeft: '2.6rem' }}
                    />
                  </InputWithIcon>
                )}
              </Field>

              <Field label="Password" required hint="At least 6 characters">
                {(id) => (
                  <InputWithIcon icon="Lock">
                    <Input
                      id={id}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.4rem' }}>
                <Button variant="ghost" onClick={() => { setStep(1); setBanner(null); }}>
                  <Icon name="ArrowLeft" size={15} /> Back
                </Button>
                <Button variant="primary" onClick={toStep3}>
                  Review <Icon name="ArrowRight" size={15} color="#0C0E14" weight="bold" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" {...STEP_MOTION}>
              <div className="auth-step-label">
                <span className="auth-step-label__num">3</span>
                <span className="auth-step-label__title">Review & Confirm</span>
              </div>

              <div className="auth-review">
                <p><span>Name</span><strong>{firstName} {lastName}</strong></p>
                <p><span>Username</span><strong>{username}</strong></p>
              </div>

              <Button type="submit" variant="primary" fullWidth loading={loading}>
                Create Account
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => { setStep(2); setBanner(null); }} style={{ marginTop: '0.55rem' }}>
                <Icon name="ArrowLeft" size={15} /> Edit Details
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <p style={{ marginTop: '1.4rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
        Already have an account?{' '}
        <Link
          to="/login"
          className="auth-link"
          onClick={() => location.state && navigate('/login')}
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
