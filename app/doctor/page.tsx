'use client';

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { DoctorAuthPanel } from '@/components/doctor-auth-panel';
import { DoctorProfilePanel } from '@/components/doctor-profile-panel';
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

export default function DoctorPage() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

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
          <h1 className="text-4xl font-semibold text-foreground mb-2">Doctor workspace</h1>
          <p className="text-foreground/60">Manage your account, hospital details, and sign-in state from here.</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {!doctor ? (
            <DoctorAuthPanel onAuthenticated={(profile) => setDoctor(profile)} />
          ) : (
            <DoctorProfilePanel doctor={doctor} onLogout={() => setDoctor(null)} />
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
