'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <section className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm md:p-8">
          {sent ? (
            <div className="text-center">
              <MailCheck size={32} className="mx-auto mb-3 text-status-success" />
              <h1 className="text-2xl font-semibold text-foreground">Check your email</h1>
              <p className="mt-2 text-sm text-foreground/60">
                If an account exists for {email}, a password reset link has been sent. It stays valid for 1 hour.
              </p>
              <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
              <p className="mt-1 text-sm text-foreground/60">
                Enter your account email and we&apos;ll send you a link to choose a new password.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <input
                  className={FIELD}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <Link href="/" className="mt-4 block text-center text-sm text-foreground/60 hover:text-foreground">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
