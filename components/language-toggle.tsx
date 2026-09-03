'use client';

import { useTranslation } from '@/lib/i18n';

/** EN | FR split button. Persists the preference; see lib/use-language.ts. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className={`inline-flex overflow-hidden rounded-lg border border-border text-xs font-semibold ${className}`} role="group" aria-label={t('lang.toggleLabel')}>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`px-2.5 py-1.5 transition-colors ${language === 'en' ? 'bg-primary text-white' : 'bg-white text-foreground/60 hover:bg-secondary'}`}
      >
        EN
      </button>
      <span className="w-px bg-border" />
      <button
        type="button"
        onClick={() => setLanguage('fr')}
        aria-pressed={language === 'fr'}
        className={`px-2.5 py-1.5 transition-colors ${language === 'fr' ? 'bg-primary text-white' : 'bg-white text-foreground/60 hover:bg-secondary'}`}
      >
        FR
      </button>
    </div>
  );
}
