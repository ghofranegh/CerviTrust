'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AuthLanding } from '@/components/auth-landing';
import { PatientRoster } from '@/components/patient-roster';
import { useDoctorSession } from '@/lib/use-doctor-session';
import type { DoctorProfile } from '@/lib/analysis-types';

export default function Home() {
  const { doctor, loading, signIn } = useDoctorSession();
  const router = useRouter();

  // Administrators don't have a patient roster — they land on the console.
  useEffect(() => {
    if (doctor?.role === 'admin') router.replace('/admin');
  }, [doctor, router]);

  const handleAuthenticated = (profile: DoctorProfile, token: string) => {
    signIn(profile, token);
    if (profile.role === 'admin') router.replace('/admin');
  };

  if (loading || doctor?.role === 'admin') {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <div className="flex flex-1 items-center justify-center gap-2 text-foreground/60">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
        <Footer />
      </main>
    );
  }

  if (!doctor) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <AuthLanding onAuthenticated={handleAuthenticated} />
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary mb-1">Welcome back, {doctor.firstName}</p>
          <h1 className="text-3xl font-semibold text-foreground">Your patients</h1>
          <p className="mt-1 text-foreground/60">Find an existing patient or add a new one to start an analysis.</p>
        </div>

        <PatientRoster />
      </section>

      <Footer />
    </main>
  );
}
