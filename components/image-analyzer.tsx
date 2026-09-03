'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { AnalysisResults } from '@/components/analysis-results';
import { QualityControlPanel } from '@/components/quality-control-panel';
import { SegmentationViewer } from '@/components/segmentation-viewer';
import { CellReviewTable } from '@/components/cell-review-table';
import { ReportPreview } from '@/components/report-preview';
import { ReportDocument } from '@/components/report-document';
import { PatientPicker } from '@/components/patient-picker';
import { EMPTY_PATIENT, missingPatientFields, type PatientInfo } from '@/lib/report-utils';
import { DonutChart, MeterBar, classColor } from '@/components/charts';
import { getStoredDoctorToken } from '@/lib/client-auth';
import { useAnalysisSession, type TabId } from '@/lib/use-analysis-session';
import { translateError, useTranslation } from '@/lib/i18n';
import {
  Analysis,
  CellReview,
  DoctorProfile,
  TONE_BADGE,
  classMeta,
  formatNumber,
  normalizeAssessment,
  priorityLabel,
  priorityTone,
  sampleTypeOptions,
  sortClasses,
  stainingMethodOptions,
  toPercent,
} from '@/lib/analysis-types';

const TAB_IDS: TabId[] = ['overview', 'quality', 'segmentation', 'review', 'report'];

