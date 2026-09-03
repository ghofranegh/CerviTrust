'use client';

/**
 * Dependency-free SVG chart primitives built on the project's own tokens.
 * The severity ramp below was validated for lightness band, chroma floor and
 * colour-vision separation; every chart that uses it also ships a legend and
 * direct labels, so identity never depends on colour alone.
 */

import { ReactNode, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

/** Ordinal severity ramp: benign -> malignant. */
export const CLASS_COLORS: Record<string, string> = {
  NILM: '#2E7D32',
  'ASC-US': '#E3A008',
  LSIL: '#E3A008',
  'ASC-H': '#E2685A',
  AGC: '#E2685A',
  HSIL: '#E2685A',
  SCC: '#96262C',
};

export function classColor(name: string): string {
  return CLASS_COLORS[(name ?? '').toUpperCase()] ?? '#8A8A8A';
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  deltaGood,
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  deltaGood?: 'up' | 'down';
  icon?: ReactNode;
  trend?: number[];
}) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isUp = hasDelta && delta! >= 0;
  const good = deltaGood === 'down' ? !isUp : isUp;

  return (
    <div className="bg-white rounded-lg border border-border p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{label}</p>
        {icon ? <span className="text-primary flex-shrink-0">{icon}</span> : null}
      </div>
      <div className="mt-2 text-3xl font-semibold text-foreground tabular-nums">{value}</div>
      <div className="mt-2 flex items-center gap-3">
        {hasDelta ? (
          <span className={`text-xs font-medium ${good ? 'text-status-success' : 'text-status-critical'}`}>
            {isUp ? '↑' : '↓'} {Math.abs(delta!).toFixed(0)}%{deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        ) : deltaLabel ? (
          <span className="text-xs text-foreground/60">{deltaLabel}</span>
        ) : null}
        {trend && trend.length > 1 ? <Sparkline values={trend} /> : null}
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 72, height = 20 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / span) * height}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline points={points} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.5} />
      <circle cx={(values.length - 1) * step} cy={height - ((values[values.length - 1] - min) / span) * height} r={2.5} fill="var(--primary)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Meter                                                               */
/* ------------------------------------------------------------------ */

