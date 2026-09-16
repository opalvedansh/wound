import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { PremiumCard } from '../components/PremiumCard';
import { Text } from '../components/Typography';
import { spacing } from '../lib/theme';

export const AIProcessingScreen = () => {
  const navigation = useNavigation<any>();
  return (
    <PremiumScreen scrollable>
      <View style={styles.header}>
        <Text variant="caption" style={styles.caption}>SCREEN: AIPROCESSING</Text>
        <Text variant="h1" style={styles.title}>Analyzing...</Text>
        <Text variant="body" style={styles.desc}>Running localized segmentation models.</Text>
      </View>
      <View style={styles.actions}>
        <PremiumButton title="View Results (Simulate)" onPress={() => navigation.replace('AIResult')} variant="primary" style={styles.button} />
      </View>
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xxl,
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
  actions: {
    gap: spacing.md,
  },
  button: {
    width: '100%',
  }
});
