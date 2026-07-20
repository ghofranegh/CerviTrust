import { ReactNode } from 'react';

interface MedicalCardProps {
  label: string;
  value: string | ReactNode;
  subtitle?: string;
  className?: string;
}

export function MedicalCard({ label, value, subtitle, className = '' }: MedicalCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-border p-6 ${className}`}>
      <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">{label}</p>
      <div className="text-2xl font-semibold text-foreground mb-1">{value}</div>
      {subtitle && <p className="text-xs text-foreground/60">{subtitle}</p>}
    </div>
  );
}
