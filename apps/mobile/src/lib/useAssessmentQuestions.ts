import { create } from 'zustand';
import { supabase } from './supabase';

export type QuestionType = 'chip_single' | 'chip_multi' | 'numeric';

export interface AssessmentQuestion {
  id: string;
  title: string;
  type: QuestionType;
  options: string[] | null;
  required: boolean;
  order: number;
  active: boolean;
  followUpOnly: boolean;
}

const DEFAULT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'default_wound_type',
    title: 'WOUND TYPE',
    type: 'chip_single',
    options: ['Pressure Ulcer', 'DFU', 'VLU', 'Arterial Ulcer', 'Surgical Wound', 'Traumatic', 'Burn', 'Other'],
    required: true,
    order: 0,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_trend',
    title: 'WOUND APPEARANCE TREND',
    type: 'chip_single',
    options: ['Improving', 'Static', 'Deteriorating'],
    required: false,
    order: 1,
    active: true,
    followUpOnly: true, // Typically asked on follow-ups
  },
  {
    id: 'default_exudate_level',
    title: 'EXUDATE - Volume / Level',
    type: 'chip_single',
    options: ['None', 'Scant', 'Moderate', 'Heavy'],
    required: false,
    order: 2,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_exudate_type',
    title: 'EXUDATE - Type',
    type: 'chip_single',
    options: ['Serous', 'Sanguineous', 'Serosanguineous', 'Purulent'],
    required: false,
    order: 3,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_infection',
    title: 'INFECTION SIGNS',
    type: 'chip_multi',
    options: ['Erythema', 'Local warmth', 'Edema', 'Purulent discharge', 'Malodor', 'Increased pain', 'Fever/systemic signs'],
    required: false,
    order: 4,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_pain',
    title: 'PAIN LEVEL (0-10)',
    type: 'numeric',
    options: null,
    required: false,
    order: 5,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_edges',
    title: 'EDGES',
    type: 'chip_single',
    options: ['Well-defined', 'Rolled', 'Undermined', 'Macerated', 'Callused'],
    required: false,
    order: 6,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_periwound',
    title: 'PERIWOUND',
    type: 'chip_single',
    options: ['Healthy', 'Dry/Flaky', 'Macerated', 'Erythematous', 'Fragile'],
    required: false,
    order: 7,
    active: true,
    followUpOnly: false,
  },
  {
    id: 'default_comorbidities',
    title: 'COMORBIDITIES',
    type: 'chip_multi',
    options: ['Diabetes', 'Hypertension', 'CVD', 'CKD', 'PVD', 'Obesity', 'Smoking', 'Immunocompromised', 'None'],
    required: false,
    order: 8,
    active: true,
    followUpOnly: false,
  },
];

interface AssessmentQuestionsState {
  questions: AssessmentQuestion[];
  loading: boolean;
  error: string | null;
  fetchQuestions: () => Promise<void>;
}

export const useAssessmentQuestions = create<AssessmentQuestionsState>((set) => ({
  questions: DEFAULT_QUESTIONS,
  loading: false,
  error: null,
  fetchQuestions: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('AssessmentQuestion')
        .select('*')
        .eq('active', true)
        .order('order', { ascending: true });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        set({ questions: data as AssessmentQuestion[], loading: false });
      } else {
        // Use defaults if table is empty
        set({ questions: DEFAULT_QUESTIONS, loading: false });
      }
    } catch (err: any) {
      console.error('Error fetching assessment questions, falling back to defaults:', err.message);
      // Fallback to default if table doesn't exist or offline
      set({ questions: DEFAULT_QUESTIONS, loading: false, error: err.message });
    }
  },
}));
