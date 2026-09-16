import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumCard } from '../components/PremiumCard';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  Patient: { patientId: string };
};

export const PatientScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'Patient'>>();
  const patientId = route.params?.patientId;

  const allPatients = useVisitStore((state) => state.patients);
  const patient = allPatients.find(p => p.id === patientId);
  
  const allCases = useVisitStore((state) => state.cases);
  const cases = allCases.filter(c => c.patientId === patientId);

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text variant="h3">Patient not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (patient.firstName[0] + patient.lastName[0]).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Feather name="settings" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Text variant="h1" style={styles.avatarText}>{initials}</Text>
          </View>
          <Text variant="h1" style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
          <Text variant="bodyMedium" style={styles.patientMeta}>
            ID: {patient.patientId} • {patient.sex} • DOB: {patient.dob}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="h3" style={styles.sectionTitle}>Wound Cases ({cases.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('NewCase', { patientId: patient.id })} style={styles.addButton}>
            <Feather name="plus" size={16} color={colors.accent} />
            <Text variant="bodyMedium" style={styles.addButtonText}>New Case</Text>
          </TouchableOpacity>
        </View>

        {cases.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIconContainer}>
              <Feather name="folder-plus" size={32} color={colors.accent} />
            </View>
            <Text variant="body" style={styles.emptyStateBody}>
              No active cases. Tap "New Case" to start.
            </Text>
          </View>
        ) : (
          cases.map(c => (
            <PremiumCard key={c.id} onPress={() => navigation.navigate('CaseDetail', { caseId: c.id })} style={styles.caseCard} noPadding>
              <View style={styles.caseHeader}>
                <Text variant="h3" style={styles.caseTitle}>Case: {c.woundLocation}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>ACTIVE</Text>
                </View>
              </View>
              <View style={styles.caseBody}>
                <View style={styles.metaRow}>
                  <View style={styles.metaIconContainer}>
                    <Feather name="map-pin" size={16} color={colors.textSecondary} />
                  </View>
                  <Text variant="body" style={styles.metaText}>{c.woundLocation}</Text>
                </View>
                <View style={styles.metaRow}>
                  <View style={styles.metaIconContainer}>
                    <Feather name="calendar" size={16} color={colors.textSecondary} />
                  </View>
                  <Text variant="body" style={styles.metaText}>Onset: {c.onsetDate}</Text>
                </View>
              </View>
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  navBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md,
    backgroundColor: '#F8FAFC'
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  container: { 
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: spacing.xxl 
  },
  avatarLarge: { 
    width: 96, 
    height: 96, 
    borderRadius: 48, 
    backgroundColor: colors.textPrimary, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
  },
  patientName: {
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontSize: 28,
  },
  patientMeta: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.lg 
  },
  sectionTitle: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  addButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#DCFCE7', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 99,
  },
  addButtonText: {
    color: colors.accent, 
    marginLeft: 6,
    fontWeight: '600',
  },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: spacing.xl 
  },
  emptyStateCard: {
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: spacing.xxl,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: spacing.md,
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateBody: { 
    textAlign: 'center', 
    color: colors.textSecondary,
  },
  caseCard: { 
    marginBottom: spacing.lg,
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  caseHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.lg, 
    backgroundColor: colors.textPrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  caseTitle: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  statusBadge: { 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  statusText: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: '700', 
    letterSpacing: 0.5 
  },
  caseBody: { 
    padding: spacing.xl, 
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  metaRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metaIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  metaText: {
    fontSize: 16,
    color: colors.textSecondary,
  }
});