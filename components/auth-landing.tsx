'use client';

import Image from 'next/image';
import { Eye, Shield, Zap } from 'lucide-react';
import { DoctorAuthPanel } from '@/components/doctor-auth-panel';
import type { DoctorProfile } from '@/lib/analysis-types';

/**
 * The signed-out entry point: product on the left, sign-in card on the right.
 * This is the first thing anyone sees when they open the platform.
 */
export function AuthLanding({
  onAuthenticated,
  headline = 'AI-assisted cervical cytology screening',
  message,
}: {
  onAuthenticated: (doctor: DoctorProfile, token: string) => void;
  headline?: string;
  message?: string;
}) {
  return (
    <section className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16 lg:py-10">
        {/* Product side */}
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
            <span className="text-4xl font-bold text-primary">CerviTrust</span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{headline}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-foreground/70">
            {message ??
              'Sign in to analyse cervical cytology images, review flagged cells one by one, and produce structured screening reports.'}
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { icon: <Zap size={18} />, title: 'Fast screening', text: 'Whole-slide classification with calibrated probabilities.' },
              { icon: <Eye size={18} />, title: 'Targeted review', text: 'Confirm, correct or flag every detected cell.' },
              { icon: <Shield size={18} />, title: 'Clinical support', text: 'Final interpretation always stays with the practitioner.' },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {item.icon}
                </span>
                <span>
                  <span className="block font-semibold text-foreground">{item.title}</span>
                  <span className="block text-sm text-foreground/60">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Auth side */}
        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <DoctorAuthPanel onAuthenticated={onAuthenticated} />
          <p className="mt-4 text-center text-xs leading-relaxed text-foreground/60">
            CerviTrust is a clinical decision support tool for research and professional use. It does not provide a
            diagnosis.
          </p>
        </div>
      </div>
    </section>
  );
}
