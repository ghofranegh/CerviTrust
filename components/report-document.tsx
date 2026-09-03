'use client';

/**
 * The printable report. This is NOT the on-screen preview: it is a typographic
 * A4 document (styles live in `globals.css` under `.print-document`), so
 * "Export as PDF" produces a clinical document rather than a capture of the UI.
 * Hidden on screen, it is the only element printed.
 */

import { useTranslation } from '@/lib/i18n';
import {
  Analysis,
  CellReviewMap,
  DoctorProfile,
  ReportStatus,
  classMeta,
  effectiveClass,
  formatNumber,
  priorityLabel,
  qualityLabel,
  reportStatusLabel,
  reviewLabel,
  sampleTypeLabel,
  sortClasses,
  stainingMethodLabel,
  toPercent,
} from '@/lib/analysis-types';
import { personName } from '@/lib/analysis-types';
import {
  PatientInfo,
  ageFrom,
  patientDisplayName,
  pseudonymise,
  reviewedDistribution,
  studyReference,
} from '@/lib/report-utils';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="pd-field">
      <span className="k">{label}</span>
      <span className="v">{value || '—'}</span>
    </div>
  );
}

export function ReportDocument({
  analysis,
  patient,
  reviews,
  observations,
  status,
  doctor,
  savedAt,
}: {
  analysis: Analysis;
  patient: PatientInfo;
  reviews: CellReviewMap;
  observations: string;
  status: ReportStatus;
  doctor?: DoctorProfile | null;
  savedAt?: string | null;
}) {
  const { t, language } = useTranslation();
  const regions = analysis.regions_of_interest ?? [];
  const generatedAt = analysis.analyzedAt ? new Date(analysis.analyzedAt) : new Date();
  const reference = studyReference(patient, analysis.analyzedAt);

  const distribution = reviewedDistribution(regions, reviews);
  const reviewed = regions.filter((roi) => (reviews[String(roi.id)]?.decision ?? 'pending') !== 'pending').length;
  const corrected = regions.filter((roi) => reviews[String(roi.id)]?.decision === 'corrected').length;
  const flagged = regions.filter((roi) => reviews[String(roi.id)]?.decision === 'flagged').length;

  const priorityCells = [...regions]
    .sort(
      (a, b) =>
        classMeta(b.predicted_class).severity - classMeta(a.predicted_class).severity || b.confidence - a.confidence,
    )
    .slice(0, 4);

  const probabilities = analysis.probabilities ?? {};
  const stats = analysis.segmentationStats;

  return (
    <article className="print-document" id="print-document">
      {/* Letterhead */}
      <header className="pd-header">
        <div>
          <p className="pd-brand">CerviTrust</p>
          <p className="pd-sub">{t('report.brandSub')}</p>
        </div>
        <div className="pd-header-meta">
          <p>
            <strong>{t('report.reportLabel')}</strong> {reference}
          </p>
          <p>{t('report.generatedOn', { date: generatedAt.toLocaleString() })}</p>
          <p>{t('report.statusColon')} {reportStatusLabel(status, language)}</p>
        </div>
      </header>

      <h1 className="pd-title">{t('report.aiAssistedTitle')}</h1>

      {/* 1. Identification */}
      <section className="pd-section">
        <h2>1. {t('report.studyIdentity')}</h2>
        <div className="pd-grid">
          <Field label={t('report.patient')} value={patientDisplayName(patient)} />
          <Field label={t('report.patientId')} value={patient.patientId} />
          <Field label={t('report.pseudonymisedRecord')} value={pseudonymise(patient.patientId || patientDisplayName(patient))} />
          <Field label={t('report.dateOfBirth')} value={patient.dateOfBirth} />
          <Field label={t('report.age')} value={ageFrom(patient.dateOfBirth)} />
          <Field label={t('report.sex')} value={t('common.female')} />
          <Field label={t('report.sampleId')} value={patient.sampleId} />
          <Field label={t('report.slideId')} value={patient.slideId} />
          <Field label={t('report.sampleType')} value={sampleTypeLabel(patient.sampleType, language)} />
          <Field label={t('report.anatomicalSite')} value={t('common.cervix')} />
          <Field label={t('report.stainingMethod')} value={stainingMethodLabel(patient.stainingMethod, language)} />
          <Field label={t('report.imageStudyId')} value={patient.imageStudyId} />
          <Field label={t('report.analysisDate')} value={generatedAt.toLocaleDateString()} />
          <Field label={t('report.reportSaved')} value={savedAt ? new Date(savedAt).toLocaleString() : t('common.notSaved')} />
        </div>
      </section>

      {/* 2. Screening result */}
      <section className="pd-section">
        <h2>2. {t('report.screeningResult')}</h2>
        <div className="pd-result">
          <div className="pd-result-main">
            <span className="pd-result-class">{classMeta(analysis.predictedClass, language).label}</span>
            <span className="pd-result-full">{classMeta(analysis.predictedClass, language).fullLabel}</span>
          </div>
          <div className="pd-result-figures">
            <Field label={t('review.calibratedProbability')} value={`${analysis.confidence}%`} />
            <Field label={t('results.reviewPriority')} value={priorityLabel(analysis.priority, language)} />
            <Field label={t('report.uncertaintyCol')} value={`± ${formatNumber((analysis.uncertainty ?? 0) * 100, 1)} pts`} />
            <Field label={t('report.predictiveEntropy')} value={formatNumber(analysis.entropy, 2)} />
            <Field label={t('report.marginToSecond')} value={formatNumber(analysis.margin, 2)} />
          </div>
        </div>

        {analysis.reviewReasons?.length ? (
          <p className="pd-note">
            <strong>{t('report.triageReasons')}</strong> {analysis.reviewReasons.join('; ')}.
          </p>
        ) : null}

        <table className="pd-table">
          <caption>{t('report.calibratedClassProbabilities')}</caption>
          <thead>
            <tr>
              <th>{t('report.bethesdaClass')}</th>
              <th>{t('report.description')}</th>
              <th className="num">{t('report.probabilityCol')}</th>
              <th className="num">{t('report.uncertaintyCol')}</th>
            </tr>
          </thead>
          <tbody>
            {sortClasses(Object.keys(probabilities)).map((name) => (
              <tr key={name}>
                <td>
                  <strong>{classMeta(name, language).label}</strong>
                </td>
                <td>{classMeta(name, language).fullLabel}</td>
                <td className="num">{toPercent(probabilities[name], 1)}</td>
                <td className="num">
                  {analysis.uncertainties?.[name] !== undefined
                    ? `± ${formatNumber(analysis.uncertainties[name] * 100, 1)} pts`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3. Quality control */}
      <section className="pd-section">
        <h2>3. {t('report.slideQualityControl')}</h2>
        <div className="pd-grid">
          <Field label={t('qc.score')} value={`${analysis.quality?.score ?? '—'} / 100`} />
          <Field label={t('report.interpretability')} value={qualityLabel(analysis.quality?.label, language)} />
          <Field label={t('report.detectedCauses')} value={analysis.quality?.causes?.join(', ') || t('qc.noneDetected')} />
          <Field label={t('report.focus')} value={toPercent(analysis.quality?.subscores?.sharpness, 0)} />
          <Field label={t('report.contrast')} value={toPercent(analysis.quality?.subscores?.contrast, 0)} />
          <Field label={t('report.exposure')} value={toPercent(analysis.quality?.subscores?.exposure, 0)} />
          <Field label={t('report.staining')} value={toPercent(analysis.quality?.subscores?.staining, 0)} />
          <Field label={t('report.cellularity')} value={toPercent(analysis.quality?.subscores?.cellularity, 0)} />
          <Field
            label={t('report.fieldSize')}
            value={analysis.imageInfo ? `${analysis.imageInfo.width} × ${analysis.imageInfo.height} px` : '—'}
          />
        </div>
      </section>

      {/* 4. Cellular analysis */}
      <section className="pd-section">
        <h2>4. {t('report.cellularAnalysis')}</h2>
        <div className="pd-grid">
          <Field label={t('report.nucleiDetected')} value={String(stats?.nuclei_detected ?? 0)} />
          <Field label={t('report.cellsClassified')} value={String(regions.length)} />
          <Field label={t('report.reviewedByPractitioner')} value={`${reviewed} / ${regions.length}`} />
          <Field label={t('report.correctedFlagged')} value={`${corrected} / ${flagged}`} />
          <Field label={t('report.abnormalCells')} value={String(stats?.abnormal_instances ?? 0)} />
          <Field label={t('report.highPriorityCells')} value={String(stats?.high_priority_instances ?? 0)} />
          <Field label={t('report.meanNucleusArea')} value={stats ? `${stats.mean_nucleus_area_px} px²` : '—'} />
          <Field label={t('report.meanCircularity')} value={formatNumber(stats?.mean_circularity, 2)} />
          <Field label={t('report.meanNcRatio')} value={formatNumber(stats?.mean_nc_ratio, 3)} />
        </div>

        {Object.keys(distribution).length ? (
          <table className="pd-table">
            <caption>{t('report.classDistAfterReview')}</caption>
            <thead>
              <tr>
                <th>{t('report.class')}</th>
                <th className="num">{t('report.cells')}</th>
                <th className="num">{t('report.share')}</th>
              </tr>
            </thead>
            <tbody>
              {sortClasses(Object.keys(distribution)).map((name) => (
                <tr key={name}>
                  <td>
                    <strong>{classMeta(name, language).label}</strong> — {classMeta(name, language).fullLabel}
                  </td>
                  <td className="num">{distribution[name]}</td>
                  <td className="num">{((distribution[name] / regions.length) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {/* 5. Per-cell decisions */}
      {regions.length ? (
        <section className="pd-section">
          <h2>5. {t('report.detectedCellsDecisions')}</h2>
          <table className="pd-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>{t('report.modelClass')}</th>
                <th className="num">{t('report.probabilityCol')}</th>
                <th>{t('review.priority')}</th>
                <th>{t('review.decision')}</th>
                <th>{t('report.retainedClass')}</th>
                <th className="num">{t('seg.ncRatio')}</th>
                <th className="num">{t('seg.nuclearCircularity')}</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((roi) => {
                const review = reviews[String(roi.id)];
                const retained = effectiveClass(roi, review);
                return (
                  <tr key={roi.id}>
                    <td className="num">{roi.id}</td>
                    <td>{classMeta(roi.predicted_class, language).label}</td>
                    <td className="num">{toPercent(roi.confidence, 1)}</td>
                    <td>{priorityLabel(roi.priority, language)}</td>
                    <td>{reviewLabel(review?.decision ?? 'pending', language)}</td>
                    <td>
                      {classMeta(retained, language).label}
                      {review?.note ? ` (${review.note})` : ''}
                    </td>
                    <td className="num">{formatNumber(roi.morphometrics?.nc_ratio, 3)}</td>
                    <td className="num">{formatNumber(roi.morphometrics?.circularity, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* 6. Imaging evidence */}
      <section className="pd-section pd-break">
        <h2>6. {t('report.imagingEvidence')}</h2>
        <div className="pd-figures">
          {analysis.segmentation?.overlay ? (
            <figure className="pd-figure">
              <img src={`data:image/png;base64,${analysis.segmentation.overlay}`} alt="" />
              <figcaption>{t('report.nucleusContours')}</figcaption>
            </figure>
          ) : null}
          {analysis.gradcam?.overlay ? (
            <figure className="pd-figure">
              <img src={`data:image/png;base64,${analysis.gradcam.overlay}`} alt="" />
              <figcaption>{t('report.gradcamOverlay')}</figcaption>
            </figure>
          ) : null}
          {analysis.gradcam?.heatmap ? (
            <figure className="pd-figure">
              <img src={`data:image/png;base64,${analysis.gradcam.heatmap}`} alt="" />
              <figcaption>{t('report.activationHeatmap')}</figcaption>
            </figure>
          ) : null}
        </div>

        {priorityCells.length ? (
          <>
            <p className="pd-subhead">{t('report.cellsOfHighestInterest')}</p>
            <div className="pd-cells">
              {priorityCells.map((roi) => (
                <figure key={roi.id} className="pd-cell">
                  <img src={`data:image/png;base64,${roi.image}`} alt="" />
                  <figcaption>
                    #{roi.id} · {classMeta(effectiveClass(roi, reviews[String(roi.id)]), language).label} ·{' '}
                    {toPercent(roi.confidence, 0)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {/* 7. Conclusion */}
      <section className="pd-section">
        <h2>7. {t('report.findingsAndRecommendation')}</h2>
        <p className="pd-para">
          <strong>{t('report.findings')}.</strong> {analysis.findings}
        </p>
        <p className="pd-para">
          <strong>{t('report.recommendation')}.</strong> {analysis.recommendation}
        </p>
        {patient.notes ? (
          <p className="pd-para">
            <strong>{t('report.clinicalNotes')}.</strong> {patient.notes}
          </p>
        ) : null}
        <p className="pd-para">
          <strong>{t('report.reviewerObservations')}.</strong> {observations || t('report.noneRecorded')}
        </p>
      </section>

      {/* 8. Signature */}
      <section className="pd-section">
        <h2>8. {t('report.validation')}</h2>
        <div className="pd-signature">
          <div>
            <Field label={t('report.reportingPractitioner')} value={doctor ? personName(doctor) : '—'} />
            <Field label={t('report.site')} value={doctor?.hospital ?? '—'} />
            <Field label={t('report.specialty')} value={doctor?.specialty ?? '—'} />
          </div>
          <div>
            <Field label={t('report.reportStatus')} value={reportStatusLabel(status, language)} />
            <Field label={t('report.model')} value={`${analysis.model?.backbone ?? 'efficientnet_b0'} · ${analysis.model?.uncertainty_method ?? 'Laplace'}`} />
            <div className="pd-signature-line">
              <span>{t('report.signatureStamp')}</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="pd-foot">
        <p>{t('report.footerLong')}</p>
        <p>
          {reference} · {t('report.generatedOn', { date: generatedAt.toLocaleString() })} · {t('report.segmentation')}:{' '}
          {analysis.segmentationStats?.source === 'hovernet' ? 'HoVer-Net' : 'Watershed'} · {t('report.explainability')}:{' '}
          {analysis.model?.explainability ?? 'Grad-CAM'}
        </p>
      </footer>
    </article>
  );
}
