'use client';

import { useMemo, useState } from 'react';
import { Check, Flag, Pencil, X } from 'lucide-react';
import { classColor } from '@/components/charts';
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
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [correcting, setCorrecting] = useState<number | null>(null);
  const [correctionClass, setCorrectionClass] = useState<string>('');
  const [correctionNote, setCorrectionNote] = useState('');

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
        <h3 className="text-lg font-semibold text-foreground mb-1">Targeted review</h3>
        <p className="text-sm text-foreground/70">
          No individual cell was isolated on this field, so there is nothing to confirm one by one. The whole-image
          classification above remains available for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Classification and targeted review</h3>
          <p className="text-sm text-foreground/60">
            Every detected cell is listed with its calibrated probability. Confirm, correct or flag each one — your
            decisions are stored with the report.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground/70 tabular-nums">
            {summary.reviewed} / {regions.length} reviewed
          </span>
          <button
            type="button"
            onClick={confirmAllPending}
            disabled={summary.pending === 0}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary disabled:opacity-40"
          >
            Confirm all shown
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Predicted class</span>
          <select className={SELECT_CLASS} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">All classes</option>
            {sortClasses(availableClasses).map((name) => (
              <option key={name} value={name.toUpperCase()}>
                {classMeta(name).label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Confidence</span>
          <select className={SELECT_CLASS} value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}>
            <option value="all">All levels</option>
            <option value="high">High (≥ 85%)</option>
            <option value="medium">Medium (60–85%)</option>
            <option value="low">Low (&lt; 60%)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Priority</span>
          <select className={SELECT_CLASS} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Review status</span>
          <select className={SELECT_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="pending">To review</option>
            <option value="confirmed">Confirmed</option>
            <option value="corrected">Corrected</option>
            <option value="flagged">Flagged</option>
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
          Reset filters
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cells detected', value: regions.length },
          { label: 'Abnormal (≥ LSIL)', value: summary.abnormal },
          { label: 'High priority', value: summary.highPriority },
          { label: 'Still to review', value: summary.pending },
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
              <th className="px-4 py-3 font-semibold text-foreground/70">Preview</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">Predicted class</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">Calibrated probability</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">Priority</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">Review status</th>
              <th className="px-4 py-3 font-semibold text-foreground/70">Decision</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((roi) => {
              const review = reviews[String(roi.id)];
              const decision = review?.decision ?? 'pending';
              const finalClass = effectiveClass(roi, review);
              const meta = classMeta(roi.predicted_class);
              const isCorrecting = correcting === roi.id;

              return (
                <tr
                  key={roi.id}
                  className={`border-b border-border last:border-0 align-middle ${selectedId === roi.id ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground tabular-nums">{roi.id}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onSelect?.(roi.id)} title="Show this instance in the viewer">
                      <img src={`data:image/png;base64,${roi.image}`} alt={`Cell ${roi.id}`} className="h-12 w-12 rounded-md border border-border object-cover" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${TONE_BADGE[meta.tone]}`} title={meta.fullLabel}>
                      {meta.label}
                    </span>
                    {finalClass.toUpperCase() !== roi.predicted_class.toUpperCase() ? (
                      <span className="ml-2 text-xs text-foreground/60">→ {classMeta(finalClass).label}</span>
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
                      title={roi.review_reasons?.join(' · ') || 'No triage reason recorded'}
                    >
                      {priorityLabel(roi.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[reviewTone(decision)]}`}>
                      {reviewLabel(decision)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isCorrecting ? (
                      <div className="space-y-2 min-w-[220px]">
                        <select className={`${SELECT_CLASS} w-full`} value={correctionClass} onChange={(e) => setCorrectionClass(e.target.value)}>
                          {sortClasses(availableClasses).map((name) => (
                            <option key={name} value={name}>
                              {classMeta(name).label} — {classMeta(name).fullLabel}
                            </option>
                          ))}
                        </select>
                        <input
                          className="w-full rounded-lg border border-border px-3 py-1.5 text-sm"
                          placeholder="Reason (optional)"
                          value={correctionNote}
                          onChange={(e) => setCorrectionNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white"
                            onClick={() => applyDecision(roi.id, 'corrected', correctionClass, correctionNote)}
                          >
                            Save correction
                          </button>
                          <button type="button" className="rounded-md border border-border px-3 py-1.5 text-xs" onClick={() => setCorrecting(null)}>
                            Cancel
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
                          <Check size={13} /> Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => startCorrection(roi)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            decision === 'corrected' ? 'bg-status-warning/15 text-status-warning border border-status-warning/30' : 'border border-border text-foreground/80 hover:bg-secondary'
                          }`}
                        >
                          <Pencil size={13} /> Correct
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDecision(roi.id, decision === 'flagged' ? 'pending' : 'flagged')}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            decision === 'flagged' ? 'bg-status-critical/15 text-status-critical border border-status-critical/30' : 'border border-border text-foreground/80 hover:bg-secondary'
                          }`}
                        >
                          <Flag size={13} /> Flag
                        </button>
                        {decision !== 'pending' ? (
                          <button
                            type="button"
                            onClick={() => applyDecision(roi.id, 'pending')}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-foreground/50 hover:text-foreground"
                            title="Clear this decision"
                          >
                            <X size={13} />
                          </button>
                        ) : null}
                      </div>
                    )}
                    {review?.note ? <p className="mt-1 text-xs text-foreground/60">Note: {review.note}</p> : null}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-foreground/60">
                  No cell matches the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {priorityCases.length > 0 ? (
        <div className="rounded-lg border border-border bg-white p-6">
          <h4 className="font-semibold text-foreground mb-1">Priority cases ({priorityCases.length})</h4>
          <p className="text-sm text-foreground/60 mb-4">Cells the triage rules put at the top of the review queue.</p>
          <ul className="space-y-2">
            {priorityCases.map((roi) => (
              <li key={roi.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="flex items-center gap-3">
                  <span className="font-medium text-foreground tabular-nums">#{roi.id}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(roi.predicted_class).tone]}`}>
                    {classMeta(roi.predicted_class).label}
                  </span>
                  <span className="text-sm text-foreground/70 tabular-nums">{toPercent(roi.confidence, 2)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-foreground/60">{roi.review_reasons?.[0] ?? 'Flagged by triage'}</span>
                  <button type="button" className="rounded-md border border-border px-3 py-1 text-xs text-foreground/80 hover:bg-secondary" onClick={() => onSelect?.(roi.id)}>
                    View
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
