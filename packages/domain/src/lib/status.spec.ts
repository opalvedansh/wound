import type { Treatment } from './domain';
import { caseStatus, nextVisitDue, worstStatus } from './status';

const visit = (sequenceNumber: number, createdAt: string, extra: Partial<Treatment> = {}): Treatment => ({
  id: `t${sequenceNumber}`,
  caseId: 'c1',
  sequenceNumber,
  phase: 'COMPLETED',
  createdAt,
  ...extra,
});

const open = { status: 'IN_TREATMENT' as const };
const now = new Date(2026, 9, 7, 15, 0); // 7 Oct 2026, mid-afternoon

describe('nextVisitDue', () => {
  it('counts intervals from the visit date', () => {
    const t = (nextVisitDate: string) => visit(1, new Date(2026, 9, 1, 9).toISOString(), { therapy: { therapyGiven: [], dressingType: '', nextVisitDate } });
    expect(nextVisitDue(t('In 3 Days'))).toEqual(new Date(2026, 9, 4));
    expect(nextVisitDue(t('1 Week'))).toEqual(new Date(2026, 9, 8));
    expect(nextVisitDue(t('2 Weeks'))).toEqual(new Date(2026, 9, 15));
    expect(nextVisitDue(t('1 Month'))).toEqual(new Date(2026, 10, 1));
  });

  it('reads calendar dates and has no due date for "as needed" or free text', () => {
    const t = (nextVisitDate?: string) => visit(1, now.toISOString(), { therapy: { therapyGiven: [], dressingType: '', nextVisitDate } });
    expect(nextVisitDue(t('2026-10-20'))).toEqual(new Date(2026, 9, 20));
    expect(nextVisitDue(t('2026-02-30'))).toBeNull();
    expect(nextVisitDue(t('PRN (As Needed)'))).toBeNull();
    expect(nextVisitDue(t('after the scan'))).toBeNull();
    expect(nextVisitDue(t())).toBeNull();
  });
});

describe('caseStatus', () => {
  const plan = (nextVisitDate: string) => ({ therapy: { therapyGiven: [], dressingType: '', nextVisitDate } });

  it('has no status before the first visit or after the case is closed', () => {
    expect(caseStatus(open, [], now)).toBeUndefined();
    expect(caseStatus({ status: 'COMPLETED' }, [visit(1, '2026-01-01T09:00:00Z', plan('1 Week'))], now)).toBeUndefined();
  });

  it('is overdue once the planned visit day has passed, not on the day itself', () => {
    const due = (date: string) => caseStatus(open, [visit(1, '2026-09-01T09:00:00Z', plan(date))], now);
    expect(due('2026-10-07')).toEqual({ status: 'healing' });
    expect(due('2026-10-06')).toEqual({ status: 'overdue', reason: 'Visit overdue by 1 day' });
    expect(due('2026-10-02')).toEqual({ status: 'overdue', reason: 'Visit overdue by 5 days' });
  });

  it("only uses the latest visit's plan", () => {
    const visits = [visit(1, '2026-09-01T09:00:00Z', plan('1 Week')), visit(2, '2026-10-05T09:00:00Z', { phase: 'PRE' })];
    expect(caseStatus(open, visits, now)).toEqual({ status: 'healing' });
  });

  it('needs review when the latest assessed trend is deteriorating', () => {
    const assessed = (trend: 'Improving' | 'Static' | 'Deteriorating') =>
      ({
        assessment: {
          woundType: '', exudateLevel: '', exudateType: '', infectionSigns: [], edgeCondition: '', periwoundCondition: '', comorbidities: [],
          woundAppearanceTrend: trend,
        },
      }) satisfies Partial<Treatment>;
    expect(caseStatus(open, [visit(1, '2026-10-01T09:00:00Z', assessed('Deteriorating'))], now)).toEqual({
      status: 'review',
      reason: 'Wound marked as deteriorating',
    });
    expect(
      caseStatus(open, [visit(1, '2026-09-01T09:00:00Z', assessed('Deteriorating')), visit(2, '2026-10-01T09:00:00Z', assessed('Improving'))], now),
    ).toEqual({ status: 'healing' });
  });

  it('puts overdue ahead of needs review', () => {
    const t = visit(1, '2026-09-01T09:00:00Z', {
      ...plan('1 Week'),
      assessment: {
        woundType: '', exudateLevel: '', exudateType: '', infectionSigns: [], edgeCondition: '', periwoundCondition: '', comorbidities: [],
        woundAppearanceTrend: 'Deteriorating',
      },
    });
    expect(caseStatus(open, [t], now)?.status).toBe('overdue');
  });
});

describe('worstStatus', () => {
  it('picks the most urgent status and ignores wounds without one', () => {
    expect(worstStatus([])).toBeUndefined();
    expect(worstStatus([undefined, { status: 'healing' }])).toEqual({ status: 'healing' });
    expect(worstStatus([{ status: 'review', reason: 'r' }, { status: 'overdue', reason: 'o' }, { status: 'healing' }])).toEqual({
      status: 'overdue',
      reason: 'o',
    });
  });
});
