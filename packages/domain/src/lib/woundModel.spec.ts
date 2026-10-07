import { filterIntake, isUncertain, missingIntake, optionLabel, previousMeasurement, woundTypeName, type IntakeQuestion } from './woundModel';

describe('missingIntake', () => {
  it('names the answers the model refuses to work without', () => {
    expect(missingIntake({})).toEqual(['diabetes', 'cause']);
    expect(missingIntake({ diabetes: 'no', cause: '' })).toEqual(['cause']);
    expect(missingIntake({ diabetes: 'no', cause: 'burn' })).toEqual([]);
  });
});

describe('filterIntake', () => {
  const questions: IntakeQuestion[] = [
    { id: 'diabetes', text: 'Diabetes?', type: 'choice', options: ['yes', 'no', 'not_sure'] },
    { id: 'pain', text: 'Pain 0-10?', type: 'number' },
    { id: 'current_treatment', text: 'Current dressing (free text)', type: 'text' },
  ];

  it('keeps valid answers to the model questions only', () => {
    expect(
      filterIntake(
        { diabetes: 'yes', pain: '6', current_treatment: "Mrs Rao's foam dressing", patient_name: 'Asha Rao' },
        questions,
      ),
    ).toEqual({ diabetes: 'yes', pain: 6 });
  });

  it('drops options the question does not offer and numbers that are not numbers', () => {
    expect(filterIntake({ diabetes: 'maybe', pain: 'lots' }, questions)).toEqual({});
    expect(filterIntake({ pain: 0 }, questions)).toEqual({ pain: 0 });
  });
});

describe('previousMeasurement', () => {
  const now = new Date('2026-10-08T12:00:00Z');

  it('uses the latest measured area and how many days ago it was', () => {
    expect(
      previousMeasurement(
        [
          { area: 6.2, createdAt: '2026-09-10T12:00:00Z' },
          { area: 4.8, createdAt: '2026-09-24T12:00:00Z' },
          { area: null, createdAt: '2026-10-01T12:00:00Z' },
        ],
        now,
      ),
    ).toEqual({ area_cm2: 4.8, days_ago: 14 });
  });

  it('has nothing to compare against before a size was measured', () => {
    expect(previousMeasurement([], now)).toBeUndefined();
    expect(previousMeasurement([{ area: null, createdAt: now }, { area: 0, createdAt: now }], now)).toBeUndefined();
  });
});

describe('display helpers', () => {
  it('reports a classification below 70% as uncertain', () => {
    expect(isUncertain({ label: 'diabetic', prob: 0.69, top: [] })).toBe(true);
    expect(isUncertain({ label: 'diabetic', prob: 0.7, top: [] })).toBe(false);
    expect(isUncertain(undefined)).toBe(false);
    expect(isUncertain({ label: 'diabetic', prob: null, top: [], rule: 'diabetes and a foot location' })).toBe(false);
  });

  it('turns model ids into words', () => {
    expect(woundTypeName('pressure')).toBe('Pressure injury');
    expect(woundTypeName('arterial_ulcer')).toBe('arterial ulcer');
    expect(optionLabel('pressure_lying_or_sitting')).toBe('Pressure lying or sitting');
  });
});
