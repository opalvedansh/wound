import { BadRequestException } from '@nestjs/common';
import { caseInput, patientInput, reviewInput } from './inputs';

const now = new Date('2026-10-08T12:00:00Z');

const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { problems: string[] }).problems;
  }
  throw new Error('expected a BadRequestException');
};

describe('patientInput', () => {
  const valid = {
    firstName: ' Asha ',
    lastName: 'Rao',
    patientId: 'MRN-42',
    sex: 'F',
    dateOfBirth: '1958-03-04',
    consent: { care: true, aiTraining: true, noticeVersion: 'dpdp-1' },
  };

  it('reads only the listed fields, so ownership and ids come from the server', () => {
    const input = patientInput({ ...valid, userId: 'someone-else', id: 'chosen-id' }, now);
    expect(input).toEqual({
      firstName: 'Asha',
      lastName: 'Rao',
      patientId: 'MRN-42',
      sex: 'F',
      dateOfBirth: new Date('1958-03-04T00:00:00Z'),
      location: null,
      consent: { care: true, aiTraining: true, noticeVersion: 'dpdp-1', recordedAt: now.toISOString() },
    });
    expect(input).not.toHaveProperty('userId');
  });

  it('needs consent to care records and photos', () => {
    expect(problemsOf(() => patientInput({ ...valid, consent: undefined }, now))).toEqual(['consent']);
    expect(problemsOf(() => patientInput({ ...valid, consent: { care: false, noticeVersion: 'dpdp-1' } }, now))).toEqual(['consent']);
  });

  it('names each problem field without echoing values', () => {
    expect(problemsOf(() => patientInput({ ...valid, firstName: ' ', sex: 'X', dateOfBirth: '2030-01-01' }, now))).toEqual([
      'firstName',
      'sex',
      'dateOfBirth',
    ]);
    expect(problemsOf(() => patientInput({ ...valid, dateOfBirth: '1958-02-30' }, now))).toEqual(['dateOfBirth']);
  });
});

describe('caseInput', () => {
  it('fills in the wound type when it is not known yet', () => {
    expect(caseInput({ patientId: 'p1', location: 'Left heel', onset: '2026-09-20' }, now)).toEqual({
      patientId: 'p1',
      location: 'Left heel',
      onset: new Date('2026-09-20T00:00:00Z'),
      woundType: 'Not recorded',
      comorbidities: [],
    });
  });

  it('needs a patient, a location and a past onset date', () => {
    expect(problemsOf(() => caseInput({ onset: '2026-12-01' }, now))).toEqual(['patientId', 'location', 'onset']);
  });
});

describe('reviewInput', () => {
  it('needs the edited text, or a reason to reject', () => {
    expect(problemsOf(() => reviewInput({ decision: 'edited' }))).toEqual(['finalReport']);
    expect(problemsOf(() => reviewInput({ decision: 'rejected', reason: ' ' }))).toEqual(['reason']);
    expect(problemsOf(() => reviewInput({ decision: 'maybe' }))).toEqual(['decision']);
    expect(reviewInput({ decision: 'approved' })).toEqual({ decision: 'approved', finalReport: null, reason: null, corrections: null });
  });
});
