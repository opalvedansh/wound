'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '../../../components/shell';
import { Button, Field, Input } from '../../../components/ui';
import type { Me } from '@antigravity-project-spec-pack/domain/api';
import { api } from '../../../lib/api';
import { forgetMe, keys } from '../../../lib/queries';
import { supabaseBrowser as supabase } from '../../../lib/supabase/client';

type Mode = 'signin' | 'forgot' | 'sent' | 'set';

/**
 * Sign in. Accounts are invite-only (no self sign-up): an invited member, or someone who forgot their password,
 * arrives here from the email's link and chooses a password.
 */
export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Invite and recovery links carry the session in the URL fragment (never sent to the server).
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    if (access && refresh) {
      const type = hash.get('type');
      window.history.replaceState(null, '', window.location.pathname);
      void supabase.auth.setSession({ access_token: access, refresh_token: refresh }).then(({ error: e }) => {
        if (e) setError('This link has expired. Ask for a new one below.');
        else if (type === 'invite' || type === 'recovery') setMode('set');
        else void done();
      });
    } else if (hash.get('error_description')) {
      setError(hash.get('error_description'));
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('set');
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  // Straight to the right first page for the role, with the profile already cached for the menu.
  const done = async () => {
    qc.clear();
    forgetMe();
    const me = await api<Me>('/me').catch(() => null);
    if (me) qc.setQueryData(keys.me, me);
    const role = me?.memberships[0]?.role;
    router.replace(role === 'FRONT_DESK' ? '/patients' : '/dashboard');
    router.refresh();
  };

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
      else return done();
    } else if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
      if (err) setError(err.message);
      else setMode('sent');
    } else if (mode === 'set') {
      if (password.length < 8) setError('Use at least 8 characters.');
      else if (password !== confirm) setError("The passwords don't match.");
      else {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) setError(err.message);
        else return done();
      }
    }
    setBusy(false);
  };

  const title = { signin: 'Sign in', forgot: 'Reset your password', sent: 'Check your email', set: 'Choose a password' }[mode];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between bg-accent p-12 text-on-accent lg:flex">
        <div className="flex items-center gap-3">
          <span className="rounded-[13px] ring-2 ring-white/30">
            <Logo />
          </span>
          <span className="text-lg font-semibold">Wound Care</span>
        </div>
        <div>
          <p className="max-w-md text-[28px] leading-tight font-semibold tracking-tight">Every wound measured the same way, every visit, by every clinician.</p>
          <p className="mt-4 max-w-md text-sm opacity-80">
            AI outlines and measures the wound from a photo; clinicians review every draft before it becomes part of the record.
          </p>
        </div>
        <p className="text-[12px] opacity-70">Research prototype, not for patient care.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold">Wound Care</span>
          </div>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">
            {mode === 'signin' && 'Clinic portal for doctors, admins and front-desk staff.'}
            {mode === 'forgot' && "Enter your email and we'll send you a link to choose a new password."}
            {mode === 'sent' && `If ${email} has an account, a link is on its way. It works once and expires in an hour.`}
            {mode === 'set' && 'At least 8 characters. You will use it to sign in from now on.'}
          </p>

          {mode !== 'sent' ? (
            <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
              {error ? (
                <div role="alert" className="rounded-lg bg-overdue-soft px-3 py-2.5 text-[13px] text-overdue">
                  {error}
                </div>
              ) : null}
              {mode !== 'set' ? (
                <Field label="Email">
                  <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@clinic.com" autoFocus />
                </Field>
              ) : null}
              {mode === 'signin' || mode === 'set' ? (
                <Field label={mode === 'set' ? 'New password' : 'Password'}>
                  <Input
                    type="password"
                    autoComplete={mode === 'set' ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              ) : null}
              {mode === 'set' ? (
                <Field label="Repeat the password">
                  <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
              ) : null}
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send link' : 'Save password'}
              </Button>
            </form>
          ) : null}

          <div className="mt-6 text-center text-[13px] text-muted">
            {mode === 'signin' ? (
              <>
                <button type="button" className="cursor-pointer font-medium text-accent hover:underline" onClick={() => (setMode('forgot'), setError(null))}>
                  Forgot your password?
                </button>
                <p className="mt-3">No account? Ask your clinic admin to invite you.</p>
              </>
            ) : mode !== 'set' ? (
              <button type="button" className="cursor-pointer font-medium text-accent hover:underline" onClick={() => (setMode('signin'), setError(null))}>
                Back to sign in
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
