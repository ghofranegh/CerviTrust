'use client';

import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { Target, Eye, Shield } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-foreground mb-4">{t('about.title')}</h1>
          <p className="text-lg text-foreground/60">
            {t('about.subtitle')}
          </p>
        </div>

        {/* Project Overview */}
        <div className="bg-white rounded-lg border border-border p-8 mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">{t('about.overviewTitle')}</h2>
          <p className="text-foreground/70 leading-relaxed mb-4">
            {t('about.overviewP1')}
          </p>
          <p className="text-foreground/70 leading-relaxed">
            {t('about.overviewP2')}
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Mission */}
          <div className="bg-white rounded-lg border border-border p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                <Target size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">{t('about.missionTitle')}</h3>
              </div>
            </div>
            <p className="text-foreground/70 leading-relaxed">
              {t('about.missionBody')}
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white rounded-lg border border-border p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                <Eye size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">{t('about.visionTitle')}</h3>
              </div>
            </div>
            <p className="text-foreground/70 leading-relaxed">
              {t('about.visionBody')}
            </p>
          </div>
        </div>

        {/* Core Principles */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">{t('about.principlesTitle')}</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('about.principle1Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('about.principle1Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('about.principle2Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('about.principle2Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('about.principle3Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('about.principle3Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('about.principle4Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('about.principle4Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <div className="bg-secondary rounded-lg border border-border p-8 mb-12">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0 flex-shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('about.disclaimerTitle')}</h2>
              <p className="text-foreground/70 leading-relaxed mb-3">
                <strong>{t('about.disclaimerBold')}</strong>
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>{t('about.disclaimerItem1')}</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>{t('about.disclaimerItem2')}</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>{t('about.disclaimerItem3')}</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>{t('about.disclaimerItem4')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Research Use */}
        <div className="bg-white rounded-lg border border-border p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">{t('about.researchTitle')}</h2>
          <p className="text-foreground/70 leading-relaxed mb-4">
            {t('about.researchP1')}
          </p>
          <p className="text-foreground/70 leading-relaxed">
            {t('about.researchP2')}
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