export function MeterBar({
  label,
  value,
  display,
  color = 'var(--primary)',
  track = 'bg-foreground/10',
  size = 'md',
}: {
  label?: string;
  value: number;
  display?: string;
  color?: string;
  track?: string;
  size?: 'sm' | 'md';
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="space-y-1.5">
      {(label || display) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label ? <span className="text-foreground/70">{label}</span> : <span />}
          {display ? <span className="font-semibold text-foreground tabular-nums">{display}</span> : null}
        </div>
      )}
      <div className={`w-full ${size === 'sm' ? 'h-1.5' : 'h-2'} rounded-full overflow-hidden ${track}`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 180,
}: {
  segments: DonutSegment[];
  centerValue: ReactNode;
  centerLabel: string;
  size?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  // 2px surface gap between neighbouring arcs.
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;

  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={16} />
          {total > 0 &&
            segments.map((segment) => {
              if (segment.value <= 0) return null;
              const fraction = segment.value / total;
              const length = Math.max(0, fraction * circumference - gap);
              const dash = `${length} ${circumference - length}`;
              const rotation = (offset / circumference) * 360 - 90;
              offset += fraction * circumference;
              const dimmed = hovered !== null && hovered !== segment.label;
              return (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={hovered === segment.label ? 19 : 16}
                  strokeDasharray={dash}
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                  opacity={dimmed ? 0.35 : 1}
                  onMouseEnter={() => setHovered(segment.label)}
                  onMouseLeave={() => setHovered(null)}
                  className="transition-all cursor-default"
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
          <span className="text-2xl font-semibold text-foreground tabular-nums">{centerValue}</span>
          <span className="text-xs text-foreground/60">{centerLabel}</span>
        </div>
      </div>

      <ul className="flex-1 w-full space-y-2">
        {segments.map((segment) => {
          const pct = total > 0 ? (segment.value / total) * 100 : 0;
          return (
            <li
              key={segment.label}
              className={`flex items-center justify-between gap-3 text-sm rounded-md px-2 py-1 transition-colors ${
                hovered === segment.label ? 'bg-secondary' : ''
              }`}
              onMouseEnter={() => setHovered(segment.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
                <span className="text-foreground/80 truncate">{segment.label}</span>
              </span>
              <span className="text-foreground font-medium tabular-nums flex-shrink-0">
                {segment.value} <span className="text-foreground/50">({pct.toFixed(1)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column distribution                                                 */
/* ------------------------------------------------------------------ */

export function BarDistribution({
  bars,
  height = 150,
  valueSuffix = '',
}: {
  bars: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  valueSuffix?: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-2 min-w-[280px]" style={{ height }}>
        {bars.map((bar) => {
          const ratio = bar.value / max;
          return (
            <div key={bar.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${bar.label}: ${bar.value}${valueSuffix}`}>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {bar.value}
                {valueSuffix}
              </span>
              <div
                className="w-full max-w-[24px] rounded-t transition-all"
                style={{
                  height: `${Math.max(ratio * 100, bar.value > 0 ? 3 : 1)}%`,
                  backgroundColor: bar.value > 0 ? bar.color ?? 'var(--primary)' : 'var(--muted)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2 min-w-[280px]">
        {bars.map((bar) => (
          <span key={bar.label} className="flex-1 text-center text-[11px] text-foreground/60 truncate">
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend line                                                          */
/* ------------------------------------------------------------------ */

export interface TrendSeries {
  label: string;
  color: string;
  values: number[];
}

export function TrendChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: TrendSeries[];
  height?: number;
}) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 640;
  const padding = { top: 12, right: 16, bottom: 26, left: 34 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const count = Math.max(labels.length, 1);
  const stepX = count > 1 ? plotW / (count - 1) : 0;

  const x = (i: number) => padding.left + i * stepX;
  const y = (v: number) => padding.top + plotH - (v / niceMax) * plotH;

  const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[520px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ height }}
          onMouseLeave={() => setActiveIndex(null)}
          role="img"
          aria-label={t('common.activityOverTime')}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={1} />
              <text x={padding.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-foreground/50" fontSize={10}>
                {Math.round(tick)}
              </text>
            </g>
          ))}

          {labels.map((label, i) =>
            i % Math.ceil(count / 7) === 0 || i === count - 1 ? (
              <text key={`${label}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-foreground/50" fontSize={10}>
                {label}
              </text>
            ) : null,
          )}

          {series.map((s) => (
            <polyline
              key={s.label}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {activeIndex !== null ? (
            <>
              <line x1={x(activeIndex)} x2={x(activeIndex)} y1={padding.top} y2={padding.top + plotH} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
              {series.map((s) => (
                <circle key={s.label} cx={x(activeIndex)} cy={y(s.values[activeIndex] ?? 0)} r={4} fill={s.color} stroke="#FFFFFF" strokeWidth={2} />
              ))}
            </>
          ) : null}

          {labels.map((label, i) => (
            <rect
              key={`hit-${label}-${i}`}
              x={x(i) - stepX / 2}
              y={padding.top}
              width={Math.max(stepX, 8)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(i)}
            />
          ))}
        </svg>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <ul className="flex flex-wrap gap-4">
            {series.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs text-foreground/70">
                <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
          {activeIndex !== null ? (
            <div className="text-xs text-foreground/70">
              <span className="font-medium text-foreground">{labels[activeIndex]}</span>
              {series.map((s) => (
                <span key={s.label} className="ml-3 tabular-nums">
                  {s.label}: <span className="font-medium text-foreground">{s.values[activeIndex] ?? 0}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-foreground/50">Hover the chart for daily values</span>
          )}
        </div>
      </div>
    </div>
  );
}
