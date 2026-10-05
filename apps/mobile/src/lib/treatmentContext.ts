import { useVisitStore } from '../store/useVisitStore';
import { sentenceCase } from './format';

/**
 * A treatment with the case and patient it belongs to, for screens that must show whose wound
 * they're working on. `visit` reads like "Right foot, treatment 2".
 */
export const useTreatmentContext = (treatmentId?: string) => {
  const treatment = useVisitStore((state) => state.treatments.find((t) => t.id === treatmentId));
  const woundCase = useVisitStore((state) => state.cases.find((c) => c.id === treatment?.caseId));
  const patient = useVisitStore((state) => state.patients.find((p) => p.id === woundCase?.patientId));

  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : undefined;
  const visit = [
    woundCase ? sentenceCase(woundCase.woundLocation) : undefined,
    treatment ? `treatment ${treatment.sequenceNumber}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return { treatment, woundCase, patient, patientName, visit };
};
