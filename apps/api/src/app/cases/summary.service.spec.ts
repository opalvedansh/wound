import type { AnalyzeResponse } from '@antigravity-project-spec-pack/domain/wound-model';
import { woundStatus, worst } from './summary.service';

const now = new Date('2026-10-08T12:00:00Z');
const sure: AnalyzeResponse = { status: 'ok', wound_type: { label: 'venous', prob: 0.9, top: [['venous', 0.9]] } };
const visit = (area: number | null, extra: { urgent?: boolean; findings?: AnalyzeResponse } = {}) => ({
  at: now,
  area,
  urgent: extra.urgent ?? false,
  findings: extra.findings ?? sure,
});

describe('woundStatus', () => {
  it('has no status before the first analysed visit', () => {
    expect(woundStatus([], null, now)).toEqual({ status: null, reason: null });
  });

  it('a missed visit makes the wound overdue, before anything else', () => {
    const r = woundStatus([visit(4, { urgent: true })], new Date('2026-10-05'), now);
    expect(r).toEqual({ status: 'overdue', reason: 'Visit overdue by 3 days' });
    expect(woundStatus([visit(4)], new Date('2026-10-08'), now).status).toBe('healing'); // due today is not overdue
  });

  it('an urgent flag, an unsure wound type or growth over 10% needs review', () => {
    expect(woundStatus([visit(4, { urgent: true })], null, now).status).toBe('review');
    const unsure: AnalyzeResponse = { status: 'ok', wound_type: { label: 'venous', prob: 0.4, top: [['venous', 0.4], ['arterial', 0.35]] } };
    expect(woundStatus([visit(4, { findings: unsure })], null, now).status).toBe('review');
    expect(woundStatus([visit(4), visit(4.5)], null, now)).toEqual({ status: 'review', reason: 'Wound grew 13% since the last visit' });
    expect(woundStatus([visit(4), visit(4.3)], null, now).status).toBe('healing');
    expect(woundStatus([visit(4), visit(null), visit(3)], null, now).status).toBe('healing');
  });

  it('a patient shows their worst wound', () => {
    expect(worst(['healing', 'overdue', 'review'])).toBe('overdue');
    expect(worst([null, 'healing'])).toBe('healing');
    expect(worst([])).toBeNull();
  });
});
