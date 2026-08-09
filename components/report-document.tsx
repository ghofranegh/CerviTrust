'use client';

/**
 * The printable report. This is NOT the on-screen preview: it is a typographic
 * A4 document (styles live in `globals.css` under `.print-document`), so
 * "Export as PDF" produces a clinical document rather than a capture of the UI.
 * Hidden on screen, it is the only element printed.
 */

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
  sortClasses,
  toPercent,
} from '@/lib/analysis-types';
import {
  PatientInfo,
  ageFrom,
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
          <p className="pd-sub">Cervical cytology — AI-assisted classification and segmentation</p>
        </div>
        <div className="pd-header-meta">
          <p>
            <strong>Report</strong> {reference}
          </p>
          <p>Generated {generatedAt.toLocaleString()}</p>
          <p>Status: {reportStatusLabel(status)}</p>
        </div>
      </header>

      <h1 className="pd-title">AI-assisted cytology analysis report</h1>

      {/* 1. Identification */}
      <section className="pd-section">
        <h2>1. Study identification</h2>
        <div className="pd-grid">
          <Field label="Patient" value={patient.patientName} />
          <Field label="Patient ID" value={patient.patientId} />
          <Field label="Pseudonymised record" value={pseudonymise(patient.patientId || patient.patientName)} />
          <Field label="Date of birth" value={patient.dateOfBirth} />
          <Field label="Age" value={ageFrom(patient.dateOfBirth)} />
          <Field label="Sample / slide ID" value={patient.sampleId} />
          <Field label="Collection date" value={patient.collectionDate} />
          <Field label="Analysis date" value={generatedAt.toLocaleDateString()} />
          <Field label="Report saved" value={savedAt ? new Date(savedAt).toLocaleString() : 'Not saved'} />
        </div>
      </section>

      {/* 2. Screening result */}
      <section className="pd-section">
        <h2>2. Screening result</h2>
        <div className="pd-result">
          <div className="pd-result-main">
            <span className="pd-result-class">{classMeta(analysis.predictedClass).label}</span>
            <span className="pd-result-full">{classMeta(analysis.predictedClass).fullLabel}</span>
          </div>
          <div className="pd-result-figures">
            <Field label="Calibrated probability" value={`${analysis.confidence}%`} />
            <Field label="Review priority" value={priorityLabel(analysis.priority)} />
            <Field label="Uncertainty" value={`± ${formatNumber((analysis.uncertainty ?? 0) * 100, 1)} pts`} />
            <Field label="Predictive entropy" value={formatNumber(analysis.entropy, 2)} />
            <Field label="Margin to 2nd class" value={formatNumber(analysis.margin, 2)} />
          </div>
        </div>

        {analysis.reviewReasons?.length ? (
          <p className="pd-note">
            <strong>Triage reasons:</strong> {analysis.reviewReasons.join('; ')}.
          </p>
        ) : null}

        <table className="pd-table">
          <caption>Calibrated class probabilities (whole image)</caption>
          <thead>
            <tr>
              <th>Bethesda class</th>
              <th>Description</th>
              <th className="num">Probability</th>
              <th className="num">Uncertainty</th>
            </tr>
          </thead>
          <tbody>
            {sortClasses(Object.keys(probabilities)).map((name) => (
              <tr key={name}>
                <td>
                  <strong>{classMeta(name).label}</strong>
                </td>
                <td>{classMeta(name).fullLabel}</td>
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
        <h2>3. Slide quality control</h2>
        <div className="pd-grid">
          <Field label="Quality score" value={`${analysis.quality?.score ?? '—'} / 100`} />
          <Field label="Interpretability" value={qualityLabel(analysis.quality?.label)} />
          <Field label="Detected causes" value={analysis.quality?.causes?.join(', ') || 'None detected'} />
          <Field label="Focus" value={toPercent(analysis.quality?.subscores?.sharpness, 0)} />
          <Field label="Contrast" value={toPercent(analysis.quality?.subscores?.contrast, 0)} />
          <Field label="Exposure" value={toPercent(analysis.quality?.subscores?.exposure, 0)} />
          <Field label="Staining" value={toPercent(analysis.quality?.subscores?.staining, 0)} />
          <Field label="Cellularity" value={toPercent(analysis.quality?.subscores?.cellularity, 0)} />
          <Field
            label="Field size"
            value={analysis.imageInfo ? `${analysis.imageInfo.width} × ${analysis.imageInfo.height} px` : '—'}
          />
        </div>
      </section>

      {/* 4. Cellular analysis */}
      <section className="pd-section">
        <h2>4. Cellular analysis</h2>
        <div className="pd-grid">
          <Field label="Nuclei detected" value={String(stats?.nuclei_detected ?? 0)} />
          <Field label="Cells classified" value={String(regions.length)} />
          <Field label="Reviewed by practitioner" value={`${reviewed} / ${regions.length}`} />
          <Field label="Corrected / flagged" value={`${corrected} / ${flagged}`} />
          <Field label="Abnormal cells" value={String(stats?.abnormal_instances ?? 0)} />
          <Field label="High-priority cells" value={String(stats?.high_priority_instances ?? 0)} />
          <Field label="Mean nucleus area" value={stats ? `${stats.mean_nucleus_area_px} px²` : '—'} />
          <Field label="Mean circularity" value={formatNumber(stats?.mean_circularity, 2)} />
          <Field label="Mean N/C ratio" value={formatNumber(stats?.mean_nc_ratio, 3)} />
        </div>

        {Object.keys(distribution).length ? (
          <table className="pd-table">
            <caption>Class distribution after practitioner review</caption>
            <thead>
              <tr>
                <th>Class</th>
                <th className="num">Cells</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {sortClasses(Object.keys(distribution)).map((name) => (
                <tr key={name}>
                  <td>
                    <strong>{classMeta(name).label}</strong> — {classMeta(name).fullLabel}
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
          <h2>5. Detected cells and practitioner decisions</h2>
          <table className="pd-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Model class</th>
                <th className="num">Probability</th>
                <th>Priority</th>
                <th>Decision</th>
                <th>Retained class</th>
                <th className="num">N/C ratio</th>
                <th className="num">Circularity</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((roi) => {
                const review = reviews[String(roi.id)];
                const retained = effectiveClass(roi, review);
                return (
                  <tr key={roi.id}>
                    <td className="num">{roi.id}</td>
                    <td>{classMeta(roi.predicted_class).label}</td>
                    <td className="num">{toPercent(roi.confidence, 1)}</td>
                    <td>{priorityLabel(roi.priority)}</td>
                    <td>{reviewLabel(review?.decision ?? 'pending')}</td>
                    <td>
                      {classMeta(retained).label}
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
        <h2>6. Imaging evidence</h2>
        <div className="pd-figures">
          {analysis.segmentation?.overlay ? (
            <figure className="pd-figure">
              <img src={`data:image/png;base64,${analysis.segmentation.overlay}`} alt="" />
              <figcaption>Nucleus contours detected on the field</figcaption>
            </figure>
          ) : null}
          {analysis.gradcam?.overlay ? (
            <figure className="pd-figure">
              <img src={`data:image/png;base64,${analysis.gradcam.overlay}`} alt="" />
              <figcaption>Model attention (Grad-CAM overlay)</figcaption>
            </figure>
          ) : null}
          {analysis.gradcam?.heatmap ? (
            <figure className="pd-figure">
              <img src={`data:image/png;base64,${analysis.gradcam.heatmap}`} alt="" />
              <figcaption>Activation heatmap</figcaption>
            </figure>
          ) : null}
        </div>

        {priorityCells.length ? (
          <>
            <p className="pd-subhead">Cells of highest interest</p>
            <div className="pd-cells">
              {priorityCells.map((roi) => (
                <figure key={roi.id} className="pd-cell">
                  <img src={`data:image/png;base64,${roi.image}`} alt="" />
                  <figcaption>
                    #{roi.id} · {classMeta(effectiveClass(roi, reviews[String(roi.id)])).label} ·{' '}
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
        <h2>7. Findings and recommendation</h2>
        <p className="pd-para">
          <strong>Findings.</strong> {analysis.findings}
        </p>
        <p className="pd-para">
          <strong>Recommendation.</strong> {analysis.recommendation}
        </p>
        {patient.notes ? (
          <p className="pd-para">
            <strong>Clinical notes.</strong> {patient.notes}
          </p>
        ) : null}
        <p className="pd-para">
          <strong>Reviewer observations.</strong> {observations || 'None recorded.'}
        </p>
      </section>

      {/* 8. Signature */}
      <section className="pd-section">
        <h2>8. Validation</h2>
        <div className="pd-signature">
          <div>
            <Field label="Reporting practitioner" value={doctor?.fullName ?? '—'} />
            <Field label="Site" value={doctor?.hospital ?? '—'} />
            <Field label="Specialty" value={doctor?.specialty ?? '—'} />
          </div>
          <div>
            <Field label="Report status" value={reportStatusLabel(status)} />
            <Field label="Model" value={`${analysis.model?.backbone ?? 'efficientnet_b0'} · ${analysis.model?.uncertainty_method ?? 'Laplace'}`} />
            <div className="pd-signature-line">
              <span>Signature and stamp</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="pd-foot">
        <p>
          This report was produced with algorithmic assistance. The system does not establish a diagnosis: the findings
          above support triage and review, and the final clinical interpretation is the responsibility of the qualified
          healthcare professional named in section 8.
        </p>
        <p>
          {reference} · Generated {generatedAt.toLocaleString()} · Segmentation:{' '}
          {analysis.segmentationStats?.source === 'hovernet' ? 'HoVer-Net' : 'Watershed'} · Explainability:{' '}
          {analysis.model?.explainability ?? 'Grad-CAM'}
        </p>
      </footer>
    </article>
  );
}