const SAMPLE_FIELD =
  'rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function ImageAnalyzer({
  doctor,
  onSaved,
  initialPatientId,
  initialReportId,
}: {
  doctor?: DoctorProfile | null;
  onSaved?: () => void;
  initialPatientId?: string;
  initialReportId?: string;
}) {
  const {
    file,
    preview,
    status,
    analysis,
    analysisError,
    patientInfo,
    cellReviews,
    observations,
    reportStatus,
    selectedRegionId,
    savedReportId,
    savedAt,
    activeTab,
    set,
    reset,
  } = useAnalysisSession();

  const setFile = set('file');
  const setPreview = set('preview');
  const setStatus = set('status');
  const setAnalysis = set('analysis');
  const setAnalysisError = set('analysisError');
  const setPatientInfo = set('patientInfo');
  const setCellReviews = set('cellReviews');
  const setObservations = set('observations');
  const setReportStatus = set('reportStatus');
  const setSelectedRegionId = set('selectedRegionId');
  const setSavedReportId = set('savedReportId');
  const setSavedAt = set('savedAt');
  const setActiveTab = set('activeTab');

  const { t, language } = useTranslation();
  const TAB_LABELS: Record<TabId, string> = {
    overview: t('analysis.tabOverview'),
    quality: t('analysis.tabQuality'),
    segmentation: t('analysis.tabSegmentation'),
    review: t('analysis.tabReview'),
    report: t('analysis.tabReport'),
  };

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(doctor ?? null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [patientErrors, setPatientErrors] = useState<string[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = ['Analysing image', 'Detecting nuclei', 'Measuring morphometry', 'Generating heatmaps', 'Preparing report'];

  useEffect(() => {
    if (status !== 'analyzing') return;
    const interval = window.setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % loadingMessages.length);
    }, 900);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (doctor) {
      setDoctorProfile(doctor);
      return;
    }

    const token = getStoredDoctorToken();
    if (!token) {
      setDoctorProfile(null);
      return;
    }

    void fetch('/api/auth/me', { headers: { 'x-doctor-token': token } })
      .then((res) => res.json())
      .then((data) => setDoctorProfile(data.doctor ?? null))
      .catch(() => setDoctorProfile(null));
  }, [doctor]);

  // Reopen a saved report for editing — restores the analysis, patient identity and review decisions.
  useEffect(() => {
    if (!initialReportId || savedReportId === initialReportId) return;
    const token = getStoredDoctorToken();
    if (!token) return;

    setLoadingReport(true);
    void fetch(`/api/analyses/${initialReportId}`, { headers: { 'x-doctor-token': token } })
      .then((res) => res.json())
      .then((data) => {
        const record = data.analysis;
        if (!record) return;
        const restoredAnalysis = (record.analysisData ?? {}) as unknown as Analysis;

        setAnalysis(restoredAnalysis);
        setPatientInfo({
          patientRecordId: record.patientRecordId ?? record.patientId ?? '',
          patientFirstName: record.patientFirstName ?? '',
          patientLastName: record.patientLastName ?? '',
          patientId: record.patientId ?? '',
          dateOfBirth: record.dateOfBirth ?? '',
          sex: 'female',
          sampleId: record.sampleId ?? '',
          slideId: record.slideId ?? '',
          sampleType: record.sampleType ?? '',
          anatomicalSite: 'cervix',
          stainingMethod: record.stainingMethod ?? '',
          imageStudyId: record.imageStudyId ?? '',
          notes: record.notes ?? '',
        });
        setCellReviews(record.cellReviews ?? {});
        setObservations(record.reviewerObservations ?? '');
        setReportStatus(record.reportStatus ?? 'draft');
        setSavedReportId(record.id);
        setSavedAt(record.updatedAt ?? record.createdAt ?? null);
        // `segmentation.background` is a binary mask, not a photo — the contour
        // overlay is the closest thing to the original field we have on record.
        const segmentation = restoredAnalysis.segmentation;
        setPreview(segmentation?.overlay ? `data:image/png;base64,${segmentation.overlay}` : null);
        setSelectedRegionId(restoredAnalysis.regions_of_interest?.[0]?.id ?? null);
        setStatus('complete');
        setActiveTab('report');
      })
      .catch(() => {
        setSaveMessage({ tone: 'error', text: t('analysis.unableToLoadReport') });
      })
      .finally(() => setLoadingReport(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReportId]);

  // Starting a fresh analysis from a patient's roster row — pre-fill their identity.
  useEffect(() => {
    if (!initialPatientId || initialReportId || patientInfo.patientRecordId === initialPatientId) return;
    const token = getStoredDoctorToken();
    if (!token) return;

    void fetch(`/api/patients/${initialPatientId}`, { headers: { 'x-doctor-token': token } })
      .then((res) => res.json())
      .then((data) => {
        if (!data.patient) return;
        setPatientInfo({
          ...EMPTY_PATIENT,
          patientRecordId: data.patient.id,
          patientFirstName: data.patient.firstName,
          patientLastName: data.patient.lastName,
          patientId: data.patient.id,
          dateOfBirth: data.patient.dateOfBirth,
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId, initialReportId]);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setAnalysisError('Please select an image file.');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
    setStatus('idle');
    setAnalysis(null);
    setAnalysisError('');
    setCellReviews({});
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus('analyzing');
    setAnalysisError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(translateError(data.error, t) || t('error.inferenceFailed'));

      const predictedClass: string = data.predicted_class ?? 'NILM';
      const roiList = Array.isArray(data.regions_of_interest) ? data.regions_of_interest : [];
      const detected = data.segmentation_stats?.nuclei_detected ?? roiList.length;
      const abnormal = data.segmentation_stats?.abnormal_instances ?? 0;
      const confidence = Math.round((data.confidence ?? 0) * 100);

      const findings = [
        `Whole-image classification: ${classMeta(predictedClass).label} (${confidence}% calibrated probability).`,
        `${detected} nucleus instance(s) detected, ${roiList.length} classified individually, ${abnormal} reported as abnormal.`,
        data.quality
          ? `Slide quality scored ${data.quality.score}/100${data.quality.causes?.length ? ` — ${data.quality.causes.join(', ').toLowerCase()}.` : '.'}`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      const lowQuality = data.quality && data.quality.label !== 'interpretable';
      const recommendation = data.review_required
        ? `Targeted review required — ${(data.review_reasons ?? ['triage flagged this field']).join('; ').toLowerCase()}.${
            lowQuality ? ' Consider re-acquiring the field: the image quality limits interpretation.' : ''
          }`
        : `No triage flag was raised on this field. Expert review is still recommended before establishing a final diagnosis.${
            lowQuality ? ' Note that image quality is sub-optimal.' : ''
          }`;

      const results: Analysis = {
        assessment: normalizeAssessment(predictedClass),
        predictedClass,
        confidence,
        findings,
        recommendation,
        uncertainty: data.uncertainty,
        entropy: data.entropy,
        margin: data.margin,
        priority: data.priority,
        reviewRequired: data.review_required,
        reviewReasons: data.review_reasons ?? [],
        probabilities: data.probabilities ?? undefined,
        uncertainties: data.uncertainties ?? undefined,
        classDistribution: data.class_distribution ?? undefined,
        quality: data.quality ?? undefined,
        segmentationStats: data.segmentation_stats ?? undefined,
        gradcamStats: data.gradcam_stats ?? undefined,
        regions_of_interest: roiList,
        gradcam: data.gradcam ?? undefined,
        segmentation: data.segmentation ?? undefined,
        imageInfo: data.image_info ?? undefined,
        model: data.model ?? undefined,
        processingTimeMs: data.processing_time_ms,
        analyzedAt: new Date().toISOString(),
      };

      setAnalysis(results);
      setCellReviews({});
      setSelectedRegionId(roiList[0]?.id ?? null);
      setReportStatus('draft');
      setObservations('');
      setSavedReportId(null);
      setSavedAt(null);
      setSaveMessage(null);
      setActiveTab('overview');
      setStatus('complete');
    } catch (err) {
      console.error(err);
      setAnalysisError(
        err instanceof Error && err.message !== 'Failed to fetch'
          ? err.message
          : t('analysis.unableToReachInference'),
      );
      setStatus('idle');
    }
  };

  const handleClear = () => {
    reset();
    setSaveMessage(null);
    setPatientErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReview = (id: number, review: CellReview) => {
    setCellReviews((current) => ({ ...current, [String(id)]: review }));
  };

  /** Creates the report, or pushes later edits onto the one already stored. */
  const handleSaveAnalysis = async () => {
    if (!analysis || !doctorProfile) return;

    const missing = missingPatientFields(patientInfo);
    setPatientErrors(missing);
    if (missing.length) {
      setSaveMessage({
        tone: 'error',
        text: 'Patient information is required before a report can be saved.',
      });
      return;
    }

    setSaveLoading(true);
    setSaveMessage(null);

    try {
      const token = getStoredDoctorToken();
      const reviewedCount = Object.values(cellReviews).filter((review) => review.decision !== 'pending').length;

      const res = savedReportId
        ? await fetch(`/api/analyses/${savedReportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
            body: JSON.stringify({ cellReviews, reviewerObservations: observations, reportStatus, notes: patientInfo.notes }),
          })
        : await fetch('/api/analyses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
            body: JSON.stringify({
              patientRecordId: patientInfo.patientRecordId,
              patientFirstName: patientInfo.patientFirstName,
              patientLastName: patientInfo.patientLastName,
              patientId: patientInfo.patientId,
              dateOfBirth: patientInfo.dateOfBirth,
              sampleId: patientInfo.sampleId,
              slideId: patientInfo.slideId,
              sampleType: patientInfo.sampleType,
              stainingMethod: patientInfo.stainingMethod,
              imageStudyId: patientInfo.imageStudyId,
              notes: patientInfo.notes,
              assessment: analysis.assessment,
              confidence: analysis.confidence,
              findings: analysis.findings,
              recommendation: analysis.recommendation,
              analysisData: analysis,
              cellReviews,
              reviewerObservations: observations,
              reportStatus,
              priority: analysis.priority ?? 'medium',
              qualityScore: analysis.quality?.score ?? null,
              cellsDetected: analysis.segmentationStats?.nuclei_detected ?? 0,
              cellsReviewed: reviewedCount,
            }),
          });

      const data = await res.json();
      if (!res.ok) throw new Error(translateError(data.error, t) || t('analysis.unableToSaveReport'));

      setSavedReportId(data.analysis.id);
      setSavedAt(data.analysis.updatedAt ?? data.analysis.createdAt);
      setReportStatus(data.analysis.reportStatus);
      setSaveMessage({ tone: 'success', text: savedReportId ? 'Saved report updated.' : 'Report saved successfully.' });
      onSaved?.();
    } catch (err) {
      console.error(err);
      setSaveMessage({ tone: 'error', text: err instanceof Error ? err.message : t('analysis.unableToSaveReport') });
    } finally {
      setSaveLoading(false);
    }
  };

  /** Status changes are a decision on a stored report, so they go through PATCH. */
  const handleStatusChange = async (nextStatus: typeof reportStatus) => {
    if (!savedReportId) {
      setSaveMessage({ tone: 'error', text: 'Save the report before changing its status.' });
      return;
    }

    const previousStatus = reportStatus;
    setReportStatus(nextStatus);
    setSaveLoading(true);
    setSaveMessage(null);

    try {
      const token = getStoredDoctorToken();
      const res = await fetch(`/api/analyses/${savedReportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify({ cellReviews, reviewerObservations: observations, reportStatus: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(translateError(data.error, t) || t('analysis.unableToUpdateReport'));

      setSavedAt(data.analysis.updatedAt);
      setSaveMessage({
        tone: 'success',
        text: nextStatus === 'validated' ? 'Report validated and locked.' : 'Report status updated.',
      });
      onSaved?.();
    } catch (err) {
      setReportStatus(previousStatus);
      setSaveMessage({ tone: 'error', text: err instanceof Error ? err.message : t('analysis.unableToUpdateReport') });
    } finally {
      setSaveLoading(false);
    }
  };

  const availableClasses = useMemo(() => {
    const fromModel = analysis?.model?.classes ?? Object.keys(analysis?.probabilities ?? {});
    return fromModel.length ? fromModel : ['NILM', 'LSIL', 'HSIL', 'SCC'];
  }, [analysis]);

  const probabilityRows = useMemo(() => {
    if (!analysis?.probabilities) return [];
    return sortClasses(Object.keys(analysis.probabilities)).map((name) => ({
      name,
      value: analysis.probabilities![name],
      uncertainty: analysis.uncertainties?.[name],
    }));
  }, [analysis]);

  const regions = analysis?.regions_of_interest ?? [];

  return (
    <>
    <div className="screen-only space-y-8">
      {loadingReport ? <p className="text-sm text-foreground/60">Loading saved report…</p> : null}
      {/* Upload area */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 hover:bg-secondary/50 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} className="mx-auto mb-4 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground mb-2">{t('analysis.uploadTitle')}</h3>
          <p className="text-foreground/60 mb-4">{t('analysis.uploadHint')}</p>
          <p className="text-xs text-foreground/50 mb-6">Supported formats: PNG, JPG, TIFF</p>
          <Button size="sm" variant="outline" className="border-foreground/20">
            {t('analysis.chooseFile')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Image preview */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="relative w-full bg-foreground/5">
                  <Image src={preview} alt={t('analysis.altUploadedImage')} width={600} height={600} className="w-full h-auto object-cover max-h-96" unoptimized />
                </div>

                {!analysis ? (
                  <div className="p-6 bg-white border-t border-border flex gap-3">
                    <Button onClick={handleAnalyze} disabled={status === 'analyzing'} size="lg" className="flex-1 bg-primary hover:bg-primary/90 text-white">
                      {status === 'analyzing' ? (
                        <>
                          <span className="inline-block mr-2 animate-pulse">⏳</span>
                          {loadingMessages[loadingMessageIndex]}
                          <span className="ml-2 inline-block animate-bounce">…</span>
                        </>
                      ) : (
                        t('analysis.startAnalysis')
                      )}
                    </Button>
                    <Button onClick={handleClear} variant="outline" size="lg" className="border-foreground/20">
                      <X size={20} />
                    </Button>
                  </div>
                ) : (
                  <div className="p-6 bg-white border-t border-border flex gap-3">
                    <Button onClick={handleClear} variant="outline" size="lg" className="flex-1 border-foreground/20">
                      {t('analysis.newAnalysis')}
                    </Button>
                  </div>
                )}
              </div>

              {analysisError ? (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{analysisError}</p>
              ) : null}
            </div>

            {/* Quick panel */}
            <div className="space-y-4">
              {!analysis ? (
                <div className="bg-secondary rounded-lg p-6 border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3">{t('analysis.imageDetails')}</h3>
                  <div className="space-y-2 text-xs text-foreground/60">
                    <p>{t('analysis.fileLabel', { name: file?.name ?? '' })}</p>
                    <p>{t('analysis.sizeLabel', { size: (file?.size ? file.size / 1024 / 1024 : 0).toFixed(2) })}</p>
                    <p>{t('analysis.readyForAnalysis')}</p>
                  </div>
                </div>
              ) : (
                <AnalysisResults analysis={analysis} />
              )}
            </div>
          </div>

          {/* Full results */}
          {analysis && (
            <div className="bg-white rounded-lg border border-border">
              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-border p-2 print:hidden">
                {TAB_IDS.map((tabId) => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tabId ? 'bg-primary text-white' : 'text-foreground/70 hover:bg-secondary'
                    }`}
                  >
                    {TAB_LABELS[tabId]}
                    {tabId === 'review' && regions.length ? (
                      <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${activeTab === tabId ? 'bg-white/20' : 'bg-foreground/10'}`}>
                        {regions.length}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="p-6 md:p-8">
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    <div className="border-b border-border pb-8">
                      <h2 className="text-2xl font-semibold text-foreground mb-6">Screening assessment results</h2>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-5">
                          <div>
                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">Cytological classification</p>
                            <div className="flex flex-wrap items-center gap-3">
                              <StatusBadge status={analysis.assessment} />
                              <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[classMeta(analysis.predictedClass).tone]}`}>
                                Model class: {classMeta(analysis.predictedClass).label}
                              </span>
                              <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[priorityTone(analysis.priority)]}`}>
                                {priorityLabel(analysis.priority)} priority
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-foreground/60">{classMeta(analysis.predictedClass).fullLabel}</p>
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Clinical confidence</p>
                            <div className="flex items-center gap-4">
                              <div className="text-3xl font-bold text-primary tabular-nums">{analysis.confidence}%</div>
                              <div className="flex-1">
                                <MeterBar value={analysis.confidence / 100} />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-foreground/60">Uncertainty</p>
                                <p className="font-semibold tabular-nums">± {formatNumber((analysis.uncertainty ?? 0) * 100, 1)} pts</p>
                              </div>
                              <div>
                                <p className="text-xs text-foreground/60">Entropy</p>
                                <p className="font-semibold tabular-nums">{formatNumber(analysis.entropy, 2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-foreground/60">Margin</p>
                                <p className="font-semibold tabular-nums">{formatNumber(analysis.margin, 2)}</p>
                              </div>
                            </div>
                          </div>

                          {analysis.reviewReasons?.length ? (
                            <div className="rounded-lg border border-border bg-secondary/30 p-4">
                              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Why this was flagged</p>
                              <ul className="space-y-1 text-sm text-foreground/75">
                                {analysis.reviewReasons.map((reason) => (
                                  <li key={reason}>• {reason}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Class probabilities (calibrated)</p>
                          <div className="space-y-3">
                            {probabilityRows.map((row) => (
                              <div key={row.name} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: classColor(row.name) }} />
                                    <span className="text-foreground/80" title={classMeta(row.name).fullLabel}>
                                      {classMeta(row.name).label}
                                    </span>
                                  </span>
                                  <span className="font-semibold text-foreground tabular-nums">
                                    {toPercent(row.value, 1)}
                                    {typeof row.uncertainty === 'number' ? (
                                      <span className="ml-1 text-xs font-normal text-foreground/50">± {formatNumber(row.uncertainty * 100, 1)}</span>
                                    ) : null}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, row.value * 100)}%`, backgroundColor: classColor(row.name) }} />
                                </div>
                              </div>
                            ))}
                          </div>

                          {analysis.classDistribution && regions.length ? (
                            <div className="pt-4 border-t border-border">
                              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">Per-cell class distribution</p>
                              <DonutChart
                                segments={Object.entries(analysis.classDistribution)
                                  .filter(([, value]) => value > 0)
                                  .map(([name, value]) => ({ label: classMeta(name).label, value, color: classColor(name) }))}
                                centerValue={regions.length}
                                centerLabel="cells analysed"
                                size={150}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-b border-border pb-8">
                      <h3 className="text-lg font-semibold text-foreground">Findings summary</h3>
                      <p className="text-base text-foreground/70 leading-relaxed">{analysis.findings}</p>
                    </div>

                    {/* Visualizations */}
                    {analysis.gradcam ? (
                      <div className="space-y-4 border-b border-border pb-8">
                        <h3 className="text-lg font-semibold text-foreground">Model attention</h3>
                        <p className="text-sm text-foreground/60">
                          Grad-CAM shows which parts of the field drove the predicted class
                          {analysis.gradcamStats?.high_activation_pct !== undefined
                            ? ` — ${analysis.gradcamStats.high_activation_pct}% of the field carries high activation.`
                            : '.'}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <figure className="rounded-lg border border-border p-4 bg-secondary/30">
                            <img src={`data:image/png;base64,${analysis.gradcam.heatmap}`} alt="Grad-CAM heatmap" className="w-full h-64 object-contain rounded-md bg-white" />
                            <figcaption className="mt-2 text-sm text-foreground/70">Activation heatmap</figcaption>
                          </figure>
                          <figure className="rounded-lg border border-border p-4 bg-secondary/30">
                            <img src={`data:image/png;base64,${analysis.gradcam.overlay}`} alt="Grad-CAM overlay" className="w-full h-64 object-contain rounded-md bg-white" />
                            <figcaption className="mt-2 text-sm text-foreground/70">Overlay on the original field</figcaption>
                          </figure>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Clinical recommendation</h3>
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-6">
                        <p className="text-base text-foreground leading-relaxed">{analysis.recommendation}</p>
                      </div>
                    </div>

                    {analysis.model ? (
                      <div className="rounded-lg border border-border bg-secondary/30 p-4 text-xs text-foreground/60 flex flex-wrap gap-x-6 gap-y-1">
                        <span>Backbone: {analysis.model.backbone}</span>
                        <span>Input: {analysis.model.input_size}px</span>
                        <span>Uncertainty: {analysis.model.uncertainty_method}</span>
                        <span>Explainability: {analysis.model.explainability}</span>
                        <span>Segmentation: {analysis.model.segmentation_source}</span>
                        {analysis.processingTimeMs ? <span>Processed in {(analysis.processingTimeMs / 1000).toFixed(1)}s</span> : null}
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === 'quality' &&
                  (analysis.quality ? (
                    <QualityControlPanel quality={analysis.quality} segmentationStats={analysis.segmentationStats} imageInfo={analysis.imageInfo} />
                  ) : (
                    <p className="text-sm text-foreground/60">{t('analysis.noQualityMetrics')}</p>
                  ))}

                {activeTab === 'segmentation' && (
                  <SegmentationViewer
                    previewSrc={preview}
                    segmentation={analysis.segmentation}
                    stats={analysis.segmentationStats}
                    regions={regions}
                    selectedId={selectedRegionId}
                    onSelect={setSelectedRegionId}
                  />
                )}

                {activeTab === 'review' && (
                  <CellReviewTable
                    regions={regions}
                    reviews={cellReviews}
                    availableClasses={availableClasses}
                    onReview={handleReview}
                    onSelect={(id) => setSelectedRegionId(id)}
                    selectedId={selectedRegionId}
                  />
                )}

                {activeTab === 'report' && (
                  <div className="space-y-8">
                    {/* Patient identity — mandatory before the report can be stored */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{t('analysis.patientSampleDetails')}</h3>
                        <p className="text-sm text-foreground/60">{t('analysis.attachPatientHint')}</p>
                      </div>

                      {!doctorProfile ? (
                        <p className="text-sm text-foreground/60">{t('analysis.signInToAttach')}</p>
                      ) : (
                        <div className="space-y-4">
                          <PatientPicker value={patientInfo} onChange={(next) => {
                            setPatientInfo(next);
                            setPatientErrors([]);
                          }} />
                          {patientErrors.length ? (
                            <p className="text-xs text-destructive">{t('analysis.missingFields', { fields: patientErrors.join(', ') })}</p>
                          ) : null}

                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.sampleId')}</span>
                              <input
                                type="text"
                                className={SAMPLE_FIELD}
                                value={patientInfo.sampleId}
                                onChange={(e) => setPatientInfo({ ...patientInfo, sampleId: e.target.value })}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.slideId')}</span>
                              <input
                                type="text"
                                className={SAMPLE_FIELD}
                                value={patientInfo.slideId}
                                onChange={(e) => setPatientInfo({ ...patientInfo, slideId: e.target.value })}
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.sampleType')}</span>
                              <select
                                className={SAMPLE_FIELD}
                                value={patientInfo.sampleType}
                                onChange={(e) => setPatientInfo({ ...patientInfo, sampleType: e.target.value as PatientInfo['sampleType'] })}
                              >
                                <option value="">{t('common.notSpecified')}</option>
                                {sampleTypeOptions(language).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.stainingMethod')}</span>
                              <select
                                className={SAMPLE_FIELD}
                                value={patientInfo.stainingMethod}
                                onChange={(e) => setPatientInfo({ ...patientInfo, stainingMethod: e.target.value as PatientInfo['stainingMethod'] })}
                              >
                                <option value="">{t('common.notSpecified')}</option>
                                {stainingMethodOptions(language).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.anatomicalSite')}</span>
                              <input type="text" className={`${SAMPLE_FIELD} bg-secondary text-foreground/60`} value={t('common.cervix')} disabled />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.imageStudyId')}</span>
                              <input
                                type="text"
                                className={SAMPLE_FIELD}
                                value={patientInfo.imageStudyId}
                                onChange={(e) => setPatientInfo({ ...patientInfo, imageStudyId: e.target.value })}
                              />
                            </label>

                            <label className="md:col-span-2 flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground/70">{t('report.clinicalNotes')}</span>
                              <textarea
                                className="min-h-20 rounded-lg border border-border px-3 py-2 text-sm"
                                placeholder={t('analysis.contextPlaceholder')}
                                value={patientInfo.notes}
                                onChange={(e) => setPatientInfo({ ...patientInfo, notes: e.target.value })}
                              />
                            </label>

                            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                              <Button onClick={handleSaveAnalysis} disabled={saveLoading}>
                                {saveLoading ? t('analysis.saving') : savedReportId ? t('analysis.updateSavedReport') : t('analysis.saveReport')}
                              </Button>
                              {savedReportId ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-status-success/30 bg-status-success/10 px-2 py-1 text-xs font-medium text-status-success">
                                  <Check size={13} /> {t('analysis.storedInReports')}
                                </span>
                              ) : null}
                              {saveMessage ? (
                                <span className={`text-sm ${saveMessage.tone === 'error' ? 'text-destructive' : 'text-status-success'}`}>
                                  {saveMessage.text}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <ReportPreview
                      analysis={analysis}
                      patient={patientInfo}
                      reviews={cellReviews}
                      observations={observations}
                      onObservationsChange={setObservations}
                      status={reportStatus}
                      onStatusChange={handleStatusChange}
                      canValidate={Boolean(savedReportId)}
                      savedAt={savedAt}
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-border bg-secondary p-6 text-center print:hidden">
                <p className="text-xs text-foreground/60">
                  <strong className="text-foreground">{t('analysis.disclaimerLabel')}</strong> {t('analysis.disclaimerText')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Print-only clinical document — this is what "Export as PDF" produces. */}
    {analysis ? (
      <ReportDocument
        analysis={analysis}
        patient={patientInfo}
        reviews={cellReviews}
        observations={observations}
        status={reportStatus}
        doctor={doctorProfile}
        savedAt={savedAt}
      />
    ) : null}
    </>
  );
}
