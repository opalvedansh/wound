import { intakeFromApp } from './sync.service';

describe('intakeFromApp', () => {
  it('derives the body site, diabetes and cause from what the app records', () => {
    expect(intakeFromApp('Left heel', { woundType: 'Pressure injury', comorbidities: ['Type 2 diabetes'], pain: 4 }, [])).toEqual({
      body_location: 'heel',
      diabetes: 'yes',
      cause: 'pressure_lying_or_sitting',
      pain: 4,
    });
    expect(intakeFromApp('Sacrum', null, ['Diabetes mellitus'])).toEqual({ body_location: 'sacrum_buttock', diabetes: 'yes', cause: 'unknown' });
  });

  it("says it doesn't know rather than guessing", () => {
    expect(intakeFromApp('Somewhere', { woundType: '', comorbidities: [] }, [])).toEqual({ body_location: 'other', diabetes: 'not_sure', cause: 'unknown' });
  });
});
