/**
 * Shared shapes for everything the inference backend returns, plus the small
 * helpers used to render it (class metadata, triage tones, formatting).
 * Keep this file in sync with `utils/api.py::predict`.
 *
 * Every label helper below takes an optional trailing `lang` ('en' | 'fr',
 * defaults to 'en') so the same clinical vocabulary renders correctly under
 * the EN|FR toggle (see lib/i18n.ts) without every caller needing its own
 * translation table.
 */
import type { Language } from '@/lib/use-language';

export type ScreeningResult = 'nilm' | 'lsil' | 'hsil';
export type Priority = 'high' | 'medium' | 'low';
export type QualityLabel = 'interpretable' | 'uncertain' | 'not_interpretable';
export type Severity = 'none' | 'mild' | 'moderate';
export type Tone = 'success' | 'warning' | 'critical' | 'neutral';

/** Doctor decision recorded for one detected cell. */
export type ReviewDecision = 'pending' | 'confirmed' | 'corrected' | 'flagged';

export interface CellReview {
  decision: ReviewDecision;
  correctedClass?: string;
  note?: string;
  reviewedAt?: string;
}

export type CellReviewMap = Record<string, CellReview>;

export type ReportStatus = 'draft' | 'in_review' | 'validated';

export interface Morphometrics {
  nucleus_area_px: number;
  cytoplasm_area_px: number;
  nc_ratio: number | null;
  perimeter_px: number;
  circularity: number;
  solidity: number;
  elongation: number;
  equivalent_diameter_px: number;
  mean_nucleus_intensity: number;
  chromatin_std: number;
  mean_cytoplasm_intensity: number;
  bbox: [number, number, number, number];
}

export interface Anomaly {
  label: string;
  severity: Severity;
  value: number;
}

export interface RegionOfInterest {
  id: number;
  predicted_class: string;
  confidence: number;
  uncertainty?: number;
  probabilities?: Record<string, number>;
  entropy?: number;
  margin?: number;
  priority?: Priority;
  review_required?: boolean;
  review_reasons?: string[];
  centroid?: [number, number];
  position_pct?: [number, number];
  segmentation_confidence?: number | null;
  morphometrics?: Morphometrics;
  anomalies?: Anomaly[];
  image: string;
}

export interface QualityReport {
  score: number;
  label: QualityLabel;
  causes: string[];
  subscores: {
    sharpness: number;
    contrast: number;
    exposure: number;
    staining: number;
    cellularity: number;
  };
  metrics: Record<string, number>;
}

export interface SegmentationStats {
  source: string;
  nuclei_detected: number;
  nuclei_analyzed: number;
  mean_nucleus_area_px: number;
  median_nucleus_area_px: number;
  nucleus_coverage_pct: number;
  cytoplasm_coverage_pct: number;
  mean_circularity: number;
  mean_nc_ratio: number | null;
  mean_instance_confidence: number;
  mean_instance_entropy: number;
  abnormal_instances: number;
  high_priority_instances: number;
}

export interface GradcamData {
  heatmap: string;
  overlay: string;
  attention_overlay?: string;
}

export interface GradcamStats {
  high_activation_pct?: number;
  mean_activation?: number;
  peak_activation?: number;
  focus_score?: number;
  peak_position_pct?: [number, number];
}

export interface SegmentationData {
  overlay: string;
  background: string;
  cytoplasm: string;
  nucleus: string;
}

export interface ModelInfo {
  classes?: string[];
  backbone?: string;
  input_size?: number;
  uncertainty_method?: string;
  explainability?: string;
  segmentation_source?: string;
}

/** Full analysis object held in the UI and persisted with a saved report. */
export interface Analysis {
  assessment: ScreeningResult;
  predictedClass: string;
  confidence: number;
  findings: string;
  recommendation: string;
  uncertainty?: number;
  entropy?: number;
  margin?: number;
  priority?: Priority;
  reviewRequired?: boolean;
  reviewReasons?: string[];
  probabilities?: Record<string, number>;
  uncertainties?: Record<string, number>;
  classDistribution?: Record<string, number>;
  quality?: QualityReport;
  segmentationStats?: SegmentationStats;
  gradcamStats?: GradcamStats;
  regions_of_interest?: RegionOfInterest[];
  gradcam?: GradcamData;
  segmentation?: SegmentationData;
  imageInfo?: { width: number; height: number; megapixels: number };
  model?: ModelInfo;
  processingTimeMs?: number;
  analyzedAt?: string;
}

