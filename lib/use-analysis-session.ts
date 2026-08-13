'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Analysis, CellReviewMap, ReportStatus } from '@/lib/analysis-types';
import { EMPTY_PATIENT, PatientInfo } from '@/lib/report-utils';

const SESSION_EVENT = 'cervitrust:analysis-session';

export type AnalysisStatus = 'idle' | 'analyzing' | 'complete';
export type TabId = 'overview' | 'quality' | 'segmentation' | 'review' | 'report';

export interface AnalysisSessionState {
  file: File | null;
  preview: string | null;
  status: AnalysisStatus;
  analysis: Analysis | null;
  analysisError: string;
  patientInfo: PatientInfo;
  cellReviews: CellReviewMap;
  observations: string;
  reportStatus: ReportStatus;
  selectedRegionId: number | null;
  savedReportId: string | null;
  savedAt: string | null;
  activeTab: TabId;
}

const EMPTY_SESSION: AnalysisSessionState = {
  file: null,
  preview: null,
  status: 'idle',
  analysis: null,
  analysisError: '',
  patientInfo: EMPTY_PATIENT,
  cellReviews: {},
  observations: '',
  reportStatus: 'draft',
  selectedRegionId: null,
  savedReportId: null,
  savedAt: null,
  activeTab: 'overview',
};

/**
 * Module-scope singleton: a client-side route change only remounts the
 * component, it doesn't reload the JS runtime, so this survives navigating
 * away from /analysis (to the patient roster, dashboard…) and back. Only a
 * hard reload or an explicit reset() clears it — which is exactly what lets
 * an in-progress, unsaved analysis "not go away" when switching pages.
 */
let session: AnalysisSessionState = { ...EMPTY_SESSION };

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EVENT));
}

export function useAnalysisSession() {
  const [state, setState] = useState<AnalysisSessionState>(session);

  useEffect(() => {
    const onChange = () => setState(session);
    window.addEventListener(SESSION_EVENT, onChange);
    return () => window.removeEventListener(SESSION_EVENT, onChange);
  }, []);

  const update = useCallback((patch: Partial<AnalysisSessionState>) => {
    session = { ...session, ...patch };
    notify();
  }, []);

  /** Returns a useState-like setter (value or updater function) for one field. */
  const set = useCallback(
    <K extends keyof AnalysisSessionState>(key: K) =>
      (value: AnalysisSessionState[K] | ((prev: AnalysisSessionState[K]) => AnalysisSessionState[K])) => {
        const nextValue = typeof value === 'function' ? (value as (prev: AnalysisSessionState[K]) => AnalysisSessionState[K])(session[key]) : value;
        session = { ...session, [key]: nextValue };
        notify();
      },
    [],
  );

  const reset = useCallback(() => {
    session = { ...EMPTY_SESSION };
    notify();
  }, []);

  return { ...state, set, update, reset };
}
