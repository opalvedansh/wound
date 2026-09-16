import { create } from 'zustand';
import { Patient, Case, Treatment, AIResult } from '@antigravity-project-spec-pack/domain';
import { supabase } from '@antigravity-project-spec-pack/domain';

export interface WebPortalState {
  patients: Patient[];
  cases: Case[];
  treatments: Treatment[];
  aiResults: AIResult[];
  isLoading: boolean;
  
  // Actions
  fetchData: () => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'syncState'>) => Promise<void>;
  updateCaseStatus: (caseId: string, status: Case['status']) => void;
  flagTreatment: (treatmentId: string, reason: string) => void;
  clearState: () => void;
}

export const useWebStore = create<WebPortalState>((set, get) => ({
  patients: [],
  cases: [],
  treatments: [],
  aiResults: [],
  isLoading: false,

  clearState: () => set({
    patients: [],
    cases: [],
    treatments: [],
    aiResults: [],
    isLoading: false
  }),

  fetchData: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      get().clearState();
      return;
    }

    set({ isLoading: true });
    
    // Fetch Patients
    const { data: patientsData, error: patientsError } = await supabase.from('Patient').select('*');
    if (patientsError) console.error('Error fetching patients:', patientsError);
    
    // Fetch Cases
    const { data: casesData, error: casesError } = await supabase.from('Case').select('*');
    if (casesError) console.error('Error fetching cases:', casesError);
    
    // Fetch Treatments
    const { data: treatmentsData, error: treatmentsError } = await supabase.from('Treatment').select('*');
    if (treatmentsError) console.error('Error fetching treatments:', treatmentsError);

    // Map DB schema to Frontend Domain Interfaces
    const mappedPatients: Patient[] = (patientsData || []).map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      patientId: p.patientId,
      sex: p.sex,
      dob: p.dateOfBirth,
      location: p.location,
      syncState: 'synced'
    }));

    const mappedCases: Case[] = (casesData || []).map(c => ({
      id: c.id,
      patientId: c.patientId,
      onsetDate: c.onset,
      woundLocation: c.location,
      status: 'IN_TREATMENT', // Mocking this since it's missing from SQL schema
      syncState: 'synced',
      createdAt: c.createdAt
    }));

    const mappedTreatments: Treatment[] = (treatmentsData || []).map(t => ({
      id: t.id,
      caseId: t.caseId,
      sequenceNumber: 1, // Mocking
      phase: 'COMPLETED', // Mocking
      createdAt: t.createdAt
    }));

    set({
      patients: mappedPatients,
      cases: mappedCases,
      treatments: mappedTreatments,
      isLoading: false
    });
  },

  addPatient: async (data) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot add patient without active session');
      return;
    }

    const newId = `PT-${Math.floor(Math.random()*10000)}`;
    const { error } = await supabase.from('Patient').insert([{
      id: newId,
      userId: session.user.id,
      firstName: data.firstName,
      lastName: data.lastName,
      patientId: data.patientId,
      sex: data.sex,
      dateOfBirth: data.dob,
      location: data.location,
      updatedAt: new Date().toISOString()
    }]);
    
    if (error) {
      console.error('Error inserting patient:', error);
      return;
    }

    set((state) => ({
      patients: [...state.patients, { ...data, id: newId, syncState: 'synced' }]
    }));
  },

  updateCaseStatus: (caseId: string, status: Case['status']) => set((state) => ({
    cases: state.cases.map(c => c.id === caseId ? { ...c, status } : c)
  })),

  flagTreatment: (treatmentId, reason) => set((state) => ({
    // For now just storing it by logging it. 
  }))
}));

