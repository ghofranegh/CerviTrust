'use client';

import { AlertCircle } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { MeterBar } from '@/components/charts';
import { useTranslation } from '@/lib/i18n';
import {
  Analysis,
  TONE_BADGE,
  classMeta,
  formatNumber,
  priorityLabel,
  priorityTone,
  qualityLabel,
  qualityTone,
} from '@/lib/analysis-types';

/** Compact result panel shown next to the uploaded image. */
export function AnalysisResults({ analysis }: { analysis: Analysis }) {
  const { t, language } = useTranslation();
  const regions = analysis.regions_of_interest ?? [];
  const abnormal = regions.filter((roi) => classMeta(roi.predicted_class).severity >= 2).length;

  return (
    <div className="bg-white rounded-lg border border-border p-6 space-y-5">
      <h3 className="text-sm font-semibold text-foreground">{t('results.title')}</h3>

      <div>
        <p className="text-xs text-foreground/60 mb-2">{t('results.assessment')}</p>
        <StatusBadge status={analysis.assessment} className="w-full justify-center" />
        <p className="mt-2 text-xs text-foreground/60 text-center">{classMeta(analysis.predictedClass, language).fullLabel}</p>
      </div>

      <div>
        <p className="text-xs text-foreground/60 mb-2">{t('results.calibratedProbability')}</p>
        <div className="text-2xl font-bold text-primary tabular-nums">{analysis.confidence}%</div>
        <div className="mt-2">
          <MeterBar value={analysis.confidence / 100} />
        </div>
        {typeof analysis.uncertainty === 'number' ? (
          <p className="mt-2 text-xs text-foreground/60">
            {t('seg.bayesianUncertainty', { value: formatNumber(analysis.uncertainty * 100, 1), entropy: formatNumber(analysis.entropy, 2) })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-foreground/60">{t('results.reviewPriority')}</p>
          <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[priorityTone(analysis.priority)]}`}>
            {priorityLabel(analysis.priority, language)}
          </span>
        </div>
        <div>
          <p className="text-xs text-foreground/60">{t('results.slideQuality')}</p>
          <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[qualityTone(analysis.quality?.label)]}`}>
            {qualityLabel(analysis.quality?.label, language)}
          </span>
        </div>
        <div>
          <p className="text-xs text-foreground/60">{t('results.cellsDetected')}</p>
          <p className="font-semibold text-foreground tabular-nums">{analysis.segmentationStats?.nuclei_detected ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-foreground/60">{t('results.abnormalCells')}</p>
          <p className="font-semibold text-foreground tabular-nums">{abnormal}</p>
        </div>
      </div>

      <div className="bg-secondary rounded p-3 flex gap-2 items-start">
        <AlertCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/70">
          {analysis.reviewRequired ? t('results.targetedReviewRecommended') : t('results.reviewRecommended')}
        </p>
      </div>
    </div>
  );
}
