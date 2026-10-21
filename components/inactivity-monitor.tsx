'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '@carbon/react';

export function InactivityMonitor() {
  const [showModal, setShowModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const warningTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => {
      window.location.href = '/login';
    });
  }, []);

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => setTimeoutMinutes(parseInt(data.timeout) || 15));
  }, []);

  const resetTimer = useCallback(() => {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearInterval(warningTimerRef.current);
    setShowModal(false);

    timerRef.current = setTimeout(() => {
      setShowModal(true);
      let count = 60;
      setTimeLeft(count);
      warningTimerRef.current = setInterval(() => {
        count -= 1;
        setTimeLeft(count);
        if (count <= 0) {
          clearInterval(warningTimerRef.current!);
          logout();
        }
      }, 1000);
    }, timeoutMs - 60000);
  }, [logout, timeoutMinutes]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearInterval(warningTimerRef.current);
    };
  }, [resetTimer]);

  return (
    <Modal
      open={showModal}
      modalHeading="Session Expiring"
      primaryButtonText="Extend Session"
      onRequestSubmit={() => {
        resetTimer();
        setShowModal(false);
      }}
      onRequestClose={() => {}}
    >
      <p>Your session will expire in {timeLeft} seconds due to inactivity. Please extend your session to continue.</p>
    </Modal>
  );
}
