'use client';

import { useMemo } from 'react';
import { Download, FileText, Lock, ShieldCheck } from 'lucide-react';
import { DonutChart, MeterBar, classColor } from '@/components/charts';
import { useTranslation } from '@/lib/i18n';
import {
  Analysis,
  CellReviewMap,
  ReportStatus,
  TONE_BADGE,
  classMeta,
  effectiveClass,
  formatNumber,
  priorityLabel,
  priorityTone,
  qualityLabel,
  qualityTone,
  reportStatusLabel,
  reportStatusTone,
  reviewLabel,
  sampleTypeLabel,
  stainingMethodLabel,
  toPercent,
} from '@/lib/analysis-types';
import { PatientInfo, ageFrom, patientDisplayName, pseudonymise, studyReference } from '@/lib/report-utils';

export function ReportPreview({
  analysis,
  patient,
  reviews,
  observations,
  onObservationsChange,
  status,
  onStatusChange,
  canValidate = false,
  savedAt = null,
}: {
  analysis: Analysis;
  patient: PatientInfo;
  reviews: CellReviewMap;
  observations: string;
  onObservationsChange: (value: string) => void;
  status: ReportStatus;
  onStatusChange: (status: ReportStatus) => void;
  /** A report can only be validated once it exists in the store. */
  canValidate?: boolean;
  savedAt?: string | null;
}) {
  const { t, language } = useTranslation();
  const regions = analysis.regions_of_interest ?? [];
  const generatedAt = analysis.analyzedAt ? new Date(analysis.analyzedAt) : new Date();

  /** Distribution after the doctor's corrections are applied. */
  const finalDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const roi of regions) {
      const name = effectiveClass(roi, reviews[String(roi.id)]).toUpperCase();
      counts[name] = (counts[name] ?? 0) + 1;
    }
    if (!regions.length && analysis.probabilities) {
      // No isolated cell: fall back to the whole-image probability profile.
      return Object.fromEntries(
        Object.entries(analysis.probabilities).map(([name, value]) => [name.toUpperCase(), Math.round(value * 100)]),
      );
    }
    return counts;
  }, [regions, reviews, analysis.probabilities]);

  const donutSegments = Object.entries(finalDistribution)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ label: classMeta(name, language).label, value, color: classColor(name) }));

  const reviewedCount = regions.filter((roi) => (reviews[String(roi.id)]?.decision ?? 'pending') !== 'pending').length;
  const correctedCount = regions.filter((roi) => reviews[String(roi.id)]?.decision === 'corrected').length;
  const flaggedCount = regions.filter((roi) => reviews[String(roi.id)]?.decision === 'flagged').length;
  const coverage = regions.length ? Math.round((reviewedCount / regions.length) * 100) : 0;

  const priorityCells = [...regions]
    .sort((a, b) => classMeta(b.predicted_class).severity - classMeta(a.predicted_class).severity || b.confidence - a.confidence)
    .slice(0, 5);

  const downloadJson = () => {
    const payload = {
      study: studyReference(patient, analysis.analyzedAt),
      generatedAt: generatedAt.toISOString(),
      patient: { ...patient, pseudonym: pseudonymise(patient.patientId || patientDisplayName(patient)) },
      analysis,
      cellReviews: reviews,
      reviewerObservations: observations,
      reportStatus: status,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${studyReference(patient, analysis.analyzedAt)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const qTone = qualityTone(analysis.quality?.label);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('report.generation')}</h3>
          <p className="text-sm text-foreground/60">{t('report.generationSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <FileText size={16} /> {t('report.exportPdf')}
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <Download size={16} /> {t('report.downloadData')}
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('validated')}
            disabled={status === 'validated' || !canValidate}
            title={canValidate ? undefined : t('report.saveBeforeValidate')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {canValidate ? <ShieldCheck size={16} /> : <Lock size={16} />}
            {status === 'validated' ? t('report.reportValidated') : t('report.validateReport')}
          </button>
        </div>
      </div>

      {!canValidate ? (
        <p className="flex items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning print:hidden">
          <Lock size={16} className="flex-shrink-0" />
          {t('report.saveWithPatientDetails')}
        </p>
      ) : null}

      <div id="cervitrust-report" className="rounded-lg border border-border bg-white p-6 md:p-8 space-y-8">
        {/* Report header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <h4 className="text-xl font-semibold text-foreground">{t('report.aiAssistedTitle')}</h4>
            <p className="text-sm text-foreground/60">{t('report.brandSub')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-foreground/60">{t('report.generatedOn', { date: generatedAt.toLocaleString() })}</p>
            <p className="text-xs text-foreground/50">
              {savedAt ? t('report.savedOnDate', { date: new Date(savedAt).toLocaleString() }) : t('common.notSavedYet')}
            </p>
            <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[reportStatusTone(status)]}`}>
              {reportStatusLabel(status, language)}
            </span>
          </div>
        </div>

        {/* Study identity */}
        <section>
          <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{t('report.studyIdentity')}</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <p className="text-foreground/60">{t('report.studyId')}</p>
              <p className="font-medium text-foreground">{studyReference(patient, analysis.analyzedAt)}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.pseudonymisedRecord')}</p>
              <p className="font-medium text-foreground">{pseudonymise(patient.patientId || patientDisplayName(patient))}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.sampleId')}</p>
              <p className="font-medium text-foreground">{patient.sampleId || '—'}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.slideId')}</p>
              <p className="font-medium text-foreground">{patient.slideId || '—'}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.dateOfBirth')}</p>
              <p className="font-medium text-foreground">{patient.dateOfBirth || '—'}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.age')}</p>
              <p className="font-medium text-foreground">{ageFrom(patient.dateOfBirth)}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.sex')}</p>
              <p className="font-medium text-foreground">{t('common.female')}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.sampleType')}</p>
              <p className="font-medium text-foreground">{sampleTypeLabel(patient.sampleType, language)}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.anatomicalSite')}</p>
              <p className="font-medium text-foreground">{t('common.cervix')}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.stainingMethod')}</p>
              <p className="font-medium text-foreground">{stainingMethodLabel(patient.stainingMethod, language)}</p>
            </div>
            <div>
              <p className="text-foreground/60">{t('report.imageStudyId')}</p>
              <p className="font-medium text-foreground">{patient.imageStudyId || '—'}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-foreground/60">
            <ShieldCheck size={14} className="text-status-success" />
            {t('report.pseudonymisedNote')}
          </p>
        </section>

        {/* Quality summary */}
        <section className="border-t border-border pt-6">
          <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{t('report.qualityControlSummary')}</h5>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">{t('report.cellsDetected')}</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{analysis.segmentationStats?.nuclei_detected ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">{t('report.cellsAnalysed')}</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{regions.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">{t('report.slideQuality')}</p>
              <p className={`text-xl font-semibold ${qTone === 'success' ? 'text-status-success' : qTone === 'warning' ? 'text-status-warning' : 'text-status-critical'}`}>
                {qualityLabel(analysis.quality?.label, language)}
              </p>
              <p className="text-xs text-foreground/60">{t('report.scoreOutOf', { score: analysis.quality?.score ?? '—' })}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">{t('report.segmentation')}</p>
              <p className="text-xl font-semibold text-foreground">
                {analysis.segmentationStats?.source === 'hovernet' ? 'HoVer-Net' : 'Watershed'}
              </p>
              <p className="text-xs text-foreground/60">
                {t('report.meanConf', { value: toPercent(analysis.segmentationStats?.mean_instance_confidence, 0) })}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">{t('report.reviewCoverage')}</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{coverage}%</p>
              <p className="text-xs text-foreground/60">{t('report.cellsCount', { reviewed: reviewedCount, total: regions.length })}</p>
            </div>
          </div>
        </section>

        {/* Screening result */}
        <section className="border-t border-border pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('report.screeningResult')}</h5>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-lg border px-3 py-2 text-base font-semibold ${TONE_BADGE[classMeta(analysis.predictedClass, language).tone]}`}>
                {classMeta(analysis.predictedClass, language).label}
              </span>
              <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[priorityTone(analysis.priority)]}`}>
                {priorityLabel(analysis.priority, language)} {t('report.priorityWord')}
              </span>
            </div>
            <p className="text-sm text-foreground/70">{classMeta(analysis.predictedClass, language).fullLabel}</p>

            <MeterBar label={t('review.calibratedProbability')} value={analysis.confidence / 100} display={`${analysis.confidence}%`} />

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">{t('report.bayesianUncertainty')}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">± {formatNumber((analysis.uncertainty ?? 0) * 100, 1)} pts</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">{t('report.predictiveEntropy')}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(analysis.entropy, 2)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">{t('report.marginToSecond')}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(analysis.margin, 2)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">{t('report.cellsCorrectedFlagged')}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{correctedCount} / {flaggedCount}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">{t('report.processingTime')}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">
                    {analysis.processingTimeMs ? `${(analysis.processingTimeMs / 1000).toFixed(1)} s` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
              {regions.length ? t('report.classDistributionAfterReview') : t('report.wholeImageProbabilityProfile')}
            </h5>
            {donutSegments.length ? (
              <DonutChart
                segments={donutSegments}
                centerValue={regions.length || '100%'}
                centerLabel={regions.length ? t('report.cellsAnalysedLabel') : t('report.probabilityLabel')}
              />
            ) : (
              <p className="text-sm text-foreground/60">{t('report.noClassDistribution')}</p>
            )}
          </div>
        </section>

        {/* Priority cells */}
        {priorityCells.length > 0 ? (
          <section className="border-t border-border pt-6">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{t('report.priorityCellsToReview')}</h5>
            <div className="flex flex-wrap gap-4">
              {priorityCells.map((roi) => {
                const review = reviews[String(roi.id)];
                return (
                  <div key={roi.id} className="w-32 rounded-lg border border-border p-2">
                    <img src={`data:image/png;base64,${roi.image}`} alt={`Priority cell ${roi.id}`} className="h-24 w-full rounded object-cover" />
                    <p className={`mt-2 text-center text-xs font-semibold ${TONE_BADGE[classMeta(effectiveClass(roi, review), language).tone]} rounded-md border py-0.5`}>
                      {classMeta(effectiveClass(roi, review), language).label}
                    </p>
                    <p className="mt-1 text-center text-xs text-foreground/70 tabular-nums">{toPercent(roi.confidence, 2)}</p>
                    <p className="text-center text-[11px] text-foreground/50">{reviewLabel(review?.decision ?? 'pending', language)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Imaging evidence */}
        {(analysis.segmentation || analysis.gradcam) && (
          <section className="border-t border-border pt-6">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">{t('report.imagingEvidence')}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {analysis.segmentation?.overlay ? (
                <figure>
                  <img src={`data:image/png;base64,${analysis.segmentation.overlay}`} alt={t('report.altSegmentationOverlay')} className="w-full h-40 rounded-lg border border-border object-cover" />
                  <figcaption className="mt-1 text-xs text-foreground/60">{t('report.nucleusContours')}</figcaption>
                </figure>
              ) : null}
              {analysis.gradcam?.overlay ? (
                <figure>
                  <img src={`data:image/png;base64,${analysis.gradcam.overlay}`} alt="Grad-CAM overlay" className="w-full h-40 rounded-lg border border-border object-cover" />
                  <figcaption className="mt-1 text-xs text-foreground/60">{t('report.gradcamOverlay')}</figcaption>
                </figure>
              ) : null}
              {analysis.gradcam?.heatmap ? (
                <figure>
                  <img src={`data:image/png;base64,${analysis.gradcam.heatmap}`} alt={t('report.activationHeatmap')} className="w-full h-40 rounded-lg border border-border object-cover" />
                  <figcaption className="mt-1 text-xs text-foreground/60">{t('report.activationHeatmap')}</figcaption>
                </figure>
              ) : null}
            </div>
            {analysis.gradcamStats?.high_activation_pct !== undefined ? (
              <p className="mt-3 text-xs text-foreground/60">
                {t('report.highActivation', { pct: analysis.gradcamStats.high_activation_pct, score: formatNumber(analysis.gradcamStats.focus_score, 2) })}
              </p>
            ) : null}
          </section>
        )}

        {/* Findings and recommendation */}
        <section className="border-t border-border pt-6 space-y-4">
          <div>
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">{t('report.findings')}</h5>
            <p className="text-sm text-foreground/80 leading-relaxed">{analysis.findings}</p>
            {analysis.reviewReasons?.length ? (
              <ul className="mt-2 space-y-1">
                {analysis.reviewReasons.map((reason) => (
                  <li key={reason} className="text-sm text-foreground/70">• {reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">{t('report.recommendation')}</h5>
            <p className="rounded-lg bg-primary/5 border border-primary/10 p-4 text-sm text-foreground leading-relaxed">
              {analysis.recommendation}
            </p>
          </div>
          {patient.notes ? (
            <div>
              <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">{t('report.clinicalNotes')}</h5>
              <p className="text-sm text-foreground/80 leading-relaxed">{patient.notes}</p>
            </div>
          ) : null}
        </section>

        {/* Reviewer observations + status */}
        <section className="border-t border-border pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">{t('report.reviewerObservations')}</h5>
            <textarea
              className="w-full min-h-28 rounded-lg border border-border px-3 py-2 text-sm"
              placeholder={t('report.reviewerObservationsPlaceholder')}
              maxLength={2000}
              value={observations}
              onChange={(event) => onObservationsChange(event.target.value)}
            />
            <p className="mt-1 text-right text-xs text-foreground/50">{observations.length} / 2000</p>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">{t('report.reportStatus')}</h5>
            <div className="space-y-2">
              {(
                [
                  { value: 'draft', hintKey: 'report.statusDraftHint' },
                  { value: 'in_review', hintKey: 'report.statusInReviewHint' },
                  { value: 'validated', hintKey: 'report.statusValidatedHint' },
                ] as Array<{ value: ReportStatus; hintKey: 'report.statusDraftHint' | 'report.statusInReviewHint' | 'report.statusValidatedHint' }>
              ).map((option) => {
                const locked = option.value === 'validated' && !canValidate;
                return (
                  <label
                    key={option.value}
                    title={locked ? t('report.saveBeforeValidate') : undefined}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                      locked
                        ? 'cursor-not-allowed border-border opacity-50'
                        : status === option.value
                          ? 'cursor-pointer border-primary bg-primary/5'
                          : 'cursor-pointer border-border hover:bg-secondary'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="report-status"
                        disabled={locked}
                        checked={status === option.value}
                        onChange={() => onStatusChange(option.value)}
                      />
                      {reportStatusLabel(option.value, language)}
                    </span>
                    <span className="text-xs text-foreground/60">{locked ? t('report.saveFirst') : t(option.hintKey)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <p className="border-t border-border pt-4 text-xs text-foreground/60 text-center leading-relaxed">{t('report.footerDisclaimer')}</p>
      </div>
    </div>
  );
}
