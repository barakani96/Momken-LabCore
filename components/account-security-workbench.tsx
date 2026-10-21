'use client';
import { useState } from 'react';
import { Button, InlineNotification, Stack, Tile, TextInput } from '@carbon/react';
export function AccountSecurityWorkbench() {
  const [secret, setSecret] = useState(''); const [code, setCode] = useState(''); const [recovery, setRecovery] = useState<string[]>([]); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  async function call(path: string, body?: unknown) { setBusy(true); setStatus(''); try { const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data; } catch (e) { setStatus(e instanceof Error ? e.message : 'Request failed'); return null; } finally { setBusy(false); } }
  async function setup() { const data = await call('/api/auth/mfa/setup'); if (data) { setSecret(data.secret); setStatus(`Enrollment started. Add this secret to your authenticator app and confirm within ${data.expiresInSeconds / 60} minutes.`); } }
  async function verify() { const data = await call('/api/auth/mfa/verify', { code }); if (data) { setRecovery(data.recoveryCodes || []); setSecret(''); setCode(''); setStatus('Multi-factor authentication enabled. Store recovery codes safely.'); } }
  async function disable() { const data = await call('/api/auth/mfa/disable', { code }); if (data) { setRecovery([]); setSecret(''); setCode(''); setStatus(data.message); } }
  return <Stack gap={6} className="account-security-workbench">
    <div><h1>Account security</h1><p>Protect your Northstar account with an authenticator app and single-use recovery codes.</p></div>
    {status && <InlineNotification kind={status.includes('enabled') ? 'success' : 'info'} title="Security status" subtitle={status} lowContrast />}
    <Tile><Stack gap={4}><h2>Authenticator-based MFA</h2><p>Use a TOTP authenticator app. Enrollment expires after 10 minutes and requires confirmation before MFA is activated.</p><Button onClick={setup} disabled={busy}>Start MFA enrollment</Button>{secret && <><TextInput id="mfa-secret" labelText="Manual setup secret" value={secret} readOnly /><p>Enter the secret in your authenticator app, then enter its current six-digit code below.</p></>}<TextInput id="mfa-code" labelText="Authenticator code" value={code} onChange={e => setCode(e.target.value)} maxLength={20} autoComplete="one-time-code" /><div className="security-actions"><Button onClick={verify} disabled={busy || !secret || !/^\d{6}$/.test(code)}>Confirm and enable</Button><Button kind="danger--tertiary" onClick={disable} disabled={busy || code.length < 6}>Disable MFA</Button></div></Stack></Tile>
    {recovery.length > 0 && <Tile><Stack gap={3}><h2>Recovery codes — shown once</h2><p>Save these codes in a secure place. Each code can be used once and will not be shown again.</p><pre className="mfa-recovery-codes">{recovery.join('\n')}</pre><Button onClick={() => navigator.clipboard?.writeText(recovery.join('\n'))}>Copy recovery codes</Button></Stack></Tile>}
  </Stack>;
}
