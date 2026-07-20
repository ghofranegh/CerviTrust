export type StatusType = 'nilm' | 'lsil' | 'hsil' | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig = {
  nilm: {
    label: 'NILM',
    fullLabel: 'Negative for Intraepithelial Lesion',
    color: 'bg-status-success/10 text-status-success border-status-success/30',
    icon: '✓',
  },
  lsil: {
    label: 'LSIL',
    fullLabel: 'Low-Grade Squamous Intraepithelial Lesion',
    color: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    icon: '!',
  },
  hsil: {
    label: 'HSIL',
    fullLabel: 'High-Grade Squamous Intraepithelial Lesion',
    color: 'bg-status-critical/10 text-status-critical border-status-critical/30',
    icon: '⚠',
  },
  pending: {
    label: 'Analyzing...',
    fullLabel: 'Analysis in Progress',
    color: 'bg-muted/50 text-muted-foreground border-muted',
    icon: '⏳',
  },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div title={config.fullLabel} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm ${config.color} ${className}`}>
      <span className="text-lg">{config.icon}</span>
      {config.label}
    </div>
  );
}
