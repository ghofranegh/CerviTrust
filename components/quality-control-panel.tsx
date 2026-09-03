'use client';

import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { BarDistribution, MeterBar } from '@/components/charts';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import {
  QualityReport,
  SegmentationStats,
  TONE_BADGE,
  qualityLabel,
  qualityTone,
} from '@/lib/analysis-types';

const SUBSCORE_KEYS: Array<{ key: keyof QualityReport['subscores']; labelKey: TranslationKey; hintKey: TranslationKey }> = [
  { key: 'sharpness', labelKey: 'qc.sub.sharpness', hintKey: 'qc.sub.sharpnessHint' },
  { key: 'contrast', labelKey: 'qc.sub.contrast', hintKey: 'qc.sub.contrastHint' },
  { key: 'exposure', labelKey: 'qc.sub.exposure', hintKey: 'qc.sub.exposureHint' },
  { key: 'staining', labelKey: 'qc.sub.staining', hintKey: 'qc.sub.stainingHint' },
  { key: 'cellularity', labelKey: 'qc.sub.cellularity', hintKey: 'qc.sub.cellularityHint' },
];

const METRIC_KEYS: Record<string, TranslationKey> = {
  laplacian_variance: 'qc.metric.laplacian_variance',
  mean_intensity: 'qc.metric.mean_intensity',
  std_intensity: 'qc.metric.std_intensity',
  mean_saturation: 'qc.metric.mean_saturation',
  clipped_highlights_pct: 'qc.metric.clipped_highlights_pct',
  clipped_shadows_pct: 'qc.metric.clipped_shadows_pct',
  nucleus_coverage_pct: 'qc.metric.nucleus_coverage_pct',
};

export function QualityControlPanel({
  quality,
  segmentationStats,
  imageInfo,
}: {
  quality: QualityReport;
  segmentationStats?: SegmentationStats;
  imageInfo?: { width: number; height: number; megapixels: number };
}) {
  const { t, language } = useTranslation();
  const tone = qualityTone(quality.label);
  const Icon = quality.label === 'interpretable' ? CheckCircle2 : quality.label === 'uncertain' ? HelpCircle : AlertTriangle;

  const barColor =
    tone === 'success' ? '#2E7D32' : tone === 'warning' ? '#E3A008' : tone === 'critical' ? '#96262C' : '#8A8A8A';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('qc.title')}</h3>
          <p className="text-sm text-foreground/60">{t('qc.subtitle')}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${TONE_BADGE[tone]}`}>
          <Icon size={16} />
          {qualityLabel(quality.label, language)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Headline score */}
        <div className="rounded-lg border border-border bg-secondary/30 p-6 flex flex-col justify-center">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('qc.score')}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-semibold text-foreground tabular-nums">{quality.score}</span>
            <span className="text-lg text-foreground/50">/100</span>
          </div>
          <div className="mt-4">
            <MeterBar value={quality.score / 100} color={barColor} />
          </div>
          {imageInfo ? (
            <p className="mt-4 text-xs text-foreground/60">
              {t('qc.field')}: {imageInfo.width} × {imageInfo.height} px ({imageInfo.megapixels} MP)
            </p>
          ) : null}
        </div>

        {/* Sub-scores */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-white p-6 space-y-4">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('qc.components')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {SUBSCORE_KEYS.map(({ key, labelKey, hintKey }) => {
              const value = quality.subscores?.[key] ?? 0;
              return (
                <div key={key} title={t(hintKey)}>
                  <MeterBar label={t(labelKey)} value={value} display={`${Math.round(value * 100)}%`} color={barColor} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detected causes */}
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{t('qc.possibleCauses')}</p>
          {quality.causes.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-status-success">
              <CheckCircle2 size={16} /> {t('qc.noneDetected')}
            </p>
          ) : (
            <ul className="space-y-2">
              {quality.causes.map((cause) => (
                <li key={cause} className="flex items-center gap-2 text-sm text-foreground/80">
                  <AlertTriangle size={14} className="text-status-warning flex-shrink-0" />
                  {cause}
                </li>
              ))}
            </ul>
          )}

          {segmentationStats ? (
            <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground/60">{t('qc.nucleiDetected')}</p>
                <p className="font-semibold text-foreground tabular-nums">{segmentationStats.nuclei_detected}</p>
              </div>
              <div>
                <p className="text-foreground/60">{t('qc.nucleiAnalysed')}</p>
                <p className="font-semibold text-foreground tabular-nums">{segmentationStats.nuclei_analyzed}</p>
              </div>
              <div>
                <p className="text-foreground/60">{t('qc.nucleusCoverage')}</p>
                <p className="font-semibold text-foreground tabular-nums">{segmentationStats.nucleus_coverage_pct}%</p>
              </div>
              <div>
                <p className="text-foreground/60">{t('qc.cytoplasmCoverage')}</p>
                <p className="font-semibold text-foreground tabular-nums">{segmentationStats.cytoplasm_coverage_pct}%</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Raw measurements */}
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{t('qc.measuredValues')}</p>
          <BarDistribution
            bars={SUBSCORE_KEYS.map(({ key, labelKey }) => ({
              label: t(labelKey),
              value: Math.round((quality.subscores?.[key] ?? 0) * 100),
              color: barColor,
            }))}
            height={120}
          />
          <table className="w-full mt-4 text-sm">
            <caption className="sr-only">Raw image quality measurements</caption>
            <tbody>
              {Object.entries(quality.metrics ?? {}).map(([key, value]) => (
                <tr key={key} className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">{METRIC_KEYS[key] ? t(METRIC_KEYS[key]) : key}</td>
                  <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
