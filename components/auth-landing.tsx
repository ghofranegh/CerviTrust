'use client';

import Image from 'next/image';
import { Eye, Shield, Zap } from 'lucide-react';
import { DoctorAuthPanel } from '@/components/doctor-auth-panel';
import { useTranslation } from '@/lib/i18n';
import type { DoctorProfile } from '@/lib/analysis-types';

/**
 * The signed-out entry point: product on the left, sign-in card on the right.
 * This is the first thing anyone sees when they open the platform. `headline`
 * and `message` let individual pages override the pitch copy — those two
 * props stay English-only for now (see lib/i18n.ts for what's translated).
 */
export function AuthLanding({
  onAuthenticated,
  headline,
  message,
}: {
  onAuthenticated: (doctor: DoctorProfile, token: string) => void;
  headline?: string;
  message?: string;
}) {
  const { t } = useTranslation();

  const features = [
    { icon: <Zap size={18} />, title: t('auth.featureFastTitle'), text: t('auth.featureFastText') },
    { icon: <Eye size={18} />, title: t('auth.featureReviewTitle'), text: t('auth.featureReviewText') },
    { icon: <Shield size={18} />, title: t('auth.featureSupportTitle'), text: t('auth.featureSupportText') },
  ];

  return (
    <section className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16 lg:py-10">
        {/* Product side */}
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={72} height={72} className="h-[72px] w-[72px] object-contain" />
            <span className="text-4xl font-bold text-primary">CerviTrust</span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{headline ?? t('auth.headline')}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-foreground/70">{message ?? t('auth.subMessage')}</p>

          <ul className="mt-8 space-y-4">
            {features.map((item) => (
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
          <p className="mt-4 text-center text-xs leading-relaxed text-foreground/60">{t('auth.disclaimer')}</p>
        </div>
      </div>
    </section>
  );
}
