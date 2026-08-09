'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStoredDoctorToken, setStoredDoctorToken } from '@/lib/client-auth';
import type { DoctorProfile } from '@/lib/analysis-types';

/** Broadcast so every mounted component reacts to a sign-in / sign-out. */
const SESSION_EVENT = 'cervitrust:session';

export function notifySessionChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

/**
 * Single source of truth for "who is signed in". Every page uses this instead of
 * repeating the /api/auth/me fetch, so the header, the gate and the profile all
 * stay in sync after a sign-in, an avatar change or a sign-out.
 */
export function useDoctorSession() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getStoredDoctorToken();
    if (!token) {
      setDoctor(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', { headers: { 'x-doctor-token': token } });
      const data = await res.json();
      if (data.doctor) {
        setDoctor(data.doctor);
      } else {
        setStoredDoctorToken(null);
        setDoctor(null);
      }
    } catch {
      setDoctor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const onChange = () => void load();
    window.addEventListener(SESSION_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(SESSION_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [load]);

  const signIn = useCallback((profile: DoctorProfile, token: string) => {
    setStoredDoctorToken(token);
    setDoctor(profile);
    setLoading(false);
    notifySessionChange();
  }, []);

  const signOut = useCallback(() => {
    setStoredDoctorToken(null);
    setDoctor(null);
    notifySessionChange();
  }, []);

  /** Apply a fresh profile locally (after a PATCH) without a round trip. */
  const updateDoctor = useCallback((profile: DoctorProfile) => {
    setDoctor(profile);
    notifySessionChange();
  }, []);

  return { doctor, loading, reload: load, signIn, signOut, updateDoctor };
}