export type ProfessionalTitle = 'pathologist' | 'cytopathologist' | 'gynecologist' | 'laboratory_physician';
export type Specialty = 'anatomical_pathology' | 'cytopathology' | 'gynecology' | 'oncology' | 'laboratory_medicine';
export type SampleType = 'cervical_cytology' | 'pap_smear' | 'biopsy' | 'histology' | 'hpv_sample';
export type StainingMethod = 'papanicolaou' | 'h_e' | 'other';

export const PROFESSIONAL_TITLE_LABELS: Record<ProfessionalTitle, string> = {
  pathologist: 'Pathologist',
  cytopathologist: 'Cytopathologist',
  gynecologist: 'Gynecologist',
  laboratory_physician: 'Laboratory Physician',
};

const PROFESSIONAL_TITLE_LABELS_FR: Record<ProfessionalTitle, string> = {
  pathologist: 'Pathologiste',
  cytopathologist: 'Cytopathologiste',
  gynecologist: 'Gynécologue',
  laboratory_physician: 'Médecin de laboratoire',
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  anatomical_pathology: 'Anatomical Pathology',
  cytopathology: 'Cytopathology',
  gynecology: 'Gynecology',
  oncology: 'Oncology',
  laboratory_medicine: 'Laboratory Medicine',
};

const SPECIALTY_LABELS_FR: Record<Specialty, string> = {
  anatomical_pathology: 'Anatomopathologie',
  cytopathology: 'Cytopathologie',
  gynecology: 'Gynécologie',
  oncology: 'Oncologie',
  laboratory_medicine: 'Médecine de laboratoire',
};

export const SAMPLE_TYPE_LABELS: Record<SampleType, string> = {
  cervical_cytology: 'Cervical Cytology',
  pap_smear: 'Pap Smear',
  biopsy: 'Biopsy',
  histology: 'Histology',
  hpv_sample: 'HPV Sample',
};

const SAMPLE_TYPE_LABELS_FR: Record<SampleType, string> = {
  cervical_cytology: 'Cytologie cervicale',
  pap_smear: 'Frottis Pap',
  biopsy: 'Biopsie',
  histology: 'Histologie',
  hpv_sample: 'Échantillon HPV',
};

export const STAINING_METHOD_LABELS: Record<StainingMethod, string> = {
  papanicolaou: 'Papanicolaou',
  h_e: 'H&E',
  other: 'Other',
};

const STAINING_METHOD_LABELS_FR: Record<StainingMethod, string> = {
  papanicolaou: 'Papanicolaou',
  h_e: 'H&E',
  other: 'Autre',
};

/** Every option offered by the unified account "role" selector — clinical titles map to a doctor account, "Administrator" maps to an admin account. */
export function roleSelectOptions(lang: Language = 'en'): Array<{ value: ProfessionalTitle | 'administrator'; label: string }> {
  const titles = lang === 'fr' ? PROFESSIONAL_TITLE_LABELS_FR : PROFESSIONAL_TITLE_LABELS;
  return [
    ...(Object.entries(titles) as Array<[ProfessionalTitle, string]>).map(([value, label]) => ({ value, label })),
    { value: 'administrator' as const, label: lang === 'fr' ? 'Administrateur' : 'Administrator' },
  ];
}

/** @deprecated use `roleSelectOptions(language)` so the picker follows the EN|FR toggle. */
export const ROLE_SELECT_OPTIONS = roleSelectOptions('en');

export function professionalTitleLabel(title?: ProfessionalTitle | null, lang: Language = 'en'): string {
  if (!title) return '—';
  return (lang === 'fr' ? PROFESSIONAL_TITLE_LABELS_FR : PROFESSIONAL_TITLE_LABELS)[title];
}

export function specialtyLabel(specialty?: Specialty | string | null, lang: Language = 'en'): string {
  if (!specialty || !(specialty in SPECIALTY_LABELS)) return specialty || '—';
  return (lang === 'fr' ? SPECIALTY_LABELS_FR : SPECIALTY_LABELS)[specialty as Specialty];
}

/** Specialty dropdown options in the current language. */
export function specialtyOptions(lang: Language = 'en'): Array<{ value: Specialty; label: string }> {
  const labels = lang === 'fr' ? SPECIALTY_LABELS_FR : SPECIALTY_LABELS;
  return (Object.entries(labels) as Array<[Specialty, string]>).map(([value, label]) => ({ value, label }));
}

/** Sample type dropdown options in the current language. */
export function sampleTypeOptions(lang: Language = 'en'): Array<{ value: SampleType; label: string }> {
  const labels = lang === 'fr' ? SAMPLE_TYPE_LABELS_FR : SAMPLE_TYPE_LABELS;
  return (Object.entries(labels) as Array<[SampleType, string]>).map(([value, label]) => ({ value, label }));
}

