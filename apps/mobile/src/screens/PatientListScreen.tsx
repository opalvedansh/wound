import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumCard } from '../components/PremiumCard';
import { colors, spacing, shadows } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { useVisitStore } from '../store/useVisitStore';

export const PatientListScreen = () => {
  const navigation = useNavigation<any>();
  const patients = useVisitStore((state) => state.patients);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.badgeLabelContainer}>
              <View style={styles.badgeDot} />
              <Text variant="caption" style={styles.activeRosterText}>Active Roster</Text>
            </View>
            <Text variant="h1" style={styles.pageTitle}>Patients</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('AccountSettings')} style={styles.avatar}>
            <Text variant="bodyMedium" style={styles.avatarText}>DC</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => {}} style={styles.searchBar}>
          <Feather name="search" size={20} color={colors.textTertiary} />
          <Text variant="body" style={styles.searchText}>Search patients...</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text variant="h3" style={styles.sectionTitle}>All Patients ({patients.length})</Text>
        </View>

        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconContainer}>
              <Feather name="users" size={32} color={colors.accent} />
            </View>
            <Text variant="h3" style={styles.emptyStateTitle}>No Patients Yet</Text>
            <Text variant="body" style={styles.emptyStateBody}>
              Tap the + button to register a new patient.
            </Text>
          </View>
        ) : (
          patients.map((patient) => {
            const initials = `${patient.firstName[0] || ''}${patient.lastName[0] || ''}`.toUpperCase();
            
            return (
              <PremiumCard 
                key={patient.id} 
                onPress={() => navigation.navigate('Patient', { patientId: patient.id })} 
                style={styles.patientCard} 
                noPadding
              >
                <View style={styles.cardInner}>
                  <View style={styles.patientMainRow}>
                    <View style={styles.patientAvatar}>
                      <Text style={styles.patientAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.patientInfo}>
                      <Text variant="h3" style={styles.patientName} numberOfLines={1}>
                        {patient.firstName} {patient.lastName}
                      </Text>
                      <Text variant="body" style={styles.patientMeta}>
                        {patient.patientId} • {patient.sex} • {patient.dob}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.metaRow}>
                    <View style={[styles.syncBadge, patient.syncState === 'synced' ? styles.syncBadgeSuccess : styles.syncBadgeWarning]}>
                      <Feather 
                        name={patient.syncState === 'synced' ? "check-circle" : "clock"} 
                        size={12} 
                        color={patient.syncState === 'synced' ? colors.success : colors.warning} 
                        style={{ marginRight: 4 }} 
                      />
                      <Text style={[styles.syncBadgeText, { color: patient.syncState === 'synced' ? colors.success : colors.warning }]}>
                        {patient.syncState === 'synced' ? 'Synced' : 'Pending Sync'}
                      </Text>
                    </View>
                  </View>
                </View>
              </PremiumCard>
            );
          })
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('PatientIntake')} activeOpacity={0.9}>
          <Feather name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  container: { 
    padding: spacing.lg, 
    paddingBottom: 120 
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xl, 
    marginTop: spacing.md 
  },
  badgeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  activeRosterText: {
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  pageTitle: {
    color: colors.textPrimary,
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: colors.textPrimary, 
    alignItems: 'center', 
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(17,24,39,0.2)',
    elevation: 4,
  },
  avatarText: { 
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 99, 
    marginBottom: spacing.xl,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.04)',
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  searchText: { 
    color: colors.textTertiary, 
    marginLeft: 12,
    fontSize: 16,
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
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: spacing.xxl, 
    marginTop: spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
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
  emptyStateTitle: { 
    textAlign: 'center', 
    marginBottom: spacing.xs 
  },
  emptyStateBody: { 
    textAlign: 'center', 
    color: colors.textSecondary,
    maxWidth: '70%',
  },
  patientCard: {
    marginBottom: spacing.md,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 4px 12px rgba(0,0,0,0.04)',
    elevation: 2,
  },
  cardInner: {
    padding: spacing.lg,
  },
  patientMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  patientAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    marginBottom: 2,
  },
  patientMeta: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  metaRow: { 
    flexDirection: 'row', 
    marginTop: spacing.md, 
    paddingTop: spacing.md, 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9' 
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncBadgeSuccess: {
    backgroundColor: '#DCFCE7', // Very light green
  },
  syncBadgeWarning: {
    backgroundColor: '#FEF3C7', // Very light amber
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fabContainer: { 
    position: 'absolute', 
    bottom: spacing.xl, 
    right: spacing.lg,
  },
  fab: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: colors.accent, 
    alignItems: 'center', 
    justifyContent: 'center', 
    boxShadow: '0px 8px 16px rgba(0,91,79,0.4)',
    elevation: 8 
  }
});