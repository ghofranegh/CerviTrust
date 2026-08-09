'use client';

import Link from 'next/link';
import { Loader2, Zap, Eye, Shield } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { FeatureCard } from '@/components/feature-card';
import { AuthLanding } from '@/components/auth-landing';
import { Button } from '@/components/ui/button';
import { useDoctorSession } from '@/lib/use-doctor-session';

export default function Home() {
  const { doctor, loading, signIn } = useDoctorSession();

  if (loading) {
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

  // Signed out: the platform opens on the sign-in page, not on the content.
  if (!doctor) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <Navigation />
        <AuthLanding onAuthenticated={signIn} />
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-primary mb-3">Welcome back, {doctor.fullName.split(' ')[0]}</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6 max-w-3xl mx-auto text-balance">CerviTrust</h1>
          <p className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto text-balance">
            AI-Assisted Cervical Cytology Screening
          </p>
          <p className="text-lg text-foreground/60 mb-12 max-w-2xl mx-auto leading-relaxed">
            CerviTrust assists healthcare professionals in reviewing cervical cytology images by providing rapid
            screening support, highlighting suspicious cellular regions, and helping prioritize cases that may require
            closer examination.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/analysis">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white h-12 px-8 text-base">
                Start analysis
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base border-foreground/20 hover:bg-secondary">
                Open dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div id="features" className="mt-20">
          <h2 className="text-3xl font-semibold text-center text-foreground mb-12">Key Capabilities</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <FeatureCard
              icon={<Zap size={24} />}
              title="Fast Screening"
              description="Rapid analysis of cervical cytology images to support routine screening workflows."
            />
            <FeatureCard
              icon={<Eye size={24} />}
              title="Visual Findings"
              description="Highlights relevant cellular regions to facilitate image review and clinical assessment."
            />
            <FeatureCard
              icon={<Shield size={24} />}
              title="Clinical Support"
              description="Provides an additional layer of assistance while leaving final interpretation to healthcare professionals."
            />
          </div>

          <div className="bg-secondary border border-border rounded-lg p-6 md:p-8 text-center">
            <p className="text-sm text-foreground/70 leading-relaxed">
              <strong className="text-foreground">Important Disclaimer:</strong> This software is intended as a clinical
              decision support tool and is not a replacement for professional medical diagnosis. Final diagnostic
              decisions must be made by qualified medical professionals.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
