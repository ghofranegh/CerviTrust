'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getStoredDoctorToken, setStoredDoctorToken } from '@/lib/client-auth';

interface DoctorProfile {
  id: string;
  fullName: string;
  email: string;
  hospital: string;
  specialty: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export function DoctorAuthPanel({ onAuthenticated }: { onAuthenticated?: (doctor: DoctorProfile) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    hospital: '',
    specialty: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) return;
    void fetchCurrentDoctor(token);
  }, []);

  async function fetchCurrentDoctor(token: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-doctor-token': token },
      });
      const data = await res.json();
      if (data.doctor) {
        setDoctor(data.doctor);
        onAuthenticated?.(data.doctor);
      } else {
        setStoredDoctorToken(null);
      }
    } catch {
      setStoredDoctorToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'signup' ? form : { email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      setStoredDoctorToken(data.token);
      setDoctor(data.doctor);
      onAuthenticated?.(data.doctor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  if (doctor) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Doctor access</h3>
          <p className="text-sm text-foreground/60">Sign in or create your account to save analyses and manage your profile.</p>
        </div>
        <div className="flex rounded-lg border border-border p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${mode === 'signin' ? 'bg-primary text-white' : 'text-foreground/70'}`}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${mode === 'signup' ? 'bg-primary text-white' : 'text-foreground/70'}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <>
            <input
              className="w-full rounded-lg border border-border px-3 py-2"
              placeholder="Full name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              required
            />
            <input
              className="w-full rounded-lg border border-border px-3 py-2"
              placeholder="Hospital"
              value={form.hospital}
              onChange={(event) => setForm({ ...form, hospital: event.target.value })}
              required
            />
            <input
              className="w-full rounded-lg border border-border px-3 py-2"
              placeholder="Specialty"
              value={form.specialty}
              onChange={(event) => setForm({ ...form, specialty: event.target.value })}
            />
            <input
              className="w-full rounded-lg border border-border px-3 py-2"
              placeholder="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </>
        )}
        <input
          className="w-full rounded-lg border border-border px-3 py-2"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          className="w-full rounded-lg border border-border px-3 py-2"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
