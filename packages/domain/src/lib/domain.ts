import type { QuestionResponse } from './questions';

export type SyncState = 'synced' | 'pending';

/** Bump when the consent wording changes, so each record shows which notice the patient agreed to. */
export const CONSENT_NOTICE_VERSION = 'dpdp-1';

/** What the patient agreed to at registration (DPDP). */
export interface PatientConsent {
  /** Their details, wound assessments and wound photos kept for their care. Required to register. */
  care: boolean;
  /** De-identified photos used to improve wound measurement. Optional. */
  aiTraining: boolean;
  noticeVersion: string;
  recordedAt: string; // ISO timestamp
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientId: string;
  sex: string;
  dob: string;
  location: string;
  /** Missing on patients registered before consent was asked. */
  consent?: PatientConsent;
  syncState: SyncState;
}

export interface BaselineAssessment {
  woundType: string;
  exudateLevel: string;
  exudateType: string;
  infectionSigns: string[];
  /** 0 to 10. Missing when the pain question wasn't asked. */
  pain?: number;
  edgeCondition: string;
  periwoundCondition: string;
  comorbidities: string[];
  /** Answers to questions an admin added to the assessment form. */
  responses?: QuestionResponse[];
}

export interface RevisitAssessment extends BaselineAssessment {
  woundAppearanceTrend?: 'Improving' | 'Static' | 'Deteriorating';
}

export interface TherapyDetails {
  therapyGiven: string[];
  dressingType: string;
  nextVisitDate?: string;
  /** Answers to questions an admin added to the care form. */
  responses?: QuestionResponse[];
}

export interface ImageMetadata {
  captureTimestamp: string;
  lightingScore?: number;
  blurScore?: number;
  calibrated: boolean;
}

export interface Case {
  id: string;
  patientId: string;
  onsetDate: string; // ISO format
  woundLocation: string;
  status: 'IN_TREATMENT' | 'EVALUATION' | 'COMPLETED';
  syncState: SyncState;
  createdAt: string;
}

export interface Treatment {
  id: string;
  caseId: string;
  sequenceNumber: number;
  phase: 'PRE' | 'POST' | 'COMPLETED';
  preImageUri?: string;
  postImageUri?: string;
  imageMetadata?: ImageMetadata;
  assessment?: RevisitAssessment;
  therapy?: TherapyDetails;
  createdAt: string;
}

export interface AIResult {
  id: string;
  phaseId: string;
  modelId: string;
  modelVersion: string;
  confidenceScore: number;
  findings: any;
  status: 'PENDING' | 'PROCESSED' | 'ERROR';
  createdAt: Date;
}

export type OutboxItemType = 'PATIENT' | 'CASE' | 'TREATMENT' | 'IMAGE';

export interface OutboxItem {
  id: string;
  type: OutboxItemType;
  entityId: string;
  payload: any;
  createdAt: string;
  retryCount: number;
}
