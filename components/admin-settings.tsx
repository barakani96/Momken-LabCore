'use client';
import { useState, useEffect, useCallback } from 'react';
import { TextInput, Button, Tile, Stack, InlineNotification } from '@carbon/react';

export function AdminSettings() {
  const [timeoutMinutes, setTimeoutMinutes] = useState('15');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setTimeoutMinutes(data.timeout);
    } catch (e) {
      setError('Failed to load settings');
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: timeoutMinutes }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSuccess(true);
      setError(null);
      window.setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError('Failed to save settings');
    }
  };

  return (
    <Stack gap={6}>
      <h1>System Settings</h1>
      {error && <InlineNotification kind="error" title="Error" subtitle={error} />}
      <Tile>
        <Stack gap={4}>
          <TextInput 
            id="inactivity-timeout" 
            labelText="Inactivity Logout Threshold (minutes)" 
            value={timeoutMinutes} 
            onChange={e => setTimeoutMinutes(e.target.value)} 
          />
          <Button onClick={save}>Save Settings</Button>
          {success && <InlineNotification kind="success" title="Settings saved" />}
        </Stack>
      </Tile>
    </Stack>
  );
}
