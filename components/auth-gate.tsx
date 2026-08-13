'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AuthLanding } from '@/components/auth-landing';
import { useDoctorSession } from '@/lib/use-doctor-session';
import type { DoctorProfile } from '@/lib/analysis-types';

/**
 * Wraps a page that requires an account. Signed-out visitors get the sign-in
 * landing instead of an empty screen; `adminOnly` pages also check the role.
 */
export function AuthGate({
  children,
  adminOnly = false,
  doctorOnly = false,
  headline,
  message,
}: {
  children: (doctor: DoctorProfile) => ReactNode;
  adminOnly?: boolean;
  /** Refuses administrators — for pages only a practitioner needs (analysis, dashboard, saved reports). */
  doctorOnly?: boolean;
  headline?: string;
  message?: string;
}) {
  const { doctor, loading, signIn } = useDoctorSession();

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <div className="flex flex-1 items-center justify-center gap-2 text-foreground/60">
          <Loader2 size={18} className="animate-spin" /> Loading your workspace…
        </div>
        <Footer />
      </main>
    );
  }

  if (!doctor) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <AuthLanding onAuthenticated={signIn} headline={headline} message={message} />
        <Footer />
      </main>
    );
  }

  if (adminOnly && doctor.role !== 'admin') {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <h1 className="text-2xl font-semibold text-foreground">Administrator access required</h1>
            <p className="mt-2 text-foreground/70">
              You are signed in as a practitioner. This area is reserved for administrator accounts.
            </p>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  if (doctorOnly && doctor.role !== 'doctor') {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <h1 className="text-2xl font-semibold text-foreground">Reserved for practitioners</h1>
            <p className="mt-2 text-foreground/70">
              Administrators don&apos;t analyse samples or write reports. Open the administration console instead.
            </p>
            <Link href="/admin" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Go to administration console
            </Link>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return <>{children(doctor)}</>;
}
