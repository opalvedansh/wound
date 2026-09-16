import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  CaseDetail: { caseId: string };
};

export const CaseDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'CaseDetail'>>();
  const caseId = route.params?.caseId;

  const woundCase = useVisitStore((state) => state.cases.find(c => c.id === caseId));
  const allTreatments = useVisitStore((state) => state.treatments);
  const treatments = allTreatments.filter(t => t.caseId === caseId).sort((a,b) => a.sequenceNumber - b.sequenceNumber);
  const addTreatment = useVisitStore((state) => state.addTreatment);
  
  if (!woundCase) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Feather name="arrow-left" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text variant="h3" style={{ color: '#111827' }}>Case not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasBaseline = treatments.length > 0;
  
  const handleStartVisit = () => {
    const newTreatmentId = addTreatment(caseId);
    navigation.navigate('Camera', { treatmentId: newTreatmentId, step: 'pre' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Feather name="more-horizontal" size={24} color="#111827" />
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerGroup}>
          <View style={styles.badgeRow}>
            <View style={styles.caseBadge}>
              <Text style={styles.caseBadgeText}>ID: {woundCase.id.toUpperCase()}</Text>
            </View>
            <View style={styles.dateBadge}>
              <Feather name="calendar" size={12} color="#4B5563" />
              <Text style={styles.dateBadgeText}>{woundCase.onsetDate}</Text>
            </View>
          </View>
          <Text style={styles.titleText}>{woundCase.woundLocation}</Text>
        </View>
        
        {!hasBaseline ? (
          <View style={styles.baselineCard}>
            <View style={styles.baselineIconContainer}>
              <Feather name="file-text" size={24} color="#111827" />
            </View>
            <Text style={styles.baselineTitle}>Initial Assessment Required</Text>
            <Text style={styles.baselineDesc}>
              Please complete the baseline clinical assessment to begin tracking this wound's progression.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartVisit}>
              <Text style={styles.primaryButtonText}>Start Baseline Visit</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.metricsContainer}>
              <View style={styles.metricBlock}>
                <View style={styles.metricLabelRow}>
                  <Feather name="activity" size={14} color="#9CA3AF" style={{marginRight: 4}} />
                  <Text style={styles.metricLabel}>WOUND TYPE</Text>
                </View>
                <Text style={styles.metricValue}>
                  {treatments[0].assessment?.woundType || 'Pending'}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricBlock}>
                <View style={styles.metricLabelRow}>
                  <Feather name="target" size={14} color="#9CA3AF" style={{marginRight: 4}} />
                  <Text style={styles.metricLabel}>PAIN LEVEL</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={[styles.metricValue, treatments[0].assessment?.pain! > 5 && { color: '#EF4444' }]}>
                    {treatments[0].assessment?.pain ?? '--'}
                  </Text>
                  <Text style={styles.metricSubValue}> / 10</Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineSection}>
              <Text style={styles.sectionTitle}>Treatment History</Text>
              
              <View style={styles.timelineContainer}>
                {treatments.map((t, index) => {
                  const isLast = index === treatments.length - 1;
                  const isCompleted = t.phase === 'COMPLETED';
                  
                  return (
                    <View key={t.id} style={styles.timelineRow}>
                      {/* Timeline Graphic */}
                      <View style={styles.timelineGraphic}>
                        <View style={[styles.timelineDot, isCompleted && styles.timelineDotCompleted]} />
                        {!isLast && <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />}
                      </View>
                      
                      {/* Timeline Content */}
                      <TouchableOpacity 
                        activeOpacity={0.7}
                        style={styles.timelineCard}
                        onPress={() => {
                          if (t.phase === 'PRE') navigation.navigate('Camera', { treatmentId: t.id, step: 'pre' });
                          else if (t.phase === 'POST') navigation.navigate('Camera', { treatmentId: t.id, step: 'post' });
                          else navigation.navigate('TreatmentDetail', { treatmentId: t.id });
                        }}
                      >
                        <View style={styles.timelineCardHeader}>
                          <Text style={styles.timelineCardTitle}>
                            T{t.sequenceNumber} <Text style={{fontWeight: '400', color: '#6B7280'}}>• {index === 0 ? 'Baseline' : 'Follow-up'}</Text>
                          </Text>
                          <View style={[styles.statusPill, isCompleted ? styles.statusPillCompleted : styles.statusPillActive]}>
                            <Text style={[styles.statusPillText, isCompleted ? styles.statusTextCompleted : styles.statusTextActive]}>
                              {isCompleted ? 'COMPLETED' : t.phase}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.timelineCardDesc}>
                          {isCompleted ? 'Review clinical notes and captured imagery.' : 'Tap to continue the active assessment.'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.footerAction}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleStartVisit}>
                <Feather name="plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>New Assessment (T{treatments.length + 1})</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  navBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.lg,
    backgroundColor: '#FFFFFF'
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  container: { 
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120 
  },
  headerGroup: {
    marginBottom: spacing.xxl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  caseBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  caseBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.6,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  titleText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: '#0F172A',
    lineHeight: 48,
    marginTop: spacing.xs,
  },
  baselineCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    padding: spacing.xl,
    marginTop: spacing.sm,
  },
  baselineIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  baselineTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: spacing.sm,
  },
  baselineDesc: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    height: 52,
    backgroundColor: '#E2E8F0',
    marginHorizontal: spacing.lg,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  metricSubValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
  },
  timelineSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: spacing.xl,
    letterSpacing: -0.5,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  timelineGraphic: {
    width: 24,
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#D1D5DB',
    zIndex: 2,
  },
  timelineDotCompleted: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  timelineLine: {
    position: 'absolute',
    top: 16,
    bottom: -40,
    width: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 1,
  },
  timelineLineCompleted: {
    backgroundColor: '#111827',
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: spacing.lg,
    paddingVertical: spacing.xl,
    marginTop: -8, // Align with dot
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timelineCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillActive: {
    backgroundColor: '#FEF3C7',
  },
  statusPillCompleted: {
    backgroundColor: '#F3F4F6',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: '#D97706',
  },
  statusTextCompleted: {
    color: '#6B7280',
  },
  timelineCardDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footerAction: {
    marginTop: spacing.xl,
  }
});