/**
 * The wound model service's contract (wound-ai/api/server.py) and the visit records built from it.
 * Shared by the NestJS API, which calls the model, and the web portal, which shows the results.
 *
 * Import through `@antigravity-project-spec-pack/domain/wound-model`, never the package index: the index also
 * re-exports a browser Supabase client.
 */

export type AnalyzeStatus = 'ok' | 'retake' | 'no_wound_found';

export interface Flag {
  level: 'urgent' | 'review';
  text: string;
}

export interface ClassResult {
  label: string;
  /** Calibrated probability of `label`. */
  prob: number;
  /** Top alternatives, most likely first. */
  top: [string, number][];
}

export interface Measurement {
  area_cm2: number;
  length_cm: number;
  width_cm: number;
  perimeter_cm: number;
  n_regions: number;
}

export interface AreaChange {
  previous_area_cm2?: number;
  /** Positive = smaller than last time. */
  percent_area_reduction?: number;
  days_between?: number;
}

/** One polygon per wound region; points are [x, y] scaled 0–1 by the photo's width and height. */
export type Outline = [number, number][][];

export interface IntakeQuestion {
  id: string;
  text: string;
  type: 'choice' | 'number' | 'text';
  options?: string[];
}

export type IntakeAnswers = Record<string, string | number>;

/**
 * What POST /analyze returns. Only `status` is always there: a retake carries `quality.issues`, no wound found
 * carries `flags`, and the rest appears as each trained model is added to the service.
 */
export interface AnalyzeResponse {
  status: AnalyzeStatus;
  case_id?: string;
  timestamp?: string;
  quality?: { ok: boolean; issues: string[] };
  marker_found?: boolean;
  flags?: Flag[];
  wound_type?: ClassResult;
  severity?: Record<string, ClassResult>;
  tissue_pct?: Record<string, number>;
  measurement?: Measurement | null;
  change?: AreaChange;
  outline?: Outline | null;
  report_markdown?: string;
  follow_up_questions?: IntakeQuestion[];
  model_versions?: Record<string, string>;
}

/** The model refuses an analysis without these (they decide the diabetic-foot rule and the follow-ups). */
export const REQUIRED_INTAKE = ['diabetes', 'cause'] as const;

export const missingIntake = (answers: IntakeAnswers): string[] =>
  REQUIRED_INTAKE.filter((id) => answers[id] === undefined || answers[id] === '');

/**
 * Keeps only answers to the model's own choice and number questions, with values the question allows. Free text
 * (such as "current treatment") and anything else is dropped, so nothing that could identify the patient is sent.
 */
export const filterIntake = (answers: Record<string, unknown>, questions: IntakeQuestion[]): IntakeAnswers => {
  const kept: IntakeAnswers = {};
  for (const q of questions) {
    const value = answers[q.id];
    if (q.type === 'choice' && typeof value === 'string' && (q.options ?? []).includes(value)) kept[q.id] = value;
    if (q.type === 'number') {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
      if (Number.isFinite(n)) kept[q.id] = n;
    }
  }
  return kept;
};

/** Below this calibrated probability a classification is reported as uncertain (same as report.py). */
export const UNCERTAIN_BELOW = 0.7;

export const isUncertain = (result: ClassResult | undefined): boolean => result !== undefined && result.prob < UNCERTAIN_BELOW;

/** Display names for the model's wound-type labels (same as report.py). */
export const WOUND_TYPE_LABEL: Record<string, string> = {
  diabetic: 'Diabetic foot ulcer',
  pressure: 'Pressure injury',
  venous: 'Venous leg ulcer',
  surgical: 'Surgical wound',
  burn: 'Burn',
  other: 'Other wound',
  not_wound: 'No wound detected',
};

export const woundTypeName = (label: string) => WOUND_TYPE_LABEL[label] ?? label.replace(/_/g, ' ');

/** The model's option ids are snake_case ("pressure_lying_or_sitting"); show them as words. */
export const optionLabel = (option: string) => {
  const words = option.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The most recent measured area, which the model compares the new photo against. */
export const previousMeasurement = (
  results: { area: number | null; createdAt: Date | string }[],
  now: Date = new Date(),
): { area_cm2: number; days_ago: number } | undefined => {
  const latest = results
    .filter((r): r is { area: number; createdAt: Date | string } => r.area !== null && r.area > 0)
    .map((r) => ({ area: r.area, at: new Date(r.createdAt) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  if (!latest) return undefined;
  return { area_cm2: latest.area, days_ago: Math.max(0, Math.round((now.getTime() - latest.at.getTime()) / 86_400_000)) };
};

export type ReviewDecision = 'approved' | 'edited' | 'rejected';
export const REVIEW_DECISIONS: readonly ReviewDecision[] = ['approved', 'edited', 'rejected'];

export interface ReviewView {
  decision: ReviewDecision;
  finalReport: string | null;
  reason: string | null;
  reviewerId: string;
  createdAt: string;
}

/** One analysed photo of a wound: what the API returns and the case page lists. */
export interface VisitView {
  aiResultId: string;
  treatmentId: string;
  takenAt: string;
  /** Short-lived signed URL, or null if the photo can't be signed right now. */
  photoUrl: string | null;
  findings: AnalyzeResponse;
  intake: IntakeAnswers;
  draftReport: string | null;
  review: ReviewView | null;
}

/** What POST /cases/:id/visits answers: a saved visit, or why the photo was not analysed (nothing saved). */
export interface VisitOutcome {
  status: AnalyzeStatus;
  visit?: VisitView;
  /** Retake: what to fix in the photo. */
  issues?: string[];
  flags?: Flag[];
}

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  patientId: string;
  sex: string;
  dateOfBirth: string;
  location: string | null;
  createdAt: string;
  cases: CaseSummary[];
}

export interface CaseSummary {
  id: string;
  location: string;
  onset: string;
  woundType: string;
  createdAt: string;
}

export interface CaseView extends CaseSummary {
  comorbidities: string[];
  patient: { id: string; firstName: string; lastName: string; patientId: string };
  /** Oldest first. */
  visits: VisitView[];
}
