import { useState } from 'react';
import { supabase } from '../supabase';
import { useMfaStatus } from '../hooks/useMfaStatus';
import CandleLoader3D from './CandleLoader3D';

/**
 * MfaGate
 * -------
 * Wrap any authenticated view in this. It will:
 *   1. Force new users to enroll a TOTP authenticator (QR + verify code).
 *   2. Force returning users to enter a fresh TOTP code each session
 *      (until the session reaches aal2).
 *   3. Only render `children` once the session is fully aal2-verified.
 *
 * Because BIG-BULL-AI handles wallet/tax data, MFA is not optional here.
 */
export default function MfaGate({ user, children }) {
  const { status, factorId, refresh } = useMfaStatus(user);

  const [enrollData, setEnrollData] = useState(null); // { id, qrCode, secret }
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function startEnrollment() {
    setError(null);
    setBusy(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (enrollError) throw enrollError;
      setEnrollData({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      setEnrollData(null);
      setCode('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyChallenge(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      setCode('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'checking') {
    return (
      <div className="app-shell app-shell--centered">
        <CandleLoader3D label="Checking your security setup…" tone="mixed" />
      </div>
    );
  }

  if (status === 'ready') {
    return children;
  }

  if (status === 'needs-enroll') {
    return (
      <div className="app-shell app-shell--centered">
        <div className="login-panel">
          <h2>Set up two-factor authentication</h2>
          <p className="login-panel__subtitle">
            For your account's security, an authenticator app (Google Authenticator, Authy, 1Password, etc.)
            is required before you can access your wallets and tax data.
          </p>

          {!enrollData && (
            <button onClick={startEnrollment} disabled={busy}>
              {busy ? 'Preparing…' : 'Start setup'}
            </button>
          )}

          {enrollData && (
            <form onSubmit={verifyEnrollment} className="login-panel__form">
              <img
                src={enrollData.qrCode}
                alt="Scan this QR code with your authenticator app"
                style={{ background: '#fff', padding: 8, borderRadius: 8, alignSelf: 'center' }}
              />
              <p className="login-panel__notice">
                Can't scan it? Enter this code manually: <code>{enrollData.secret}</code>
              </p>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
                autoFocus
              />
              <button type="submit" disabled={busy || code.length !== 6}>
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
            </form>
          )}

          {error && <p className="login-panel__error">{error}</p>}
        </div>
      </div>
    );
  }

  // status === 'needs-challenge'
  return (
    <div className="app-shell app-shell--centered">
      <div className="login-panel">
        <h2>Enter your authenticator code</h2>
        <p className="login-panel__subtitle">
          Confirm it's you — enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={verifyChallenge} className="login-panel__form">
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            required
            autoFocus
          />
          <button type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        {error && <p className="login-panel__error">{error}</p>}
      </div>
    </div>
  );
}
