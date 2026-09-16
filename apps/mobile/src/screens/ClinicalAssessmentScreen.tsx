import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { Text } from '../components/Typography';
import { PremiumCard } from '../components/PremiumCard';
import { spacing, colors } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';
import { useAssessmentQuestions, AssessmentQuestion } from '../lib/useAssessmentQuestions';
import Feather from '@expo/vector-icons/Feather';

type ParamList = {
  ClinicalAssessment: { treatmentId: string };
};

const Chip = ({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) => (
  <TouchableOpacity 
    style={[styles.chip, selected && styles.chipSelected]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text variant="bodyMedium" style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const ChipGroup = ({ options, selected, onChange, multi = false }: { options: string[], selected: string | string[], onChange: (val: any) => void, multi?: boolean }) => {
  return (
    <View style={styles.chipGroup}>
      {options.map(opt => {
        const isSelected = multi ? (selected as string[]).includes(opt) : selected === opt;
        return (
          <Chip 
            key={opt} 
            label={opt} 
            selected={isSelected} 
            onPress={() => {
              if (multi) {
                const arr = selected as string[];
                onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
              } else {
                onChange(opt);
              }
            }} 
          />
        );
      })}
    </View>
  );
};

export const ClinicalAssessmentScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ClinicalAssessment'>>();
  const treatmentId = route.params?.treatmentId;
  const { updateTreatment, completePrePhase, treatments } = useVisitStore();
  const treatment = treatments.find(t => t.id === treatmentId);
  const isFollowUp = (treatment?.sequenceNumber || 1) > 1;

  const { questions, fetchQuestions, loading } = useAssessmentQuestions();
  
  React.useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const [answers, setAnswers] = useState<Record<string, any>>({
    default_wound_type: treatment?.assessment?.woundType || '',
    default_exudate_level: treatment?.assessment?.exudateLevel || '',
    default_exudate_type: treatment?.assessment?.exudateType || '',
    default_infection: treatment?.assessment?.infectionSigns || [],
    default_pain: treatment?.assessment?.pain ?? 0,
    default_edges: treatment?.assessment?.edgeCondition || '',
    default_periwound: treatment?.assessment?.periwoundCondition || '',
    default_comorbidities: treatment?.assessment?.comorbidities || [],
    default_trend: treatment?.assessment?.woundAppearanceTrend || '',
  });

  const setAnswer = (id: string, val: any) => setAnswers(prev => ({ ...prev, [id]: val }));

  const handleSave = () => {
    updateTreatment(treatmentId, {
      assessment: {
        woundType: answers.default_wound_type || answers.woundType,
        exudateLevel: answers.default_exudate_level || answers.exudateLevel,
        exudateType: answers.default_exudate_type || answers.exudateType,
        infectionSigns: answers.default_infection || answers.infectionSigns || [],
        pain: answers.default_pain ?? answers.pain ?? 0,
        edgeCondition: answers.default_edges || answers.edgeCondition,
        periwoundCondition: answers.default_periwound || answers.periwoundCondition,
        comorbidities: answers.default_comorbidities || answers.comorbidities || [],
        ...(isFollowUp ? { woundAppearanceTrend: answers.default_trend || answers.woundAppearanceTrend } : {})
      }
    });
    
    completePrePhase(treatmentId);
    navigation.navigate('Camera', { treatmentId, step: 'post' });
  };

  return (
    <PremiumScreen scrollable style={{ backgroundColor: '#F8FAFC' }}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Text variant="caption" style={styles.headerBadgeText}>CLINICAL ASSESSMENT</Text>
          </View>
        </View>
        <Text variant="h1" style={styles.title}>Clinical Parameters</Text>
        <Text variant="body" style={styles.desc}>Record current clinical presentation.</Text>
      </View>

      {questions.filter(q => q.active && (!q.followUpOnly || isFollowUp)).map(q => {
        if (q.type === 'numeric') {
          const val = answers[q.id] ?? 0;
          return (
            <PremiumCard key={q.id} style={styles.card}>
              <Text variant="caption" style={styles.sectionTitle}>{q.title}{q.required ? ' *' : ''}</Text>
              <View style={styles.painStepper}>
                <TouchableOpacity
                  style={styles.painStepBtn}
                  onPress={() => setAnswer(q.id, Math.max(0, val - 1))}
                  activeOpacity={0.7}
                >
                  <Feather name="minus" size={22} color={colors.textPrimary} />
                </TouchableOpacity>

                <View style={styles.painValueBox}>
                  <Text
                    style={[
                      styles.painNumber,
                      val >= 7 && { color: '#EF4444' },
                      val >= 4 && val < 7 && { color: '#F59E0B' },
                    ]}
                  >
                    {val}
                  </Text>
                  <Text style={styles.painOutOf}>/ 10</Text>
                </View>

                <TouchableOpacity
                  style={styles.painStepBtn}
                  onPress={() => setAnswer(q.id, Math.min(10, val + 1))}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.painDots}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setAnswer(q.id, n)}
                    style={[
                      styles.painDot,
                      val === n && styles.painDotActive,
                      n >= 7 && val === n && styles.painDotHighRisk,
                    ]}
                  />
                ))}
              </View>
            </PremiumCard>
          );
        }

        return (
          <PremiumCard key={q.id} style={styles.card}>
            <Text variant="caption" style={styles.sectionTitle}>{q.title}{q.required ? ' *' : ''}</Text>
            <ChipGroup 
              options={q.options || []}
              selected={answers[q.id] || (q.type === 'chip_multi' ? [] : '')}
              onChange={(val) => setAnswer(q.id, val)}
              multi={q.type === 'chip_multi'}
            />
          </PremiumCard>
        );
      })}

      <View style={styles.actions}>
        <PremiumButton 
          title="Save & Continue" 
          onPress={handleSave} 
          variant="primary" 
          style={styles.button} 
          disabled={questions.some(q => q.required && !answers[q.id])} 
        />
      </View>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerBadge: {
    marginLeft: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  headerBadgeText: {
    color: '#3B82F6',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  desc: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  subLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 20,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipText: {
    color: '#475569',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  painStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  painStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  painValueBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  painNumber: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
    color: colors.textPrimary,
    lineHeight: 60,
  },
  painOutOf: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  painDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  painDot: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  painDotActive: {
    backgroundColor: colors.textPrimary,
    transform: [{ scaleY: 1.4 }],
  },
  painDotHighRisk: {
    backgroundColor: '#EF4444',
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  button: {
    width: '100%',
  }
});
