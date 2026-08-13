import { UserCircle2 } from 'lucide-react';
import type { DoctorProfile } from '@/lib/analysis-types';
import { personName } from '@/lib/analysis-types';

export function initialsOf(name?: string): string {
  return (
    (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'D'
  );
}

/** Profile picture with an initials fallback, used in the header and profile. */
export function Avatar({
  doctor,
  size = 40,
  className = '',
}: {
  doctor?: Pick<DoctorProfile, 'firstName' | 'lastName' | 'avatar'> | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };
  const name = doctor ? personName(doctor, '') : '';

  if (doctor?.avatar) {
    return (
      <img
        src={doctor.avatar}
        alt={name ? `${name}'s profile picture` : 'Profile picture'}
        style={dimension}
        className={`rounded-full object-cover border border-border bg-white ${className}`}
      />
    );
  }

  if (name) {
    return (
      <span
        style={{ ...dimension, fontSize: Math.max(11, size * 0.36) }}
        className={`flex items-center justify-center rounded-full bg-primary font-semibold text-white ${className}`}
      >
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <span
      style={dimension}
      className={`flex items-center justify-center rounded-full border border-border bg-white text-foreground/70 ${className}`}
    >
      <UserCircle2 size={Math.round(size * 0.6)} />
    </span>
  );
}
