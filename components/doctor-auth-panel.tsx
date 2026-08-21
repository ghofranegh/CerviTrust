'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { DoctorProfile } from '@/lib/analysis-types';

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

/** Grey, non-editable "+216" prefix next to an 8-digit-only phone input. */
function PhoneField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <span className="flex items-center bg-secondary px-3 text-sm text-foreground/50">+216</span>
      <input
        className="w-full min-w-0 flex-1 px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:outline-none"
        placeholder="Phone (optional)"
        type="tel"
        inputMode="numeric"
        maxLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 8))}
      />
    </div>
  );
}

export function DoctorAuthPanel({
  onAuthenticated,
  compact = false,
}: {
  onAuthenticated?: (doctor: DoctorProfile, token: string) => void;
  compact?: boolean;
}) {
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    hospital: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/auth/bootstrap-status')
      .then((res) => res.json())
      .then((data) => setNeedsBootstrap(Boolean(data.needsBootstrap)))
      .catch(() => setNeedsBootstrap(false))
      .finally(() => setCheckingSetup(false));
  }, []);

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (needsBootstrap && form.password.length < 8) {
        throw new Error('Choose a password of at least 8 characters.');
      }
      if (needsBootstrap && form.password !== form.confirmPassword) {
        throw new Error('Password and confirmation do not match.');
      }

      const endpoint = needsBootstrap ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsBootstrap ? form : { email: form.email, password: form.password }),
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

  if (checkingSetup) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border bg-white shadow-sm ${compact ? 'p-6' : 'p-6 md:p-8'}`}>
        <Loader2 size={18} className="animate-spin text-foreground/50" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-white shadow-sm ${compact ? 'p-6' : 'p-6 md:p-8'}`}>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-foreground">{needsBootstrap ? 'Set up your platform' : 'Sign in'}</h2>
        <p className="mt-1 text-sm text-foreground/60">
          {needsBootstrap
            ? 'No account exists yet — create the first administrator account to get started.'
            : 'Access your screening workspace, reports and dashboard.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {needsBootstrap && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={FIELD}
                placeholder="First name"
                value={form.firstName}
                onChange={(event) => update({ firstName: event.target.value })}
                maxLength={100}
                required
              />
              <input
                className={FIELD}
                placeholder="Last name"
                value={form.lastName}
                onChange={(event) => update({ lastName: event.target.value })}
                maxLength={100}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={FIELD} placeholder="Organization / Hospital / Laboratory" value={form.hospital} onChange={(event) => update({ hospital: event.target.value })} required />
              <PhoneField value={form.phone} onChange={(value) => update({ phone: value })} />
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
          maxLength={320}
          required
        />

        <div className="relative">
          <input
            className={`${FIELD} pr-11`}
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
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

        {needsBootstrap ? (
          <input
            className={FIELD}
            placeholder="Confirm password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => update({ confirmPassword: event.target.value })}
            required
          />
        ) : null}

        {!needsBootstrap ? (
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        ) : null}

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
          {loading ? 'Please wait…' : needsBootstrap ? 'Create administrator account' : 'Sign in'}
        </button>
      </form>

      {!needsBootstrap ? (
        <p className="mt-5 border-t border-border pt-5 text-center text-sm text-foreground/60">
          Accounts are created by an administrator — contact yours if you don&apos;t have one yet.
        </p>
      ) : null}
    </div>
  );
}
