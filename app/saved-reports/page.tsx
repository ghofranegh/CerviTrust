'use client';

import { Suspense } from 'react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AuthGate } from '@/components/auth-gate';
import { SavedAnalysesList } from '@/components/saved-analyses-list';
import { useTranslation } from '@/lib/i18n';

function SavedReportsContent() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-foreground mb-2">{t('saved.title')}</h1>
          <p className="text-foreground/60">{t('saved.subtitle')}</p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <Suspense fallback={<p className="text-sm text-foreground/70">{t('list.loading')}</p>}>
            <SavedAnalysesList />
          </Suspense>
        </div>
      </section>

      <Footer />
    </main>
  );
}

export default function SavedReportsPage() {
  const { t } = useTranslation();
  return (
    <AuthGate
      doctorOnly
      headline={t('gate.savedReportsHeadline')}
      message={t('gate.savedReportsMessage')}
    >
      {() => <SavedReportsContent />}
    </AuthGate>
  );
}
