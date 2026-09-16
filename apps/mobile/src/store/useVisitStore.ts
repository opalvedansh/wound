import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from './secureStorage';
import { 
  Patient, 
  Case, 
  Treatment, 
  SyncState, 
  OutboxItemType, 
  OutboxItem,
  ImageMetadata,
  BaselineAssessment,
  RevisitAssessment,
  TherapyDetails
} from '@antigravity-project-spec-pack/domain';

export type { OutboxItemType, OutboxItem };

// Duplicate Outbox definitions removed

interface VisitState {
  // Domain Data
  patients: Patient[];
  cases: Case[];
  treatments: Treatment[];
  outbox: OutboxItem[];
  lastSyncAttempt?: string;
  
  // Actions
  addPatient: (patient: Omit<Patient, 'id' | 'syncState'>) => string;
  addCase: (caseData: Omit<Case, 'id' | 'syncState' | 'createdAt'>) => string;
  addTreatment: (caseId: string) => string;
  updateTreatment: (treatmentId: string, updates: Partial<Treatment>) => void;
  completePrePhase: (treatmentId: string) => void;
  completePostPhase: (treatmentId: string) => void;
  addToOutbox: (item: Omit<OutboxItem, 'id' | 'createdAt' | 'retryCount'>) => void;
  removeFromOutbox: (id: string) => void;
  incrementOutboxRetry: (id: string) => void;
  updateSyncState: (type: OutboxItemType, entityId: string, syncState: SyncState) => void;
  setLastSyncAttempt: (date: string) => void;

  // UI Flow State (Legacy/Current Visit)
  imageCaptured: boolean;
  clinicalDataSaved: boolean;
  aiProcessed: boolean;
  resetVisit: () => void;
  setImageCaptured: (val: boolean) => void;
  setClinicalDataSaved: (val: boolean) => void;
  setAiProcessed: (val: boolean) => void;
}

export const useVisitStore = create<VisitState>()(
  persist(
    (set, get) => ({
      patients: [],
      cases: [],
      treatments: [],
      outbox: [],

      addPatient: (data) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => ({
          patients: [...state.patients, { ...data, id, syncState: 'pending' }]
        }));
        get().addToOutbox({ type: 'PATIENT', entityId: id, payload: { ...data, id } });
        return id;
      },

      addCase: (data) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => ({
          cases: [...state.cases, { ...data, id, syncState: 'pending', createdAt: new Date().toISOString() }]
        }));
        get().addToOutbox({ type: 'CASE', entityId: id, payload: { ...data, id } });
        return id;
      },

      addTreatment: (caseId) => {
        const id = Math.random().toString(36).substr(2, 9);
        let newTreatment: Treatment;
        set((state) => {
          const caseTreatments = state.treatments.filter(t => t.caseId === caseId);
          const prevTreatment = caseTreatments.length > 0 ? caseTreatments[caseTreatments.length - 1] : null;
          
          newTreatment = {
            id,
            caseId,
            sequenceNumber: caseTreatments.length + 1,
            phase: 'PRE',
            preImageUri: prevTreatment?.postImageUri,
            assessment: prevTreatment?.assessment ? { ...prevTreatment.assessment } : undefined,
            createdAt: new Date().toISOString()
          };
          
          return {
            treatments: [...state.treatments, newTreatment]
          };
        });
        get().addToOutbox({ type: 'TREATMENT', entityId: id, payload: newTreatment! });
        return id;
      },

      updateTreatment: (treatmentId, updates) => {
        set((state) => ({
          treatments: state.treatments.map(t => t.id === treatmentId ? { ...t, ...updates } : t)
        }));
        const updated = get().treatments.find(t => t.id === treatmentId);
        if (updated) {
          get().addToOutbox({ type: 'TREATMENT', entityId: treatmentId, payload: updated });
        }
      },

      completePrePhase: (treatmentId) => {
        set((state) => ({
          treatments: state.treatments.map(t => t.id === treatmentId ? { ...t, phase: 'POST' } : t)
        }));
      },

      completePostPhase: (treatmentId) => {
        set((state) => ({
          treatments: state.treatments.map(t => t.id === treatmentId ? { ...t, phase: 'COMPLETED' } : t)
        }));
      },

      addToOutbox: (item) => {
        set((state) => {
          // Replace if already in outbox for same entity and type
          const existingIndex = state.outbox.findIndex(o => o.entityId === item.entityId && o.type === item.type);
          const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), retryCount: 0 };
          
          if (existingIndex >= 0) {
            const newOutbox = [...state.outbox];
            newOutbox[existingIndex] = newItem;
            return { outbox: newOutbox };
          }
          return { outbox: [...state.outbox, newItem] };
        });
      },

      removeFromOutbox: (id) => {
        set((state) => ({
          outbox: state.outbox.filter(o => o.id !== id)
        }));
      },

      incrementOutboxRetry: (id) => {
        set((state) => ({
          outbox: state.outbox.map(o => o.id === id ? { ...o, retryCount: o.retryCount + 1 } : o)
        }));
      },

      updateSyncState: (type, entityId, syncState) => {
        set((state) => {
          if (type === 'PATIENT') {
            return { patients: state.patients.map(p => p.id === entityId ? { ...p, syncState } : p) };
          }
          if (type === 'CASE') {
            return { cases: state.cases.map(c => c.id === entityId ? { ...c, syncState } : c) };
          }
          return {};
        });
      },

      setLastSyncAttempt: (date) => set({ lastSyncAttempt: date }),

      imageCaptured: false,
      clinicalDataSaved: false,
      aiProcessed: false,
      resetVisit: () => set({ imageCaptured: false, clinicalDataSaved: false, aiProcessed: false }),
      setImageCaptured: (val) => set({ imageCaptured: val }),
      setClinicalDataSaved: (val) => set({ clinicalDataSaved: val }),
      setAiProcessed: (val) => set({ aiProcessed: val }),
    }),
    {
      // v2: old test data and old-format outbox items are dropped (see LEGACY_STORE_KEY).
      name: 'visit-storage-v2',
      storage: createJSONStorage(() => secureStorage),
      // Don't persist UI state flags
      partialize: (state) => ({
        patients: state.patients,
        cases: state.cases,
        treatments: state.treatments,
        outbox: state.outbox,
        lastSyncAttempt: state.lastSyncAttempt
      }),
    }
  )
);

// Remove the pre-v2 store, which may hold test patient data and old outbox items.
const LEGACY_STORE_KEY = 'visit-storage';
Promise.resolve(secureStorage.removeItem(LEGACY_STORE_KEY)).catch(() => undefined);
