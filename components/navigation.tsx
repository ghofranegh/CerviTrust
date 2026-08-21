'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, LogOut, Menu, Settings, X } from 'lucide-react';
import Image from 'next/image';
import { Avatar } from '@/components/avatar';
import { useDoctorSession } from '@/lib/use-doctor-session';
import { personName, professionalTitleLabel } from '@/lib/analysis-types';

function roleLabel(doctor: { role: 'doctor' | 'admin'; professionalTitle?: string | null }): string {
  if (doctor.role === 'admin') return 'Administrator';
  return professionalTitleLabel(doctor.professionalTitle as never) !== '—' ? professionalTitleLabel(doctor.professionalTitle as never) : 'Practitioner';
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { doctor, signOut } = useDoctorSession();
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const links = doctor
    ? doctor.role === 'admin'
      ? [
          { href: '/admin', label: 'Administration' },
          { href: '/system', label: 'System Overview' },
          { href: '/about', label: 'About' },
        ]
      : [
          { href: '/', label: 'Patients' },
          { href: '/analysis', label: 'Analysis' },
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/saved-reports', label: 'Saved Reports' },
          { href: '/system', label: 'System Overview' },
          { href: '/about', label: 'About' },
        ]
    : [
        { href: '/system', label: 'System Overview' },
        { href: '/about', label: 'About' },
      ];

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setIsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (pathname === href ? 'text-primary' : 'text-foreground/70 hover:text-foreground');

  const handleSignOut = () => {
    signOut();
    setMenuOpen(false);
    router.push('/');
  };

  return (
    <nav className="w-full bg-white border-b border-border sticky top-0 z-50 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="CerviTrust Logo" width={40} height={40} className="h-10 w-10 object-contain flex-shrink-0" />
            <span className="text-xl font-semibold text-foreground">CerviTrust</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive(link.href)}`}>
                {link.label}
              </Link>
            ))}

            {doctor ? (
              <div className="relative ml-2" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 p-1 pr-3 text-sm font-medium text-foreground/80 hover:bg-secondary"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar doctor={doctor} size={32} />
                  <span className="max-w-[9rem] truncate">{personName(doctor)}</span>
                </button>

                {menuOpen ? (
                  <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                      <Avatar doctor={doctor} size={40} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{personName(doctor)}</p>
                        <p className="truncate text-xs text-foreground/60">
                          {roleLabel(doctor)}
                        </p>
                      </div>
                    </div>
                    {doctor.role === 'doctor' ? (
                      <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary" role="menuitem">
                        <LayoutDashboard size={16} /> Dashboard
                      </Link>
                    ) : null}
                    <Link href="/doctor" className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-secondary" role="menuitem">
                      <Settings size={16} /> Account settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-sm text-foreground/80 hover:bg-secondary"
                      role="menuitem"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/" className="ml-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                Sign in
              </Link>
            )}
          </div>

          <button className="lg:hidden p-2" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="lg:hidden pb-4 border-t border-border">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive(link.href)}`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {doctor ? (
              <>
                <Link href="/doctor" className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm font-medium" onClick={() => setIsOpen(false)}>
                  <Avatar doctor={doctor} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate">{personName(doctor)}</span>
                    <span className="block text-xs text-foreground/60">
                      {roleLabel(doctor)}
                    </span>
                  </span>
                </Link>
                <button type="button" onClick={handleSignOut} className="mt-2 flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm font-medium text-foreground/80">
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <Link href="/" className="mt-2 block rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium text-white" onClick={() => setIsOpen(false)}>
                Sign in
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
