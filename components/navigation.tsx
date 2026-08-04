'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, UserCircle2, X } from 'lucide-react';
import Image from 'next/image';
import { getStoredDoctorToken, setStoredDoctorToken } from '@/lib/client-auth';

interface DoctorProfile {
  id: string;
  fullName: string;
  email: string;
  hospital: string;
  specialty: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/analysis', label: 'Analysis' },
    { href: '/saved-reports', label: 'Saved Reports' },
    { href: '/system', label: 'System Overview' },
    { href: '/about', label: 'About' },
  ];

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) {
      setDoctor(null);
      return;
    }

    void fetch('/api/auth/me', {
      headers: { 'x-doctor-token': token },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.doctor) {
          setDoctor(data.doctor);
        } else {
          setStoredDoctorToken(null);
          setDoctor(null);
        }
      })
      .catch(() => {
        setDoctor(null);
      });
  }, []);

  const isActive = (href: string) => {
    return pathname === href ? 'text-primary' : 'text-foreground/70 hover:text-foreground';
  };

  const initials = doctor?.fullName
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'D';

  return (
    <nav className="w-full bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="CerviTrust Logo"
              width={40}
              height={40}
              className="h-10 w-10 object-contain flex-shrink-0"
            />
            <span className="text-xl font-semibold text-foreground">CerviTrust</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${isActive(link.href)}`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/doctor" className="ml-2 flex items-center gap-2 rounded-full border border-border bg-secondary/50 p-1.5 text-sm font-medium text-foreground/80">
              {doctor ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {initials}
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-foreground">
                  <UserCircle2 size={18} />
                </span>
              )}
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden pb-4 border-t border-border">
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
            <Link href="/doctor" className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm font-medium" onClick={() => setIsOpen(false)}>
              {doctor ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {initials}
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-foreground">
                  <UserCircle2 size={18} />
                </span>
              )}
              <span>{doctor ? doctor.fullName : 'Doctor workspace'}</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
