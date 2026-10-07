import type {
  AnalyzeResponse,
  CaseSummary,
  IntakeAnswers,
  PatientSummary,
  ReviewDecision,
  ReviewView,
  VisitView,
} from '@antigravity-project-spec-pack/domain/wound-model';

/** Database rows as the JSON the web portal reads (dates as ISO strings, calendar days as YYYY-MM-DD). */

const day = (d: Date) => d.toISOString().slice(0, 10);

interface CaseRow {
  id: string;
  location: string;
  onset: Date;
  woundType: string;
  createdAt: Date;
}

export const toCaseSummary = (c: CaseRow): CaseSummary => ({
  id: c.id,
  location: c.location,
  onset: day(c.onset),
  woundType: c.woundType,
  createdAt: c.createdAt.toISOString(),
});

interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  patientId: string;
  sex: string;
  dateOfBirth: Date;
  location: string | null;
  createdAt: Date;
  cases: CaseRow[];
}

export const toPatientSummary = (p: PatientRow): PatientSummary => ({
  id: p.id,
  firstName: p.firstName,
  lastName: p.lastName,
  patientId: p.patientId,
  sex: p.sex,
  dateOfBirth: day(p.dateOfBirth),
  location: p.location,
  createdAt: p.createdAt.toISOString(),
  cases: p.cases.map(toCaseSummary),
});

interface ReviewRow {
  decision: string;
  finalReport: string | null;
  reason: string | null;
  reviewerId: string;
  createdAt: Date;
}

export const toReviewView = (r: ReviewRow): ReviewView => ({
  decision: r.decision as ReviewDecision,
  finalReport: r.finalReport,
  reason: r.reason,
  reviewerId: r.reviewerId,
  createdAt: r.createdAt.toISOString(),
});

export interface AIResultRow {
  id: string;
  findings: unknown;
  intake: unknown;
  draftReport: string | null;
  createdAt: Date;
  review?: ReviewRow | null;
}

export const toVisitView = (treatmentId: string, result: AIResultRow, photoUrl: string | null): VisitView => ({
  aiResultId: result.id,
  treatmentId,
  takenAt: result.createdAt.toISOString(),
  photoUrl,
  findings: (result.findings ?? { status: 'ok' }) as AnalyzeResponse,
  intake: (result.intake ?? {}) as IntakeAnswers,
  draftReport: result.draftReport,
  review: result.review ? toReviewView(result.review) : null,
});
