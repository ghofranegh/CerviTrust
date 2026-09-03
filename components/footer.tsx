'use client';

import { useTranslation } from '@/lib/i18n';

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/analysis', label: t('nav.analysis') },
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/saved-reports', label: t('nav.savedReports') },
    { href: '/system', label: t('nav.systemOverview') },
    { href: '/about', label: t('nav.about') },
  ];

  return (
    <footer className="w-full bg-secondary border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">CerviTrust</h3>
            <p className="text-sm text-foreground/70">{t('footer.tagline')}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('footer.navigation')}</h3>
            <ul className="space-y-2 text-sm">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-foreground/70 hover:text-foreground transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">{t('footer.legal')}</h3>
            <p className="text-xs text-foreground/70">{t('footer.legalText')}</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8">
          <p className="text-xs text-foreground/60 text-center">
            © {currentYear} CerviTrust. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
