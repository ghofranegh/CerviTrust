'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AuthLanding } from '@/components/auth-landing';
import { DoctorProfilePanel } from '@/components/doctor-profile-panel';
import { useDoctorSession } from '@/lib/use-doctor-session';

export default function DoctorPage() {
  const { doctor, loading, signIn, signOut, updateDoctor } = useDoctorSession();

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <div className="flex flex-1 items-center justify-center gap-2 text-foreground/60">
          <Loader2 size={18} className="animate-spin" /> Loading your account…
        </div>
        <Footer />
      </main>
    );
  }

  if (!doctor) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <AuthLanding
          onAuthenticated={signIn}
          headline="Sign in to your CerviTrust account"
          message="Manage your profile, your saved reports and your screening workspace."
        />
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-foreground mb-2">Account settings</h1>
          <p className="text-foreground/60">Your profile, picture and security settings.</p>
        </div>

        <DoctorProfilePanel doctor={doctor} onLogout={signOut} onUpdated={updateDoctor} />

        <div className="mt-6 rounded-xl border border-border bg-white p-6">
          <h3 className="text-lg font-semibold text-foreground mb-1">Your workspace</h3>
          <p className="text-sm text-foreground/60 mb-4">Jump straight to the tools you use most.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Open dashboard
            </Link>
            <Link href="/analysis" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
              New analysis
            </Link>
            <Link href="/saved-reports" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
              Saved reports
            </Link>
            {doctor.role === 'admin' ? (
              <Link href="/admin" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                Administration
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
