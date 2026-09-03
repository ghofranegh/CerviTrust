'use client';

import { useMemo, useState } from 'react';
import { Check, Flag, Pencil, X } from 'lucide-react';
import { classColor } from '@/components/charts';
import { CellZoomModal } from '@/components/cell-zoom-modal';
import { useTranslation } from '@/lib/i18n';
import {
  CellReview,
  CellReviewMap,
  Priority,
  RegionOfInterest,
  ReviewDecision,
  TONE_BADGE,
  classMeta,
  effectiveClass,
  formatNumber,
  priorityLabel,
  priorityTone,
  reviewLabel,
  reviewTone,
  sortClasses,
  toPercent,
} from '@/lib/analysis-types';

type ClassFilter = 'all' | string;
type PriorityFilter = 'all' | Priority;
type StatusFilter = 'all' | ReviewDecision;
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

const SELECT_CLASS = 'rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground';

export function CellReviewTable({
  regions,
  reviews,
  availableClasses,
  onReview,
  onSelect,
  selectedId,
}: {
  regions: RegionOfInterest[];
  reviews: CellReviewMap;
  availableClasses: string[];
  onReview: (id: number, review: CellReview) => void;
  onSelect?: (id: number) => void;
  selectedId?: number | null;
}) {
  const { t, language } = useTranslation();
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [correcting, setCorrecting] = useState<number | null>(null);
  const [correctionClass, setCorrectionClass] = useState<string>('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [zoomId, setZoomId] = useState<number | null>(null);

  const decisionOf = (id: number): ReviewDecision => reviews[String(id)]?.decision ?? 'pending';

  const filtered = useMemo(() => {
    return regions.filter((roi) => {
      if (classFilter !== 'all' && roi.predicted_class.toUpperCase() !== classFilter) return false;
      if (priorityFilter !== 'all' && (roi.priority ?? 'medium') !== priorityFilter) return false;
      if (statusFilter !== 'all' && decisionOf(roi.id) !== statusFilter) return false;
      if (confidenceFilter === 'high' && roi.confidence < 0.85) return false;
      if (confidenceFilter === 'medium' && (roi.confidence < 0.6 || roi.confidence >= 0.85)) return false;
      if (confidenceFilter === 'low' && roi.confidence >= 0.6) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, reviews, classFilter, priorityFilter, statusFilter, confidenceFilter]);

  const summary = useMemo(() => {
    const abnormal = regions.filter((roi) => {
      const meta = classMeta(effectiveClass(roi, reviews[String(roi.id)]));
      return meta.severity >= 2;
    }).length;
    const highPriority = regions.filter((roi) => roi.priority === 'high').length;
    const reviewed = regions.filter((roi) => decisionOf(roi.id) !== 'pending').length;
    return { abnormal, highPriority, reviewed, pending: regions.length - reviewed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions, reviews]);

  const priorityCases = useMemo(
    () =>
      [...regions]
        .filter((roi) => roi.priority === 'high' || classMeta(roi.predicted_class).severity >= 3)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5),
    [regions],
  );

  const applyDecision = (id: number, decision: ReviewDecision, correctedClass?: string, note?: string) => {
    onReview(id, { decision, correctedClass, note, reviewedAt: new Date().toISOString() });
    setCorrecting(null);
    setCorrectionNote('');
  };

  const startCorrection = (roi: RegionOfInterest) => {
    setCorrecting(roi.id);
    setCorrectionClass(reviews[String(roi.id)]?.correctedClass ?? roi.predicted_class);
    setCorrectionNote(reviews[String(roi.id)]?.note ?? '');
  };

  const confirmAllPending = () => {
    const stamp = new Date().toISOString();
    filtered
      .filter((roi) => decisionOf(roi.id) === 'pending')
      .forEach((roi) => onReview(roi.id, { decision: 'confirmed', reviewedAt: stamp }));
  };

  if (!regions.length) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-1">{t('review.title')}</h3>
        <p className="text-sm text-foreground/70">{t('review.noCellsText')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('review.classifyTitle')}</h3>
          <p className="text-sm text-foreground/60">{t('review.classifySubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground/70 tabular-nums">
            {t('review.reviewedCount', { reviewed: summary.reviewed, total: regions.length })}
          </span>
          <button
            type="button"
            onClick={confirmAllPending}
            disabled={summary.pending === 0}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary disabled:opacity-40"
          >
            {t('review.confirmAllShown')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('review.predictedClass')}</span>
          <select className={SELECT_CLASS} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">{t('review.allClasses')}</option>
            {sortClasses(availableClasses).map((name) => (
              <option key={name} value={name.toUpperCase()}>
                {classMeta(name, language).label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('review.confidence')}</span>
          <select className={SELECT_CLASS} value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}>
            <option value="all">{t('review.allLevels')}</option>
            <option value="high">{t('review.highThreshold')}</option>
            <option value="medium">{t('review.mediumThreshold')}</option>
            <option value="low">{t('review.lowThreshold')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('review.priority')}</span>
          <select className={SELECT_CLASS} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}>
            <option value="all">{t('review.allPriorities')}</option>
            <option value="high">{priorityLabel('high', language)}</option>
            <option value="medium">{priorityLabel('medium', language)}</option>
            <option value="low">{priorityLabel('low', language)}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">{t('review.reviewStatus')}</span>
          <select className={SELECT_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">{t('review.allStatuses')}</option>
            <option value="pending">{t('review.toReview')}</option>
            <option value="confirmed">{t('review.confirmedOpt')}</option>
            <option value="corrected">{t('review.correctedOpt')}</option>
            <option value="flagged">{t('review.flaggedOpt')}</option>
          </select>
        </label>

        <button
          type="button"
          className="self-end rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground/70 hover:bg-secondary"
          onClick={() => {
            setClassFilter('all');
            setPriorityFilter('all');
            setStatusFilter('all');
            setConfidenceFilter('all');
          }}
        >
          {t('review.resetFilters')}
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('review.cellsDetected'), value: regions.length },
          { label: t('review.abnormalLsil'), value: summary.abnormal },
          { label: t('review.highPriority'), value: summary.highPriority },
          { label: t('review.stillToReview'), value: summary.pending },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-xs text-foreground/60">{item.label}</p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Detected cells with predicted class, calibrated probability and review status</caption>
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left">
              <th className="px-4 py-3 font-semibold text-foreground/70">#</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">{t('review.preview')}</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">{t('review.predictedClass')}</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">{t('review.calibratedProbability')}</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">{t('review.priority')}</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">{t('review.reviewStatus')}</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">{t('review.decision')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((roi) => {
              const review = reviews[String(roi.id)];
              const decision = review?.decision ?? 'pending';
              const finalClass = effectiveClass(roi, review);
              const meta = classMeta(roi.predicted_class, language);
              const isCorrecting = correcting === roi.id;

              return (
                <tr
                  key={roi.id}
                  className={`border-b border-border last:border-0 align-middle ${selectedId === roi.id ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground tabular-nums">{roi.id}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setZoomId(roi.id)} title={t('common.zoomInCell')}>
                      <img src={`data:image/png;base64,${roi.image}`} alt={`Cell ${roi.id}`} className="h-12 w-12 rounded-md border border-border object-cover" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${TONE_BADGE[meta.tone]}`} title={meta.fullLabel}>
                      {meta.label}
                    </span>
                    {finalClass.toUpperCase() !== roi.predicted_class.toUpperCase() ? (
                      <span className="ml-2 text-xs text-foreground/60">→ {classMeta(finalClass, language).label}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground tabular-nums w-12">{toPercent(roi.confidence, 0)}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.max(3, roi.confidence * 100)}%`, backgroundColor: classColor(roi.predicted_class) }}
                        />
                      </span>
                    </div>
                    {typeof roi.uncertainty === 'number' ? (
                      <span className="text-xs text-foreground/50">± {formatNumber(roi.uncertainty * 100, 1)} pts</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[priorityTone(roi.priority)]}`}
                      title={roi.review_reasons?.join(' · ') || t('review.noTriageReason')}
                    >
                      {priorityLabel(roi.priority, language)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[reviewTone(decision)]}`}>
                      {reviewLabel(decision, language)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isCorrecting ? (
                      <div className="space-y-2 min-w-[220px]">
                        <select className={`${SELECT_CLASS} w-full`} value={correctionClass} onChange={(e) => setCorrectionClass(e.target.value)}>
                          {sortClasses(availableClasses).map((name) => (
                            <option key={name} value={name}>
                              {classMeta(name, language).label} — {classMeta(name, language).fullLabel}
                            </option>
                          ))}
                        </select>
                        <input
                          className="w-full rounded-lg border border-border px-3 py-1.5 text-sm"
                          placeholder={t('review.reasonOptional')}
                          value={correctionNote}
                          onChange={(e) => setCorrectionNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white"
                            onClick={() => applyDecision(roi.id, 'corrected', correctionClass, correctionNote)}
                          >
                            {t('review.saveCorrection')}
                          </button>
                          <button type="button" className="rounded-md border border-border px-3 py-1.5 text-xs" onClick={() => setCorrecting(null)}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyDecision(roi.id, 'confirmed')}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            decision === 'confirmed' ? 'bg-primary text-white' : 'border border-border text-foreground/80 hover:bg-secondary'
                          }`}
                        >
                          <Check size={13} /> {t('review.confirm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => startCorrection(roi)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            decision === 'corrected' ? 'bg-status-warning/15 text-status-warning border border-status-warning/30' : 'border border-border text-foreground/80 hover:bg-secondary'
                          }`}
                        >
                          <Pencil size={13} /> {t('review.correct')}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDecision(roi.id, decision === 'flagged' ? 'pending' : 'flagged')}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            decision === 'flagged' ? 'bg-status-critical/15 text-status-critical border border-status-critical/30' : 'border border-border text-foreground/80 hover:bg-secondary'
                          }`}
                        >
                          <Flag size={13} /> {t('review.flag')}
                        </button>
                        {decision !== 'pending' ? (
                          <button
                            type="button"
                            onClick={() => applyDecision(roi.id, 'pending')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-foreground/50 hover:text-foreground"
                            title={t('review.clearDecision')}
                          >
                            <X size={13} />
                          </button>
                        ) : null}
                      </div>
                    )}
                    {review?.note ? <p className="mt-1 text-xs text-foreground/60">{t('review.note')}: {review.note}</p> : null}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-foreground/60">
                  {t('review.noMatch')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {priorityCases.length > 0 ? (
        <div className="rounded-lg border border-border bg-white p-6">
          <h4 className="font-semibold text-foreground mb-1">{t('review.priorityCases')} ({priorityCases.length})</h4>
          <p className="text-sm text-foreground/60 mb-4">{t('review.priorityCasesSubtitle')}</p>
          <ul className="space-y-2">
            {priorityCases.map((roi) => (
              <li key={roi.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="flex items-center gap-3">
                  <span className="font-medium text-foreground tabular-nums">#{roi.id}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(roi.predicted_class, language).tone]}`}>
                    {classMeta(roi.predicted_class, language).label}
                  </span>
                  <span className="text-sm text-foreground/70 tabular-nums">{toPercent(roi.confidence, 2)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-foreground/60">{roi.review_reasons?.[0] ?? t('review.flaggedByTriage')}</span>
                  <button type="button" className="rounded-md border border-border px-3 py-1 text-xs text-foreground/80 hover:bg-secondary" onClick={() => onSelect?.(roi.id)}>
                    {t('review.view')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {zoomId !== null ? (
        (() => {
          const roi = regions.find((entry) => entry.id === zoomId);
          return roi ? <CellZoomModal roi={roi} onClose={() => setZoomId(null)} /> : null;
        })()
      ) : null}
    </div>
  );
}
