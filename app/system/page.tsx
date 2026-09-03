'use client';

import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { MedicalCard } from '@/components/medical-card';
import { Clock, Image, BookOpen, Package } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function SystemPage() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-foreground mb-2">{t('system.title')}</h1>
          <p className="text-foreground/60">
            {t('system.subtitle')}
          </p>
        </div>

        {/* System Capabilities */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">{t('system.capabilitiesTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MedicalCard
              label={t('system.responseTime')}
              value={<span className="text-primary">{t('system.responseTimeValue')}</span>}
              subtitle={t('system.responseTimeSubtitle')}
            />
            <MedicalCard
              label={t('system.imageTypes')}
              value={<span className="text-primary">{t('system.imageTypesValue')}</span>}
              subtitle={t('system.imageTypesSubtitle')}
            />
            <MedicalCard
              label={t('system.classifications')}
              value={<span className="text-primary">{t('system.classificationsValue')}</span>}
              subtitle={t('system.classificationsSubtitle')}
            />
            <MedicalCard
              label={t('system.platform')}
              value={<span className="text-primary">{t('system.platformValue')}</span>}
              subtitle={t('system.platformSubtitle')}
            />
          </div>
        </div>

        {/* Supported Categories */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">{t('system.categoriesTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-status-success/10 rounded-lg flex items-center justify-center text-status-success flex-shrink-0">
                  <span className="text-xl">✓</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">NILM</h3>
                  <p className="text-sm text-foreground/70">
                    {t('system.nilmDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-status-warning/10 rounded-lg flex items-center justify-center text-status-warning flex-shrink-0">
                  <span className="text-xl">!</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">LSIL</h3>
                  <p className="text-sm text-foreground/70">
                    {t('system.lsilDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-status-critical/10 rounded-lg flex items-center justify-center text-status-critical flex-shrink-0">
                  <span className="text-xl">⚠</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">HSIL</h3>
                  <p className="text-sm text-foreground/70">
                    {t('system.hsilDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-muted-foreground flex-shrink-0">
                  <span className="text-xl">?</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t('system.otherTitle')}</h3>
                  <p className="text-sm text-foreground/70">
                    {t('system.otherDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Workflow */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">{t('system.workflowTitle')}</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('system.step1Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('system.step1Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('system.step2Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('system.step2Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('system.step3Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('system.step3Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                4
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('system.step4Title')}</h3>
                <p className="text-sm text-foreground/70">
                  {t('system.step4Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Information */}
        <div className="bg-secondary rounded-lg border border-border p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">{t('system.technicalInfoTitle')}</h2>
          <p className="text-foreground/70 mb-6 leading-relaxed">
            {t('system.technicalInfoBody')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
            <div>
              <h3 className="font-semibold text-foreground mb-2">{t('system.researchOrientedTitle')}</h3>
              <p className="text-sm text-foreground/70">
                {t('system.researchOrientedDesc')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">{t('system.professionalUseTitle')}</h3>
              <p className="text-sm text-foreground/70">
                {t('system.professionalUseDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
