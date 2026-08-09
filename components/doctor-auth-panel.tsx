'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { DoctorProfile } from '@/lib/analysis-types';

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function DoctorAuthPanel({
  onAuthenticated,
  initialMode = 'signin',
  compact = false,
}: {
  onAuthenticated?: (doctor: DoctorProfile, token: string) => void;
  initialMode?: 'signin' | 'signup';
  compact?: boolean;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    hospital: '',
    specialty: '',
    phone: '',
    role: 'doctor' as 'doctor' | 'admin',
    adminCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup' && form.password.length < 8) {
        throw new Error('Choose a password of at least 8 characters.');
      }

      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'signup' ? form : { email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      onAuthenticated?.(data.doctor, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-xl border border-border bg-white shadow-sm ${compact ? 'p-6' : 'p-6 md:p-8'}`}>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-foreground">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>
        <p className="mt-1 text-sm text-foreground/60">
          {mode === 'signin'
            ? 'Access your screening workspace, reports and dashboard.'
            : 'A few details about you and your site, and you are ready to analyse.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'doctor', label: 'Doctor / Biologist', hint: 'Analyse smears, write reports' },
                  { value: 'admin', label: 'Administrator', hint: 'Supervision and audit' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update({ role: option.value })}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    form.role === option.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs text-foreground/60">{option.hint}</span>
                </button>
              ))}
            </div>

            {form.role === 'admin' ? (
              <input
                className={FIELD}
                placeholder="Administrator access code (if required)"
                value={form.adminCode}
                onChange={(event) => update({ adminCode: event.target.value })}
              />
            ) : null}

            <input className={FIELD} placeholder="Full name" value={form.fullName} onChange={(event) => update({ fullName: event.target.value })} required />
            <input className={FIELD} placeholder="Hospital or laboratory" value={form.hospital} onChange={(event) => update({ hospital: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={FIELD} placeholder="Specialty" value={form.specialty} onChange={(event) => update({ specialty: event.target.value })} />
              <input className={FIELD} placeholder="Phone" value={form.phone} onChange={(event) => update({ phone: event.target.value })} />
            </div>
          </>
        )}

        <input
          className={FIELD}
          placeholder="Email address"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => update({ email: event.target.value })}
          required
        />

        <div className="relative">
          <input
            className={`${FIELD} pr-11`}
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={form.password}
            onChange={(event) => update({ password: event.target.value })}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="mt-5 border-t border-border pt-5 text-center">
        {mode === 'signin' ? (
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
            }}
            className="rounded-lg bg-status-success/10 px-5 py-2.5 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/15"
          >
            Create new account
          </button>
        ) : (
          <p className="text-sm text-foreground/70">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className="font-semibold text-primary hover:underline"
            >
              Sign in instead
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
