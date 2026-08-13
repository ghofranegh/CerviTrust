'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { ImageAnalyzer } from '@/components/image-analyzer';
import { AuthGate } from '@/components/auth-gate';
import type { DoctorProfile } from '@/lib/analysis-types';

function AnalysisContent({ doctor }: { doctor: DoctorProfile }) {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId') ?? undefined;
  const reportId = searchParams.get('reportId') ?? undefined;

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-12 print:hidden">
          <h1 className="text-4xl font-semibold text-foreground mb-2">Cervical Cytology Analysis</h1>
          <p className="text-foreground/60">
            Upload a cervical cytology image to receive an automated screening assessment
          </p>
        </div>

        <ImageAnalyzer doctor={doctor} initialPatientId={patientId} initialReportId={reportId} />
      </section>

      <Footer />
    </main>
  );
}

export default function AnalysisPage() {
  return (
    <AuthGate
      doctorOnly
      headline="Sign in to analyse a smear"
      message="Uploading an image and saving a report requires a practitioner account."
    >
      {(doctor) => (
        <Suspense fallback={null}>
          <AnalysisContent doctor={doctor} />
        </Suspense>
      )}
    </AuthGate>
  );
}
