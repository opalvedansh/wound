import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { Text } from '../components/Typography';
import { spacing, colors } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';

export const AIResultScreen = () => {
  const navigation = useNavigation<any>();
  const { setAiProcessed } = useVisitStore();

  const handleConfirm = () => {
    setAiProcessed(true);
    navigation.navigate('PhaseOverview');
  };

  return (
    <PremiumScreen scrollable>
      <View style={styles.header}>
        <Text variant="caption" style={styles.caption}>SCREEN: AIRESULT</Text>
        <Text variant="h1" style={styles.title}>Tissue Analysis</Text>
        <Text variant="body" style={styles.desc}>Computer Vision model v2.1.4</Text>
      </View>

      <View style={styles.mlCard}>
        <View style={styles.mlBadge}>
          <Text variant="caption" style={{color: colors.accent}}>AI GENERATED</Text>
        </View>

        <View style={styles.dataRow}>
          <Text variant="bodyMedium">Granulation</Text>
          <Text variant="bodyMedium">55%</Text>
        </View>
        <View style={styles.barBackground}><View style={[styles.barFill, {width: '55%', backgroundColor: '#10B981'}]} /></View>

        <View style={styles.dataRow}>
          <Text variant="bodyMedium">Slough</Text>
          <Text variant="bodyMedium">25%</Text>
        </View>
        <View style={styles.barBackground}><View style={[styles.barFill, {width: '25%', backgroundColor: '#F59E0B'}]} /></View>

        <View style={styles.dataRow}>
          <Text variant="bodyMedium">Necrotic</Text>
          <Text variant="bodyMedium">15%</Text>
        </View>
        <View style={styles.barBackground}><View style={[styles.barFill, {width: '15%', backgroundColor: '#111827'}]} /></View>
        
        <View style={styles.dataRow}>
          <Text variant="bodyMedium">Other</Text>
          <Text variant="bodyMedium">5%</Text>
        </View>
        <View style={styles.barBackground}><View style={[styles.barFill, {width: '5%', backgroundColor: '#D1D5DB'}]} /></View>
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Confirm & Save" onPress={handleConfirm} variant="primary" style={styles.button} />
      </View>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
  },
  caption: {
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.sm,
  },
  desc: {
    marginBottom: spacing.lg,
  },
  mlCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  mlBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: spacing.xl,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barBackground: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    marginBottom: spacing.md,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  actions: {
    gap: spacing.md,
  },
  button: {
    width: '100%',
  }
});