/** Staining method dropdown options in the current language. */
export function stainingMethodOptions(lang: Language = 'en'): Array<{ value: StainingMethod; label: string }> {
  const labels = lang === 'fr' ? STAINING_METHOD_LABELS_FR : STAINING_METHOD_LABELS;
  return (Object.entries(labels) as Array<[StainingMethod, string]>).map(([value, label]) => ({ value, label }));
}

export function sampleTypeLabel(type?: SampleType | string | null, lang: Language = 'en'): string {
  if (!type || !(type in SAMPLE_TYPE_LABELS)) return type || '—';
  return (lang === 'fr' ? SAMPLE_TYPE_LABELS_FR : SAMPLE_TYPE_LABELS)[type as SampleType];
}

export function stainingMethodLabel(method?: StainingMethod | string | null, lang: Language = 'en'): string {
  if (!method || !(method in STAINING_METHOD_LABELS)) return method || '—';
  return (lang === 'fr' ? STAINING_METHOD_LABELS_FR : STAINING_METHOD_LABELS)[method as StainingMethod];
}

export interface DoctorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospital: string;
  /** Clinical specialty — required for doctor accounts, empty for admins. */
  specialty: Specialty | '';
  department: string;
  /** Professional title shown alongside the name — null for admin accounts. */
  professionalTitle: ProfessionalTitle | null;
  phone: string;
  role: 'doctor' | 'admin';
  status: 'active' | 'inactive';
  /** Profile picture as a data URL; empty when none has been uploaded. */
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

/** Display name for any first/last-name pair — doctors and patients alike. */
export function personName(person: { firstName?: string; lastName?: string } | null | undefined, fallback = 'Unnamed'): string {
  if (!person) return fallback;
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || fallback;
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

interface ClassMeta {
  label: string;
  fullLabel: string;
  tone: Tone;
  severity: number;
}

const CLASS_META: Record<string, ClassMeta> = {
  NILM: {
    label: 'NILM',
    fullLabel: 'Negative for Intraepithelial Lesion or Malignancy',
    tone: 'success',
    severity: 0,
  },
  'ASC-US': {
    label: 'ASC-US',
    fullLabel: 'Atypical Squamous Cells of Undetermined Significance',
    tone: 'warning',
    severity: 1,
  },
  LSIL: {
    label: 'LSIL',
    fullLabel: 'Low-Grade Squamous Intraepithelial Lesion',
    tone: 'warning',
    severity: 2,
  },
  'ASC-H': {
    label: 'ASC-H',
    fullLabel: 'Atypical Squamous Cells, cannot exclude HSIL',
    tone: 'critical',
    severity: 3,
  },
  AGC: {
    label: 'AGC',
    fullLabel: 'Atypical Glandular Cells',
    tone: 'critical',
    severity: 3,
  },
  HSIL: {
    label: 'HSIL',
    fullLabel: 'High-Grade Squamous Intraepithelial Lesion',
    tone: 'critical',
    severity: 4,
  },
  SCC: {
    label: 'SCC',
    fullLabel: 'Squamous Cell Carcinoma',
    tone: 'critical',
    severity: 5,
  },
};

/** Bethesda class acronyms are standard nomenclature and are not translated — only the descriptive text is. */
const CLASS_FULL_LABEL_FR: Record<string, string> = {
  NILM: "Négatif pour une lésion intraépithéliale ou une malignité",
  'ASC-US': 'Cellules squameuses atypiques de signification indéterminée',
  LSIL: 'Lésion intraépithéliale squameuse de bas grade',
  'ASC-H': "Cellules squameuses atypiques, ne pouvant exclure une HSIL",
  AGC: 'Cellules glandulaires atypiques',
  HSIL: 'Lésion intraépithéliale squameuse de haut grade',
  SCC: 'Carcinome épidermoïde',
};

export function classMeta(className: string, lang: Language = 'en'): ClassMeta {
  const key = (className ?? '').toUpperCase();
  const base = CLASS_META[key];
  if (!base) {
    return {
      label: className || 'Unknown',
      fullLabel: lang === 'fr' ? 'Catégorie cytologique non reconnue' : 'Unrecognised cytological category',
      tone: 'neutral',
      severity: 2,
    };
  }
  return lang === 'fr' ? { ...base, fullLabel: CLASS_FULL_LABEL_FR[key] ?? base.fullLabel } : base;
}

/** Bethesda classes ordered from benign to malignant. */
export const CLASS_ORDER = ['NILM', 'ASC-US', 'LSIL', 'ASC-H', 'AGC', 'HSIL', 'SCC'];

export function sortClasses(classes: string[]): string[] {
  return [...classes].sort((a, b) => classMeta(a).severity - classMeta(b).severity);
}

/** Tailwind classes for a tone, using the template's own status tokens. */
export const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-status-success/10 text-status-success border-status-success/30',
  warning: 'bg-status-warning/10 text-status-warning border-status-warning/30',
  critical: 'bg-status-critical/10 text-status-critical border-status-critical/30',
  neutral: 'bg-muted/60 text-muted-foreground border-border',
};

