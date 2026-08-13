'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to reset password');
      setDone(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-destructive">This reset link is invalid. Request a new one from the sign-in page.</p>;
  }

  if (done) {
    return (
      <div className="text-center">
        <Check size={32} className="mx-auto mb-3 text-status-success" />
        <h1 className="text-2xl font-semibold text-foreground">Password updated</h1>
        <p className="mt-2 text-sm text-foreground/60">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>
      <p className="mt-1 text-sm text-foreground/60">At least 8 characters.</p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <input
          className={FIELD}
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <input
          className={FIELD}
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
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
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <Link href="/" className="mt-4 block text-center text-sm text-foreground/60 hover:text-foreground">
        Back to sign in
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <section className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm md:p-8">
          <Suspense fallback={<Loader2 size={18} className="animate-spin text-foreground/50" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
      <Footer />
    </main>
  );
}
