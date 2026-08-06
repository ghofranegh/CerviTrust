'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { DoctorAuthPanel } from '@/components/doctor-auth-panel';
import { DoctorProfilePanel } from '@/components/doctor-profile-panel';
import { getStoredDoctorToken } from '@/lib/client-auth';
import type { DoctorProfile } from '@/lib/analysis-types';

export default function DoctorPage() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) return;
    void fetch('/api/auth/me', { headers: { 'x-doctor-token': token } })
      .then((res) => res.json())
      .then((data) => {
        if (data.doctor) setDoctor(data.doctor);
      })
      .catch(() => setDoctor(null));
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-foreground mb-2">Doctor workspace</h1>
          <p className="text-foreground/60">Manage your account, hospital details, and sign-in state from here.</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {!doctor ? (
            <DoctorAuthPanel onAuthenticated={(profile) => setDoctor(profile)} />
          ) : (
            <>
              <DoctorProfilePanel doctor={doctor} onLogout={() => setDoctor(null)} />

              <div className="rounded-xl border border-border bg-white p-6">
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
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
