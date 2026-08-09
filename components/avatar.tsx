import { UserCircle2 } from 'lucide-react';
import type { DoctorProfile } from '@/lib/analysis-types';

export function initialsOf(fullName?: string): string {
  return (
    (fullName ?? '')
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
  doctor?: Pick<DoctorProfile, 'fullName' | 'avatar'> | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };

  if (doctor?.avatar) {
    return (
      <img
        src={doctor.avatar}
        alt={doctor.fullName ? `${doctor.fullName}'s profile picture` : 'Profile picture'}
        style={dimension}
        className={`rounded-full object-cover border border-border bg-white ${className}`}
      />
    );
  }

  if (doctor?.fullName) {
    return (
      <span
        style={{ ...dimension, fontSize: Math.max(11, size * 0.36) }}
        className={`flex items-center justify-center rounded-full bg-primary font-semibold text-white ${className}`}
      >
        {initialsOf(doctor.fullName)}
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
