import { BadRequestException } from '@nestjs/common';
import { REVIEW_DECISIONS, type ReviewDecision } from '@antigravity-project-spec-pack/domain/wound-model';

/**
 * Request bodies, checked field by field. Only the listed fields are read, so a caller can never set ownership
 * (`userId`) or ids. Problems are reported by field name only, never echoing values (they may be patient data).
 */

type Body = Record<string, unknown>;

const objectFrom = (body: unknown): Body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Send a JSON object.');
  return body as Body;
};

const text = (body: Body, key: string) => (typeof body[key] === 'string' ? (body[key] as string).trim() : '');

const fail = (message: string, problems: string[]) => {
  if (problems.length) throw new BadRequestException({ message, problems });
};

/** A YYYY-MM-DD calendar day as UTC midnight, or null if it isn't a real date. */
export const parseDay = (value: string): Date | null => {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const [y, m, d] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
};

const pastDay = (value: string, now: Date) => {
  const day = parseDay(value);
  return day && day.getTime() <= now.getTime() ? day : null;
};

export interface PatientInput {
  firstName: string;
  lastName: string;
  patientId: string;
  sex: 'M' | 'F' | 'O';
  dateOfBirth: Date;
  location: string | null;
  consent: { care: true; aiTraining: boolean; noticeVersion: string; recordedAt: string };
}

export const patientInput = (raw: unknown, now = new Date()): PatientInput => {
  const body = objectFrom(raw);
  const consent = body['consent'] && typeof body['consent'] === 'object' ? (body['consent'] as Body) : {};
  const sex = text(body, 'sex');
  const dateOfBirth = pastDay(text(body, 'dateOfBirth'), now);
  const problems = [
    !text(body, 'firstName') && 'firstName',
    !text(body, 'lastName') && 'lastName',
    (!text(body, 'patientId') || text(body, 'patientId').length > 64) && 'patientId',
    !['M', 'F', 'O'].includes(sex) && 'sex',
    !dateOfBirth && 'dateOfBirth',
    // DPDP: no record is kept without the patient's consent to care records and photos.
    (consent['care'] !== true || !text(consent, 'noticeVersion')) && 'consent',
  ].filter((p): p is string => typeof p === 'string');
  fail('Check the patient details.', problems);
  return {
    firstName: text(body, 'firstName'),
    lastName: text(body, 'lastName'),
    patientId: text(body, 'patientId'),
    sex: sex as PatientInput['sex'],
    dateOfBirth: dateOfBirth as Date,
    location: text(body, 'location') || null,
    consent: {
      care: true,
      aiTraining: consent['aiTraining'] === true,
      noticeVersion: text(consent, 'noticeVersion'),
      recordedAt: now.toISOString(),
    },
  };
};

export interface CaseInput {
  patientId: string;
  location: string;
  onset: Date;
  woundType: string;
  comorbidities: string[];
}

export const caseInput = (raw: unknown, now = new Date()): CaseInput => {
  const body = objectFrom(raw);
  const onset = pastDay(text(body, 'onset'), now);
  const comorbidities = Array.isArray(body['comorbidities'])
    ? (body['comorbidities'] as unknown[]).filter((c): c is string => typeof c === 'string' && c.trim() !== '').map((c) => c.trim())
    : [];
  const problems = [
    !text(body, 'patientId') && 'patientId',
    !text(body, 'location') && 'location',
    !onset && 'onset',
  ].filter((p): p is string => typeof p === 'string');
  fail('Check the wound details.', problems);
  return {
    patientId: text(body, 'patientId'),
    location: text(body, 'location'),
    onset: onset as Date,
    woundType: text(body, 'woundType') || 'Not recorded',
    comorbidities,
  };
};

export interface ReviewInput {
  decision: ReviewDecision;
  finalReport: string | null;
  reason: string | null;
  corrections: Record<string, unknown> | null;
}

export const reviewInput = (raw: unknown): ReviewInput => {
  const body = objectFrom(raw);
  const decision = text(body, 'decision') as ReviewDecision;
  const corrections = body['corrections'];
  const problems = [
    !REVIEW_DECISIONS.includes(decision) && 'decision',
    decision === 'edited' && !text(body, 'finalReport') && 'finalReport',
    decision === 'rejected' && !text(body, 'reason') && 'reason',
    corrections !== undefined && corrections !== null && (typeof corrections !== 'object' || Array.isArray(corrections)) && 'corrections',
  ].filter((p): p is string => typeof p === 'string');
  fail('Check the review.', problems);
  return {
    decision,
    finalReport: text(body, 'finalReport') || null,
    reason: text(body, 'reason') || null,
    corrections: (corrections as Record<string, unknown> | undefined) ?? null,
  };
};
