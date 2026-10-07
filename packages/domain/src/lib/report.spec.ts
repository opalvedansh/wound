import type { Treatment } from './domain';
import { caseReportHtml, type CaseReportOptions } from './report';

const treatment = (sequenceNumber: number, extra: Partial<Treatment> = {}): Treatment => ({
  id: `t${sequenceNumber}`,
  caseId: 'c1',
  sequenceNumber,
  phase: 'COMPLETED',
  createdAt: `2026-09-0${sequenceNumber}T09:00:00`,
  therapy: { therapyGiven: ['Debridement', 'Cleansing'], dressingType: 'Foam', nextVisitDate: '1 Week' },
  ...extra,
});

const base: CaseReportOptions = {
  patient: { firstName: 'Asha', lastName: 'Rao', patientId: 'PT-0042' },
  age: 67,
  woundCase: { woundLocation: 'Left heel', onsetDate: '2026-08-20' },
  treatments: [treatment(2), treatment(1)],
  hidePersonal: false,
  generatedAt: new Date(2026, 9, 7),
};

describe('caseReportHtml', () => {
  it('lists the chosen treatments in order with their care details', () => {
    const html = caseReportHtml(base);
    expect(html).toContain('Asha Rao');
    expect(html).toContain('67 y');
    expect(html).toContain('Left heel');
    expect(html).toContain('onset 20 Aug 2026');
    expect(html).toContain('Generated 7 Oct 2026');
    expect(html).toContain('Debridement, Cleansing');
    expect(html.indexOf('<td>T1</td>')).toBeLessThan(html.indexOf('<td>T2</td>'));
  });

  it('leaves out the name and age when personal details are hidden', () => {
    const html = caseReportHtml({ ...base, hidePersonal: true });
    expect(html).not.toContain('Asha');
    expect(html).not.toContain('Rao');
    expect(html).not.toContain('67 y');
    expect(html).toContain('Patient PT-0042');
    expect(html).toContain('personal details hidden');
  });

  it('escapes recorded text so it cannot change the page', () => {
    const html = caseReportHtml({ ...base, woundCase: { woundLocation: '<img src=x onerror=alert(1)>', onsetDate: '' } });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('adds photos only when the caller can supply them', () => {
    expect(caseReportHtml(base)).not.toContain('<figure>');
    const html = caseReportHtml({ ...base, photoSrc: (t, phase) => (phase === 'post' ? `data:image/jpeg;base64,${t.id}` : undefined) });
    expect(html).toContain('T1 · Post-treatment');
    expect(html).not.toContain('Pre-treatment</figcaption>');
  });

  it('shows the status and why', () => {
    expect(caseReportHtml({ ...base, status: { status: 'overdue', reason: 'Visit overdue by 2 days' } })).toContain(
      '<strong>Overdue</strong> (Visit overdue by 2 days)',
    );
  });
});
