import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PremiumScreen } from '../components/PremiumScreen';
import { PremiumButton } from '../components/PremiumButton';
import { PremiumCard } from '../components/PremiumCard';
import { Text } from '../components/Typography';
import { spacing } from '../lib/theme';

export const SyncStatusScreen = () => {
  const navigation = useNavigation<any>();
  return (
    <PremiumScreen scrollable>
      <View style={styles.header}>
        <Text variant="caption" style={styles.caption}>SCREEN: SYNCSTATUS</Text>
        <Text variant="h1" style={styles.title}>Sync Status</Text>
        <Text variant="body" style={styles.desc}>All cases synced successfully.</Text>
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Return" onPress={() => navigation.goBack()} variant="secondary" style={styles.button} />
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
