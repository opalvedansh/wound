import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_QUESTIONS,
  QUESTION_FORMS,
  QUESTION_TYPES,
  questionsFor,
  type Question,
  type QuestionForm,
} from '@antigravity-project-spec-pack/domain/questions';
import { secureStorage } from '../store/secureStorage';
import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:3333/api' : '')).replace(/\/+$/, '');

interface QuestionCatalogState {
  /** Every question, hidden ones included, as last loaded from the API. The built-in defaults until then. */
  questions: Question[];
  loadedAt: string | null;
  /** Loads the catalog admins edit in the web portal. Offline or signed out, the cached copy stays in use. */
  refresh: () => Promise<void>;
}

const isQuestion = (value: unknown): value is Question => {
  const q = value as Question;
  return (
    !!q &&
    typeof q.id === 'string' &&
    typeof q.title === 'string' &&
    QUESTION_FORMS.includes(q.form) &&
    QUESTION_TYPES.includes(q.type) &&
    (q.type === 'numeric' || (Array.isArray(q.options) && q.options.every((o) => typeof o === 'string')))
  );
};

export const useQuestionCatalog = create<QuestionCatalogState>()(
  persist(
    (set) => ({
      questions: DEFAULT_QUESTIONS,
      loadedAt: null,
      refresh: async () => {
        if (!API_URL) return;
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) return;
          const response = await fetch(`${API_URL}/questions?includeHidden=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) return;
          const body: unknown = await response.json();
          const questions = Array.isArray(body) ? body.filter(isQuestion) : [];
          if (questions.length > 0) set({ questions, loadedAt: new Date().toISOString() });
        } catch {
          // Offline or the API is down: keep asking the cached questions.
        }
      },
    }),
    {
      name: 'question-catalog-v1',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ questions: state.questions, loadedAt: state.loadedAt }),
    },
  ),
);

/** The questions of a form asked on this visit, in order. */
export const askedQuestions = (questions: Question[], form: QuestionForm, isFollowUp: boolean) =>
  questionsFor(questions, form).filter((q) => q.active && (!q.followUpOnly || isFollowUp));