export const TONE_BAR: Record<Tone, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical',
  neutral: 'bg-muted-foreground',
};

export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
  neutral: 'text-muted-foreground',
};

export function priorityTone(priority?: Priority): Tone {
  if (priority === 'high') return 'critical';
  if (priority === 'medium') return 'warning';
  if (priority === 'low') return 'success';
  return 'neutral';
}

export function priorityLabel(priority?: Priority, lang: Language = 'en'): string {
  if (lang === 'fr') {
    if (priority === 'high') return 'Élevée';
    if (priority === 'medium') return 'Moyenne';
    if (priority === 'low') return 'Faible';
    return 'Non évaluée';
  }
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Medium';
  if (priority === 'low') return 'Low';
  return 'Not rated';
}

export function qualityTone(label?: QualityLabel): Tone {
  if (label === 'interpretable') return 'success';
  if (label === 'uncertain') return 'warning';
  if (label === 'not_interpretable') return 'critical';
  return 'neutral';
}

export function qualityLabel(label?: QualityLabel, lang: Language = 'en'): string {
  if (lang === 'fr') {
    if (label === 'interpretable') return 'Interprétable';
    if (label === 'uncertain') return 'Incertain';
    if (label === 'not_interpretable') return 'Non interprétable';
    return 'Non évalué';
  }
  if (label === 'interpretable') return 'Interpretable';
  if (label === 'uncertain') return 'Uncertain';
  if (label === 'not_interpretable') return 'Not interpretable';
  return 'Not assessed';
}

export function severityTone(severity?: Severity): Tone {
  if (severity === 'moderate') return 'critical';
  if (severity === 'mild') return 'warning';
  return 'neutral';
}

export function severityLabel(severity?: Severity, lang: Language = 'en'): string {
  if (lang === 'fr') {
    if (severity === 'moderate') return 'Modérée';
    if (severity === 'mild') return 'Légère';
    return 'Aucune';
  }
  if (severity === 'moderate') return 'Moderate';
  if (severity === 'mild') return 'Mild';
  return 'None';
}

export function reviewTone(decision: ReviewDecision): Tone {
  if (decision === 'confirmed') return 'success';
  if (decision === 'corrected') return 'warning';
  if (decision === 'flagged') return 'critical';
  return 'neutral';
}

export function reviewLabel(decision: ReviewDecision, lang: Language = 'en'): string {
  if (lang === 'fr') {
    if (decision === 'confirmed') return 'Confirmée';
    if (decision === 'corrected') return 'Corrigée';
    if (decision === 'flagged') return 'Signalée';
    return 'À examiner';
  }
  if (decision === 'confirmed') return 'Confirmed';
  if (decision === 'corrected') return 'Corrected';
  if (decision === 'flagged') return 'Flagged';
  return 'To review';
}

export function reportStatusLabel(status: ReportStatus, lang: Language = 'en'): string {
  if (lang === 'fr') {
    if (status === 'validated') return 'Validé';
    if (status === 'in_review') return 'En révision';
    return 'Brouillon';
  }
  if (status === 'validated') return 'Validated';
  if (status === 'in_review') return 'In review';
  return 'Draft';
}

export function reportStatusTone(status: ReportStatus): Tone {
  if (status === 'validated') return 'success';
  if (status === 'in_review') return 'warning';
  return 'neutral';
}

export function toPercent(value: number | undefined, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

/** Final class for a cell once the doctor's decision is applied. */
export function effectiveClass(roi: RegionOfInterest, review?: CellReview): string {
  if (review?.decision === 'corrected' && review.correctedClass) return review.correctedClass;
  return roi.predicted_class;
}

/** Maps any backend class onto the three badge states the template supports. */
export function normalizeAssessment(value: string): ScreeningResult {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'scc' || normalized === 'asc-h' || normalized === 'agc') return 'hsil';
  if (normalized === 'asc-us') return 'lsil';
  if (normalized === 'nilm' || normalized === 'lsil' || normalized === 'hsil') {
    return normalized as ScreeningResult;
  }
  return 'nilm';
}
