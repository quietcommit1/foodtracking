import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '../store';
export default function Auth({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit() {
    if (!supabase) {
      setMessage('Connect a Supabase project first. See README and .env.example.');
      return;
    }
    setBusy(true);
    const { error } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (signup)
      setMessage(
        'Account created. Check your email to confirm, or use the initial-account setup in the README.',
      );
    else (onSuccess ?? onClose)();
  }
  return (
    <Modal title={signup ? 'Create your account' : 'Welcome to Everyday'} onClose={onClose}>
      <p className="muted">Your food diary, privately synced across your devices.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <button
        className="text-button"
        onClick={() => {
          setSignup(!signup);
          setMessage('');
        }}
      >
        {signup ? 'Already have an account? Sign in' : 'Create an account'}
      </button>
      {!supabase && (
        <p className="warning">
          This instance is not connected to Supabase. No personal data will be saved until it is
          configured.
        </p>
      )}
    </Modal>
  );
}
