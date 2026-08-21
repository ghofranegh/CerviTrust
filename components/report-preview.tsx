'use client';

import { useMemo } from 'react';
import { Download, FileText, Lock, ShieldCheck } from 'lucide-react';
import { DonutChart, MeterBar, classColor } from '@/components/charts';
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
    .map(([name, value]) => ({ label: classMeta(name).label, value, color: classColor(name) }));

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
          <h3 className="text-lg font-semibold text-foreground">Report generation</h3>
          <p className="text-sm text-foreground/60">
            Everything the model produced for this smear, assembled into a reviewable report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <FileText size={16} /> Export as PDF
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <Download size={16} /> Download data
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('validated')}
            disabled={status === 'validated' || !canValidate}
            title={canValidate ? undefined : 'Save the report before validating it'}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {canValidate ? <ShieldCheck size={16} /> : <Lock size={16} />}
            {status === 'validated' ? 'Report validated' : 'Validate report'}
          </button>
        </div>
      </div>

      {!canValidate ? (
        <p className="flex items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning print:hidden">
          <Lock size={16} className="flex-shrink-0" />
          Save the report with the patient details above before it can be validated.
        </p>
      ) : null}

      <div id="cervitrust-report" className="rounded-lg border border-border bg-white p-6 md:p-8 space-y-8">
        {/* Report header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <h4 className="text-xl font-semibold text-foreground">AI-assisted cytology analysis report</h4>
            <p className="text-sm text-foreground/60">CerviTrust — cervical cytology classification and segmentation</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-foreground/60">Generated on {generatedAt.toLocaleString()}</p>
            <p className="text-xs text-foreground/50">
              {savedAt ? `Saved on ${new Date(savedAt).toLocaleString()}` : 'Not saved yet'}
            </p>
            <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[reportStatusTone(status)]}`}>
              {reportStatusLabel(status)}
            </span>
          </div>
        </div>

        {/* Study identity */}
        <section>
          <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">Study identity</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <p className="text-foreground/60">Study ID</p>
              <p className="font-medium text-foreground">{studyReference(patient, analysis.analyzedAt)}</p>
            </div>
            <div>
              <p className="text-foreground/60">Pseudonymised record</p>
              <p className="font-medium text-foreground">{pseudonymise(patient.patientId || patientDisplayName(patient))}</p>
            </div>
            <div>
              <p className="text-foreground/60">Sample ID</p>
              <p className="font-medium text-foreground">{patient.sampleId || '—'}</p>
            </div>
            <div>
              <p className="text-foreground/60">Slide ID</p>
              <p className="font-medium text-foreground">{patient.slideId || '—'}</p>
            </div>
            <div>
              <p className="text-foreground/60">Date of birth</p>
              <p className="font-medium text-foreground">{patient.dateOfBirth || '—'}</p>
            </div>
            <div>
              <p className="text-foreground/60">Age</p>
              <p className="font-medium text-foreground">{ageFrom(patient.dateOfBirth)}</p>
            </div>
            <div>
              <p className="text-foreground/60">Sex</p>
              <p className="font-medium text-foreground">Female</p>
            </div>
            <div>
              <p className="text-foreground/60">Sample type</p>
              <p className="font-medium text-foreground">{sampleTypeLabel(patient.sampleType)}</p>
            </div>
            <div>
              <p className="text-foreground/60">Anatomical site</p>
              <p className="font-medium text-foreground">Cervix</p>
            </div>
            <div>
              <p className="text-foreground/60">Staining method</p>
              <p className="font-medium text-foreground">{stainingMethodLabel(patient.stainingMethod)}</p>
            </div>
            <div>
              <p className="text-foreground/60">Image / Study ID</p>
              <p className="font-medium text-foreground">{patient.imageStudyId || '—'}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-foreground/60">
            <ShieldCheck size={14} className="text-status-success" />
            Patient identifiers are pseudonymised in exported data.
          </p>
        </section>

        {/* Quality summary */}
        <section className="border-t border-border pt-6">
          <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">Quality control summary</h5>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">Cells detected</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{analysis.segmentationStats?.nuclei_detected ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">Cells analysed</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{regions.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">Slide quality</p>
              <p className={`text-xl font-semibold ${qTone === 'success' ? 'text-status-success' : qTone === 'warning' ? 'text-status-warning' : 'text-status-critical'}`}>
                {qualityLabel(analysis.quality?.label)}
              </p>
              <p className="text-xs text-foreground/60">Score {analysis.quality?.score ?? '—'}/100</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">Segmentation</p>
              <p className="text-xl font-semibold text-foreground">
                {analysis.segmentationStats?.source === 'hovernet' ? 'HoVer-Net' : 'Watershed'}
              </p>
              <p className="text-xs text-foreground/60">
                Mean conf. {toPercent(analysis.segmentationStats?.mean_instance_confidence, 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs text-foreground/60">Review coverage</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{coverage}%</p>
              <p className="text-xs text-foreground/60">
                {reviewedCount}/{regions.length} cells
              </p>
            </div>
          </div>
        </section>

        {/* Screening result */}
        <section className="border-t border-border pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Screening result</h5>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-lg border px-3 py-2 text-base font-semibold ${TONE_BADGE[classMeta(analysis.predictedClass).tone]}`}>
                {classMeta(analysis.predictedClass).label}
              </span>
              <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[priorityTone(analysis.priority)]}`}>
                {priorityLabel(analysis.priority)} priority
              </span>
            </div>
            <p className="text-sm text-foreground/70">{classMeta(analysis.predictedClass).fullLabel}</p>

            <MeterBar label="Calibrated probability" value={analysis.confidence / 100} display={`${analysis.confidence}%`} />

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">Bayesian uncertainty</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">± {formatNumber((analysis.uncertainty ?? 0) * 100, 1)} pts</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">Predictive entropy</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(analysis.entropy, 2)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">Margin to second class</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(analysis.margin, 2)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">Cells corrected / flagged</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{correctedCount} / {flaggedCount}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 text-foreground/70">Processing time</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">
                    {analysis.processingTimeMs ? `${(analysis.processingTimeMs / 1000).toFixed(1)} s` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
              {regions.length ? 'Class distribution after review' : 'Whole-image probability profile'}
            </h5>
            {donutSegments.length ? (
              <DonutChart
                segments={donutSegments}
                centerValue={regions.length || '100%'}
                centerLabel={regions.length ? 'cells analysed' : 'probability'}
              />
            ) : (
              <p className="text-sm text-foreground/60">No class distribution available for this field.</p>
            )}
          </div>
        </section>

        {/* Priority cells */}
        {priorityCells.length > 0 ? (
          <section className="border-t border-border pt-6">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">Priority cells to review</h5>
            <div className="flex flex-wrap gap-4">
              {priorityCells.map((roi) => {
                const review = reviews[String(roi.id)];
                return (
                  <div key={roi.id} className="w-32 rounded-lg border border-border p-2">
                    <img src={`data:image/png;base64,${roi.image}`} alt={`Priority cell ${roi.id}`} className="h-24 w-full rounded object-cover" />
                    <p className={`mt-2 text-center text-xs font-semibold ${TONE_BADGE[classMeta(effectiveClass(roi, review)).tone]} rounded-md border py-0.5`}>
                      {classMeta(effectiveClass(roi, review)).label}
                    </p>
                    <p className="mt-1 text-center text-xs text-foreground/70 tabular-nums">{toPercent(roi.confidence, 2)}</p>
                    <p className="text-center text-[11px] text-foreground/50">{reviewLabel(review?.decision ?? 'pending')}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Imaging evidence */}
        {(analysis.segmentation || analysis.gradcam) && (
          <section className="border-t border-border pt-6">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">Imaging evidence</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {analysis.segmentation?.overlay ? (
                <figure>
                  <img src={`data:image/png;base64,${analysis.segmentation.overlay}`} alt="Segmentation overlay" className="w-full h-40 rounded-lg border border-border object-cover" />
                  <figcaption className="mt-1 text-xs text-foreground/60">Nucleus contours</figcaption>
                </figure>
              ) : null}
              {analysis.gradcam?.overlay ? (
                <figure>
                  <img src={`data:image/png;base64,${analysis.gradcam.overlay}`} alt="Grad-CAM overlay" className="w-full h-40 rounded-lg border border-border object-cover" />
                  <figcaption className="mt-1 text-xs text-foreground/60">Attention overlay (Grad-CAM)</figcaption>
                </figure>
              ) : null}
              {analysis.gradcam?.heatmap ? (
                <figure>
                  <img src={`data:image/png;base64,${analysis.gradcam.heatmap}`} alt="Activation heatmap" className="w-full h-40 rounded-lg border border-border object-cover" />
                  <figcaption className="mt-1 text-xs text-foreground/60">Activation heatmap</figcaption>
                </figure>
              ) : null}
            </div>
            {analysis.gradcamStats?.high_activation_pct !== undefined ? (
              <p className="mt-3 text-xs text-foreground/60">
                {analysis.gradcamStats.high_activation_pct}% of the field carries high activation · focus score{' '}
                {formatNumber(analysis.gradcamStats.focus_score, 2)}
              </p>
            ) : null}
          </section>
        )}

        {/* Findings and recommendation */}
        <section className="border-t border-border pt-6 space-y-4">
          <div>
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Findings</h5>
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
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Recommendation</h5>
            <p className="rounded-lg bg-primary/5 border border-primary/10 p-4 text-sm text-foreground leading-relaxed">
              {analysis.recommendation}
            </p>
          </div>
          {patient.notes ? (
            <div>
              <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Clinical notes</h5>
              <p className="text-sm text-foreground/80 leading-relaxed">{patient.notes}</p>
            </div>
          ) : null}
        </section>

        {/* Reviewer observations + status */}
        <section className="border-t border-border pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Reviewer observations</h5>
            <textarea
              className="w-full min-h-28 rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Enter your observations, comments or recommendations…"
              maxLength={2000}
              value={observations}
              onChange={(event) => onObservationsChange(event.target.value)}
            />
            <p className="mt-1 text-right text-xs text-foreground/50">{observations.length} / 2000</p>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Report status</h5>
            <div className="space-y-2">
              {(
                [
                  { value: 'draft', hint: 'Being written' },
                  { value: 'in_review', hint: 'Awaiting second read' },
                  { value: 'validated', hint: 'Finalised and locked' },
                ] as Array<{ value: ReportStatus; hint: string }>
              ).map((option) => {
                const locked = option.value === 'validated' && !canValidate;
                return (
                  <label
                    key={option.value}
                    title={locked ? 'Save the report before validating it' : undefined}
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
                      {reportStatusLabel(option.value)}
                    </span>
                    <span className="text-xs text-foreground/60">{locked ? 'Save first' : option.hint}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <p className="border-t border-border pt-4 text-xs text-foreground/60 text-center leading-relaxed">
          This report was generated automatically from model output. Final validation and clinical interpretation remain
          the responsibility of the healthcare professional.
        </p>
      </div>
    </div>
  );
}
