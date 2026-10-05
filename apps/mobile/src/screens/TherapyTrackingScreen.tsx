import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { QuestionAnswer } from '@antigravity-project-spec-pack/domain/questions';
import { FormLayout } from '../components/FormLayout';
import { QuestionField } from '../components/QuestionField';
import { Text } from '../components/Typography';
import { PHASE_NAME } from '../lib/format';
import { askedQuestions, useQuestionCatalog } from '../lib/questionCatalog';
import {
  answerFor,
  answerKey,
  answersFrom,
  fieldAnswer,
  isAnswered,
  listAnswer,
  responsesFrom,
  textAnswer,
  type Answers,
} from '../lib/questionAnswers';
import { colors, radii, spacing } from '../lib/theme';
import { useTreatmentContext } from '../lib/treatmentContext';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  TherapyTracking: { treatmentId: string };
};

/** The care record, asked after the post-treatment image. Its questions come from the admin-edited catalog. */
export const TherapyTrackingScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'TherapyTracking'>>();
  const treatmentId = route.params?.treatmentId;
  const { treatment, patientName, visit } = useTreatmentContext(treatmentId);
  const updateTreatment = useVisitStore((state) => state.updateTreatment);
  const completePostPhase = useVisitStore((state) => state.completePostPhase);
  const catalog = useQuestionCatalog((state) => state.questions);
  const refreshCatalog = useQuestionCatalog((state) => state.refresh);
  const isFollowUp = (treatment?.sequenceNumber || 1) > 1;

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const [answers, setAnswers] = useState<Answers>(() => answersFrom(treatment?.therapy, treatment?.therapy?.responses));
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const questionOffsets = useRef<Record<string, number>>({});

  const asked = askedQuestions(catalog, 'care', isFollowUp);
  const unanswered = asked.filter((q) => q.required && !isAnswered(q, answers));

  if (!treatment || !treatmentId) {
    return (
      <FormLayout mode="step" title="Care provided" onClose={() => navigation.goBack()}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Treatment not found</Text>
          <Text style={styles.notFoundBody}>Go back to the case and open the treatment again.</Text>
        </View>
      </FormLayout>
    );
  }

  const setAnswer = (key: string, value: QuestionAnswer) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setSubmitted(true);
    if (unanswered.length > 0) {
      const offset = questionOffsets.current[unanswered[0].id];
      if (offset !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, offset - spacing.md), animated: true });
      return;
    }

    const field = (key: string) => fieldAnswer(asked, answers, key);
    const nextVisit = textAnswer(field('nextVisitDate'));
    updateTreatment(treatmentId, {
      therapy: {
        therapyGiven: listAnswer(field('therapyGiven')),
        dressingType: textAnswer(field('dressingType')),
        ...(nextVisit ? { nextVisitDate: nextVisit } : {}),
        responses: responsesFrom(asked, answers),
      },
    });

    completePostPhase(treatmentId);
    // Back to the case the capture flow started from, rather than stacking a second copy on top of it.
    navigation.popTo('CaseDetail', { caseId: treatment.caseId });
  };

  return (
    <FormLayout
      mode="step"
      title="Care provided"
      subtitle={
        <>
          {patientName && (
            <>
              <Text style={styles.patientName}>{patientName}</Text>,{' '}
            </>
          )}
          {visit}
        </>
      }
      accessory={
        <View style={styles.phaseTag}>
          <Text style={styles.phaseTagText}>{PHASE_NAME.post}</Text>
        </View>
      }
      onClose={() => navigation.goBack()}
      submitLabel="Complete treatment"
      onSubmit={handleSave}
      scrollRef={scrollRef}
    >
      {asked.length === 0 && <Text style={styles.empty}>No care questions are set up. Complete the treatment to finish.</Text>}
      {asked.map((question, i) => {
        const value = answerFor(question, answers);
        return (
          <View
            key={question.id}
            style={[styles.question, i > 0 && styles.questionDivider]}
            onLayout={(event) => {
              questionOffsets.current[question.id] = event.nativeEvent.layout.y;
            }}
          >
            <QuestionField
              question={question}
              value={value}
              onChange={(next) => setAnswer(answerKey(question), next)}
              error={submitted && question.required && value === undefined ? 'Choose an option to continue.' : undefined}
            />
          </View>
        );
      })}
    </FormLayout>
  );
};

const styles = StyleSheet.create({
  patientName: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phaseTag: {
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.small,
    backgroundColor: colors.surfacePressed,
  },
  phaseTagText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  question: {
    paddingVertical: 20,
  },
  questionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  empty: {
    marginTop: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  notFound: {
    marginTop: spacing.lg,
  },
  notFoundTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  notFoundBody: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
