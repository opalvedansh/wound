import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Text } from '../components/Typography';
import { PremiumCard } from '../components/PremiumCard';
import { PremiumButton } from '../components/PremiumButton';
import { colors, spacing } from '../lib/theme';
import Feather from '@expo/vector-icons/Feather';
import { useVisitStore } from '../store/useVisitStore';

export const PhaseOverviewScreen = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { imageCaptured, clinicalDataSaved, aiProcessed, resetVisit } = useVisitStore();

  // Reset state when entering the screen fresh from Case Detail
  // For the prototype, we can assume PhaseOverview represents a fresh start if we want to demo it,
  // but to prevent losing state when navigating back from other screens, we won't reset on focus 
  // unless we pass a param. We'll leave it simple for now.

  const renderCTA = () => {
    if (!imageCaptured) {
      return (
        <PremiumButton 
          title="Capture Image" 
          icon="camera"
          onPress={() => navigation.navigate('Camera')} 
        />
      );
    }
    if (!clinicalDataSaved) {
      return (
        <PremiumButton 
          title="Add Clinical Data" 
          icon="file-text"
          onPress={() => navigation.navigate('ClinicalAssessment')} 
        />
      );
    }
    if (!aiProcessed) {
      return (
        <PremiumButton 
          title="Process with AI" 
          icon="cpu"
          variant="accent"
          onPress={() => navigation.navigate('AIProcessing')} 
        />
      );
    }
    return (
      <PremiumButton 
        title="View Results" 
        icon="check-circle"
        variant="primary"
        onPress={() => navigation.navigate('AIResult')} 
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => { resetVisit(); navigation.goBack(); }}><Feather name="chevron-left" size={28} color={colors.textPrimary} /></TouchableOpacity>
        <Text variant="caption">T3: ASSESSMENT</Text>
        <View style={{width:28}}/>
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <View style={styles.phaseBadge}>
            <Text variant="caption" style={{ color: colors.accent }}>PRE-TREATMENT</Text>
          </View>

          <View style={styles.mainImgContainer}>
          {imageCaptured ? (
            <Feather name="check" size={48} color={colors.primary} />
          ) : (
            <Feather name="image" size={48} color={colors.border} />
          )}
        </View>

        {clinicalDataSaved && (
          <>
            <View style={styles.sectionHeader}>
              <Text variant="h3">Clinical Questions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ClinicalAssessment')}><Text variant="bodyMedium" style={{color: colors.accent}}>Edit</Text></TouchableOpacity>
            </View>
            <PremiumCard style={{ marginBottom: spacing.xxl }}>
              <View style={styles.qRow}>
                <Text variant="bodyMedium">Exudate Level</Text>
                <Text variant="body">Moderate</Text>
              </View>
              <View style={styles.qRow}>
                <Text variant="bodyMedium">Infection Signs</Text>
                <Text variant="body">None</Text>
              </View>
            </PremiumCard>
          </>
        )}

        </ScrollView>
        <View style={styles.ctaContainer}>
          {renderCTA()}
        </View>
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  phaseBadge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.accentLight, borderRadius: 4, marginBottom: spacing.md },
  mainImgContainer: { width: '100%', height: 320, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.lg },
  qRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }
});