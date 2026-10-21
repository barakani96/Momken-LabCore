'use client';
import { Suspense, useState } from 'react';
import { Button, TextInput, InlineNotification, Tile } from '@carbon/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter(); const params = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState(''); const [recoveryMode, setRecoveryMode] = useState(false); const [mfaRequired, setMfaRequired] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const payload: Record<string, string> = { email, password }; if (mfaRequired) payload[recoveryMode ? 'recoveryCode' : 'totpCode'] = code; const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) }); const responseText = await response.text(); let body: { error?: string; mfaRequired?: boolean; user?: { id: string } }; try { body = responseText ? JSON.parse(responseText) as typeof body : {}; } catch { const contentType = response.headers.get('content-type') || ''; if (!response.ok) throw new Error(contentType.includes('text/html') ? `Sign-in service returned an HTML error (HTTP ${response.status}). Check the server terminal and database configuration.` : `Sign-in service returned an invalid response (HTTP ${response.status}). Check the server logs.`); throw new Error('Sign-in service returned an invalid response. Please try again.'); } if (body.mfaRequired) { setMfaRequired(true); setError('Enter the current authenticator code or switch to a recovery code.'); return; } if (!response.ok) throw new Error(body.error || `Unable to sign in (HTTP ${response.status}).`); router.replace(params.get('next') || '/worklist'); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); } finally { setBusy(false); } }
  return <div className="login-wrap"><Tile className="login-tile"><div className="login-brand"><span className="login-mark">N</span><div><h1>Northstar</h1><p>ERP + Laboratory Information System</p></div></div><h2>Sign in</h2><p className="login-description">Use your organization account to access laboratory operations.</p>{error && <InlineNotification kind={mfaRequired ? 'info' : 'error'} lowContrast title={mfaRequired ? 'Additional verification required' : 'Sign-in failed'} subtitle={error} hideCloseButton />}<form onSubmit={submit} className="login-form"><TextInput id="email" labelText="Work email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.currentTarget.value)} required /><TextInput id="password" labelText="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.currentTarget.value)} required />{mfaRequired && <><TextInput id="mfa-code" labelText={recoveryMode ? 'Recovery code' : 'Authenticator code'} autoComplete="one-time-code" value={code} onChange={e => setCode(e.currentTarget.value)} required /><Button kind="ghost" size="sm" type="button" onClick={() => { setRecoveryMode(!recoveryMode); setCode(''); }}>{recoveryMode ? 'Use authenticator code' : 'Use a recovery code'}</Button></>}<Button type="submit" size="lg" disabled={busy} className="login-submit">{busy ? 'Signing in…' : 'Sign in'}</Button></form><p className="login-footnote"><a href="/forgot-password">Forgot your password?</a></p><p className="login-footnote">Accounts are provisioned by an administrator. There is no public self-registration.</p></Tile></div>;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-wrap"><Tile className="login-tile"><p>Loading…</p></Tile></div>}>
      <LoginForm />
    </Suspense>
  );
}

