'use client';

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { SavedAnalysesList } from '@/components/saved-analyses-list';
import { getStoredDoctorToken } from '@/lib/client-auth';

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

export default function SavedReportsPage() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) return;
    void fetch('/api/auth/me', {
      headers: { 'x-doctor-token': token },
    })
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
          <h1 className="text-4xl font-semibold text-foreground mb-2">Saved reports</h1>
          <p className="text-foreground/60">Review all the analyses you saved with patient details and clinical notes.</p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          {!doctor ? (
            <p className="text-sm text-foreground/60">Sign in to access your saved reports.</p>
          ) : (
            <SavedAnalysesList key={refreshKey} />
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
